import { cache } from "react";
import { auth } from "./auth";
import { getUser } from "./users";
import { creditBalance, getSubscription, planOf, weeklyCredits, type Subscription } from "./billing";
import { PLANS, tierIdFor, type TierId, type TierInfo } from "@/lib/tiers";

/**
 * Who an account is and what it may do, as the server's own records say
 * right now: its plan, whether it's the admin, whether it has been
 * suspended, and its on-demand credits.
 *
 * Everything that costs money to do, and everything only some accounts may
 * see, asks here - never the sign-in cookie. The cookie says who someone
 * is; it also carries a copy of their plan and admin flag for drawing the
 * page, but that copy can be up to ten minutes old, and a copy isn't a
 * permission: an account that was just upgraded, downgraded, suspended or
 * deleted is treated as what it is now.
 *
 * (The profile is read afresh and kept for a few seconds per server, so a
 * page of a story's paintings doesn't read it twenty times; anything on
 * this server that changes an account drops the kept copy at once.)
 */
export interface Account {
  id: string;
  username: string | null;
  isAdmin: boolean;
  /** Barred from making anything (a refunded payment, abuse). */
  suspended: boolean;
  /** The plan in force now: Admin for the admin; else a paid-up
   *  subscription's; else the one set on the profile; else Free. */
  tier: TierId;
  plan: TierInfo;
  subscription: Subscription | null;
  /** Bought credits, read from the store each time it's asked. */
  credits: () => Promise<number | null>;
  /** This week's credits from the plan still to use (0 on a plan without
   *  them; null: couldn't be read). */
  weekly: () => Promise<number | null>;
  /** Everything that can be spent now: this week's credits and bought ones. */
  spendable: () => Promise<number | null>;
}

const KEEP_MS = 15_000;
const kept = new Map<string, { at: number; account: Promise<Account | null> }>();

/** Forget what's kept of an account (call after changing it). */
export function forgetAccount(userId: string) {
  kept.delete(userId);
}

async function read(userId: string): Promise<Account | null> {
  // (the profile and the subscription are asked for together; an admin's
  // subscription, if there were one, is simply not used)
  const [profile, sub] = await Promise.all([getUser(userId, { fresh: true }), getSubscription(userId).catch(() => null)]);
  // (signed in, but the account is gone - deleted since the cookie was
  // made: not an account)
  if (!profile) return null;
  const subscription = profile.isAdmin ? null : sub;
  const tier: TierId = profile.isAdmin ? "admin" : (() => {
    const paid = planOf(subscription);
    // (nobody is made an admin by a plan name alone)
    return paid && paid !== "admin" && PLANS[paid] ? paid : tierIdFor({ tier: profile.tier, isAdmin: false });
  })();
  return {
    id: profile.id,
    username: profile.username,
    isAdmin: Boolean(profile.isAdmin),
    suspended: Boolean(profile.suspended) && !profile.isAdmin,
    tier,
    plan: PLANS[tier],
    subscription,
    // (always the balance as it is this moment: it's never kept)
    credits: () => creditBalance(userId),
    weekly: () => (PLANS[tier].limits.weeklyCredits ? weeklyCredits(userId, PLANS[tier].limits.weeklyCredits).then((w) => (w ? w.left : null)) : Promise.resolve(0)),
    spendable: async () => {
      const [bought, week] = await Promise.all([creditBalance(userId), PLANS[tier].limits.weeklyCredits ? weeklyCredits(userId, PLANS[tier].limits.weeklyCredits) : Promise.resolve({ left: 0 })]);
      return bought === null ? null : bought + (week?.left ?? 0);
    },
  };
}

/** The account with this id, from the records (null: there isn't one). If
 *  the records can't be read, this throws: callers refuse what they were
 *  about to allow rather than guess. */
export function accountOf(userId: string): Promise<Account | null> {
  const now = Date.now();
  const hit = kept.get(userId);
  if (hit && now - hit.at < KEEP_MS) return hit.account;
  const account = read(userId);
  kept.set(userId, { at: now, account });
  account.then((a) => a ?? kept.delete(userId), () => kept.delete(userId));
  if (kept.size > 5000) for (const [k, v] of kept) if (now - v.at > KEEP_MS) kept.delete(k);
  return account;
}

/** The account making this request (null: signed out, or no such account).
 *  Asked once per request however many parts of the page ask. */
export const currentAccount = cache(async (): Promise<Account | null> => {
  const session = await auth();
  const id = session?.user?.id;
  return id ? accountOf(id) : null;
});

/** The admin making this request, or null for anyone else - by the
 *  records, not the cookie (and null if the records can't be read: nobody
 *  is the admin on a guess). */
export async function currentAdmin(): Promise<Account | null> {
  try {
    const account = await currentAccount();
    return account?.isAdmin && !account.suspended ? account : null;
  } catch (e) {
    console.error("[entitlements] couldn't check the admin", e);
    return null;
  }
}
