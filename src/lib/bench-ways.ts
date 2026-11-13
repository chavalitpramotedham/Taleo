import type { ReuseSettings } from "./types";

/**
 * The painting bench's ways (admin only), and each one's VARIANT CODE.
 *
 * The bench shows four slots, 1 to 4, but what a slot does changes as we
 * try things. Every result is saved with the variant code it was painted
 * with, and the leaderboard ranks variants - so a slot's old results never
 * mix with its new ones.
 *
 * A variant code is the slot's number and a fingerprint of everything that
 * decides how it paints: its settings below, and its STYLE - a note of
 * how it works that isn't a setting (its prompts, how pieces and figures
 * are assembled, how the backdrop is shown). Change a setting and the code
 * changes by itself. Change how a way works without changing a setting,
 * and bump its STYLE: that changes the code too.
 */
export const BENCH_SLOTS = ["1", "p", "q", "x"] as const;
export type BenchSlot = (typeof BENCH_SLOTS)[number];

export const BENCH_WAYS: Record<BenchSlot, ReuseSettings> = {
  // 1. today: nothing reused
  "1": { stamps: false, parts: false, backdrops: false },
  // 2. parts + pieces, the usual painters
  p: { stamps: true, parts: true, backdrops: false },
  // 3. parts, pieces and the place's backdrop reused, the page's own sky
  // and foreground made in code, the characters drawn (faces, limbs,
  // actions) by Sonnet at low effort, without thinking
  q: { stamps: true, parts: true, backdrops: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "low", unthinking: true } },
  // 4. extreme: posed from the library by a cheap composer, the page's own
  // layer made in code
  x: { stamps: true, parts: true, backdrops: true, poses: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "low", unthinking: true } },
};

/** How each way works beyond its settings. Bump (and say why) whenever a
 *  way's prompts or assembly change. */
export const STYLE: Record<BenchSlot, string> = {
  "1": "s1",
  // s2 (13 Nov): parts made for every character (the parts maker had been
  // refused by the SDK), at most 20 s waited for them
  // s3 (13 Nov): on the bench, its own parts - never another variant's
  p: "s3",
  // s1 (13 Nov): first version
  // s2 (13 Nov): its own backdrops and parts, never another variant's
  q: "s2",
  // s2 (13 Nov): parts for every character, as p; backdrop shown stroke
  // by stroke while it's painted
  // s3 (13 Nov): its own backdrops and parts, never another variant's
  x: "s3",
};

/** Points for a page's ranking, best first: 4 for the best of four, then
 *  3, 2, 1. Spread them further (say 8, 4, 2, 1) if scores bunch up. */
export const RANK_POINTS = [4, 3, 2, 1];

/** The slot's number on the bench (1-4). */
export const slotNumber = (slot: string) => String(BENCH_SLOTS.indexOf(slot as BenchSlot) + 1 || "?");

const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36).padStart(7, "0").slice(-4).toUpperCase();
};
const canonical = (v: unknown): string =>
  v && typeof v === "object" ? `{${Object.keys(v as object).sort().map((k) => `${k}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);

/** A way's variant code as it is now: e.g. "3-K7QD". */
export function variantOf(slot: BenchSlot): string {
  return `${slotNumber(slot)}-${fnv(`${canonical(BENCH_WAYS[slot])}|${STYLE[slot]}`)}`;
}

/** Results saved before variant codes existed: one code per slot (and the
 *  retired first way 3, "b"). */
export const legacyVariant = (slot: string) => (slot === "1" ? variantOf("1") : `${slot === "b" ? "3" : slotNumber(slot)}-OLD${slot === "b" ? "B" : ""}`);
// (today's way has never changed, so its earlier results are its current
// variant's)
