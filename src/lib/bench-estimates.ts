/**
 * What each bench VARIANT was EXPECTED to save, so the bench can show the
 * estimate beside what was actually measured. Estimates are kept per
 * variant code (see bench-ways.ts): whenever a way changes, its new code
 * gets a new estimate, written as the change is made, and the old codes
 * keep the estimate they were judged against. Never update one to match
 * its results: it is the prediction being tested.
 *
 * Prices: Opus 5.5 $4 in / $20 out per million tokens (cached input
 * $0.20); Sonnet 5.5 $2 / $10 (cached $0.10).
 *
 * The baseline (way 1): about $0.21 and 50 s a page, measured on the
 * earlier bench. The character painter (Opus, ~5.6k tokens out, most of it
 * thinking) is ~90% of the cost and sets the finish time; the scenery
 * painter (Sonnet low, no thinking) runs alongside it.
 *
 * Bench conditions: "Paint every page" paints the 7 test pages as one
 * book, at 4 places, so 4 of the 7 pages pay for painting their place's
 * backdrop (~4k tokens of Sonnet, ~$0.04 and ~25 s). In a real book, with
 * many pages per place, ways 3 and 4 should do better than these numbers.
 */
export interface Estimate {
  usd: number;
  ms: number;
  /** percent saved against today (cost, time) */
  costPc: number;
  timePc: number;
  why: string;
}

// The first estimates (13 Nov 2026, before any real run). They counted the
// place's backdrop in each page's cost; it is now counted as set-up.
const P1: Estimate = {
  usd: 0.15,
  ms: 38_000,
  costPc: 30,
  timePc: 25,
  why: "Opus still paints and still thinks, but writes about half the strokes per character (head and body are kept), and its input is smaller (parts sheets instead of whole portraits). Pieces trim the scenery a little.",
};
const B1: Estimate = {
  usd: 0.08,
  ms: 26_000,
  costPc: 60,
  timePc: 48,
  why: "Sonnet at medium replaces Opus for the characters: half the price per token, fewer tokens. The page-layer painter is small. Backdrops cost ~$0.023 a page here (4 of 7 pages paint one); ~$0.06 a page in a real book.",
};
// (added 13 Nov 2026, after the first way 3 - Sonnet at medium, thinking -
// came out at $0.26 and 78 s: more than today)
const Q1: Estimate = {
  usd: 0.06,
  ms: 28_000,
  costPc: 70,
  timePc: 45,
  why: "Sonnet at low effort without thinking writes only strokes - faces, limbs, held things - onto the kept heads and bodies: about 4-5k tokens (~$0.05). No scenery painter at all (backdrop reused, the page's sky and foreground made in code). One-off set-up (the backdrop, a character's parts) is counted apart. Expected between ways 2 and 4 on cost, with freer poses than 4.",
};
const X1: Estimate = {
  usd: 0.03,
  ms: 17_000,
  costPc: 85,
  timePc: 65,
  why: "The composer writes ~250 tokens of tags with no thinking (under $0.01). Nearly all the cost and wait is the backdrop on the 4 pages that paint one; the other pages take ~5 s. In a real book: about $0.01-0.015 and under 10 s a page (~93% cheaper).",
};
// (added 13 Nov 2026, before any real run)
const S1: Estimate = {
  usd: 0.006,
  ms: 9_000,
  costPc: 95,
  timePc: 80,
  why: "Nothing of the characters is painted per page: their poses are painted ahead (one-off, about $0.04 a pose with Sonnet) and only placed. The Haiku composer writes a few hundred tokens of tags (a fraction of a cent) with no thinking, the place is reused and its sky and foreground are made in code. Once a place's backdrop exists, a page should take seconds.",
};

// Re-estimated 13 Nov 2026 (about 10:00 UTC) for the variants on the bench
// now. Some of these may already have a page or two painted: they were
// written without looking at them. A page's cost here leaves out set-up
// (the place's backdrop and a character's parts), as the bench does; its
// time still includes waiting for a backdrop painted on that page.
const P6: Estimate = {
  usd: 0.15,
  ms: 35_000,
  costPc: 30,
  timePc: 30,
  why: "As before, Opus still paints and thinks over the kept heads and bodies. Parts are now prepared ahead, so a page no longer waits up to 20 s for them, and placed characters are kept to the camera's size, which costs nothing.",
};
const Q5: Estimate = {
  usd: 0.05,
  ms: 30_000,
  costPc: 76,
  timePc: 40,
  why: "Sonnet at low effort, no thinking: ~4k tokens of strokes (~$0.04) plus its input. Things the characters touch are now placed as pieces, not drawn, so a little less to write. The backdrop is counted as set-up, but a page that paints its place's backdrop still waits for it.",
};
const X7: Estimate = {
  usd: 0.002,
  ms: 15_000,
  costPc: 99,
  timePc: 70,
  why: "The composer is Haiku: ~6k tokens in and ~400 out, about a tenth of a cent. The backdrop is set-up, so a page's cost is almost nothing; its time is ~3 s, except on the 4 of 7 bench pages that wait ~25 s for their place's backdrop.",
};
const S2: Estimate = {
  usd: 0.002,
  ms: 14_000,
  costPc: 99,
  timePc: 72,
  why: "As way 4, the Haiku composer only picks poses and places them: about a tenth of a cent. Poses are prepared ahead (not counted). The wait is the place's backdrop on the pages that paint one; the others should take ~3 s.",
};

// Written 13 Nov 2026 (evening), before any run of these versions. A
// page's cost leaves out set-up (backdrops, parts, poses), as the bench
// does; times assume the page's place was prepared ahead ("Prepare
// places") - a place not prepared adds ~25 s to its first page.
const P7: Estimate = {
  usd: 0.12,
  ms: 30_000,
  costPc: 43,
  timePc: 40,
  why: "Opus still paints the characters' faces and limbs with thinking, but the scenery painter is gone: the place's backdrop is reused and the page's sky and foreground made in code, as in way 3. The character painter adds the moment's own scene details (a few pieces), so pages in one place still differ.",
};
const Q6: Estimate = {
  usd: 0.05,
  ms: 25_000,
  costPc: 76,
  timePc: 50,
  why: "As before (Sonnet at low effort, no thinking, faces and limbs only), plus a few pieces for the moment's own scene details. With the place prepared ahead, no page waits for a backdrop.",
};
const X8: Estimate = {
  usd: 0.003,
  ms: 9_000,
  costPc: 98,
  timePc: 82,
  why: "The composer now thinks before placing (Haiku at medium effort): ~8k tokens in, ~2-3k out with its thinking, about a third of a cent - twice the old effort for better placement. A page with a newcomer adds ~$0.03 and ~15 s for the newcomer's own painting. The layout pass costs nothing.",
};
const S3: Estimate = {
  usd: 0.003,
  ms: 9_000,
  costPc: 98,
  timePc: 82,
  why: "As way 4: the composer thinks first, then picks from sixteen prepared poses (six more, for laughing, sadness, carrying, peeking, reaching and hugging). A newcomer adds ~$0.03 and ~15 s. The extra poses are set-up: about $0.04 each per character, once.",
};

const X9: Estimate = {
  usd: 0.03,
  ms: 15_000,
  costPc: 86,
  timePc: 70,
  why: "The composer is now Sonnet, thinking at low effort (~9k tokens in, mostly its cached brief and the pieces' list; ~2k out with its thinking): about 3 cents, ten times the Haiku composer, for a much better arrangement. The figures' arms, hands, legs and faces are drawn in code, as before: free. A newcomer adds ~$0.03 and ~15 s.",
};

/** Each variant code's estimate. Add the new code's here whenever a way
 *  changes (see variantOf). */
export const ESTIMATES: Record<string, Estimate> = {
  // before variant codes
  "2-OLD": P1,
  "3-OLDB": B1,
  "4-OLD": X1,
  // way 2
  "2-4NFQ": P1,
  "2-494P": P1,
  "2-3UTO": P1,
  "2-3GIN": P1,
  "2-327M": P6,
  "2-1N64": P7,
  // (13 Nov: the same as the versions before, with bigger characters - the
  // size costs nothing)
  "2-YV0X": P7,
  // (13 Nov: lessons 1-2 - instructions only, the same cost)
  "2-Z9BY": P7,
  // way 3
  "3-YTBT": Q1,
  "3-008W": Q1,
  "3-ZLXV": Q1,
  "3-XMEQ": Q1,
  "3-X83P": Q5,
  "3-YF0S": Q6,
  "3-Y0PR": Q6,
  "3-W16M": Q6,
  // way 4
  "4-YG44": X1,
  "4-Y1T3": X1,
  "4-Z8Q6": X1,
  "4-YUF5": X1,
  "4-R8EN": X1,
  "4-RMPO": X7,
  "4-F49Z": X8,
  "4-HQBY": X9,
  "4-69BM": X9,
  "4-5V0L": X9,
  // way 5
  "5-0IZW": S1,
  "5-ZC2T": S2,
  "5-0Y5G": S3,
  "5-1CGH": S3,
  "5-1QRI": S3,
  "5-252J": S3,
};

/** A variant's estimate (none for v0, the baseline, or an unknown code). */
export const estimateFor = (variant: string | undefined): Estimate | undefined => (variant ? ESTIMATES[variant] : undefined);
