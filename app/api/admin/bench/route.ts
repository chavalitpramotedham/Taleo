import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { metricsEnabled, pipeline } from "@/server/metrics";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { generateBenchCases } from "@/server/bench-cases";
import { prepareParts } from "@/server/paint/parts-maker";
import type { CharacterDef } from "@/lib/types";
import { BENCH_SLOTS, legacyVariant, RANK_POINTS, variantOf, type BenchSlot } from "@/lib/bench-ways";
import { hset, KEEP_S, mem, picKey, RUNS, PAGES, type BenchRun, type WayResult } from "@/server/bench";

export const dynamic = "force-dynamic";
// (writing a batch of test pages can take a minute)
export const maxDuration = 300;

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
        const json = <T,>(v: string | undefined): T | undefined => {
          try {
            return v ? (JSON.parse(v) as T) : undefined;
          } catch {
            return undefined;
          }
        };
        return {
          id,
          at: meta.at ?? 0,
          page: meta.page ?? "",
          label: meta.label ?? "",
          ways,
          vote: o.vote || undefined,
          rank: json<string[]>(o.rank),
          rankVariants: json<Record<string, string>>(o.rankv),
          rankOld: json<{ order: string[]; variants: Record<string, string> }[]>(o.rankold),
        };
      } catch {
        return null;
      }
    })
    .filter((r): r is BenchRun => Boolean(r))
    .sort((a, b) => b.at - a.at);
}

/** Each way's record over every run: how often it was voted best, and
 *  what it cost and took on average. */
/** Each variant's record over every run (see lib/bench-ways): how often
 *  it was voted best, and its averages. The current variant of each slot
 *  first, in slot order; then earlier ones, kept for comparison. */
function leaderboard(runs: BenchRun[]) {
  const baseSlot = (key: string) => key.split("@")[0];
  const rows = new Map<string, { slot: string; results: { r: BenchRun; x: WayResult }[] }>();
  const row = (variant: string, slot: string) => {
    if (!rows.has(variant)) rows.set(variant, { slot, results: [] });
    return rows.get(variant)!;
  };
  // (results: each slot's, and any an earlier version painted there before
  // it was painted again - kept under "slot@variant")
  for (const r of runs)
    for (const [key, x] of Object.entries(r.ways)) row(x.variant ?? legacyVariant(baseSlot(key)), baseSlot(key)).results.push({ r, x });
  const current = new Set(BENCH_SLOTS.map((s) => variantOf(s)));
  for (const s of BENCH_SLOTS) row(variantOf(s), s);
  // Scores, from rankings. A ranking gives points by place (RANK_POINTS)
  // to the variant that was in each slot when it was ranked (a vote from
  // before rankings counts as a first place). A ranking that was reset is
  // kept: it still counts for variants no longer in use, so they keep the
  // score they earned, but not for current ones, which are ranked afresh.
  const score = new Map<string, { points: number; ranked: number; first: number }>();
  const give = (variant: string, place: number) => {
    const t = score.get(variant) ?? { points: 0, ranked: 0, first: 0 };
    t.points += RANK_POINTS[place] ?? 0;
    t.ranked += 1;
    if (place === 0) t.first += 1;
    score.set(variant, t);
  };
  const variantIn = (r: BenchRun, slot: string) => r.ways[slot]?.variant ?? (r.ways[slot] ? legacyVariant(slot) : null);
  for (const r of runs) {
    const order = r.rank?.length ? r.rank : r.vote ? [r.vote] : [];
    if (order.length) {
      // (the other painted slots of a run with only a vote: ranked, no points)
      const slots = r.rank?.length ? order : Object.keys(r.ways).filter((k) => !k.includes("@") && r.ways[k].ok);
      for (const slot of slots) {
        const v = r.rankVariants?.[slot] ?? variantIn(r, slot);
        if (v) give(v, order.indexOf(slot) < 0 ? 99 : order.indexOf(slot));
      }
    }
    for (const old of r.rankOld ?? [])
      old.order.forEach((slot, place) => {
        const v = old.variants[slot];
        if (v && !current.has(v)) give(v, place);
      });
  }
  const out = [...rows.entries()].map(([variant, { slot, results }]) => {
    const done = results.filter(({ x }) => x.ok);
    const avg = (pick: (x: WayResult) => number) => (done.length ? done.reduce((t, { x }) => t + pick(x), 0) / done.length : null);
    const sc = score.get(variant) ?? { points: 0, ranked: 0, first: 0 };
    return {
      way: slot,
      variant,
      current: current.has(variant),
      painted: done.length,
      wins: sc.first,
      score: sc.points,
      votedRuns: sc.ranked,
      usd: avg((x) => x.usd),
      out: avg((x) => x.out),
      totalMs: avg((x) => x.totalMs),
      firstMs: avg((x) => x.firstMs ?? 0),
      setupUsd: done.reduce((t, { x }) => t + (x.setupUsd ?? 0), 0),
      // (when it was first tried: the leaderboard numbers variants in the
      // order they were tested)
      firstAt: results.length ? Math.min(...results.map(({ r }) => r.at)) : null,
    };
  });
  const order = (row: { way: string; current: boolean }) => (row.current ? 0 : 10) + Math.max(0, BENCH_SLOTS.indexOf(row.way as BenchSlot));
  return out.sort((a, b) => order(a) - order(b) || a.variant.localeCompare(b.variant));
}

const nope = () => new NextResponse(null, { status: 404 });
const noStore = { "cache-control": "no-store" };

export async function GET(req: Request) {
  if (!(await currentAdmin())) return nope();
  const q = new URL(req.url).searchParams;
  const pr = q.get("picture") ?? "";
  const pw = q.get("way") ?? "";
  if (pr) {
    if (!ID.test(pr) || !/^[1pqx]$/.test(pw)) return NextResponse.json({ svg: null }, { headers: noStore });
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
  const way = typeof b?.way === "string" && /^[1pqx]$/.test(b.way) ? b.way : null;
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
  // New test pages written by the model (the bench turns them into pages
  // with its own characters, and saves them)
  if (b?.kind === "generate") {
    const characters = (Array.isArray(b.characters) ? b.characters : [])
      .filter((c): c is { name: string; look: string } => Boolean(c) && typeof (c as { name?: unknown }).name === "string")
      .slice(0, 40)
      .map((c) => ({ name: String(c.name).slice(0, 60), look: String(c.look ?? "").slice(0, 300) }));
    const existing = (Array.isArray(b.existing) ? b.existing : [])
      .slice(0, 80)
      .map((e) => ({ label: String((e as { label?: unknown })?.label ?? "").slice(0, 80), picture: String((e as { picture?: unknown })?.picture ?? "").slice(0, 200) }));
    try {
      const cases = await generateBenchCases({ count: Number(b.count) || 5, characters, existing });
      return NextResponse.json({ cases });
    } catch (e) {
      console.warn("bench: couldn't generate test pages", e);
      return NextResponse.json({ error: "Couldn't write new test pages just now." }, { status: 502 });
    }
  }
  // Characters' parts made ahead, once for all ways and pages ("Prepare
  // characters"): no page then waits on them, and every way uses the same.
  if (b?.kind === "prepare" && Array.isArray(b.characters)) {
    const list = (b.characters as CharacterDef[]).filter((c) => c && typeof c.name === "string").slice(0, 30);
    const results = await Promise.all(list.map(async (c) => ({ name: c.name, ...(await prepareParts(c).catch(() => ({ ok: false, preset: false }))) })));
    return NextResponse.json({ results });
  }
  if (b?.kind === "rank" && runId && Array.isArray(b.order)) {
    const order = [...new Set((b.order as unknown[]).filter((x): x is string => typeof x === "string" && /^[1pqx]$/.test(x)))];
    // (which variant was in each slot when it was ranked: the slot's way may
    // change later)
    const variants: Record<string, string> = {};
    const given = (b.variants ?? {}) as Record<string, unknown>;
    for (const slot of order) variants[slot] = typeof given[slot] === "string" && /^[\w-]{1,20}$/.test(given[slot] as string) ? (given[slot] as string) : variantOf(slot as BenchSlot);
    await hset(`bench:run:${runId}`, "rank", JSON.stringify(order));
    await hset(`bench:run:${runId}`, "rankv", JSON.stringify(variants));
    return NextResponse.json({ ok: true });
  }
  // A ranking reset: put away (it still counts for variants no longer in
  // use), and the page can be ranked afresh.
  if (b?.kind === "reset-rank" && runId) {
    const run = (await readRuns()).find((r) => r.id === runId);
    if (!run) return NextResponse.json({ ok: false });
    const order = run.rank?.length ? run.rank : run.vote ? [run.vote] : [];
    if (order.length) {
      const variants: Record<string, string> = {};
      for (const slot of order) variants[slot] = run.rankVariants?.[slot] ?? run.ways[slot]?.variant ?? legacyVariant(slot);
      await hset(`bench:run:${runId}`, "rankold", JSON.stringify([...(run.rankOld ?? []), { order, variants }].slice(-20)));
    }
    if (!metricsEnabled()) {
      const m = mem().runs.get(`bench:run:${runId}`);
      if (m) for (const f of ["rank", "rankv", "vote"]) delete m[f];
    } else await pipeline([["HDEL", `bench:run:${runId}`, "rank", "rankv", "vote"]]);
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
