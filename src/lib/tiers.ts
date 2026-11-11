/**
 * Account plans and their allowances - the one place that says what each
 * plan may do. The server enforces these numbers and the Account pages show
 * them; nothing else in the app carries a limit of its own. Adding a paid
 * plan means adding a row to PLANS (and setting `tier` on the accounts that
 * bought it) - no other code changes.
 */

export type TierId = "free" | "admin";

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
export const WEEK_UTC_OFFSET_HOURS = 0;
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
}

export const PLANS: Record<TierId, TierInfo> = {
  free: {
    id: "free",
    name: "Free",
    blurb: "A free story every week and a free character every month: everything you need for a story at bedtime.",
    credits: "beyond",
    limits: {
      // (one free story each calendar week, one free character each
      // calendar month)
      stories: WEEKLY(1),
      changesOfMind: 3,
      characters: 3,
      designs: MONTHLY(1),
      quickPages: 2,
      burst: { minutes: 30, segment: 16, illustrate: 80, tts: 400 },
      verified: true,
    },
  },
  admin: {
    id: "admin",
    name: "Admin",
    blurb: "The test account: a free story each week and a free character each month like everyone, then credits - and the keys to the admin dashboard.",
    credits: "auto",
    // (the same free story a week and free character a month as the Free plan, so
    // both flows can be tried: free first, then credits. Room for ten
    // saved characters where Free has three, and plenty of beginnings.)
    limits: { stories: WEEKLY(1), changesOfMind: 50, characters: 10, designs: MONTHLY(1), quickPages: 1, burst: null, verified: false },
    extras: [
      { label: "After the free ones", value: "Credits", note: "One a minute of story, three a character" },
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
/** The shortest and longest story (lib/ages), kept here so prices need no
 *  other file: a story costs between these. */
const STORY_MINUTES: [number, number] = [3, 8];
export const storyCredits = (minutes: number) =>
  Math.min(STORY_MINUTES[1], Math.max(STORY_MINUTES[0], Math.round(Number(minutes) || STORY_MINUTES[0]))) * CREDITS_PER_STORY_MINUTE;
export const STORY_CREDITS_RANGE: [number, number] = [storyCredits(STORY_MINUTES[0]), storyCredits(STORY_MINUTES[1])];
/** What the admin's test account is given once, to begin with. */
export const STARTER_CREDITS = 250;
/** The most that can be added by hand in one go. */
export const MAX_CREDITS_ADDED = 1000;

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
  { label: "New stories", value: allowanceText(t.limits.stories), note: t.limits.stories ? "A story counts once you make its first choice" : undefined },
  // (what's free to make, then how many can be kept)
  ...(t.limits.designs ? [{ label: "New characters", value: allowanceText(t.limits.designs), note: t.credits === "beyond" ? undefined : "Then credits" }] : []),
  { label: "Custom character slots", value: t.limits.characters === null ? "Unlimited" : `${t.limits.characters}` },
  { label: "Reading the Public Library", value: "Unlimited" },
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
