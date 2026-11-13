import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { metricsEnabled, pipeline } from "@/server/metrics";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { hset, KEEP_S, mem, picKey, RUNS, PAGES, type BenchRun, type WayResult } from "@/server/bench";

export const dynamic = "force-dynamic";

/**
 * The painting bench's records (admin only): each run of a page - its four
 * ways of painting, what each cost and took, and which one the admin
 * voted best - and the admin's own test pages. The leaderboard is worked
 * out from the runs.
 *
 * In Redis, one hash per run (a field per way, and one for the vote), so
 * four paintings finishing at once never write over each other; without
 * Redis, in memory.
 */

async function readRuns(limit = 400): Promise<BenchRun[]> {
  let raw: [string, Record<string, string>][];
  if (!metricsEnabled()) raw = [...mem().runs.entries()].map(([k, v]) => [k.slice(10), v]);
  else {
    const [ids] = await pipeline([["ZREVRANGE", RUNS, 0, limit - 1]]);
    const list = (Array.isArray(ids) ? ids : []).map(String);
    if (!list.length) return [];
    const rows = await pipeline(list.map((id) => ["HGETALL", `bench:run:${id}`]));
    raw = list.map((id, i) => {
      const r = rows[i];
      const flat = Array.isArray(r) ? r.map(String) : [];
      const o: Record<string, string> = {};
      for (let j = 0; j + 1 < flat.length; j += 2) o[flat[j]] = flat[j + 1];
      return [id, o];
    });
  }
  return raw
    .map(([id, o]): BenchRun | null => {
      try {
        const meta = JSON.parse(o.meta ?? "{}") as { at?: number; page?: string; label?: string };
        const ways: Record<string, WayResult> = {};
        for (const [k, v] of Object.entries(o)) if (k.startsWith("w")) ways[k.slice(1)] = JSON.parse(v) as WayResult;
        return { id, at: meta.at ?? 0, page: meta.page ?? "", label: meta.label ?? "", ways, vote: o.vote || undefined };
      } catch {
        return null;
      }
    })
    .filter((r): r is BenchRun => Boolean(r))
    .sort((a, b) => b.at - a.at);
}

/** Each way's record over every run: how often it was voted best, and
 *  what it cost and took on average. */
function leaderboard(runs: BenchRun[]) {
  const ways = ["1", "p", "b", "x"];
  return ways.map((w) => {
    const done = runs.filter((r) => r.ways[w]?.ok);
    const voted = runs.filter((r) => r.vote && r.ways[w]?.ok);
    const avg = (pick: (x: WayResult) => number) => (done.length ? done.reduce((t, r) => t + pick(r.ways[w]), 0) / done.length : null);
    return { way: w, painted: done.length, wins: runs.filter((r) => r.vote === w).length, votedRuns: voted.length, usd: avg((x) => x.usd), out: avg((x) => x.out), totalMs: avg((x) => x.totalMs), firstMs: avg((x) => x.firstMs ?? 0) };
  });
}

const nope = () => new NextResponse(null, { status: 404 });
const noStore = { "cache-control": "no-store" };

export async function GET(req: Request) {
  if (!(await currentAdmin())) return nope();
  const q = new URL(req.url).searchParams;
  const pr = q.get("picture") ?? "";
  const pw = q.get("way") ?? "";
  if (pr) {
    if (!ID.test(pr) || !/^[1pbx]$/.test(pw)) return NextResponse.json({ svg: null }, { headers: noStore });
    let svg: string | null = null;
    if (!metricsEnabled()) svg = mem().pics.get(picKey(pr, pw)) ?? null;
    else {
      const [v] = await pipeline([["GET", picKey(pr, pw)]]).catch(() => [null]);
      svg = typeof v === "string" ? v : null;
    }
    return NextResponse.json({ svg }, { headers: noStore });
  }
  const runs = await readRuns();
  let pages: unknown[] = [];
  if (!metricsEnabled()) pages = [...mem().pages.values()].map((v) => JSON.parse(v));
  else {
    const [h] = await pipeline([["HGETALL", PAGES]]);
    const flat = Array.isArray(h) ? h.map(String) : [];
    for (let j = 0; j + 1 < flat.length; j += 2) {
      try {
        pages.push(JSON.parse(flat[j + 1]));
      } catch {}
    }
  }
  return NextResponse.json({ runs: runs.slice(0, 200), leaderboard: leaderboard(runs), pages }, { headers: noStore });
}

const ID = /^[\w-]{3,80}$/;

export async function POST(req: Request) {
  if (!(await currentAdmin())) return nope();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const runId = typeof b?.runId === "string" && ID.test(b.runId) ? b.runId : null;
  const way = typeof b?.way === "string" && /^[1pbx]$/.test(b.way) ? b.way : null;
  if (b?.kind === "start" && runId) {
    const meta = { at: Date.now(), page: String(b.page ?? "").slice(0, 80), label: String(b.label ?? "").slice(0, 200) };
    await hset(`bench:run:${runId}`, "meta", JSON.stringify(meta));
    if (metricsEnabled()) await pipeline([["ZADD", RUNS, meta.at, runId]]);
    return NextResponse.json({ ok: true });
  }
  if (b?.kind === "result" && runId && way) {
    const r = (b.result ?? {}) as Partial<WayResult>;
    const clean: WayResult = { usd: Number(r.usd) || 0, out: Number(r.out) || 0, totalMs: Number(r.totalMs) || 0, firstMs: Number(r.firstMs) || 0, ok: Boolean(r.ok), genId: typeof r.genId === "string" && ID.test(r.genId) ? r.genId : undefined, summary: String(r.summary ?? "").slice(0, 600) };
    await hset(`bench:run:${runId}`, `w${way}`, JSON.stringify(clean));
    return NextResponse.json({ ok: true });
  }
  if (b?.kind === "picture" && runId && way && typeof b.svg === "string") {
    const svg = sanitizeSvg(b.svg, 400_000);
    if (!svg) return NextResponse.json({ ok: false });
    if (!metricsEnabled()) mem().pics.set(picKey(runId, way), svg);
    else await pipeline([["SET", picKey(runId, way), svg, "EX", KEEP_S]]);
    return NextResponse.json({ ok: true });
  }
  if (b?.kind === "vote" && runId && way) {
    await hset(`bench:run:${runId}`, "vote", way);
    return NextResponse.json({ ok: true });
  }
  if (b?.kind === "page" && b.page && typeof b.page === "object") {
    const p = b.page as Record<string, unknown>;
    const id = typeof p.key === "string" && ID.test(p.key) ? p.key : null;
    if (!id) return NextResponse.json({ error: "No page id." }, { status: 400 });
    await hset(PAGES, id, JSON.stringify(p).slice(0, 20000));
    return NextResponse.json({ ok: true });
  }
  if (b?.kind === "forget-page" && typeof b.key === "string" && ID.test(b.key)) {
    if (!metricsEnabled()) mem().pages.delete(b.key);
    else await pipeline([["HDEL", PAGES, b.key]]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Not understood." }, { status: 400 });
}
