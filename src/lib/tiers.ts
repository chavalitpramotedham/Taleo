/**
 * Account tiers and their allowances - one place for both the limits the
 * server enforces and what the Account tier section shows.
 *
 * Everyone is on Free for now (more tiers are coming); the admin account is
 * unlimited and can open the admin dashboard.
 */

export type TierId = "free" | "admin";

/** The new-story allowance: one new story, then the next can begin 24
 *  hours later - one a day. */
export const STORY_WINDOW_HOURS = 24;

/** Custom characters a Free account can keep. */
export const FREE_CHARACTERS = 3;

/** Safety caps on the paid AI work inside a story, per 30 minutes. They're
 *  far above normal use - their job is to stop anyone scripting the
 *  service and running up the bill, not to limit families. */
export const ABUSE_WINDOW_MINUTES = 30;
export const ABUSE_CAPS = {
  segment: 16,
  illustrate: 80,
  character: 12,
  tts: 400,
} as const;

export interface TierRow {
  label: string;
  value: string;
  note?: string;
}

export interface TierInfo {
  id: TierId;
  name: string;
  blurb: string;
  /** The headline allowances. */
  rows: TierRow[];
  /** The behind-the-scenes safety limits. */
  caps: TierRow[];
}

const caps = (unlimited: boolean): TierRow[] => [
  { label: "Story pages written", value: unlimited ? "Unlimited" : `Up to ${ABUSE_CAPS.segment} parts per ${ABUSE_WINDOW_MINUTES} min` },
  { label: "Pages painted", value: unlimited ? "Unlimited" : `Up to ${ABUSE_CAPS.illustrate} per ${ABUSE_WINDOW_MINUTES} min` },
  { label: "Character designs and redraws", value: unlimited ? "Unlimited" : `Up to ${ABUSE_CAPS.character} per ${ABUSE_WINDOW_MINUTES} min` },
  { label: "New read-aloud clips", value: unlimited ? "Unlimited" : `Up to ${ABUSE_CAPS.tts} per ${ABUSE_WINDOW_MINUTES} min`, note: "Clips already made are always free" },
];

export const TIERS: Record<TierId, TierInfo> = {
  free: {
    id: "free",
    name: "Free",
    blurb: "Everything you need for a story at bedtime.",
    rows: [
      { label: "New stories", value: "1 per day" },
      { label: "Custom characters", value: `${FREE_CHARACTERS} saved` },
      { label: "Reading the Public Library", value: "Unlimited" },
      { label: "Saving others' stories", value: "Unlimited" },
    ],
    caps: caps(false),
  },
  admin: {
    id: "admin",
    name: "Admin",
    blurb: "Unlimited everything, and the keys to the admin dashboard.",
    rows: [
      { label: "New stories", value: "Unlimited" },
      { label: "Custom characters", value: "Unlimited" },
      { label: "Reading the Public Library", value: "Unlimited" },
      { label: "Saving others' stories", value: "Unlimited" },
      { label: "Admin dashboard", value: "Full access" },
    ],
    caps: caps(true),
  },
};

export const tierFor = (isAdmin: boolean | undefined): TierInfo => (isAdmin ? TIERS.admin : TIERS.free);

/** How many custom characters this account can keep. */
export const characterLimit = (isAdmin: boolean | undefined) => (isAdmin ? Infinity : FREE_CHARACTERS);
