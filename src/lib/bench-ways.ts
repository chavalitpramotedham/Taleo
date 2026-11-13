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
 * and bump its STYLE: that changes the code too. Either way, write the
 * new code's estimate in bench-estimates.ts.
 */
export const BENCH_SLOTS = ["1", "p", "q", "x", "s"] as const;
/** A slot id, as the bench's requests carry it. */
export const SLOT_RE = /^(1|p|q|x|s)$/;
export type BenchSlot = (typeof BENCH_SLOTS)[number];

export const BENCH_WAYS: Record<BenchSlot, ReuseSettings> = {
  // 1. today: nothing reused
  "1": { stamps: false, parts: false, backdrops: false },
  // 2. parts + pieces, the usual painters
  // (and, like way 3, the place's backdrop reused with the page's own sky
  // and foreground made in code: only the characters are painted)
  p: { stamps: true, parts: true, backdrops: true, codeLayer: true },
  // 3. parts, pieces and the place's backdrop reused, the page's own sky
  // and foreground made in code, the characters drawn (faces, limbs,
  // actions) by Sonnet at low effort, without thinking
  q: { stamps: true, parts: true, backdrops: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "low", unthinking: true } },
  // 4. extreme: posed from the library by a cheap composer, the page's own
  // layer made in code
  // (its composer is Sonnet, thinking at low effort: the arrangement of
  // the figures - who stands where, doing what, facing whom - is the whole
  // picture here, and worth a stronger hand than way 5's)
  x: { stamps: true, parts: true, backdrops: true, poses: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "low", unthinking: false } },
  // 5. pre-painted poses: each character painted once in ten poses, ahead;
  // a composer picks a pose for each, places them and adds pieces (the
  // place reused, its sky and foreground made in code)
  s: { stamps: true, parts: true, backdrops: true, poses: true, sprites: true, codeLayer: true, painter: { model: "claude-haiku-5-5", effort: "medium", unthinking: false } },
};

/** How each way works beyond its settings. Bump (and say why) whenever a
 *  way's prompts or assembly change. */
export const STYLE: Record<BenchSlot, string> = {
  // s2 (13 Nov): lessons 1-2 (docs/painting-lessons.md): each
  // character's size against the others on its sheet; the main action's
  // object always shown, at the action
  "1": "s2",
  // s2 (13 Nov): parts made for every character (the parts maker had been
  // refused by the SDK), at most 20 s waited for them
  // s3 (13 Nov): on the bench, its own parts - never another variant's
  // s4 (13 Nov): the apple tree and the wild flowers can be placed again
  // (an apple and a bunch of flowers to hold had taken their names)
  // s5 (13 Nov): characters' parts prepared ahead and shared; token
  // counts off the clock; a tree a character touches can stand among them
  // s6 (13 Nov): characters kept to the camera's size band and footing
  // s7 (13 Nov): the place's backdrop reused like way 3 (a setting); the
  // moment's own scene details added by the character painter; replies
  // sized to fit
  // s8 (13 Nov): characters bigger - a mid shot about half the
  // picture's height (0.88 of their canvas, from 0.62), wide 0.55, close 1.5
  // s9 (13 Nov): lessons 1-2 (docs/painting-lessons.md): each
  // character's size against the others on its sheet; the main action's
  // object always shown, at the action
  p: "s9",
  // s1 (13 Nov): first version
  // s2 (13 Nov): its own backdrops and parts, never another variant's
  // s3 (13 Nov): the apple tree and wild flowers fixed, as p s4
  // s4 (13 Nov): as p s5, and its painter may place standard pieces for
  // what the characters touch; gentler backdrop framing; a place's
  // backdrop reused across its pages
  // s5 (13 Nov): as p s6
  // s6 (13 Nov): the moment's own scene details added by the character
  // painter; replies sized to fit; nothing thrown away when cut off
  // s7 (13 Nov): characters bigger - a mid shot about half the
  // picture's height (0.88 of their canvas, from 0.62), wide 0.55, close 1.5
  // s8 (13 Nov): lessons 1-2 (docs/painting-lessons.md): each
  // character's size against the others on its sheet; the main action's
  // object always shown, at the action
  q: "s8",
  // s2 (13 Nov): parts for every character, as p; backdrop shown stroke
  // by stroke while it's painted
  // s3 (13 Nov): its own backdrops and parts, never another variant's
  // s4 (13 Nov): the apple tree and wild flowers fixed, as p s4
  // s5 (13 Nov): as q s4
  // s6 (13 Nov): the composer is Haiku 5.5 (a twentieth of Sonnet's price);
  // and so its settings' fingerprint changes too
  // s7 (13 Nov): as p s6 (Haiku had them huge or tiny)
  // s8 (13 Nov): the composer thinks first (Haiku at medium effort, a
  // setting); main-action and interaction rules; a layout pass (nobody on
  // top of anybody, the target never hidden, the ends of a group facing
  // in); newcomers painted for the page; the moment's own scene details
  // s9 (13 Nov): figures' arms, hands, legs and faces redrawn in code
  // (tapering limbs, shaped hands, feet that turn, a jump that leaves the
  // ground, a run that leans, arms that swing, eyes that look; new arm
  // and leg poses and moods); the composer is Sonnet (a setting)
  // s10 (13 Nov): characters bigger - a mid shot about half the
  // picture's height (0.88 of their canvas, from 0.62), wide 0.55, close 1.5
  // s11 (13 Nov): lessons 1-2 (docs/painting-lessons.md): each
  // character's size against the others on its sheet; the main action's
  // object always shown, at the action
  x: "s11",
  // s1 (13 Nov): first version
  // s2 (13 Nov): as p s6
  // s3 (13 Nov): as x s8, and six more prepared poses (laugh, sad, carry,
  // peek, reach, hug)
  // s4 (13 Nov): a character without poses yet is put together from its
  // parts with way 4's new arms, hands, legs and faces
  // s5 (13 Nov): characters bigger - a mid shot about half the
  // picture's height (0.88 of their canvas, from 0.62), wide 0.55, close 1.5
  // s6 (13 Nov): lessons 1-2 (docs/painting-lessons.md): each
  // character's size against the others on its sheet; the main action's
  // object always shown, at the action
  s: "s6",
};

/** Points for a page's ranking, best first: 4 for the best of four, then
 *  3, 2, 1. Spread them further (say 8, 4, 2, 1) if scores bunch up. */
export const RANK_POINTS = [4, 3, 2, 1];
/** Points for a place in a ranking of n ways: n for the best, down to 1
 *  (a ranking of four gives 4-3-2-1, as before; of five, 5-4-3-2-1). */
export const rankPoints = (place: number, n: number) => (place >= 0 && place < n ? n - place : 0);

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
// (v0's results from before variant codes were painted by its first
// version, 1-SV11 - it has changed since)
export const legacyVariant = (slot: string) => (slot === "1" ? "1-SV11" : `${slot === "b" ? "3" : slotNumber(slot)}-OLD${slot === "b" ? "B" : ""}`);
