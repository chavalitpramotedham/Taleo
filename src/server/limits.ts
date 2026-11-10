import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "./auth";
import { readJson, writeJson } from "./store";
import { allowancePhrase, tierFor, type TierInfo } from "@/lib/tiers";

/**
 * Who may use the paid AI endpoints, and how often.
 *
 * Every endpoint that calls Claude or the voice provider requires a signed-in
 * account, and every allowance comes from that account's plan (lib/tiers) -
 * there are no numbers here:
 *
 *   story       beginning a new story                    plan.limits.stories
 *   character   designing or redrawing a character       plan.limits.designs
 *   segment     continuing stories already started   \
 *   illustrate  painting pages                        >  plan.limits.burst
 *   tts         new read-aloud clips                 /
 *
 * `story` and `character` are the plan's product limits and the costliest
 * single requests, so their counts are kept in the shared store, where every
 * server instance sees them (one small write per new story or design).
 *
 * The burst caps are counted in the server's memory: every stored write is a
 * metered Blob operation, and writing on each painted page or voice clip
 * would burn through the store's allowance. Memory is per server instance,
 * which is plenty for a safety cap.
 */

export type Bucket = "story" | "segment" | "illustrate" | "character" | "tts";
type StoredBucket = "story" | "character";
const STORED: Bucket[] = ["story", "character"];
const stored = (bucket: Bucket): bucket is StoredBucket => STORED.includes(bucket);

type Usage = Partial<Record<Bucket, number[]>>;
const path = (userId: string) => `ratelimits/${userId}.json`;

/** What a plan allows in a bucket (null: no limit). */
function allowance(plan: TierInfo, bucket: Bucket): { count: number; windowMs: number } | null {
  const l = plan.limits;
  if (bucket === "story") return l.stories && { count: l.stories.count, windowMs: l.stories.hours * 3600_000 };
  if (bucket === "character") return l.designs && { count: l.designs.count, windowMs: l.designs.hours * 3600_000 };
  return l.burst && { count: l.burst[bucket], windowMs: l.burst.minutes * 60_000 };
}
// (the longest any stored entry can matter, whichever plan asks)
const KEEP_MS = 7 * 24 * 3600_000;

// In-memory counts: the burst buckets live here, and so does a copy of this
// instance's own recent stored uses - a read made a moment after a write
// can still see the copy from before it, and this instance at least knows
// what it has just handed out.
const memory = new Map<string, Usage>();
const merged = (a: number[] = [], b: number[] = []) => [...new Set([...a, ...b])].sort((x, y) => x - y);

async function load(userId: string, bucket: Bucket): Promise<Usage> {
  const mine = memory.get(userId) ?? {};
  if (!stored(bucket)) return mine;
  const saved = (await readJson<Usage>(path(userId), { fresh: true })) ?? {};
  const usage: Usage = {};
  for (const b of STORED) usage[b] = merged(saved[b], mine[b]);
  return usage;
}
async function save(userId: string, bucket: Bucket, usage: Usage) {
  const mine = memory.get(userId) ?? {};
  if (!stored(bucket)) {
    memory.set(userId, { ...mine, [bucket]: usage[bucket] });
    return;
  }
  const now = Date.now();
  const kept: Usage = {};
  for (const b of STORED) kept[b] = (usage[b] ?? []).filter((t) => now - t < KEEP_MS);
  memory.set(userId, { ...mine, ...kept });
  await writeJson(path(userId), kept);
}

// One stored check-and-write at a time per account (on this instance), so
// two requests sent together can't both read "one left".
const queues = new Map<string, Promise<unknown>>();
function inTurn<T>(userId: string, bucket: Bucket, work: () => Promise<T>): Promise<T> {
  if (!stored(bucket)) return work();
  const run = (queues.get(userId) ?? Promise.resolve()).then(work, work);
  const tail = run.catch(() => {});
  queues.set(userId, tail);
  void tail.then(() => {
    if (queues.get(userId) === tail) queues.delete(userId);
  });
  return run;
}

function minutesText(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  if (m >= 90) {
    const h = Math.round(m / 60);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${m} minute${m === 1 ? "" : "s"}`;
}

type Who = Session["user"];

/** What a user still has in a bucket, without using any of it. */
export async function peekLimit(user: Who, bucket: Bucket): Promise<{ ok: boolean; retryAfterSec: number }> {
  const a = allowance(tierFor(user), bucket);
  if (!a) return { ok: true, retryAfterSec: 0 };
  const now = Date.now();
  const usage = await load(user.id, bucket);
  const recent = (usage[bucket] ?? []).filter((t) => now - t < a.windowMs);
  if (recent.length < a.count) return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.ceil((recent[recent.length - a.count] + a.windowMs - now) / 1000) };
}

/** Uses one from a bucket if there's room. */
function take(user: Who, bucket: Bucket): Promise<{ ok: boolean; retryAfterSec: number; at: number }> {
  const a = allowance(tierFor(user), bucket);
  if (!a) return Promise.resolve({ ok: true, retryAfterSec: 0, at: 0 });
  return inTurn(user.id, bucket, async () => {
    let now = Date.now();
    const usage = await load(user.id, bucket);
    const all = usage[bucket] ?? [];
    const recent = all.filter((t) => now - t < a.windowMs);
    if (recent.length >= a.count) {
      return { ok: false, retryAfterSec: Math.ceil((recent[recent.length - a.count] + a.windowMs - now) / 1000), at: now };
    }
    while (all.includes(now)) now++; // (each use is its own entry, so a refund removes exactly one)
    usage[bucket] = [...(stored(bucket) ? all : recent), now];
    await save(user.id, bucket, usage);
    return { ok: true, retryAfterSec: 0, at: now };
  });
}

/** Gives back a use that didn't produce anything (e.g. the story failed to
 *  write), so a failure never costs someone their allowance. */
export async function refund(userId: string, bucket: Bucket, at: number) {
  if (!at) return;
  try {
    await inTurn(userId, bucket, async () => {
      // (drop it from this instance's own copy first, or the merge in
      // load() would put it straight back)
      const mine = memory.get(userId);
      if (mine?.[bucket]) memory.set(userId, { ...mine, [bucket]: mine[bucket]!.filter((t) => t !== at) });
      const usage = await load(userId, bucket);
      const list = usage[bucket] ?? [];
      if (!list.includes(at) && !stored(bucket)) return;
      usage[bucket] = list.filter((t) => t !== at);
      await save(userId, bucket, usage);
    });
  } catch (e) {
    console.error("[limits] refund failed", e);
  }
}

const LIMIT_MESSAGES: Record<Bucket, (wait: string, plan: TierInfo) => string> = {
  story: (w, plan) =>
    `Today's story has been made! On the ${plan.name} plan each family can begin ${plan.limits.stories ? allowancePhrase(plan.limits.stories, "new story", "new stories") : "any number of stories"} - the next can start in about ${w}. Every story in the library is free to read in the meantime.`,
  segment: (w) => `That's a lot of story for one sitting! Please try again in about ${w}.`,
  illustrate: (w) => `The painter needs a little rest. The pictures will carry on in about ${w}.`,
  character: (w) => `You've dreamt up lots of characters! Try again in about ${w}.`,
  tts: (w) => `The storyteller's voice needs a rest. Try again in about ${w}.`,
};
export const limitMessage = (user: Who, bucket: Bucket, retryAfterSec: number) => LIMIT_MESSAGES[bucket](minutesText(retryAfterSec), tierFor(user));

export type Guard =
  | { ok: true; session: Session; release: () => Promise<void> }
  | { ok: false; response: NextResponse };

/**
 * Requires a signed-in user and takes one from `bucket` (plans without a
 * limit there pass straight through). `bucket` may be worked out from the
 * session - what a request costs can depend on who is asking. Call
 * `release()` if the work then fails, to refund it.
 */
export async function guard(bucket: Bucket | ((session: Session) => Bucket | NextResponse | Promise<Bucket | NextResponse>)): Promise<Guard> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Please sign in to make stories." }, { status: 401 }) };
  }
  const chosen = typeof bucket === "function" ? await bucket(session) : bucket;
  if (chosen instanceof NextResponse) return { ok: false, response: chosen };
  const b = chosen;
  let took: Awaited<ReturnType<typeof take>>;
  try {
    took = await take(session.user, b);
  } catch (e) {
    // If the counter itself is unavailable, fail closed for the stored
    // product limits (the costly actions) but don't block reading in
    // progress.
    console.error("[limits] couldn't check usage", e);
    if (stored(b)) {
      return { ok: false, response: NextResponse.json({ error: "Couldn't start that just now. Please try again." }, { status: 503 }) };
    }
    return { ok: true, session, release: async () => {} };
  }
  if (!took.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: limitMessage(session.user, b, took.retryAfterSec), retryAfterSec: took.retryAfterSec, limited: b },
        { status: 429, headers: { "Retry-After": String(took.retryAfterSec) } },
      ),
    };
  }
  const userId = session.user.id;
  return { ok: true, session, release: () => refund(userId, b, took.at) };
}
