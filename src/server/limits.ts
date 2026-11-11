import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "./auth";
import { readJson, writeJson } from "./store";
import { allowancePhrase, tierFor, CREDIT_PRICES, type CreditItem, type TierInfo } from "@/lib/tiers";
import { accountOf, type Account } from "./entitlements";
import { refundCredits, spendCredits } from "./billing";

/**
 * Who may use the paid AI endpoints, and how often.
 *
 * Every endpoint that calls Claude or the voice provider requires a signed-in
 * account, and every allowance comes from that account's plan (lib/tiers) -
 * there are no numbers here:
 *
 *   story       a new story, counted at its first choice plan.limits.stories
 *   start       beginning one (dropped ones included)    ...plus changesOfMind
 *   character   designing or redrawing a character       plan.limits.designs
 *   segment     continuing stories already started   \
 *   illustrate  painting pages                        >  plan.limits.burst
 *   tts         new read-aloud clips                 /
 *
 * A story counts toward the plan once its first choice is made: someone who
 * begins one and doesn't take to it can begin another. So that this isn't an
 * endless supply of free opening chapters, beginnings have a count of their
 * own - the plan's stories plus its changes of mind - and nothing can be
 * begun once the stories themselves are used up.
 *
 * `story`, `start` and `character` are the plan's product limits and the
 * costliest requests, so their counts are kept in the shared store, where
 * every server instance sees them (one small write each time).
 *
 * The burst caps are counted in the server's memory: every stored write is a
 * metered Blob operation, and writing on each painted page or voice clip
 * would burn through the store's allowance. Memory is per server instance,
 * which is plenty for a safety cap.
 */

export type Bucket = "story" | "start" | "segment" | "illustrate" | "character" | "tts";
type StoredBucket = "story" | "start" | "character";
const STORED: Bucket[] = ["story", "start", "character"];
const stored = (bucket: Bucket): bucket is StoredBucket => STORED.includes(bucket);

/** Uses of each bucket (when), and - so that asking twice for the same
 *  first choice counts once - which stories have been counted (`counted`:
 *  the story's key, and when). */
type Usage = Partial<Record<Bucket, number[]>> & { counted?: Record<string, number> };
const path = (userId: string) => `ratelimits/${userId}.json`;

/** What a plan allows in a bucket (null: no limit). */
function allowance(plan: TierInfo, bucket: Bucket): { count: number; windowMs: number } | null {
  const l = plan.limits;
  if (bucket === "story") return l.stories && { count: l.stories.count, windowMs: l.stories.hours * 3600_000 };
  if (bucket === "start") return l.stories && { count: l.stories.count + l.changesOfMind, windowMs: l.stories.hours * 3600_000 };
  if (bucket === "character") return l.designs && { count: l.designs.count, windowMs: l.designs.hours * 3600_000 };
  return l.burst && { count: l.burst[bucket as "segment" | "illustrate" | "tts"], windowMs: l.burst.minutes * 60_000 };
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
  for (const b of STORED) usage[b] = merged(saved[b] as number[] | undefined, mine[b] as number[] | undefined);
  usage.counted = { ...saved.counted, ...mine.counted };
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
  for (const b of STORED) kept[b] = ((usage[b] as number[] | undefined) ?? []).filter((t) => now - t < KEEP_MS);
  kept.counted = Object.fromEntries(Object.entries(usage.counted ?? {}).filter(([, t]) => now - t < KEEP_MS));
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
export async function peekLimit(user: Who, bucket: Bucket): Promise<{ ok: boolean; retryAfterSec: number; left?: number }> {
  const a = allowance(tierFor(user), bucket);
  if (!a) return { ok: true, retryAfterSec: 0 };
  const now = Date.now();
  const usage = await load(user.id, bucket);
  const recent = (usage[bucket] ?? []).filter((t) => now - t < a.windowMs);
  if (recent.length < a.count) return { ok: true, retryAfterSec: 0, left: a.count - recent.length };
  return { ok: false, retryAfterSec: Math.ceil((recent[recent.length - a.count] + a.windowMs - now) / 1000), left: 0 };
}

/** What a request uses: one from a bucket - optionally only if another
 *  bucket still has room (`needs`), and optionally once only per `key`
 *  (asked again with the same key, it's already paid for). */
export interface Cost {
  bucket: Bucket;
  needs?: StoredBucket;
  key?: string;
}
type Took = { ok: boolean; retryAfterSec: number; at: number; limited: Bucket; already?: boolean };

const room = (usage: Usage, a: NonNullable<ReturnType<typeof allowance>>, bucket: Bucket, now: number) => {
  const recent = (usage[bucket] ?? []).filter((t) => now - t < a.windowMs);
  return recent.length < a.count ? 0 : Math.ceil((recent[recent.length - a.count] + a.windowMs - now) / 1000);
};

/** Can this account begin a story now? Not once its stories are used up,
 *  nor after too many changes of mind. */
export async function peekStart(user: Who): Promise<{ ok: boolean; retryAfterSec: number; limited: Bucket; left?: number }> {
  const story = await peekLimit(user, "story");
  if (!story.ok) return { ...story, left: 0, limited: "story" };
  // (`left`: how many more stories can be begun - absent when unlimited)
  return { ...(await peekLimit(user, "start")), limited: "start" };
}

/** Uses one from a bucket if there's room. */
function take(user: Who, { bucket, needs, key }: Cost): Promise<Took> {
  const plan = tierFor(user);
  const a = allowance(plan, bucket);
  const free: Took = { ok: true, retryAfterSec: 0, at: 0, limited: bucket };
  if (!a) return Promise.resolve(free);
  return inTurn(user.id, bucket, async () => {
    let now = Date.now();
    const usage = await load(user.id, bucket);
    if (key && usage.counted?.[key]) return { ...free, already: true };
    const other = needs && allowance(plan, needs);
    const blocked = other ? room(usage, other, needs, now) : 0;
    if (blocked) return { ok: false, retryAfterSec: blocked, at: now, limited: needs! };
    const wait = room(usage, a, bucket, now);
    const all = usage[bucket] ?? [];
    if (wait && key) {
      // A use nobody has claimed (a story begun when stories were counted
      // at their beginning) is this one's: it was paid for then.
      const claimed = new Set(Object.values(usage.counted ?? {}));
      const unclaimed = all.find((t) => now - t < a.windowMs && !claimed.has(t));
      if (unclaimed) {
        usage.counted = { ...usage.counted, [key]: unclaimed };
        await save(user.id, bucket, usage);
        return { ...free, already: true };
      }
    }
    if (wait) return { ok: false, retryAfterSec: wait, at: now, limited: bucket };
    while (all.includes(now)) now++; // (each use is its own entry, so a refund removes exactly one)
    usage[bucket] = [...(stored(bucket) ? all : all.filter((t) => now - t < a.windowMs)), now];
    if (key) usage.counted = { ...usage.counted, [key]: now };
    await save(user.id, bucket, usage);
    return { ok: true, retryAfterSec: 0, at: now, limited: bucket };
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
      const uncounted = (c: Usage["counted"]) => Object.fromEntries(Object.entries(c ?? {}).filter(([, t]) => t !== at));
      const mine = memory.get(userId);
      if (mine?.[bucket]) memory.set(userId, { ...mine, [bucket]: mine[bucket]!.filter((t) => t !== at), counted: uncounted(mine.counted) });
      const usage = await load(userId, bucket);
      const list = usage[bucket] ?? [];
      if (!list.includes(at) && !stored(bucket)) return;
      usage[bucket] = list.filter((t) => t !== at);
      usage.counted = uncounted(usage.counted);
      await save(userId, bucket, usage);
    });
  } catch (e) {
    console.error("[limits] refund failed", e);
  }
}

const LIMIT_MESSAGES: Record<Bucket, (wait: string, plan: TierInfo) => string> = {
  story: (w, plan) =>
    `Today's story has been made! The ${plan.name} plan comes with ${plan.limits.stories ? allowancePhrase(plan.limits.stories, "new story", "new stories") : "any number of stories"}, and the next can start in about ${w}. Every story in the library is free to read in the meantime.`,
  start: (w) =>
    `A few stories have been begun and set aside before their first choice. A fresh one can start in about ${w} - every story in the library is free to read in the meantime.`,
  segment: (w) => `That's a lot of story for one sitting! Please try again in about ${w}.`,
  illustrate: (w) => `The painter needs a little rest. The pictures will carry on in about ${w}.`,
  character: (w) => `You've dreamt up lots of characters! Try again in about ${w}.`,
  tts: (w) => `The storyteller's voice needs a rest. Try again in about ${w}.`,
};
export const limitMessage = (user: Who, bucket: Bucket, retryAfterSec: number) => LIMIT_MESSAGES[bucket](minutesText(retryAfterSec), tierFor(user));

export type Guard =
  | { ok: true; session: Session; release: () => Promise<void>; /** credits this request was paid with, if the plan's own allowance was used up */ credits?: number }
  | { ok: false; response: NextResponse };

/** What on-demand credits can pay for once the plan's allowance for it is
 *  used up. (A story isn't here yet: it is counted over two requests - its
 *  beginning and its first choice - and the credit has to follow it across
 *  both. Until that's wired in, a story beyond the plan's waits for the
 *  plan, credits or no.) */
const PAID_BY_CREDITS: Partial<Record<Bucket, CreditItem>> = { character: "character" };

/**
 * The signed-in account as the records have it now, in the shape the plan
 * checks use: who they are from the cookie, what they may do from the
 * server (see server/entitlements). `null`: no such account any more.
 * If the records can't be read, `stale` is true and the cookie's own copy
 * of the plan stands in - good enough to carry on a story being read, never
 * to begin something the plan counts.
 */
export async function whoIs(session: Session): Promise<{ user: Who; account: Account | null; stale: boolean } | null> {
  try {
    const account = await accountOf(session.user.id);
    if (!account) return null;
    return { user: { ...session.user, isAdmin: account.isAdmin, tier: account.tier }, account, stale: false };
  } catch (e) {
    console.error("[limits] couldn't read the account", e);
    // (never the admin on the cookie's word alone)
    return { user: { ...session.user, isAdmin: false, tier: session.user.isAdmin ? "free" : session.user.tier }, account: null, stale: true };
  }
}

/**
 * Requires a signed-in user and takes one from `bucket` (plans without a
 * limit there pass straight through). `bucket` may be worked out from the
 * session - what a request costs can depend on who is asking. Call
 * `release()` if the work then fails, to refund it.
 */
export async function guard(
  bucket: Bucket | ((session: Session) => Bucket | Cost | NextResponse | Promise<Bucket | Cost | NextResponse>),
  /** `useCredits`: the person has said yes to paying with credits if the
   *  plan's allowance is used up. Credits are never spent without it: a
   *  request that could have been paid with them is turned away like any
   *  other, with what it would cost (so the page can offer it). */
  opts: { useCredits?: boolean } = {},
): Promise<Guard> {
  let session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Please sign in to make stories." }, { status: 401 }) };
  }
  // What they may do is read from the records, not the cookie: the plan
  // as it is now, and whether the account still stands.
  const me = await whoIs(session);
  if (!me) return { ok: false, response: NextResponse.json({ error: "Please sign in to make stories." }, { status: 401 }) };
  if (me.account?.suspended) {
    return { ok: false, response: NextResponse.json({ error: "This account can't make new stories at the moment. Please get in touch with us and we'll sort it out." }, { status: 403 }) };
  }
  // (everything downstream sees the account as it is now)
  session = { ...session, user: me.user };
  const chosen = typeof bucket === "function" ? await bucket(session) : bucket;
  if (chosen instanceof NextResponse) return { ok: false, response: chosen };
  const cost: Cost = typeof chosen === "string" ? { bucket: chosen } : chosen;
  const b = cost.bucket;
  const unavailable = { ok: false as const, response: NextResponse.json({ error: "Couldn't start that just now. Please try again." }, { status: 503 }) };
  // (the plan couldn't be read: nothing the plan counts is begun on a guess)
  if (me.stale && (stored(b) || (cost.needs && stored(cost.needs)))) return unavailable;
  let took: Took;
  try {
    took = await take(session.user, cost);
    // (already paid for: it's an ordinary request for more of that story)
    if (took.already && b !== "segment") took = await take(session.user, { bucket: "segment" });
  } catch (e) {
    // If the counter itself is unavailable, fail closed for the stored
    // product limits (the costly actions) but don't block reading in
    // progress.
    console.error("[limits] couldn't check usage", e);
    if (stored(b)) return unavailable;
    return { ok: true, session, release: async () => {} };
  }
  if (!took.ok) {
    // The plan's allowance is used up: on-demand credits pay for it, if
    // the account has them. Taken in one step on the store (two requests
    // can't spend the same credit), under a reference of its own, and
    // given back if the work then fails.
    const item = took.limited === b ? PAID_BY_CREDITS[b] : undefined;
    let offer: { item: CreditItem; price: number; balance: number } | undefined;
    if (item && me.account) {
      const price = CREDIT_PRICES[item];
      const have = await me.account.credits();
      if (have !== null && have >= price) offer = { item, price, balance: have };
      if (offer && opts.useCredits) {
        const ref = `${item}:${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
        const paid = await spendCredits(session.user.id, price, ref, `One ${item} beyond the ${me.account.plan.name} plan's allowance`);
        if (paid.ok) {
          const userId = session.user.id;
          return { ok: true, session, credits: price, release: async () => void (await refundCredits(userId, price, ref, "The work failed: credits returned")) };
        }
      }
    }
    return {
      ok: false,
      response: NextResponse.json(
        // (`credits`: this could be paid for with credits - ask, then send it again saying so)
        { error: limitMessage(session.user, took.limited, took.retryAfterSec), retryAfterSec: took.retryAfterSec, limited: took.limited, plan: tierFor(session.user).name, credits: offer },
        { status: 429, headers: { "Retry-After": String(took.retryAfterSec) } },
      ),
    };
  }
  const userId = session.user.id;
  const used = took.limited;
  return { ok: true, session, release: () => refund(userId, used, took.at) };
}
