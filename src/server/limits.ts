import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "./auth";
import { readPrivate as readJson, writePrivate as writeJson } from "./store";
import { allowancePhrase, monthOf, tierFor, weekOf, CHARACTER_CREDITS, CREDITS_PER_STORY_MINUTE, FREE_STORY_MINUTES, type TierInfo } from "@/lib/tiers";
import { accountOf, type Account } from "./entitlements";
import { applyCredits, billingAvailable, heldCredits, holdCredits, pendingStoryHold, releaseHold, releasePendingStories, settleHold, moveHold, wasPaid, STORY_PENDING } from "./billing";
import { underDailyCap, type CapKind } from "./caps";
import { STARTER_CREDITS } from "@/lib/tiers";

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
export const usagePath = path;
/** Forget what this server remembers of an account's uses (it was deleted). */
export const forgetUsage = (userId: string) => void memory.delete(userId);

/** What a plan allows in a bucket (null: no limit). */
type Window = { count: number; windowMs: number; week?: boolean; month?: boolean };
/** The calendar stretch an allowance is counted over, if it is. */
const calendar = (a: Window, now: number) => (a.week ? weekOf(now) : a.month ? monthOf(now) : null);
function allowance(plan: TierInfo, bucket: Bucket): Window | null {
  const l = plan.limits;
  if (bucket === "story") return l.stories && { count: l.stories.count, windowMs: l.stories.hours * 3600_000, week: l.stories.week };
  if (bucket === "start") return l.stories && { count: l.stories.count + l.changesOfMind, windowMs: l.stories.hours * 3600_000, week: l.stories.week };
  if (bucket === "character") return l.designs && { count: l.designs.count, windowMs: l.designs.hours * 3600_000, week: l.designs.week, month: l.designs.month };
  return l.burst && { count: l.burst[bucket as "segment" | "illustrate" | "tts"], windowMs: l.burst.minutes * 60_000 };
}
/** Which uses still count now: those of the last so-many hours - or, for
 *  an allowance counted by the calendar week, those since this week began. */
const counted = (a: Window, uses: number[] | undefined, now: number) => {
  const from = calendar(a, now)?.start ?? now - a.windowMs;
  return (uses ?? []).filter((t) => t >= from && t <= now + 1000);
};
/** Seconds until there's room again, given the uses that count (all of
 *  the allowance used): when the week turns, or when the oldest of them
 *  falls out of the stretch. */
const waitFor = (a: Window, recent: number[], now: number) =>
  Math.max(1, Math.ceil(((calendar(a, now)?.end ?? recent[recent.length - a.count] + a.windowMs) - now) / 1000));
// (the longest any stored entry can matter, whichever plan asks)
const KEEP_MS = 32 * 24 * 3600_000;

// In-memory counts: the burst buckets live here, and so does a copy of this
// instance's own recent stored uses - a read made a moment after a write
// can still see the copy from before it, and this instance at least knows
// what it has just handed out.
const memory = new Map<string, Usage>();
const merged = (a: number[] = [], b: number[] = []) => [...new Set([...a, ...b])].sort((x, y) => x - y);

// Checks that arrive together (a page asking what's left of stories,
// beginnings and characters at once) share one read of the account's
// counts instead of fetching the same file several times over.
const reading = new Map<string, Promise<Usage | null>>();
function readStored(userId: string): Promise<Usage | null> {
  let p = reading.get(userId);
  if (!p) {
    p = readJson<Usage>(path(userId), { fresh: true }).finally(() => reading.delete(userId));
    reading.set(userId, p);
  }
  return p;
}

async function load(userId: string, bucket: Bucket): Promise<Usage> {
  const mine = memory.get(userId) ?? {};
  if (!stored(bucket)) return mine;
  const saved = (await readStored(userId)) ?? {};
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
  if (m >= 36 * 60) {
    const d = Math.round(m / 1440);
    return `${d} day${d === 1 ? "" : "s"}`;
  }
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
  const recent = counted(a, usage[bucket], now);
  if (recent.length < a.count) return { ok: true, retryAfterSec: 0, left: a.count - recent.length };
  return { ok: false, retryAfterSec: waitFor(a, recent, now), left: 0 };
}

/** What a request uses: one from a bucket - optionally only if another
 *  bucket still has room (`needs`), and optionally once only per `key`
 *  (asked again with the same key, it's already paid for). */
export interface Cost {
  bucket: Bucket;
  needs?: StoredBucket;
  key?: string;
  /** What it costs in credits, where credits pay for it (a story: its
   *  length in minutes; a character's is worked out here). */
  credits?: number;
}
type Took = { ok: boolean; retryAfterSec: number; at: number; limited: Bucket; already?: boolean };

const room = (usage: Usage, a: NonNullable<ReturnType<typeof allowance>>, bucket: Bucket, now: number) => {
  const recent = counted(a, usage[bucket], now);
  return recent.length < a.count ? 0 : waitFor(a, recent, now);
};

/** Can this account begin a story now? Not once its stories are used up,
 *  nor after too many changes of mind. */
export async function peekStart(user: Who): Promise<{ ok: boolean; retryAfterSec: number; limited: Bucket; left?: number }> {
  // (asked together: the two share one read of the account's counts)
  const [story, start] = await Promise.all([peekLimit(user, "story"), peekLimit(user, "start")]);
  if (!story.ok) return { ...story, left: 0, limited: "story" };
  // (`left`: how many more stories can be begun - absent when unlimited)
  return { ...start, limited: "start" };
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
      const unclaimed = counted(a, all, now).find((t) => !claimed.has(t));
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
    `${plan.limits.stories?.week ? "This week's" : "Today's"} story has been made! The ${plan.name} plan comes with ${plan.limits.stories ? allowancePhrase(plan.limits.stories, "new story", "new stories") : "any number of stories"}, and the next can start in about ${w}. Every story in the library is free to read in the meantime.`,
  start: (w) =>
    `A few stories have been begun and set aside before their first choice. A fresh one can start in about ${w} - every story in the library is free to read in the meantime.`,
  segment: (w) => `That's a lot of story for one sitting! Please try again in about ${w}.`,
  illustrate: (w) => `The painter needs a little rest. The pictures will carry on in about ${w}.`,
  character: (w, plan) =>
    plan.limits.designs?.week || plan.limits.designs?.month
      ? `This ${plan.limits.designs.month ? "month" : "week"}'s free character has been dreamt up! The ${plan.name} plan comes with ${allowancePhrase(plan.limits.designs, "new character", "new characters")}, and the next can be made in about ${w}.`
      : `You've dreamt up lots of characters! Try again in about ${w}.`,
  tts: (w) => `The storyteller's voice needs a rest. Try again in about ${w}.`,
};
export const limitMessage = (user: Who, bucket: Bucket, retryAfterSec: number) => LIMIT_MESSAGES[bucket](minutesText(retryAfterSec), tierFor(user));

export type Guard =
  | {
      ok: true;
      session: Session;
      /** The work failed or was stopped: what was counted or held for it goes
       *  back. (`left`: the person walked away mid-work rather than the
       *  work failing - credits still go back, but a use of the plan's own
       *  allowance stays used, so leaving and asking again isn't an endless
       *  supply of work that's never counted.) */
      release: (how?: { left?: boolean }) => Promise<void>;
      /** The work was done: credits held for it become the spend. (Nothing
       *  to do where no credits were held.) `storyKey`: for a story's
       *  beginning, the ticket of the story it began - what's held for it
       *  is then held under that story's own name until its first choice. */
      settle: (done?: { storyKey?: string }) => Promise<void>;
      /** credits held for this request, if the plan's own allowance was used up */
      credits?: number;
    }
  | { ok: false; response: NextResponse };

/** What an account must hold, or was charged. */
export interface CreditOffer {
  item: "story" | "character";
  price: number;
  balance: number;
}

/** The admin's test account starts with some credits - given once, ever
 *  (the store remembers the reference), and looked at once per server. */
const started = new Set<string>();
export async function starterCredits(account: Account | null) {
  if (!account?.isAdmin || started.has(account.id)) return;
  started.add(account.id);
  const given = await applyCredits(account.id, STARTER_CREDITS, "grant", "starter", "To begin with (the test account)").catch(() => null);
  if (!given?.ok) started.delete(account.id);
}

const notEnough = (o: CreditOffer) =>
  NextResponse.json(
    {
      error:
        o.item === "story"
          ? `This story needs ${o.price} credit${o.price === 1 ? "" : "s"} (one for each minute), and there ${o.balance === 1 ? "is" : "are"} ${o.balance} left.`
          : `A character needs ${o.price} credit${o.price === 1 ? "" : "s"}, and there ${o.balance === 1 ? "is" : "are"} ${o.balance} left.`,
      limited: "credits",
      credits: o,
    },
    { status: 402 },
  );

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
  // A day's ceiling on paid work, counted where every server sees it (the
  // admin's own account has ten times the room, for testing).
  const capKind: CapKind = b === "illustrate" || b === "tts" || b === "character" ? b : "story";
  if (!(await underDailyCap(session.user.id, capKind, me.user.isAdmin ? 10 : 1))) {
    return { ok: false, response: NextResponse.json({ error: "That's a great deal for one day! Please come back tomorrow.", limited: "day" }, { status: 429, headers: { "Retry-After": "3600" } }) };
  }
  const unavailable = { ok: false as const, response: NextResponse.json({ error: "Couldn't start that just now. Please try again." }, { status: 503 }) };
  // (the plan couldn't be read: nothing the plan counts is begun on a guess)
  if (me.stale && (stored(b) || (cost.needs && stored(cost.needs)))) return unavailable;
  // ---- credits (see lib/tiers: one a minute of story, three a character)
  const userId = session.user.id;
  const account = me.account;
  const mode = account?.plan.credits ?? "beyond";
  await starterCredits(account);
  // What this request is, in credits: a character; a story at its first
  // choice (charged then, once, under the story's own reference - asked
  // again, it's recognised); a story's beginning (nothing is charged, but
  // there must be enough for the story it begins).
  const item: CreditOffer["item"] | null = b === "character" ? "character" : (b === "story" && cost.key) || b === "start" ? "story" : null;
  const price = item === "character" ? CHARACTER_CREDITS : item ? Math.max(0, Math.round(cost.credits ?? 0)) : 0;
  // A story's credits are held from the moment it's begun (they leave the
  // balance at once) and become the spend at its first choice. A story
  // thrown away, or replaced by another, before that choice has them
  // returned.
  const beginning = b === "start";
  const fresh = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const storyRef = item === "story" && cost.key ? `story:${cost.key}`.replace(/[^\w.:-]/g, "").slice(0, 110) : null;
  const ref = beginning ? `${STORY_PENDING}${fresh}` : (storyRef ?? `${item}:${fresh}`);
  /** Take the credits (or, for a beginning, see that they're there). */
  // (`down`: the credits themselves couldn't be read or changed just now -
  // which is never reported as "you have none")
  const pay = async (): Promise<{ ok: true; spent: number } | { ok: false; offer: CreditOffer; down?: boolean }> => {
    if (!account || !item || !price) return { ok: true, spent: 0 };
    // (a new beginning takes the place of one not carried on: its credits
    // come back first)
    if (beginning) await releasePendingStories(userId, "Another story was begun instead: credits returned");
    // (set aside as the work begins - gone from the balance at once - and
    // settled or released when it's known how the work went)
    await heldCredits(userId).catch(() => null); // (first, anything left by work that never finished goes back)
    const paid = await holdCredits(userId, price, ref, what);
    if (paid.ok) return { ok: true, spent: paid.applied ? price : 0 };
    return { ok: false, offer: { item, price, balance: paid.balance }, down: paid.reason === "unavailable" };
  };
  const what = item === "story" ? `A ${price}-minute story` : "A character";
  // (a beginning's credits stay held when its opening has been written -
  // they're settled at the first choice - and go back if writing it fails)
  // (...and from then they're held under the name of the story begun, so
  // only that story's own first choice can spend them)
  const pendingFor = (key: string) => `${STORY_PENDING}${key}`.replace(/[^\w.:-]/g, "").slice(0, 110);
  const heldOpen = (spent: number) => ({
    ok: true as const,
    session,
    credits: spent,
    release: giveBack(spent),
    settle: async (done?: { storyKey?: string }) => {
      if (spent && done?.storyKey) await moveHold(userId, ref, pendingFor(done.storyKey));
    },
  });
  /** A story's first choice, where credits were set aside for that very
   *  story when it was begun: they're taken out of "waiting" before
   *  anything is written (so throwing the story away mid-writing can't
   *  have them back), become the spend when the part is written, and go
   *  back to waiting if writing it fails. Null: nothing is waiting for it. */
  const fromWaiting = async () => {
    if (beginning || !storyRef || !cost.key) return null;
    const waitingRef = pendingFor(cost.key);
    if (!(await moveHold(userId, waitingRef, storyRef))) return null;
    return {
      ok: true as const,
      session,
      credits: price,
      release: async () => void (await moveHold(userId, storyRef, waitingRef)),
      settle: async () => void (await settleHold(userId, storyRef, what)),
    };
  };
  /** Every request to the storyteller counts toward the sitting's cap,
   *  paid for with credits or not. */
  const sitting = async () => {
    const more = await take(session.user, { bucket: "segment" }).catch(() => null);
    if (!more || more.ok) return null;
    return { ok: false as const, response: NextResponse.json({ error: limitMessage(session.user, "segment", more.retryAfterSec), retryAfterSec: more.retryAfterSec, limited: "segment" }, { status: 429, headers: { "Retry-After": String(more.retryAfterSec) } }) };
  };
  const giveBack = (spent: number) => async () => {
    if (spent) await releaseHold(userId, ref, `${what}: it didn't work out, credits returned`);
  };
  const keep = (spent: number) => async () => {
    if (spent) await settleHold(userId, ref, what);
  };
  const nothing = async () => {};

  // A plan where everything costs credits (the admin's test account):
  // nothing is counted against an allowance - the credits are the limit.
  // (Where credits can't be kept at all, or can't be reached just now, the
  // plan's own allowance stands instead: the account is never locked out
  // of making things by the credit store being away.)
  if (mode === "always" && item && price && !me.stale && billingAvailable()) {
    if (item === "story") {
      const tooMuch = await sitting();
      if (tooMuch) return tooMuch;
      const waited = await fromWaiting();
      if (waited) return waited;
    }
    const paid = await pay();
    if (paid.ok) return beginning ? heldOpen(paid.spent) : { ok: true, session, credits: paid.spent, release: giveBack(paid.spent), settle: keep(paid.spent) };
    if (!paid.down) return { ok: false, response: notEnough(paid.offer) };
    console.error("[limits] credits unavailable: the plan's own allowance stands");
  }

  // A free story covers so many minutes (lib/tiers: FREE_STORY_MINUTES).
  // A longer one still uses the free story - and credits for the minutes
  // beyond it, set aside when it's begun and spent at its first choice.
  const freeCovers = FREE_STORY_MINUTES * CREDITS_PER_STORY_MINUTE;
  const long = item === "story" && price > freeCovers && mode === "auto" && Boolean(account) && !me.stale && billingAvailable();

  let took: Took;
  /** how the request itself was counted (before any second look) */
  let counted: Took | null = null;
  try {
    took = await take(session.user, cost);
    counted = took;
    // (already paid for: it's an ordinary request for more of that story)
    if (took.already && b !== "segment") took = await take(session.user, { bucket: "segment" });
  } catch (e) {
    // If the counter itself is unavailable, fail closed for the stored
    // product limits (the costly actions) but don't block reading in
    // progress.
    console.error("[limits] couldn't check usage", e);
    if (stored(b)) return unavailable;
    return { ok: true, session, release: nothing, settle: nothing };
  }
  if (!took.ok) {
    // The plan's allowance is used up: credits pay for more, if the person
    // has said yes and has them. (Only what the plan's own count of the
    // thing stopped - a story when its stories are used up, a character
    // when its designs are; not the cap on beginnings dropped unread.)
    const coverable = item && price && account && (took.limited === "story" || took.limited === "character") && took.limited === item;
    let offer: CreditOffer | undefined;
    if (coverable) {
      // A story at its first choice whose credits were set aside when it
      // was begun: nothing more is taken - that hold becomes the spend
      // once the next part is written (and stays held if writing it
      // fails, to be tried again).
      if (item === "story") {
        const tooMuch = await sitting();
        if (tooMuch) return tooMuch;
        const waited = await fromWaiting();
        if (waited) return waited;
      }
      const waiting = item === "story" && beginning ? await pendingStoryHold(userId) : null;
      const balance = await account.credits();
      // (beginning another gives back what's held for one not carried on)
      const free = balance === null ? null : balance + (beginning ? (waiting?.amount ?? 0) : 0);
      if (free !== null && free >= price) offer = { item, price, balance: free };
      // (said yes: in so many words, or by being on a plan that pays with
      // credits without asking each time)
      if (offer && (opts.useCredits || mode === "auto")) {
        const paid = await pay();
        if (paid.ok) return beginning ? heldOpen(paid.spent) : { ok: true, session, credits: paid.spent, release: giveBack(paid.spent), settle: keep(paid.spent) };
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
  // One of the plan's free stories, but longer than a free story covers:
  // the minutes beyond it are paid for with credits.
  if (long && counted && !counted.already) {
    const use = counted;
    const topUp = price - freeCovers;
    const extra = `${topUp / CREDITS_PER_STORY_MINUTE} minute${topUp === CREDITS_PER_STORY_MINUTE ? "" : "s"} beyond a free story`;
    const backUse = () => refund(userId, use.limited, use.at);
    // (its first choice: what was set aside when it was begun becomes the
    // spend - and stays set aside, to try again, if writing the part fails)
    const waited = await fromWaiting();
    if (waited) {
      return {
        ...waited,
        release: async (how?: { left?: boolean }) => {
          await waited.release();
          if (!how?.left) await backUse();
        },
      };
    }
    if (beginning) await releasePendingStories(userId, "Another story was begun instead: credits returned");
    await heldCredits(userId).catch(() => null);
    const paid = await holdCredits(userId, topUp, ref, `A ${price}-minute story: ${extra}`);
    if (paid.ok) {
      const spent = paid.applied ? topUp : 0;
      const back = async (how?: { left?: boolean }) => {
        if (spent) await releaseHold(userId, ref, "The story didn't work out: credits returned");
        if (!how?.left) await backUse();
      };
      // (held from now under the name of the story begun - see heldOpen)
      if (beginning) {
        return {
          ok: true,
          session,
          credits: spent,
          release: back,
          settle: async (done?: { storyKey?: string }) => {
            if (spent && done?.storyKey) await moveHold(userId, ref, pendingFor(done.storyKey));
          },
        };
      }
      return { ok: true, session, credits: spent, release: back, settle: async () => void (spent && (await settleHold(userId, ref, `A ${price}-minute story: ${extra}`))) };
    }
    // (not enough for the extra minutes, or the credits can't be reached:
    // the free story isn't used up on a story that can't be made)
    await backUse();
    if (paid.reason === "unavailable") return unavailable;
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `A standard story covers ${FREE_STORY_MINUTES} minutes. This one is ${price / CREDITS_PER_STORY_MINUTE}, which needs ${topUp} credit${topUp === 1 ? "" : "s"} for the extra - there ${paid.balance === 1 ? "is" : "are"} ${paid.balance}. Make it ${FREE_STORY_MINUTES} minutes or shorter and it's free.`,
          limited: "credits",
          credits: { item: "story", price: topUp, balance: paid.balance },
          freeMinutes: FREE_STORY_MINUTES,
        },
        { status: 402 },
      ),
    };
  }
  // (it turned out to be one of the plan's own after all - a new week has
  // begun since it was started: what was set aside for it goes back)
  // (and a beginning on the plan's own allowance takes the place of one
  // that was being paid for and never carried on)
  if (item === "story" && account && beginning) {
    await releasePendingStories(userId, "Another story was begun instead: credits returned").catch(() => 0);
  } else if (item === "story" && account && cost.key && !counted?.already) {
    await releaseHold(userId, pendingFor(cost.key), "The story was one of the plan's own: credits returned").catch(() => null);
  }
  const used = took.limited;
  // (walked away mid-work: the use stays used - asking again for the same
  // first choice is recognised and costs nothing more)
  return { ok: true, session, release: (how) => (how?.left ? Promise.resolve() : refund(userId, used, took.at)), settle: nothing };
}
