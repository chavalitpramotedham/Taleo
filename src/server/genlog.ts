import { AsyncLocalStorage } from "node:async_hooks";
import { metricsEnabled, pipeline, type Cmd } from "./metrics";

/**
 * The activity log: one record for every request that makes something (a
 * part of a story, a painting, a character, a voice clip) - who asked, for
 * what, which models were called and how each call went, how long the
 * reader waited for the first of it and for all of it, and how it ended.
 * Read on the private activity page (/admin/activity) to see what a family
 * actually went through when something was slow or failed.
 *
 * Kept in Redis beside the metrics (no Blob operations): a record is
 * written when the request begins ("running") and written over when it
 * ends, so a request the platform cut off still leaves its trace - a
 * record that never finished. Records are kept 30 days, results 14, and the
 * lists are trimmed, so it can't grow without bound. Without Redis (local
 * and test runs) it's kept in memory.
 *
 * Logging never breaks the request it describes: every failure here is
 * caught and only logged.
 */

export type GenKind = "story" | "painting" | "character" | "voice";
export const GEN_KINDS: GenKind[] = ["story", "painting", "character", "voice"];

/** running: begun, not ended (if it's old, the server was cut off)
 *  ok: made and sent          error: failed
 *  slow: the painter was given up on before its first stroke
 *  refused: the model declined
 *  left: the reader went away before it finished
 *  denied: turned away before any model was asked (a limit, a bad page) */
export type GenStatus = "running" | "ok" | "error" | "slow" | "refused" | "left" | "denied";

/** One request to a model. */
export interface GenCall {
  label: string;
  /** The model asked for, and the one that answered (they differ after a
   *  server-side fallback). */
  asked: string;
  model: string;
  effort?: string;
  thinking?: string;
  at: number;
  /** ms until the request was taken up / the first words came / it ended */
  acceptedMs?: number;
  firstMs?: number;
  totalMs: number;
  stop?: string;
  error?: string;
  http?: number;
  requestId?: string;
  messageId?: string;
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
  usdMicro: number;
}

export interface GenRecord {
  id: string;
  at: number;
  kind: GenKind;
  /** e.g. "start", "part 3", "page 2 (quick, second go)" */
  sub: string;
  /** A few words of what was asked for. */
  what: string;
  /** Which of the ways this kind of request can go it was: for a painting
   *  "first go" or "second go", "quick painter" or "main painter", "in
   *  layers" or "one painter"... Short labels, shown as they are. (Records
   *  from before these were kept have none: the page reads what it can
   *  from `sub`.) */
  cases?: string[];
  userId: string | null;
  tier?: string;
  storyId?: string;
  status: GenStatus;
  http?: number;
  error?: string;
  /** ms the browser held the request back before sending it (a painting
   *  waiting its turn), as the browser reports it */
  waitedMs?: number;
  /** ms from the request arriving to the first of the result being sent */
  firstMs?: number;
  totalMs?: number;
  /** characters (or bytes) of result sent */
  size?: number;
  summary?: string;
  hasResult?: boolean;
  request?: unknown;
  calls: GenCall[];
  usdMicro: number;
  region?: string;
  vercelId?: string;
  ua?: string;
  mock?: boolean;
}

const RECORD_TTL = 30 * 86_400;
const RESULT_TTL = 14 * 86_400;
const KEEP_ALL = 3000;
const KEEP_USER = 1000;
const MAX_RESULT = 120_000;
/** A record still "running" after this long was cut off: no request may
 *  run longer than five minutes. */
export const NEVER_FINISHED_MS = 6 * 60_000;

// ------------------------------------------------------------------ storage

interface Memory {
  records: Map<string, GenRecord>;
  results: Map<string, string>;
}
const memory = (): Memory => {
  const g = globalThis as { __taleoGenlog?: Memory };
  return (g.__taleoGenlog ??= { records: new Map(), results: new Map() });
};

async function save(rec: GenRecord, first: boolean, result?: string) {
  try {
    if (!metricsEnabled()) {
      const m = memory();
      m.records.set(rec.id, JSON.parse(JSON.stringify(rec)) as GenRecord);
      if (result) m.results.set(rec.id, result);
      for (const old of [...m.records.keys()].slice(0, Math.max(0, m.records.size - KEEP_ALL))) {
        m.records.delete(old);
        m.results.delete(old);
      }
      return;
    }
    const cmds: Cmd[] = [["SET", `gl:${rec.id}`, JSON.stringify(rec), "EX", RECORD_TTL]];
    if (first) {
      cmds.push(["ZADD", "gl:all", rec.at, rec.id], ["ZREMRANGEBYRANK", "gl:all", 0, -(KEEP_ALL + 1)]);
      if (rec.userId) cmds.push(["ZADD", `gl:u:${rec.userId}`, rec.at, rec.id], ["ZREMRANGEBYRANK", `gl:u:${rec.userId}`, 0, -(KEEP_USER + 1)], ["EXPIRE", `gl:u:${rec.userId}`, RECORD_TTL]);
    }
    if (result) cmds.push(["SET", `gl:r:${rec.id}`, result, "EX", RESULT_TTL]);
    await pipeline(cmds);
  } catch (e) {
    console.error("[genlog] couldn't record", e);
  }
}

/** The newest records, for one user or for everyone (newest first). */
export async function recentGens(opts: { userId?: string; limit?: number } = {}): Promise<GenRecord[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  if (!metricsEnabled()) {
    return [...memory().records.values()]
      .filter((r) => !opts.userId || r.userId === opts.userId)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit);
  }
  const [ids] = await pipeline([["ZRANGE", opts.userId ? `gl:u:${opts.userId}` : "gl:all", 0, limit - 1, "REV"]]);
  if (!Array.isArray(ids) || !ids.length) return [];
  const [found] = await pipeline([["MGET", ...ids.map((id) => `gl:${String(id)}`)]]);
  const out: GenRecord[] = [];
  for (const raw of Array.isArray(found) ? found : []) {
    if (!raw) continue; // (kept longer in the list than the record itself)
    try {
      out.push((typeof raw === "string" ? JSON.parse(raw) : raw) as GenRecord);
    } catch {}
  }
  return out;
}

/** One record with what it made (if that was kept). */
export async function getGen(id: string): Promise<{ record: GenRecord; result: string | null } | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  if (!metricsEnabled()) {
    const record = memory().records.get(id);
    return record ? { record, result: memory().results.get(id) ?? null } : null;
  }
  const [raw, result] = await pipeline([["GET", `gl:${id}`], ["GET", `gl:r:${id}`]]);
  if (!raw) return null;
  try {
    const record = (typeof raw === "string" ? JSON.parse(raw) : raw) as GenRecord;
    return { record, result: result == null ? null : typeof result === "string" ? result : JSON.stringify(result) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- recording

const ctx = new AsyncLocalStorage<GenRecord>();

/** A model call made while a logged request is being served (called by the
 *  usage tracker; outside one it's nothing). */
export function noteCall(call: GenCall) {
  const rec = ctx.getStore();
  if (!rec) return;
  rec.calls.push(call);
  rec.usdMicro += call.usdMicro;
}

/** The request as sent, made small enough to keep: pictures are dropped
 *  (their size is noted), long text is cut, and the whole is capped. */
export function compact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > 700 ? `${value.slice(0, 700)}… (+${value.length - 700} characters)` : value;
  if (value === null || typeof value !== "object") return value;
  if (depth > 7) return "…";
  if (Array.isArray(value)) return value.slice(0, 40).map((v) => compact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string" && (k === "svg" || k === "picture" || /^\s*<svg/.test(v))) out[k] = `(a picture, ${v.length} characters)`;
    else if (k === "sig" || k === "ticket") out[k] = v ? "(signed)" : v;
    else out[k] = compact(v, depth + 1);
  }
  return out;
}
const capped = (value: unknown): unknown => {
  const small = compact(value);
  const json = JSON.stringify(small) ?? "";
  return json.length > 12_000 ? { cut: `${json.slice(0, 12_000)}… (+${json.length - 12_000} characters)` } : small;
};

export const snippet = (s: string | null | undefined, max = 90) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export interface Gen {
  id: string;
  /** Run the work inside the record, so its model calls are noted on it. */
  run<T>(fn: () => T): T;
  /** Something was sent to the reader (the first time is "first seen"). */
  sent(size: number): void;
  /** How it ended. Awaited before the reply closes, so the record is
   *  written while the server is still alive. Only the first call counts. */
  end(status: GenStatus, extra?: { error?: unknown; result?: string; summary?: string; http?: number; cases?: string[] }): Promise<void>;
  /** Settles once the ending is written: hand it to `after()` so the
   *  server stays up for it even when the reader has already gone. */
  done: Promise<void>;
}

const tidyCases = (cases: (string | false | null | undefined)[] | undefined) => {
  const out = [...new Set((cases ?? []).filter((c): c is string => Boolean(c)).map((c) => snippet(c, 60)))].slice(0, 12);
  return out.length ? out : undefined;
};

const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : typeof e === "string" ? e : "unknown").slice(0, 500);

/** Begin a record for a request that's about to make something. */
export function beginGen(init: {
  kind: GenKind;
  sub: string;
  what: string;
  cases?: string[];
  userId: string | null;
  tier?: string;
  storyId?: string;
  req: Request;
  request?: unknown;
  mock?: boolean;
}): Gen {
  const h = init.req.headers;
  const waited = Number(h.get("x-taleo-waited"));
  const rec: GenRecord = {
    id: `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
    at: Date.now(),
    kind: init.kind,
    sub: init.sub,
    what: snippet(init.what, 140),
    cases: tidyCases(init.cases),
    userId: init.userId,
    tier: init.tier,
    storyId: init.storyId,
    status: "running",
    waitedMs: h.has("x-taleo-waited") && Number.isFinite(waited) && waited >= 0 ? Math.min(Math.round(waited), 3_600_000) : undefined,
    request: init.request === undefined ? undefined : capped(init.request),
    calls: [],
    usdMicro: 0,
    region: process.env.VERCEL_REGION || undefined,
    vercelId: h.get("x-vercel-id") || undefined,
    ua: snippet(h.get("user-agent"), 160) || undefined,
    mock: init.mock || undefined,
  };
  let ended = false;
  const began = save(rec, true);
  let settle = () => {};
  const done = new Promise<void>((r) => (settle = r));
  return {
    id: rec.id,
    done,
    run: (fn) => ctx.run(rec, fn),
    sent(size) {
      if (ended) return;
      rec.firstMs ??= Date.now() - rec.at;
      rec.size = (rec.size ?? 0) + size;
    },
    async end(status, extra = {}) {
      if (ended) return;
      ended = true;
      rec.status = status;
      rec.totalMs = Date.now() - rec.at;
      if (extra.error !== undefined) rec.error = errorText(extra.error);
      if (extra.http) rec.http = extra.http;
      if (extra.summary) rec.summary = snippet(extra.summary, 300);
      // (what's only known once it's made: "the ending", say)
      if (extra.cases?.length) rec.cases = tidyCases([...(rec.cases ?? []), ...extra.cases]);
      const result = extra.result ? (extra.result.length > MAX_RESULT ? `${extra.result.slice(0, MAX_RESULT)}\n… (cut: ${extra.result.length} characters in all)` : extra.result) : undefined;
      rec.hasResult = Boolean(result) || undefined;
      await began;
      await save(rec, false, result);
      settle();
    },
  };
}

/** A request turned away before anything was made (a limit reached, a page
 *  that can't be painted): one finished record, with the answer given. */
export async function logDenied(
  init: Parameters<typeof beginGen>[0],
  response: Response,
): Promise<void> {
  // (signed-out callers aren't logged: there's nobody to look up, and
  // anyone could fill the log)
  if (!init.userId) return;
  let message = "";
  try {
    const data = (await response.clone().json()) as { error?: string };
    message = data.error ?? "";
  } catch {}
  const gen = beginGen(init);
  await gen.end("denied", { error: message || `HTTP ${response.status}`, http: response.status });
}
