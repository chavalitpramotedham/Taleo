import type { Session } from "next-auth";
import type { Account } from "./entitlements";
import { billingAvailable } from "./billing";
import { peekLimit, peekStart, starterCredits } from "./limits";
import { listCharacters } from "./characters";
import { CHARACTER_CREDITS, STORY_CREDITS_RANGE, type CreditsMode, type TierId } from "@/lib/tiers";

/**
 * What an account can do right now, in one piece - for the account menu's
 * summary and the details page: stories left on the plan (to finish, and
 * to begin), characters kept and still to be designed, credits, and what
 * credits buy. Read from the records each time (see server/entitlements);
 * the server checks again when anything is actually made.
 */
export interface Rights {
  tier: TierId;
  plan: string;
  isAdmin: boolean;
  suspended: boolean;
  /** How the plan uses credits: "always" (everything costs them) or
   *  "beyond" (the plan's allowance first). */
  creditsMode: CreditsMode;
  /** null: not kept here, or unreadable just now. */
  credits: number | null;
  /** Whether this account may add credits to itself by hand (the admin's
   *  test account only). */
  canAddCredits: boolean;
  prices: { story: [number, number]; character: number };
  stories: {
    /** New stories the plan still allows (null: the plan has no limit). */
    left: number | null;
    /** How many may still be begun (dropped ones included). */
    startsLeft: number | null;
    /** The stretch the plan counts over, and when the next opens up. */
    windowHours: number | null;
    /** Counted by the calendar week (else over the last `windowHours`). */
    weekly: boolean;
    nextInSec: number;
  };
  characters: {
    saved: number;
    /** How many can be kept (null: no limit). */
    limit: number | null;
    /** Designs and redraws the plan still allows (null: no limit). */
    designsLeft: number | null;
    /** What the free designs are counted over: "week", "month", or null (a rolling stretch, or no limit). */
    designsPer: "week" | "month" | null;
  };
}

export async function rightsOf(account: Account): Promise<Rights> {
  // (the plan checks ask "who" in the cookie's shape: who they are, what
  // the records say they may do)
  const who = { id: account.id, isAdmin: account.isAdmin, tier: account.tier, username: account.username } as unknown as Session["user"];
  await starterCredits(account);
  const limits = account.plan.limits;
  const [story, start, design, saved, credits] = await Promise.all([
    peekLimit(who, "story"),
    peekStart(who),
    peekLimit(who, "character"),
    listCharacters(account.id).then((c) => c.length, () => 0),
    billingAvailable() ? account.credits() : Promise.resolve(null),
  ]);
  return {
    tier: account.tier,
    plan: account.plan.name,
    isAdmin: account.isAdmin,
    suspended: account.suspended,
    creditsMode: account.plan.credits,
    credits,
    canAddCredits: account.isAdmin && billingAvailable(),
    prices: { story: STORY_CREDITS_RANGE, character: CHARACTER_CREDITS },
    stories: {
      left: limits.stories ? (story.left ?? 0) : null,
      startsLeft: limits.stories ? (start.ok ? (start.left ?? 0) : 0) : null,
      windowHours: limits.stories?.hours ?? null,
      weekly: Boolean(limits.stories?.week),
      nextInSec: story.ok ? 0 : story.retryAfterSec,
    },
    characters: { saved, limit: limits.characters, designsLeft: limits.designs ? (design.left ?? 0) : null, designsPer: limits.designs?.month ? "month" : limits.designs?.week ? "week" : null },
  };
}
