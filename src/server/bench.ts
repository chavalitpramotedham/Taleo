import { metricsEnabled, pipeline } from "./metrics";
import { getGen } from "./genlog";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { legacyVariant } from "@/lib/bench-ways";

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
  /** its own way went wrong part-way and the page was painted again the
   *  ordinary way (as v0): why. Not that way's work, so left out of its
   *  averages. */
  fellBack?: string;
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
  /** the variant in each slot when it was ranked */
  rankVariants?: Record<string, string>;
  /** rankings that were reset: kept, and still counted for variants no
   *  longer in use */
  rankOld?: { order: string[]; variants: Record<string, string> }[];
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


const parse = <T,>(v: string | undefined): T | undefined => {
  try {
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
};
/** All of a run's fields. */
export async function runFields(runId: string): Promise<Record<string, string>> {
  if (!metricsEnabled()) return { ...(mem().runs.get(`bench:run:${runId}`) ?? {}) };
  const [r] = await pipeline([["HGETALL", `bench:run:${runId}`]]).catch(() => [null]);
  const flat = Array.isArray(r) ? r.map(String) : [];
  const o: Record<string, string> = {};
  for (let j = 0; j + 1 < flat.length; j += 2) o[flat[j]] = flat[j + 1];
  return o;
}
export async function hdel(key: string, fields: string[]) {
  if (!metricsEnabled()) {
    const m = mem().runs.get(key);
    if (m) for (const f of fields) delete m[f];
    return;
  }
  await pipeline([["HDEL", key, ...fields]]);
}

/** The model calls that are one-off set-up, paid once and reused by the
 *  pages after (see paintOnce): not part of a page's own cost. */
export const SETUP_CALLS = new Set(["backdrop painter", "parts maker"]);

function failedWhy(calls: { label?: string; error?: string }[], end: unknown): string {
  const first = calls.find((c) => c.error);
  const why = first ? `${first.label ?? "a painter"}: ${first.error}` : String(end ?? "it didn't finish");
  return why.slice(0, 300);
}

/** A benched painting has finished (on the server, whether or not the
 *  bench page is still open): its cost, times and picture, from its own
 *  record, saved to its run. */
export async function saveBenchResult(runId: string, way: string, o: { variant: string; genId: string; ok: boolean; firstMs?: number; totalMs: number; svg: string; fellBack?: string }): Promise<void> {
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
    // (a failure names the first painter that failed and why - e.g. the
    // service saying too many requests - before the painting's own end)
    ...(o.fellBack ? { fellBack: o.fellBack.slice(0, 300) } : {}),
    ...(o.ok ? {} : { error: failedWhy(calls, got?.record.error ?? got?.record.status) }),
  };
  // A result an earlier version painted in this slot is kept, under its
  // own name, so that version keeps its numbers. And if the page had been
  // ranked with it, that ranking is put away (as a reset does) with who
  // was in each slot, so its points stay with the versions it ranked -
  // never passed to the new one - and the page can be ranked afresh.
  const fields = await runFields(runId);
  const prev = fields[`w${way}`];
  if (prev) {
    try {
      const old = JSON.parse(prev) as WayResult;
      const oldVariant = old.variant ?? legacyVariant(way);
      if (oldVariant !== o.variant) {
        await hset(`bench:run:${runId}`, `w${way}@${oldVariant}`, JSON.stringify({ ...old, variant: oldVariant }));
        const order = parse<string[]>(fields.rank) ?? (fields.vote ? [fields.vote] : []);
        if (order.length) {
          const given = parse<Record<string, string>>(fields.rankv) ?? {};
          const variants: Record<string, string> = {};
          for (const slot of order) {
            const r = parse<WayResult>(fields[`w${slot}`]);
            variants[slot] = given[slot] ?? r?.variant ?? legacyVariant(slot);
          }
          const kept = parse<{ order: string[]; variants: Record<string, string> }[]>(fields.rankold) ?? [];
          await hset(`bench:run:${runId}`, "rankold", JSON.stringify([...kept, { order, variants }].slice(-20)));
          await hdel(`bench:run:${runId}`, ["rank", "rankv", "vote"]);
        }
      }
    } catch {}
  }
  await hset(`bench:run:${runId}`, `w${way}`, JSON.stringify(result));
  const svg = o.ok ? sanitizeSvg(o.svg, 400_000) : "";
  if (!svg) return;
  if (!metricsEnabled()) mem().pics.set(picKey(runId, way), svg);
  else await pipeline([["SET", picKey(runId, way), svg, "EX", KEEP_S]]);
}
