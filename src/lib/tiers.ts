/**
 * Account plans and their allowances - the one place that says what each
 * plan may do. The server enforces these numbers and the Account pages show
 * them; nothing else in the app carries a limit of its own. Adding a paid
 * plan means adding a row to PLANS (and setting `tier` on the accounts that
 * bought it) - no other code changes.
 */
import { STORY_LENGTHS, lengthOf } from "./ages";

export type TierId = "free" | "plus" | "pro" | "admin";

/** "So many, per so many hours" - or, with `week`, so many in each
 *  calendar week (Monday to Sunday: everything is counted afresh as the
 *  week begins, whenever in the week it was used). */
export interface Allowance {
  count: number;
  hours: number;
  week?: boolean;
  /** ...or in each calendar month (from the 1st). */
  month?: boolean;
}
/** One a month, by the calendar. */
const MONTHLY = (count: number): Allowance => ({ count, hours: 720, month: true });
/** One a week, by the calendar. */
const WEEKLY = (count: number): Allowance => ({ count, hours: 168, week: true });
/** The weeks are counted in this one clock for everyone (hours ahead of
 *  UTC): a week begins at Monday's midnight there. */
export const WEEK_UTC_OFFSET_HOURS = 8;
/** When the calendar month containing `at` began, and when the next does
 *  (ms; by the same clock as the weeks). */
export function monthOf(at: number): { start: number; end: number } {
  const shift = WEEK_UTC_OFFSET_HOURS * 3600_000;
  const d = new Date(at + shift);
  return { start: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - shift, end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - shift };
}
/** When the calendar week containing `at` began, and when the next does (ms). */
export function weekOf(at: number): { start: number; end: number } {
  const shift = WEEK_UTC_OFFSET_HOURS * 3600_000;
  const d = new Date(at + shift);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday) - shift;
  return { start, end: start + 7 * 86_400_000 };
}

export interface TierLimits {
  /** New stories (null: no limit). A story counts once its first choice
   *  is made - one begun and dropped before that doesn't. */
  stories: Allowance | null;
  /** How many stories may be begun and dropped before their first choice
   *  (a change of mind about the theme, say), on top of the stories
   *  themselves and over the same stretch of time. */
  changesOfMind: number;
  /** Credits the plan gives at the start of each calendar week. Any left
   *  when the week ends are gone: they never add up, and they're used
   *  before credits that were bought. */
  weeklyCredits: number;
  /** Custom characters that can be kept. */
  characters: number | null;
  /** Character designs and redraws (each one is paid AI work). */
  designs: Allowance | null;
  /** How many pages at the start of each part the quicker painter takes. */
  quickPages: number;
  /** Safety caps on the paid AI work inside a story. They're far above
   *  normal use - their job is to stop anyone scripting the service and
   *  running up the bill, not to limit families. */
  burst: { minutes: number; segment: number; illustrate: number; tts: number } | null;
  /** Whether what's sent to be painted or published must be the server's
   *  own writing (see server/tickets). */
  verified: boolean;
}

export interface TierRow {
  label: string;
  value: string;
  note?: string;
}

export interface TierInfo {
  id: TierId;
  name: string;
  blurb: string;
  limits: TierLimits;
  /** How this plan uses credits (see CreditsMode). */
  credits: CreditsMode;
  /** Extra headline rows beyond those worked out from the limits. */
  extras?: TierRow[];
  /** What it costs each month, in US dollars (0: nothing; absent: not
   *  something that's bought). */
  monthlyUsd?: number;
}

/** The plans that can be bought, cheapest first. */
export const PAID_PLANS = ["plus", "pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export const isPaidPlan = (v: unknown): v is PaidPlan => v === "plus" || v === "pro";
/** The plans a person can be on, in order (the admin's isn't one). */
export const PUBLIC_PLANS: TierId[] = ["free", "plus", "pro"];
const SAFETY = { minutes: 30, segment: 16, illustrate: 80, tts: 400 };

export const PLANS: Record<TierId, TierInfo> = {
  free: {
    id: "free",
    // (the plan everyone has, and what it's called; it costs nothing)
    name: "Basic",
    blurb: "Your starter pack for bedtime",
    monthlyUsd: 0,
    // (credits an account holds are used, without asking each time, once
    // the week's free story or the month's free character is gone)
    credits: "auto",
    limits: {
      // (one free story each calendar week, one free character each
      // calendar month)
      stories: WEEKLY(1),
      changesOfMind: 3,
      weeklyCredits: 0,
      characters: 3,
      designs: MONTHLY(1),
      quickPages: 2,
      burst: SAFETY,
      verified: true,
    },
  },
  plus: {
    id: "plus",
    name: "Plus",
    blurb: "A story most nights of the week",
    monthlyUsd: 12.99,
    credits: "auto",
    limits: { stories: WEEKLY(2), changesOfMind: 4, weeklyCredits: 5, characters: 6, designs: MONTHLY(2), quickPages: 2, burst: SAFETY, verified: true },
  },
  pro: {
    id: "pro",
    name: "Pro",
    blurb: "Long adventures, every night",
    monthlyUsd: 29.99,
    credits: "auto",
    limits: { stories: WEEKLY(4), changesOfMind: 6, weeklyCredits: 8, characters: 10, designs: MONTHLY(4), quickPages: 2, burst: SAFETY, verified: true },
  },
  admin: {
    id: "admin",
    name: "Admin",
    blurb: "Unlimited storytelling bedtime goodness, just for me",
    credits: "auto",
    // (the same free story a week and free character a month as the Free plan, so
    // both flows can be tried: free first, then credits. Room for ten
    // saved characters where Free has three, and plenty of beginnings.)
    limits: { stories: WEEKLY(1), changesOfMind: 50, weeklyCredits: 0, characters: 10, designs: MONTHLY(1), quickPages: 1, burst: null, verified: false },
    extras: [
      { label: "Adding credits", value: "Any time" },
      { label: "Admin dashboard", value: "Full access" },
    ],
  },
};

/**
 * Credits: what an account can hold on top of its plan.
 *
 * One credit is one minute of story. A story costs as many credits as the
 * length chosen for it (3 to 8); a character, new or painted again, costs
 * one. Reading anything already made is always free.
 *
 * How a plan uses them (`credits` on the plan - the one place to change
 * it):
 *   "beyond"  the plan's own allowance goes first and costs nothing; once
 *             it is used up, credits pay for more (the Free plan)
 *   "auto"    the same - the plan's free ones first, then credits - but
 *             without being asked each time: the page says what the next
 *             one will cost, and making it is the yes (the admin's test
 *             account, so both the free and the credit flow can be tried)
 *   "always"  every story and character costs credits (no plan uses this
 *             now; kept so a credits-only plan needs no new code)
 * (These prices follow what a story costs to make - its paintings, one a
 * page, and pages go with minutes - not yet measured spend.)
 */
export type CreditsMode = "beyond" | "auto" | "always";
export const CREDITS_PER_STORY_MINUTE = 1;
export const CHARACTER_CREDITS = 3;
/** What a plan's free story covers (a Quest). A longer story still uses
 *  it, and the difference is paid for with credits. */
export const FREE_STORY_MINUTES = 3;
/** A story costs its length's reading time, a credit a minute (lib/ages:
 *  Quest 3, Adventure 5, Odyssey 8). */
export const storyCredits = (minutes: number) => lengthOf(minutes).minutes * CREDITS_PER_STORY_MINUTE;
export const STORY_CREDITS_RANGE: [number, number] = [storyCredits(STORY_LENGTHS[0].minutes), storyCredits(STORY_LENGTHS[STORY_LENGTHS.length - 1].minutes)];
/** What the admin's test account is given once, to begin with. */
export const STARTER_CREDITS = 250;
/** The most that can be added by hand in one go. */
export const MAX_CREDITS_ADDED = 1000;
/** Credits can be bought in these packs, or another amount up to the most. */
export const CREDIT_PACKS = [10, 20, 30, 50, 100];
/** The fewest and the most that can be bought at once ("Other"). The
 *  fewest is the smallest pack: a card payment has a fixed fee of its own,
 *  which would swallow a smaller sale. */
export const CREDIT_PACK_MIN = CREDIT_PACKS[0];
export const CREDIT_PACK_MAX = 10_000;
/** What one credit costs to buy, in US cents - the same in every pack. */
export const CREDIT_PRICE_CENTS = 50;
export const CREDIT_CURRENCY = "USD";
/** Bigger orders cost less a credit: so much off (per cent) from so many
 *  credits upward - whether a pack or an amount of one's own. */
export const CREDIT_DISCOUNTS: { from: number; off: number }[] = [
  { from: 100, off: 10 },
  { from: 50, off: 5 },
];
/** The discount (per cent) on an order of this many credits. */
export const packDiscount = (credits: number): number => CREDIT_DISCOUNTS.find((d) => credits >= d.from)?.off ?? 0;
/** What a number of credits costs to buy. The one place the price is
 *  worked out (in whole cents, the discount taken off and rounded to the
 *  nearest cent): the page and the checkout both ask here. `full` is the
 *  price before any discount. */
export const packPrice = (credits: number): { amount: number; full: number; off: number; currency: string } | null => {
  if (!Number.isInteger(credits) || credits <= 0) return null;
  const full = credits * CREDIT_PRICE_CENTS;
  const off = packDiscount(credits);
  return { amount: Math.round((full * (100 - off)) / 100) / 100, full: full / 100, off, currency: CREDIT_CURRENCY };
};

const isTier = (v: unknown): v is TierId => typeof v === "string" && Object.prototype.hasOwnProperty.call(PLANS, v);

/** The plan an account is on: the one recorded on its profile, else Admin
 *  for the admin account and Free for everyone else. */
export function tierIdFor(who: { tier?: string | null; isAdmin?: boolean } | null | undefined): TierId {
  if (who?.isAdmin) return "admin";
  // (nobody is made an admin by a plan name alone)
  if (isTier(who?.tier) && who.tier !== "admin") return who.tier;
  return "free";
}
export const tierFor = (who: Parameters<typeof tierIdFor>[0]): TierInfo => PLANS[tierIdFor(who)];
export const limitsFor = (who: Parameters<typeof tierIdFor>[0]): TierLimits => tierFor(who).limits;

/** How many custom characters this account can keep. */
export const characterLimit = (who: Parameters<typeof tierIdFor>[0]) => limitsFor(who).characters ?? Infinity;

// ---- how a plan reads on the Account pages ----

const per = (hours: number) => (hours === 24 ? "day" : hours === 168 ? "week" : hours === 720 ? "month" : hours === 1 ? "hour" : hours % 24 === 0 ? `${hours / 24} days` : `${hours} hours`);
/** "one new story a day", "3 new stories every 2 days" */
export const allowancePhrase = (a: Allowance, one: string, many: string) =>
  `${a.count === 1 ? "one" : a.count} ${a.count === 1 ? one : many} ${a.hours === 24 ? "a day" : a.hours === 168 ? "a week" : a.hours === 720 ? "a month" : `every ${per(a.hours)}`}`;
export const allowanceText = (a: Allowance | null) => (a ? `${a.count} per ${per(a.hours)}` : "Unlimited");

/** The headline allowances. */
export const tierRows = (t: TierInfo): TierRow[] => [
  {
    // (a plan's own story is a "standard story": up to FREE_STORY_MINUTES long)
    label: t.limits.stories && t.credits !== "beyond" ? "Free stories (a Quest)" : "New stories",
    value: allowanceText(t.limits.stories),
    note: t.limits.stories ? (t.credits === "beyond" ? "A story counts once you make its first choice" : "An Adventure or an Odyssey uses it too, and adds the difference in credits (2 or 5). A story counts once you make its first choice") : undefined,
  },
  ...(t.limits.weeklyCredits ? [{ label: "Weekly credits", value: `${t.limits.weeklyCredits} a week`, note: "Used first; any left at the week's end are gone" }] : []),
  // (what's free to make, then how many can be kept)
  ...(t.limits.designs ? [{ label: "New characters", value: allowanceText(t.limits.designs), note: t.credits === "beyond" ? undefined : "Then credits" }] : []),
  { label: "Custom character slots", value: t.limits.characters === null ? "Unlimited" : `${t.limits.characters}` },
  { label: "Reading the Public Library", value: "Unlimited" },
  ...(t.credits === "beyond" ? [] : [{ label: "After the free ones", value: "Credits", note: "Quest 3, Adventure 5, Odyssey 8; a character 3" }]),
  ...(t.extras ?? []),
];

/** The behind-the-scenes safety limits. */
export const tierCaps = (t: TierInfo): TierRow[] => {
  const b = t.limits.burst;
  const cap = (n: number | undefined, what = "") => (b && n !== undefined ? `Up to ${n}${what} per ${b.minutes} min` : "Unlimited");
  const s = t.limits.stories;
  return [
    { label: "Stories begun, then dropped before the first choice", value: s ? `Up to ${allowanceText({ count: t.limits.changesOfMind, hours: s.hours })}` : "Unlimited" },
    { label: "Story pages written", value: cap(b?.segment, " parts") },
    { label: "Pages painted", value: cap(b?.illustrate) },
    { label: "Character designs and redraws", value: t.limits.designs ? `Up to ${allowanceText(t.limits.designs)}` : "Unlimited" },
    { label: "New read-aloud clips", value: cap(b?.tts), note: "Clips already made are always free" },
  ];
};
