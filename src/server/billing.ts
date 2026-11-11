import { promises as fs } from "fs";
import path from "path";
import { metricsEnabled, pipeline } from "./metrics";
import type { TierId } from "@/lib/tiers";

/**
 * What an account has paid for: its subscription (which plan, and until
 * when) and its on-demand credits - a balance, and the ledger of every
 * change to it.
 *
 * This is money, so it is kept apart from the rest of the account and held
 * to stricter rules than anything else the app stores:
 *
 *  - It lives in Redis (the private store the metrics use), never in the
 *    file store: that one is publicly readable by address, and can only be
 *    rewritten whole (two servers writing at once lose one of the writes).
 *  - A balance only ever changes through `applyCredits`, one atomic step
 *    on the store itself: check there is enough, change the balance, write
 *    the ledger line. Two requests arriving together can't both spend the
 *    last credit, and a balance can never go below nothing.
 *  - Every change carries a reference (`ref`) and is applied once only: a
 *    payment notice delivered twice, or a request retried, changes the
 *    balance the first time and is recognised the second. Refunds are
 *    changes of their own, tied to what they refund.
 *  - The ledger is only ever added to.
 *
 * Without Redis: on a developer's machine it is kept in memory and a local
 * file, so everything can be tried; on a deployed site it is simply not
 * available - every balance reads as nothing, spending is refused and
 * granting fails loudly - rather than pretended.
 */

export type SubscriptionStatus = "active" | "past_due" | "canceled";

/** A subscription as the payment provider last reported it. */
export interface Subscription {
  plan: TierId;
  status: SubscriptionStatus;
  /** The end of the period paid for (ms). The plan holds until then, and
   *  for a few days after while a failed payment is retried. */
  periodEnd: number;
  /** The provider's own names for the customer and the subscription. */
  provider?: string;
  customerId?: string;
  subscriptionId?: string;
  updatedAt: number;
}

/** One line of the ledger. */
export interface CreditEntry {
  /** What it was for - unique: the same ref is never applied twice. */
  ref: string;
  at: number;
  /** Credits added (a purchase, a refund, a gift) or taken (a spend). */
  delta: number;
  /** A spend goes in two steps: "hold" sets the credits aside as the work
   *  begins (they leave the balance at once), then either "spend" settles
   *  it when the work is done (no further change: delta 0) or "release"
   *  puts them back because it failed. */
  reason: "purchase" | "spend" | "refund" | "grant" | "adjust" | "hold" | "release";
  /** A few words for a person reading the ledger. */
  note?: string;
  /** The balance once this was applied. */
  balance: number;
}

export type CreditResult =
  | { ok: true; balance: number; applied: boolean } // applied: false = seen before, nothing changed
  | { ok: false; balance: number; reason: "insufficient" | "unavailable" };

const LEDGER_KEPT = 500;
const REF_KEPT_S = 400 * 86_400; // how long a ref is remembered (well past any retry or dispute)
const GRACE_MS = 3 * 86_400_000;

const onVercel = Boolean(process.env.VERCEL);
/** Whether paid state can be kept here at all. */
export const billingAvailable = () => metricsEnabled() || !onVercel;

const balKey = (id: string) => `bill:cr:${id}`;
const ledgerKey = (id: string) => `bill:ledger:${id}`;
const refKey = (id: string, ref: string) => `bill:ref:${id}:${ref}`;
const subKey = (id: string) => `bill:sub:${id}`;
const safe = (s: string) => /^[\w.:-]{1,120}$/.test(s);

// One step on the store: seen before? enough? then balance, ref and ledger
// together. Returns {state, balance}: 1 applied, 2 seen before, 0 not enough.
const APPLY = `
if redis.call('EXISTS', KEYS[2]) == 1 then return {2, tonumber(redis.call('GET', KEYS[1]) or '0')} end
local bal = tonumber(redis.call('GET', KEYS[1]) or '0')
local delta = tonumber(ARGV[1])
if bal + delta < 0 then return {0, bal} end
local nb = redis.call('INCRBY', KEYS[1], delta)
local entry = string.gsub(ARGV[2], '"balance":%-?%d+', '"balance":' .. nb, 1)
redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[3]))
redis.call('LPUSH', KEYS[3], entry)
redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[4]) - 1)
return {1, nb}`;

// ---- a developer's machine: memory, and a file so it survives a restart
interface Local {
  balance: number;
  refs: Record<string, 1>;
  ledger: CreditEntry[];
  holds?: Record<string, { amount: number; at: number }>;
  sub?: Subscription | null;
}
const localFile = (id: string) => path.join(process.cwd(), ".data", "billing", `${id}.json`);
// (read from the file each time - pages and API routes are separate
// programs here, each with its own memory - and changed one at a time)
async function localOf(id: string): Promise<Local> {
  try {
    return JSON.parse(await fs.readFile(localFile(id), "utf8")) as Local;
  } catch {
    return { balance: 0, refs: {}, ledger: [] };
  }
}
let localTurn: Promise<unknown> = Promise.resolve();
const localInTurn = <T>(work: () => Promise<T>): Promise<T> => {
  const run = localTurn.then(work, work);
  localTurn = run.catch(() => {});
  return run;
};
async function localSave(id: string, rec: Local) {
  try {
    await fs.mkdir(path.dirname(localFile(id)), { recursive: true });
    await fs.writeFile(localFile(id), JSON.stringify(rec));
  } catch {}
}

/** The account's credit balance - null if it can't be read just now (which
 *  is never taken to mean "none": callers decide what an unknown balance
 *  allows). */
export async function creditBalance(userId: string): Promise<number | null> {
  if (!safe(userId)) return 0;
  if (!metricsEnabled()) return onVercel ? 0 : (await localOf(userId)).balance;
  try {
    const [v] = await pipeline([["GET", balKey(userId)]]);
    return Math.max(0, Number(v ?? 0) || 0);
  } catch (e) {
    console.error("[billing] couldn't read a balance", e);
    return null;
  }
}

/**
 * Changes a balance by `delta` (negative to spend), once per `ref`.
 * Spending more than there is changes nothing and says so.
 */
export async function applyCredits(userId: string, delta: number, reason: CreditEntry["reason"], ref: string, note?: string): Promise<CreditResult> {
  if (!safe(userId) || !safe(ref) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) throw new Error("Not a valid change to a balance.");
  const entry: CreditEntry = { ref, at: Date.now(), delta, reason, note: note?.slice(0, 200), balance: 0 };
  if (!metricsEnabled()) {
    if (onVercel) return { ok: false, balance: 0, reason: "unavailable" };
    return localInTurn(async (): Promise<CreditResult> => {
      const rec = await localOf(userId);
      if (rec.refs[ref]) return { ok: true, balance: rec.balance, applied: false };
      if (rec.balance + delta < 0) return { ok: false, balance: rec.balance, reason: "insufficient" };
      rec.balance += delta;
      rec.refs[ref] = 1;
      rec.ledger.unshift({ ...entry, balance: rec.balance });
      rec.ledger.length = Math.min(rec.ledger.length, LEDGER_KEPT);
      await localSave(userId, rec);
      return { ok: true, balance: rec.balance, applied: true };
    });
  }
  try {
    const [out] = await pipeline([["EVAL", APPLY, 3, balKey(userId), refKey(userId, ref), ledgerKey(userId), delta, JSON.stringify(entry), REF_KEPT_S, LEDGER_KEPT]]);
    const [state, balance] = (Array.isArray(out) ? out : [0, 0]).map(Number);
    if (state === 0) return { ok: false, balance, reason: "insufficient" };
    return { ok: true, balance, applied: state === 1 };
  } catch (e) {
    console.error("[billing] couldn't change a balance", e);
    return { ok: false, balance: 0, reason: "unavailable" };
  }
}

/** Takes `amount` credits for `ref`, if the account has them. */
export const spendCredits = (userId: string, amount: number, ref: string, note?: string) => applyCredits(userId, -Math.abs(amount), "spend", ref, note);
/** Gives back what `ref` spent (once, however often it's asked). */
export const refundCredits = (userId: string, amount: number, ref: string, note?: string) => applyCredits(userId, Math.abs(amount), "refund", `refund:${ref}`, note);

/** The newest lines of an account's ledger. */
export async function creditLedger(userId: string, limit = 50): Promise<CreditEntry[]> {
  if (!safe(userId)) return [];
  if (!metricsEnabled()) return onVercel ? [] : (await localOf(userId)).ledger.slice(0, limit);
  try {
    const [rows] = await pipeline([["LRANGE", ledgerKey(userId), 0, limit - 1]]);
    return (Array.isArray(rows) ? rows : []).flatMap((r) => {
      try {
        return [(typeof r === "string" ? JSON.parse(r) : r) as CreditEntry];
      } catch {
        return [];
      }
    });
  } catch (e) {
    console.error("[billing] couldn't read a ledger", e);
    return [];
  }
}

/** The account's subscription as last recorded (null: none, or unreadable -
 *  either way no paid plan is assumed). */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  if (!safe(userId)) return null;
  if (!metricsEnabled()) return onVercel ? null : ((await localOf(userId)).sub ?? null);
  try {
    const [raw] = await pipeline([["GET", subKey(userId)]]);
    return raw ? ((typeof raw === "string" ? JSON.parse(raw) : raw) as Subscription) : null;
  } catch (e) {
    console.error("[billing] couldn't read a subscription", e);
    return null;
  }
}

/** Records what the payment provider says the subscription now is. A notice
 *  older than the one already recorded is ignored (they can arrive out of
 *  order). */
export async function setSubscription(userId: string, sub: Omit<Subscription, "updatedAt"> | null, at = Date.now()): Promise<void> {
  if (!safe(userId)) throw new Error("Not an account.");
  const current = await getSubscription(userId);
  if (current && current.updatedAt > at) return;
  const next = sub ? { ...sub, updatedAt: at } : null;
  if (!metricsEnabled()) {
    if (onVercel) throw new Error("Billing isn't available here: connect Redis first.");
    return localInTurn(async () => {
      const rec = await localOf(userId);
      rec.sub = next;
      await localSave(userId, rec);
    });
  }
  await pipeline([next ? ["SET", subKey(userId), JSON.stringify(next)] : ["DEL", subKey(userId)]]);
}

/** The plan a subscription gives right now: its own while it's paid up
 *  (and for a few days' grace after a period ends, while a failed payment
 *  is retried); none once it has lapsed or been cancelled and run out. */
export function planOf(sub: Subscription | null, now = Date.now()): TierId | null {
  if (!sub) return null;
  if (sub.status === "canceled") return now < sub.periodEnd ? sub.plan : null;
  return now < sub.periodEnd + GRACE_MS ? sub.plan : null;
}

/** Removes everything kept about an account's credits and subscription
 *  (the account was deleted). */
export async function forgetBilling(userId: string): Promise<void> {
  if (!safe(userId)) return;
  if (!metricsEnabled()) {
    if (!onVercel) await localInTurn(() => fs.unlink(localFile(userId)).catch(() => {}));
    return;
  }
  await pipeline([["DEL", balKey(userId), ledgerKey(userId), subKey(userId), holdsKey(userId)]]);
}

// ------------------------------------------------------------------ holds
//
// Paying for a piece of work is a transaction in two steps, so credits are
// never taken for something that wasn't delivered and never spent twice:
//
//   hold     as the work begins, the credits are set aside: they leave the
//            balance at once (nothing else can spend them) and the ledger
//            says "hold".
//   settle   the work was done: the hold becomes the spend. The balance
//            doesn't change again; the ledger says "spend".
//   release  the work failed or was stopped: the credits go back and the
//            ledger says "release". The same piece of work can then be
//            tried, and held for, again.
//
// A hold nobody settled or released (the server stopped mid-work) is
// released once it is older than any piece of work can take.

const holdsKey = (id: string) => `bill:holds:${id}`;
/** No request runs longer than five minutes; well past that, a hold is stale. */
const HOLD_STALE_MS = 20 * 60_000;

// KEYS: balance, holds, ledger, ref-of-the-work. ARGV: ref, amount, entry, now, ledger kept.
const HOLD = `
if redis.call('HEXISTS', KEYS[2], ARGV[1]) == 1 or redis.call('EXISTS', KEYS[4]) == 1 then return {2, tonumber(redis.call('GET', KEYS[1]) or '0')} end
local bal = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[2])
if bal < amount then return {0, bal} end
local nb = redis.call('DECRBY', KEYS[1], amount)
redis.call('HSET', KEYS[2], ARGV[1], amount .. ':' .. ARGV[4])
local entry = string.gsub(ARGV[3], '"balance":%-?%d+', '"balance":' .. nb, 1)
redis.call('LPUSH', KEYS[3], entry)
redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[5]) - 1)
return {1, nb}`;
// KEYS: as above. ARGV: ref, 'spend' | 'release', entry, ref kept (s), ledger kept.
const SETTLE = `
local h = redis.call('HGET', KEYS[2], ARGV[1])
if not h then return {2, tonumber(redis.call('GET', KEYS[1]) or '0'), 0} end
local amount = tonumber(string.match(h, '^(%d+)'))
redis.call('HDEL', KEYS[2], ARGV[1])
local nb
local delta = 0
if ARGV[2] == 'release' then
  nb = redis.call('INCRBY', KEYS[1], amount)
  delta = amount
else
  nb = tonumber(redis.call('GET', KEYS[1]) or '0')
  redis.call('SET', KEYS[4], '1', 'EX', tonumber(ARGV[4]))
end
local entry = string.gsub(ARGV[3], '"balance":%-?%d+', '"balance":' .. nb, 1)
entry = string.gsub(entry, '"delta":%-?%d+', '"delta":' .. delta, 1)
entry = string.gsub(entry, '"amount":%-?%d+', '"amount":' .. amount, 1)
redis.call('LPUSH', KEYS[3], entry)
redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[5]) - 1)
return {1, nb, amount}`;

/** Sets `amount` credits aside for the piece of work `ref`, if the account
 *  has them. `applied: false`: this work is already held for, or already
 *  paid for - nothing more is taken. */
export async function holdCredits(userId: string, amount: number, ref: string, note?: string): Promise<CreditResult> {
  if (!safe(userId) || !safe(ref) || !Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) throw new Error("Not a valid hold.");
  const now = Date.now();
  const entry: CreditEntry = { ref, at: now, delta: -amount, reason: "hold", note: note?.slice(0, 200), balance: 0 };
  if (!metricsEnabled()) {
    if (onVercel) return { ok: false, balance: 0, reason: "unavailable" };
    return localInTurn(async (): Promise<CreditResult> => {
      const rec = await localOf(userId);
      rec.holds ??= {};
      if (rec.holds[ref] || rec.refs[ref]) return { ok: true, balance: rec.balance, applied: false };
      if (rec.balance < amount) return { ok: false, balance: rec.balance, reason: "insufficient" };
      rec.balance -= amount;
      rec.holds[ref] = { amount, at: now };
      rec.ledger.unshift({ ...entry, balance: rec.balance });
      rec.ledger.length = Math.min(rec.ledger.length, LEDGER_KEPT);
      await localSave(userId, rec);
      return { ok: true, balance: rec.balance, applied: true };
    });
  }
  try {
    const [out] = await pipeline([["EVAL", HOLD, 4, balKey(userId), holdsKey(userId), ledgerKey(userId), refKey(userId, ref), ref, amount, JSON.stringify(entry), now, LEDGER_KEPT]]);
    const [state, balance] = (Array.isArray(out) ? out : [0, 0]).map(Number);
    if (state === 0) return { ok: false, balance, reason: "insufficient" };
    return { ok: true, balance, applied: state === 1 };
  } catch (e) {
    console.error("[billing] couldn't hold credits", e);
    return { ok: false, balance: 0, reason: "unavailable" };
  }
}

/** Ends the hold for `ref`: "spend" (the work was done) or "release" (it
 *  wasn't: the credits go back). Asked twice, or with no such hold, it
 *  changes nothing. Returns whether it did, and the credits concerned. */
async function endHold(userId: string, ref: string, how: "spend" | "release", note?: string): Promise<{ done: boolean; amount: number }> {
  if (!safe(userId) || !safe(ref)) return { done: false, amount: 0 };
  // (the amount and the change to the balance are filled in from the hold itself)
  const entry = { ref: `${how === "spend" ? "settled" : "released"}:${ref}`, at: Date.now(), delta: 0, reason: how, note: note?.slice(0, 200), balance: 0, amount: 0 };
  if (!metricsEnabled()) {
    if (onVercel) return { done: false, amount: 0 };
    return localInTurn(async () => {
      const rec = await localOf(userId);
      const held = rec.holds?.[ref];
      if (!held) return { done: false, amount: 0 };
      delete rec.holds![ref];
      if (how === "release") rec.balance += held.amount;
      else rec.refs[ref] = 1;
      rec.ledger.unshift({ ...entry, delta: how === "release" ? held.amount : 0, amount: held.amount, balance: rec.balance } as CreditEntry);
      rec.ledger.length = Math.min(rec.ledger.length, LEDGER_KEPT);
      await localSave(userId, rec);
      return { done: true, amount: held.amount };
    });
  }
  try {
    const [out] = await pipeline([["EVAL", SETTLE, 4, balKey(userId), holdsKey(userId), ledgerKey(userId), refKey(userId, ref), ref, how, JSON.stringify(entry), REF_KEPT_S, LEDGER_KEPT]]);
    const [state, , amount] = (Array.isArray(out) ? out : [0, 0, 0]).map(Number);
    return { done: state === 1, amount: amount || 0 };
  } catch (e) {
    console.error(`[billing] couldn't ${how === "spend" ? "settle" : "release"} a hold`, e);
    return { done: false, amount: 0 };
  }
}
/** The work was done: the hold becomes the spend. */
export const settleHold = (userId: string, ref: string, note?: string) => endHold(userId, ref, "spend", note);
/** The work failed or was stopped: the held credits go back. */
export const releaseHold = (userId: string, ref: string, note?: string) => endHold(userId, ref, "release", note);

/** A story's credits are held from the moment it's begun until its first
 *  choice - which may be a good while later (a parent reading the opening
 *  pages aloud) - so that hold is given a day before it counts as left
 *  behind. Everything else is over in minutes. */
export const STORY_PENDING = "story:pending:";
const STORY_PENDING_STALE_MS = 24 * 3600_000;

/** Every hold on an account as it stands (null: couldn't be read). */
async function listHolds(userId: string): Promise<[string, { amount: number; at: number }][] | null> {
  if (!metricsEnabled()) {
    if (onVercel) return null;
    return Object.entries((await localOf(userId)).holds ?? {});
  }
  try {
    const [raw] = await pipeline([["HGETALL", holdsKey(userId)]]);
    const flat = Array.isArray(raw) ? raw.map(String) : raw && typeof raw === "object" ? Object.entries(raw as Record<string, unknown>).flat().map(String) : [];
    const holds: [string, { amount: number; at: number }][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const [amount, at] = flat[i + 1].split(":").map(Number);
      holds.push([flat[i], { amount: amount || 0, at: at || 0 }]);
    }
    return holds;
  } catch (e) {
    console.error("[billing] couldn't read the holds", e);
    return null;
  }
}

/** What's set aside right now for work in progress - after releasing any
 *  hold left behind by work that never finished. Null if it can't be read. */
export async function heldCredits(userId: string): Promise<number | null> {
  if (!safe(userId)) return null;
  const now = Date.now();
  const holds = await listHolds(userId);
  if (!holds) return null;
  let held = 0;
  for (const [ref, h] of holds) {
    const stale = ref.startsWith(STORY_PENDING) ? STORY_PENDING_STALE_MS : HOLD_STALE_MS;
    if (now - h.at > stale) await releaseHold(userId, ref, ref.startsWith(STORY_PENDING) ? "The story was never carried on: credits returned" : "The work never finished: credits returned");
    else held += h.amount;
  }
  return held;
}

/** The credits held for a story that's been begun but hasn't reached its
 *  first choice (there is at most one such story at a time). */
export async function pendingStoryHold(userId: string): Promise<{ ref: string; amount: number } | null> {
  if (!safe(userId)) return null;
  const holds = (await listHolds(userId)) ?? [];
  const mine = holds.filter(([ref]) => ref.startsWith(STORY_PENDING)).sort((a, b) => b[1].at - a[1].at)[0];
  return mine ? { ref: mine[0], amount: mine[1].amount } : null;
}

/** Gives back whatever is held for stories begun and not carried on (one
 *  was thrown away, or another begun in its place). Returns the credits
 *  returned. */
export async function releasePendingStories(userId: string, note: string): Promise<number> {
  if (!safe(userId)) return 0;
  let back = 0;
  for (const [ref] of ((await listHolds(userId)) ?? []).filter(([r]) => r.startsWith(STORY_PENDING))) back += (await releaseHold(userId, ref, note)).amount;
  return back;
}

/** Notes that `ref` has been paid for (by settling some other hold), so
 *  asking to pay for it again takes nothing. */
export async function markPaid(userId: string, ref: string): Promise<void> {
  if (!safe(userId) || !safe(ref)) return;
  if (!metricsEnabled()) {
    if (onVercel) return;
    return localInTurn(async () => {
      const rec = await localOf(userId);
      rec.refs[ref] = 1;
      await localSave(userId, rec);
    });
  }
  await pipeline([["SET", refKey(userId, ref), "1", "EX", REF_KEPT_S]]).catch((e) => console.error("[billing] couldn't note a payment", e));
}

/** Whether `ref` was paid for with credits. */
export async function wasPaid(userId: string, ref: string): Promise<boolean> {
  if (!safe(userId) || !safe(ref)) return false;
  if (!metricsEnabled()) return onVercel ? false : Boolean((await localOf(userId)).refs[ref]);
  try {
    const [n] = await pipeline([["EXISTS", refKey(userId, ref)]]);
    return Number(n) === 1;
  } catch {
    return false;
  }
}
