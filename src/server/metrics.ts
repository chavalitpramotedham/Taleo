import { AsyncLocalStorage } from "node:async_hooks";
import { noteCall } from "./genlog";

/**
 * Product metrics for the admin dashboard: what was made (stories, pages,
 * words, paintings, characters, voice), who was active, and what each AI
 * request used (tokens, and an estimated cost from list prices).
 *
 * Stored as daily counters in Redis (Upstash, from the Vercel Marketplace):
 * one small pipelined request per event, atomic increments, no Blob
 * operations. Without Redis configured, recording is a no-op and the
 * dashboard shows what it can from the library and user lists.
 *
 * Recording never blocks or breaks the request it describes: it's fire-and-
 * forget, and any failure is only logged.
 */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const metricsEnabled = () => Boolean(URL_ && TOKEN);

export type Cmd = (string | number)[];

export async function pipeline(cmds: Cmd[]): Promise<unknown[]> {
  if (!metricsEnabled() || cmds.length === 0) return [];
  const res = await fetch(`${URL_.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`metrics store ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r) => r.result);
}

/** UTC day, e.g. "2026-11-09". */
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const monthKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);

// -------------------------------------------------------------- who's asking

/** The signed-in user a request is for, so AI usage deep inside the
 *  storyteller and painter can be attributed without threading it through. */
const ctx = new AsyncLocalStorage<{ userId: string | null }>();
export const withMetricsUser = <T>(userId: string | null | undefined, fn: () => T): T => ctx.run({ userId: userId ?? null }, fn);
const currentUser = () => ctx.getStore()?.userId ?? null;

// ------------------------------------------------------------------- prices

/** List prices in USD per million tokens, for estimates only (the
 *  dashboard also shows Anthropic's own cost report when an admin key is
 *  set). Cache writes (5-minute) are billed at 1.25x input. */
const PRICES: { match: RegExp; input: number; output: number; cacheRead: number }[] = [
  { match: /opus-5-5/, input: 4, output: 20, cacheRead: 0.2 },
  { match: /opus-5\b|opus-5-0|opus-4/, input: 5, output: 25, cacheRead: 0.5 },
  { match: /fable|mythos/, input: 10, output: 50, cacheRead: 0.25 },
  { match: /sonnet-5/, input: 2, output: 10, cacheRead: 0.2 },
  { match: /haiku-5/, input: 0.1, output: 0.5, cacheRead: 0.01 },
];
const priceFor = (model: string) => PRICES.find((p) => p.match.test(model)) ?? PRICES[0];

export type AiFeature = "story" | "painting" | "character";

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Estimated cost in millionths of a dollar ("micro-dollars"), so it can be
 *  summed with integer increments. */
export function estimateMicroUsd(model: string, u: TokenUsage): number {
  const p = priceFor(model);
  const usd =
    ((u.input_tokens ?? 0) * p.input +
      (u.output_tokens ?? 0) * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25) /
    1_000_000;
  return Math.round(usd * 1_000_000);
}

// ---------------------------------------------------------------- recording

function fire(cmds: Cmd[]) {
  if (!metricsEnabled()) return;
  pipeline(cmds).catch((e) => console.error("[metrics] couldn't record", e));
}

/** Count things made today (e.g. { stories_started: 1, pages: 4 }), and
 *  mark the current user as active. */
export function count(fields: Record<string, number>) {
  const day = dayKey();
  const cmds: Cmd[] = Object.entries(fields)
    .filter(([, n]) => n)
    .map(([f, n]) => ["HINCRBY", `m:${day}`, f, Math.round(n)]);
  const user = currentUser();
  if (user) cmds.push(["SADD", `au:${day}`, user]);
  fire(cmds);
}

/** One AI request's token use, by feature and model, with its estimated
 *  cost - for the day, and for the user this month. */
export function recordAi(feature: AiFeature, model: string, u: TokenUsage) {
  const day = dayKey();
  const micro = estimateMicroUsd(model, u);
  const f = (k: string) => `${feature}:${k}`;
  const cmds: Cmd[] = [
    ["HINCRBY", `m:${day}`, f("calls"), 1],
    ["HINCRBY", `m:${day}`, f("in"), u.input_tokens ?? 0],
    ["HINCRBY", `m:${day}`, f("out"), u.output_tokens ?? 0],
    ["HINCRBY", `m:${day}`, f("cache_read"), u.cache_read_input_tokens ?? 0],
    ["HINCRBY", `m:${day}`, f("cache_write"), u.cache_creation_input_tokens ?? 0],
    ["HINCRBY", `m:${day}`, f("usd_micro"), micro],
    ["HINCRBY", `models:${day}`, model, micro],
  ];
  const user = currentUser();
  if (user) {
    cmds.push(["HINCRBY", `uc:${monthKey()}`, user, micro]);
    cmds.push(["SADD", `au:${day}`, user]);
  }
  fire(cmds);
}

/** What's known about a model request before it's sent (for the activity
 *  log: which painter, how hard it was asked to think). */
export interface CallAbout {
  label?: string;
  effort?: string;
  thinking?: string;
}

interface SeenEvent {
  type: string;
  message?: { id?: string; model?: string; usage?: TokenUsage };
  usage?: TokenUsage;
  delta?: { type?: string; stop_reason?: string | null };
}

/** Tracks a streamed reply's token use as events arrive, so it's recorded
 *  even if the stream is stopped part-way (the reader left): what was
 *  generated up to then is still billed. It also times the request (taken
 *  up, first words, done) and notes how it ended, for the activity log. */
export function streamUsageTracker(feature: AiFeature, fallbackModel: string, about: CallAbout = {}) {
  let model = fallbackModel;
  const u: TokenUsage = {};
  let done = false;
  const began = Date.now();
  let acceptedMs: number | undefined;
  let firstMs: number | undefined;
  let stop: string | undefined;
  let messageId: string | undefined;
  let error: string | undefined;
  let http: number | undefined;
  let requestId: string | undefined;
  return {
    see(event: SeenEvent) {
      if (event.type === "message_start" && event.message) {
        acceptedMs ??= Date.now() - began;
        if (event.message.model) model = event.message.model;
        if (event.message.id) messageId = event.message.id;
        Object.assign(u, event.message.usage ?? {});
      } else if (event.type === "message_delta") {
        if (event.delta?.stop_reason) stop = event.delta.stop_reason;
        for (const [k, v] of Object.entries(event.usage ?? {})) if (typeof v === "number") (u as Record<string, number>)[k] = v;
      } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        firstMs ??= Date.now() - began;
      }
    },
    /** A reply that came whole, not streamed. */
    whole(message: { id?: string; model?: string; stop_reason?: string | null; usage?: TokenUsage }) {
      this.see({ type: "message_start", message });
      this.see({ type: "message_delta", delta: { stop_reason: message.stop_reason }, usage: message.usage });
      firstMs ??= Date.now() - began;
      this.finish();
    },
    /** How the request went wrong (or why it was given up on). */
    fail(err: unknown, why?: string) {
      const e = err as { name?: string; message?: string; status?: number; requestID?: string | null } | null;
      error = (why || `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`).slice(0, 400);
      if (typeof e?.status === "number") http = e.status;
      if (typeof e?.requestID === "string") requestId = e.requestID;
    },
    finish() {
      if (done) return;
      done = true;
      if (u.input_tokens || u.output_tokens) recordAi(feature, model, u);
      noteCall({
        label: about.label ?? feature,
        asked: fallbackModel,
        model,
        effort: about.effort,
        thinking: about.thinking,
        at: began,
        acceptedMs,
        firstMs,
        totalMs: Date.now() - began,
        stop,
        error,
        http,
        requestId,
        messageId,
        in: u.input_tokens ?? 0,
        out: u.output_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        usdMicro: estimateMicroUsd(model, u),
      });
    },
  };
}

// ------------------------------------------------------------------ reading

export interface DayMetrics {
  day: string;
  counts: Record<string, number>;
  activeUsers: number;
  models: Record<string, number>;
}

/** The last `days` days (oldest first), plus this month's top users by
 *  estimated cost. */
export async function readMetrics(days: number): Promise<{ days: DayMetrics[]; topUsers: { userId: string; usdMicro: number }[] } | null> {
  if (!metricsEnabled()) return null;
  const keys = Array.from({ length: days }, (_, i) => dayKey(Date.now() - (days - 1 - i) * 86_400_000));
  const cmds: Cmd[] = keys.flatMap((d) => [["HGETALL", `m:${d}`], ["SCARD", `au:${d}`], ["HGETALL", `models:${d}`]]);
  cmds.push(["HGETALL", `uc:${monthKey()}`]);
  const out = await pipeline(cmds);
  const toMap = (r: unknown): Record<string, number> => {
    const m: Record<string, number> = {};
    if (Array.isArray(r)) for (let i = 0; i + 1 < r.length; i += 2) m[String(r[i])] = Number(r[i + 1]) || 0;
    else if (r && typeof r === "object") for (const [k, v] of Object.entries(r)) m[k] = Number(v) || 0;
    return m;
  };
  const result: DayMetrics[] = keys.map((day, i) => ({
    day,
    counts: toMap(out[i * 3]),
    activeUsers: Number(out[i * 3 + 1]) || 0,
    models: toMap(out[i * 3 + 2]),
  }));
  const top = Object.entries(toMap(out[keys.length * 3]))
    .map(([userId, usdMicro]) => ({ userId, usdMicro }))
    .sort((a, b) => b.usdMicro - a.usdMicro)
    .slice(0, 10);
  return { days: result, topUsers: top };
}

/** Distinct active users across several days (a union of the day sets). */
export async function activeUsersOver(days: number): Promise<number | null> {
  if (!metricsEnabled()) return null;
  const keys = Array.from({ length: days }, (_, i) => `au:${dayKey(Date.now() - i * 86_400_000)}`);
  const [n] = await pipeline([["SUNIONSTORE", "au:tmp", ...keys], ["EXPIRE", "au:tmp", 60]]);
  return Number(n) || 0;
}

/** Takes an account out of the usage figures kept by name: who was active
 *  on which day, and each month's cost per account (the account was
 *  deleted). The day's totals themselves name nobody and stay. */
export async function forgetMetricsUser(userId: string): Promise<void> {
  if (!metricsEnabled()) return;
  const cmds: Cmd[] = [];
  const now = new Date();
  for (let m = 0; m < 14; m++) cmds.push(["HDEL", `uc:${monthKey(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 15))}`, userId]);
  for (let d = 0; d < 100; d++) cmds.push(["SREM", `au:${dayKey(Date.now() - d * 86_400_000)}`, userId]);
  await pipeline(cmds);
}
