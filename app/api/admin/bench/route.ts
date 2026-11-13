import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { metricsEnabled, pipeline } from "@/server/metrics";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { generateBenchCases } from "@/server/bench-cases";
import { backdropReady, prepareBackdrop } from "@/server/claude";
import { partsReady, prepareParts } from "@/server/paint/parts-maker";
import { prepareSprite, spritesFor } from "@/server/paint/sprite-maker";
import { SPRITE_POSE_IDS, type SpritePose } from "@/lib/art/sprites";
import type { CharacterDef } from "@/lib/types";
import { characterArt } from "@/lib/presets";
import { BENCH_SLOTS, legacyVariant, rankPoints, variantOf, type BenchSlot, SLOT_RE } from "@/lib/bench-ways";
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
  const give = (variant: string, place: number, n: number) => {
    const t = score.get(variant) ?? { points: 0, ranked: 0, first: 0 };
    t.points += rankPoints(place, n);
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
        if (v) give(v, order.indexOf(slot) < 0 ? 99 : order.indexOf(slot), r.rank?.length ? order.length : 4);
      }
    }
    for (const old of r.rankOld ?? [])
      old.order.forEach((slot, place) => {
        const v = old.variants[slot];
        if (v && !current.has(v)) give(v, place, old.order.length);
      });
  }
  const out = [...rows.entries()].map(([variant, { slot, results }]) => {
    // (a painting that fell back to the ordinary way isn't this variant's
    // work: counted apart, not in its averages)
    const done = results.filter(({ x }) => x.ok && !x.fellBack);
    const avg = (pick: (x: WayResult) => number) => (done.length ? done.reduce((t, { x }) => t + pick(x), 0) / done.length : null);
    const sc = score.get(variant) ?? { points: 0, ranked: 0, first: 0 };
    return {
      way: slot,
      variant,
      current: current.has(variant),
      painted: done.length,
      fellBack: results.filter(({ x }) => x.fellBack).length,
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

/** Paintings made (every way of every page, failed ones too), painting
 *  versions used and money spent (set-up included), over a day, a week and
 *  all time. */
function usageOf(runs: BenchRun[]) {
  const now = Date.now();
  const over = (ms: number) => {
    const results = runs.filter((r) => now - r.at <= ms).flatMap((r) => Object.entries(r.ways));
    return {
      paints: results.length,
      versions: new Set(results.map(([k, x]) => x.variant ?? legacyVariant(k.split("@")[0]))).size,
      usd: results.reduce((t, [, x]) => t + (x.usd || 0) + (x.setupUsd || 0), 0),
    };
  };
  return { day: over(86_400_000), week: over(7 * 86_400_000), all: over(Infinity) };
}

const nope = () => new NextResponse(null, { status: 404 });
/** Archived test pages' keys (a list kept on its own). */
const ARCHIVED = "bench:archived";
let memArchived: string[] = [];
const noStore = { "cache-control": "no-store" };

export async function GET(req: Request) {
  if (!(await currentAdmin())) return nope();
  const q = new URL(req.url).searchParams;
  const pr = q.get("picture") ?? "";
  const pw = q.get("way") ?? "";
  if (pr) {
    if (!ID.test(pr) || !SLOT_RE.test(pw)) return NextResponse.json({ svg: null }, { headers: noStore });
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
  // (test pages put away: hidden from the bench's main list, kept)
  let archived: string[] = [];
  if (!metricsEnabled()) archived = [...memArchived];
  else {
    const [v] = await pipeline([["GET", ARCHIVED]]).catch(() => [null]);
    try {
      archived = typeof v === "string" ? (JSON.parse(v) as string[]) : [];
    } catch {}
  }
  // (the bench's own use: over the last day, the last week, and all time -
  // every run, not just those sent)
  const all = await readRuns(20_000);
  return NextResponse.json({ runs: runs.slice(0, 200), leaderboard: leaderboard(runs), pages, archived, usage: usageOf(all) }, { headers: noStore });
}

const ID = /^[\w-]{3,80}$/;

export async function POST(req: Request) {
  if (!(await currentAdmin())) return nope();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const runId = typeof b?.runId === "string" && ID.test(b.runId) ? b.runId : null;
  const way = typeof b?.way === "string" && SLOT_RE.test(b.way) ? b.way : null;
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
  // One pre-painted pose of one character (way 5's "Prepare poses" asks
  // for them one at a time, a few at once, so none runs long)
  if (b?.kind === "prepare-pose" && b.character && typeof b.pose === "string" && (SPRITE_POSE_IDS as string[]).includes(b.pose)) {
    const ok = await prepareSprite(b.character as CharacterDef, b.pose as SpritePose).catch(() => false);
    return NextResponse.json({ ok });
  }
  // What's already prepared: characters with their parts, and poses made,
  // out of those that can have them (looks only, makes nothing).
  if (b?.kind === "prepared" && Array.isArray(b.characters) && Array.isArray(b.cast)) {
    const ok = (c: unknown): c is CharacterDef => Boolean(c && typeof (c as CharacterDef).name === "string");
    const chars = (b.characters as unknown[]).filter(ok).slice(0, 30);
    // (newcomers, with no portrait, have no poses to make)
    const cast = (b.cast as unknown[]).filter(ok).filter((c) => characterArt(c)).slice(0, 80);
    const each = await Promise.all(chars.map(async (c) => ({ name: c.name, ready: await partsReady(c).catch(() => false) })));
    const parts = each.filter((x) => x.ready !== null);
    const poses = await Promise.all(cast.map((c) => spritesFor({ ...c, id: "hero" }).catch(() => ({}))));
    const places = Array.isArray(b.places) ? (b.places as { id?: unknown; about?: unknown; light?: unknown }[]).filter((x) => typeof x?.id === "string").slice(0, 120) : [];
    const placesReady = await Promise.all(places.map((pl) => backdropReady({ id: String(pl.id), about: String(pl.about ?? ""), light: String(pl.light ?? "") }, String(b.world ?? "")).catch(() => false)));
    return NextResponse.json({
      places: { ready: placesReady.filter(Boolean).length, of: places.length },
      parts: { ready: parts.filter((x) => x.ready).length, of: parts.length, missing: parts.filter((x) => !x.ready).map((x) => x.name) },
      poses: { ready: poses.reduce<number>((t, x) => t + Object.keys(x).length, 0), of: cast.length * SPRITE_POSE_IDS.length },
    });
  }
  // A place's backdrop painted ahead (shared by every way and page set there).
  if (b?.kind === "prepare-place" && typeof (b.place as { id?: unknown } | undefined)?.id === "string") {
    const pl = b.place as { id: string; about?: string; light?: string };
    const ok = await prepareBackdrop({ id: pl.id.slice(0, 40), about: String(pl.about ?? "").slice(0, 400), light: String(pl.light ?? "").slice(0, 20) }, String(b.world ?? "").slice(0, 400)).catch(() => false);
    return NextResponse.json({ ok });
  }
  if (b?.kind === "prepare" && Array.isArray(b.characters)) {
    const list = (b.characters as CharacterDef[]).filter((c) => c && typeof c.name === "string").slice(0, 30);
    const results = await Promise.all(list.map(async (c) => ({ name: c.name, ...(await prepareParts(c).catch(() => ({ ok: false, preset: false }))) })));
    return NextResponse.json({ results });
  }
  if (b?.kind === "rank" && runId && Array.isArray(b.order)) {
    const order = [...new Set((b.order as unknown[]).filter((x): x is string => typeof x === "string" && SLOT_RE.test(x)))];
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
  // Archive a test page (or bring it back): hidden from the main list
  if (b?.kind === "archive" && typeof b.key === "string" && ID.test(b.key)) {
    let list: string[] = [];
    if (!metricsEnabled()) list = memArchived;
    else {
      const [v] = await pipeline([["GET", ARCHIVED]]).catch(() => [null]);
      try {
        list = typeof v === "string" ? (JSON.parse(v) as string[]) : [];
      } catch {}
    }
    const set = new Set(list);
    if (b.archived === false) set.delete(b.key);
    else set.add(b.key);
    const json = JSON.stringify([...set].slice(-500));
    if (!metricsEnabled()) memArchived = JSON.parse(json) as string[];
    else await pipeline([["SET", ARCHIVED, json]]);
    return NextResponse.json({ ok: true });
  }
  if (b?.kind === "forget-page" && typeof b.key === "string" && ID.test(b.key)) {
    if (!metricsEnabled()) mem().pages.delete(b.key);
    else await pipeline([["HDEL", PAGES, b.key]]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Not understood." }, { status: 400 });
}
