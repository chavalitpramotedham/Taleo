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
export const BENCH_SLOTS = ["1", "p", "q", "x", "s", "0", "m", "n"] as const;
/** A slot id, as the bench's requests carry it. */
export const SLOT_RE = /^(1|p|q|x|s|0|m|n)$/;
export type BenchSlot = (typeof BENCH_SLOTS)[number];
/** The slots on the bench now, in order: v0 - always the live version, so
 *  the baseline moves with what readers get - then this session's
 *  contenders, shown as 1 and 2. The other slots are retired: their
 *  results stay in the sessions they were painted in, and under "All". */
export const BENCH_NOW = ["0", "m", "n"] as const satisfies readonly BenchSlot[];

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
  x: { stamps: true, parts: true, backdrops: true, poses: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "medium", unthinking: false } },
  // 5. pre-painted poses: each character painted once in ten poses, ahead;
  // a composer picks a pose for each, places them and adds pieces (the
  // place reused, its sky and foreground made in code)
  s: { stamps: true, parts: true, backdrops: true, poses: true, sprites: true, codeLayer: true, painter: { model: "claude-haiku-5-5", effort: "medium", unthinking: false } },
  // v0: whatever is live (set from LIVE below)
  "0": { stamps: true, parts: true, backdrops: true },
  // 1 (session 2): live (4-RUYP) with pre-painted poses where a character
  // has them - hand-painted bodies, the same composer and layout pass;
  // characters without poses yet are built from parts as in live
  m: { stamps: true, parts: true, backdrops: true, poses: true, sprites: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "medium", unthinking: false } },
  // 2 (session 2): live (4-RUYP) with its composer at low effort, still
  // thinking first - the layout pass and the phrasebook now do much of
  // what the extra effort was bought for
  n: { stamps: true, parts: true, backdrops: true, poses: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "low", unthinking: false } },
};

/** How each way works beyond its settings. Bump (and say why) whenever a
 *  way's prompts or assembly change. */
export const STYLE: Record<BenchSlot, string> = {
  // s2 (13 Nov): lessons 1-2 (docs/painting-lessons.md): each
  // character's size against the others on its sheet; the main action's
  // object always shown, at the action
  // s3 (13 Nov): lessons 4-5 - every character on the page checked for
  // and asked for again if left out (painters mark each one); a newcomer
  // that comes out empty painted once more; the place's or page's own
  // season (an autumn wood in a summer book) for the colours
  // s4 (13 Nov): lessons 6-8 - legs always drawn (things to be behind
  // go in front as pieces); characters eased apart as they're placed;
  // food and object characters' code-made limbs thin pen lines
  // s5 (13 Nov): lesson 10 - back to front: nearer and smaller drawn
  // in front (composed pages sorted in code; painters told)
  "1": "s5",
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
  // s10 (13 Nov): lesson 3 - a character with no parts is marked DRAWN
  // IN FULL on its sheet, and if it's drawn inside a <fig> anyway that
  // drawing is kept and placed, never dropped
  // s11 (13 Nov): lessons 4-5 - every character on the page checked for
  // and asked for again if left out (painters mark each one); a newcomer
  // that comes out empty painted once more; the place's or page's own
  // season (an autumn wood in a summer book) for the colours
  // s12 (13 Nov): lessons 6-8 - legs always drawn (things to be behind
  // go in front as pieces); characters eased apart as they're placed;
  // food and object characters' code-made limbs thin pen lines
  // s13 (13 Nov): lesson 10 - back to front: nearer and smaller drawn
  // in front (composed pages sorted in code; painters told)
  // s14 (13 Nov): lessons 11-13 - overlap allowed only for true depth;
  // sizes kept true to each other by kind; the brief's arrangement kept
  p: "s14",
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
  // s9 (13 Nov): lesson 3 - a character with no parts is marked DRAWN
  // IN FULL on its sheet, and if it's drawn inside a <fig> anyway that
  // drawing is kept and placed, never dropped
  // s10 (13 Nov): lessons 4-5 - every character on the page checked for
  // and asked for again if left out (painters mark each one); a newcomer
  // that comes out empty painted once more; the place's or page's own
  // season (an autumn wood in a summer book) for the colours
  // s11 (13 Nov): lessons 6-8 - legs always drawn (things to be behind
  // go in front as pieces); characters eased apart as they're placed;
  // food and object characters' code-made limbs thin pen lines
  // s12 (13 Nov): lesson 10 - back to front: nearer and smaller drawn
  // in front (composed pages sorted in code; painters told)
  // s13 (13 Nov): lessons 11-13 - overlap allowed only for true depth;
  // sizes kept true to each other by kind; the brief's arrangement kept
  q: "s13",
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
  // s12 (13 Nov): lessons 4-5 - every character on the page checked for
  // and asked for again if left out (painters mark each one); a newcomer
  // that comes out empty painted once more; the place's or page's own
  // season (an autumn wood in a summer book) for the colours
  // s13 (13 Nov): lessons 6-8 - legs always drawn (things to be behind
  // go in front as pieces); characters eased apart as they're placed;
  // food and object characters' code-made limbs thin pen lines
  // s14 (13 Nov): lesson 9 - the composer thinks harder (Sonnet at medium,
  // a setting) and checks off every thing the brief names
  // s15 (13 Nov): lesson 10 - back to front: nearer and smaller drawn
  // in front (composed pages sorted in code; painters told)
  // s16 (13 Nov): lessons 11-13 - overlap allowed only for true depth;
  // sizes kept true to each other by kind; the brief's arrangement kept
  // s17 (13 Nov): lessons 14-15 - big things and drawn shapes ordered by
  // depth too, characters moved out of them to their edge; everyone
  // turned towards the main action; one ground line; footprint numbers
  // s18 (14 Nov): lesson 16 - huggers brought together, the main action
  // kept in frame, sitters set on their seats, the tap target always
  // there and marked; a phrasebook of action words into poses
  x: "s18",
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
  // s7 (13 Nov): lessons 4-5 - every character on the page checked for
  // and asked for again if left out (painters mark each one); a newcomer
  // that comes out empty painted once more; the place's or page's own
  // season (an autumn wood in a summer book) for the colours
  // s8 (13 Nov): lessons 6-8 - legs always drawn (things to be behind
  // go in front as pieces); characters eased apart as they're placed;
  // food and object characters' code-made limbs thin pen lines
  // s9 (13 Nov): lesson 9 - the composer checks off every thing the brief
  // names
  // s10 (13 Nov): lesson 10 - back to front: nearer and smaller drawn
  // in front (composed pages sorted in code; painters told)
  // s11 (13 Nov): lessons 11-13 - overlap allowed only for true depth;
  // sizes kept true to each other by kind; the brief's arrangement kept
  // s12 (13 Nov): lessons 14-15 - big things and drawn shapes ordered by
  // depth too, characters moved out of them to their edge; everyone
  // turned towards the main action; one ground line; footprint numbers
  // s13 (14 Nov): lesson 16 - huggers brought together, the main action
  // kept in frame, sitters set on their seats, the tap target always
  // there and marked; a phrasebook of action words into poses
  s: "s13",
  // v0: live's own (set from LIVE below)
  "0": "",
  // s1 (14 Nov): first version - as x s18
  m: "s1",
  // s1 (14 Nov): first version - as x s18
  n: "s1",
};

/** Points for a page's ranking, best first: 4 for the best of four, then
 *  3, 2, 1. Spread them further (say 8, 4, 2, 1) if scores bunch up. */
export const RANK_POINTS = [4, 3, 2, 1];
/** Points for a place in a ranking of n ways: n for the best, down to 1
 *  (a ranking of four gives 4-3-2-1, as before; of five, 5-4-3-2-1). */
export const rankPoints = (place: number, n: number) => (place >= 0 && place < n ? n - place : 0);

/** The slot's number on the bench (1-4). */
export const slotNumber = (slot: string) => ({ "1": "1", p: "2", q: "3", x: "4", s: "5", "0": "0", m: "6", n: "7" })[slot] ?? "?";

const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36).padStart(7, "0").slice(-4).toUpperCase();
};
const canonical = (v: unknown): string =>
  v && typeof v === "object" ? `{${Object.keys(v as object).sort().map((k) => `${k}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);

/** A way's variant code as it is now: e.g. "3-K7QD". */
export function variantOf(slot: BenchSlot): string {
  if (slot === "0") return LIVE.code;
  return `${slotNumber(slot)}-${fnv(`${canonical(BENCH_WAYS[slot])}|${STYLE[slot]}`)}`;
}

/**
 * What readers' pages are painted with: a bench version, PINNED - its own
 * copy of the settings and style, so the bench can keep trying things on
 * its slot without changing what readers get. To move readers to another
 * version, copy that version's settings and style here (its code is
 * checked against the expected one below, so a slip shows at once).
 * The prompts and code they share are the same for both.
 * Switched off (back to the env's TALEO_PAINT_* settings) with
 * TALEO_PAINT_LIVE=0.
 */
export const LIVE = {
  /** the code it has on the bench */
  // (4-UN3W was made live on 14 Nov; moved to 4-RUYP the same night - the
  // same settings, with lesson 16's layout and phrasebook, which it shares)
  code: "4-RUYP",
  slot: "x" as BenchSlot,
  name: "Extreme reuse",
  settings: { stamps: true, parts: true, backdrops: true, poses: true, codeLayer: true, painter: { model: "claude-sonnet-5-5", effort: "medium", unthinking: false } } as ReuseSettings,
  style: "s18",
};
/** The versions that were live before, newest first: the baseline falls
 *  back to them until the live one has paintings of its own. */
export const LIVE_EARLIER = ["4-UN3W"];

/** The live version's code, from its own settings and style (it must
 *  match LIVE.code). */
export const liveVariant = () => `${slotNumber(LIVE.slot)}-${fnv(`${canonical(LIVE.settings)}|${LIVE.style}`)}`;

// (a slip in the pinned copy - settings or style not those of its code -
// stops the site building, rather than quietly painting something else)
if (liveVariant() !== LIVE.code) throw new Error(`LIVE is pinned as ${LIVE.code} but its settings make ${liveVariant()}`);
// (v0 paints exactly what readers get)
BENCH_WAYS["0"] = LIVE.settings;
STYLE["0"] = LIVE.style;

/** Results saved before variant codes existed: one code per slot (and the
 *  retired first way 3, "b"). */
// (v0's results from before variant codes were painted by its first
// version, 1-SV11 - it has changed since)
export const legacyVariant = (slot: string) => (slot === "1" ? "1-SV11" : `${slot === "b" ? "3" : slotNumber(slot)}-OLD${slot === "b" ? "B" : ""}`);

/** A bench session: a stretch of testing measured against one baseline,
 *  which never changes within it. Choosing a new baseline starts the next
 *  session. `base` lists the baseline's codes, the first with paintings
 *  used (v0 changed code once, in its instructions only). */
export interface BenchSession {
  n: number;
  /** the baseline's name as shown ("v0", or its code) */
  name: string;
  base: string[];
  /** when it started (ms) */
  at: number;
}
/** The first sessions: the original v0 (nothing reused) as the baseline
 *  until way 4 went live for readers (13 Nov 2026, 16:34 UTC), then the
 *  live version, 4-RUYP. After that a new session starts by itself
 *  whenever LIVE changes (see the bench's API). */
export const FIRST_SESSIONS: BenchSession[] = [
  { n: 1, name: "old v0", base: ["1-UG95", "1-SV11"], at: 0 },
  { n: 2, name: "4-RUYP", base: ["4-RUYP"], at: 1_794_587_680_000 },
];
/** The session a run started at `at` belongs to. */
export const sessionAt = (sessions: BenchSession[], at: number) => [...sessions].reverse().find((s) => s.at <= at) ?? sessions[0];
/** A variant code, as a baseline may be named. */
export const VARIANT_RE = /^[1-9]-[A-Z0-9]{3,6}$/;
