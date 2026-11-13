import { metricsEnabled, pipeline } from "./metrics";
import { getGen } from "./genlog";
import { sanitizeSvg } from "@/lib/svg-sanitize";

/**
 * The painting bench's storage (see app/api/admin/bench): runs, their
 * results and pictures, and the admin's own test pages.
 *
 * In Redis, one hash per run (a field per way, and one for the vote), so
 * four paintings finishing at once never write over each other; without
 * Redis, in memory.
 */
export interface WayResult {
  usd: number;
  out: number;
  totalMs: number;
  firstMs?: number;
  ok: boolean;
  genId?: string;
  summary?: string;
  /** one-off set-up paid by this painting (a place's backdrop, a
   *  character's parts) - left out of `usd`, which is the page's own */
  setupUsd?: number;
  /** the variant it was painted with (see lib/bench-ways) */
  variant?: string;
  /** why it failed, from the painting's record */
  error?: string;
}
export interface BenchRun {
  id: string;
  at: number;
  page: string;
  label: string;
  ways: Record<string, WayResult>;
  vote?: string;
  /** the ways ranked best to worst (slot ids) */
  rank?: string[];
}

export const RUNS = "bench:runs";
export const PAGES = "bench:pages";
export const KEEP_S = 180 * 86_400;
export const mem = () => ((globalThis as { __bench?: { runs: Map<string, Record<string, string>>; pages: Map<string, string>; pics: Map<string, string> } }).__bench ??= { runs: new Map(), pages: new Map(), pics: new Map() });
/** Each painting's picture, kept as long as its run's numbers (the
 *  painting's own record, where it otherwise comes from, goes after two
 *  weeks). Its own key, so listing the runs never loads the pictures. */
export const picKey = (runId: string, way: string) => `bench:pic:${runId}:${way}`;

export async function hset(key: string, field: string, value: string) {
  if (!metricsEnabled()) {
    const m = mem();
    if (key === PAGES) m.pages.set(field, value);
    else m.runs.set(key, { ...(m.runs.get(key) ?? {}), [field]: value });
    return;
  }
  await pipeline([["HSET", key, field, value], ["EXPIRE", key, KEEP_S]]);
}


/** The model calls that are one-off set-up, paid once and reused by the
 *  pages after (see paintOnce): not part of a page's own cost. */
export const SETUP_CALLS = new Set(["backdrop painter", "parts maker"]);

/** A benched painting has finished (on the server, whether or not the
 *  bench page is still open): its cost, times and picture, from its own
 *  record, saved to its run. */
export async function saveBenchResult(runId: string, way: string, o: { variant: string; genId: string; ok: boolean; firstMs?: number; totalMs: number; svg: string }): Promise<void> {
  const got = await getGen(o.genId).catch(() => null);
  const calls = got?.record.calls ?? [];
  const setup = calls.filter((c) => SETUP_CALLS.has(c.label)).reduce((t, c) => t + (c.usdMicro || 0), 0);
  const result: WayResult = {
    usd: Math.max(0, (got?.record.usdMicro ?? 0) - setup) / 1e6,
    setupUsd: setup / 1e6,
    variant: o.variant,
    out: calls.reduce((t, c) => t + (Number((c as { out?: number }).out) || 0), 0),
    totalMs: o.totalMs,
    firstMs: o.firstMs ?? 0,
    ok: o.ok,
    genId: o.genId,
    summary: String(got?.record.summary ?? "").slice(0, 600),
    ...(o.ok ? {} : { error: String(got?.record.error ?? got?.record.status ?? "it didn't finish").slice(0, 300) }),
  };
  await hset(`bench:run:${runId}`, `w${way}`, JSON.stringify(result));
  const svg = o.ok ? sanitizeSvg(o.svg, 400_000) : "";
  if (!svg) return;
  if (!metricsEnabled()) mem().pics.set(picKey(runId, way), svg);
  else await pipeline([["SET", picKey(runId, way), svg, "EX", KEEP_S]]);
}
