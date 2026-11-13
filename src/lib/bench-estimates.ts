/**
 * What each bench way was EXPECTED to save, written down before any real
 * run (13 Nov 2026), so the bench can show the estimate beside what was
 * actually measured. Do not update these to match results: they are the
 * prediction being tested.
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

export const ESTIMATES: Record<string, Estimate> = {
  "1": { usd: 0.21, ms: 50_000, costPc: 0, timePc: 0, why: "The baseline." },
  p: {
    usd: 0.15,
    ms: 38_000,
    costPc: 30,
    timePc: 25,
    why: "Opus still paints and still thinks, but writes about half the strokes per character (head and body are kept), and its input is smaller (parts sheets instead of whole portraits). Pieces trim the scenery a little.",
  },
  b: {
    usd: 0.08,
    ms: 26_000,
    costPc: 60,
    timePc: 48,
    why: "Sonnet at medium replaces Opus for the characters: half the price per token, fewer tokens. The page-layer painter is small. Backdrops cost ~$0.023 a page here (4 of 7 pages paint one); ~$0.06 a page in a real book.",
  },
  q: {
    // (added 13 Nov 2026, after the first way 3 - Sonnet at medium,
    // thinking - came out at $0.26 and 78 s: more than today)
    usd: 0.06,
    ms: 28_000,
    costPc: 70,
    timePc: 45,
    why: "Sonnet at low effort without thinking writes only strokes - faces, limbs, held things - onto the kept heads and bodies: about 4-5k tokens (~$0.05). No scenery painter at all (backdrop reused, the page's sky and foreground made in code). One-off set-up (the backdrop, a character's parts) is counted apart. Expected between ways 2 and 4 on cost, with freer poses than 4.",
  },
  s: {
    // (added 13 Nov 2026, before any real run)
    usd: 0.006,
    ms: 9_000,
    costPc: 95,
    timePc: 80,
    why: "Nothing of the characters is painted per page: their poses are painted ahead (one-off, about $0.04 a pose with Sonnet) and only placed. The Haiku composer writes a few hundred tokens of tags (a fraction of a cent) with no thinking, the place is reused and its sky and foreground are made in code. Once a place's backdrop exists, a page should take seconds.",
  },
  x: {
    usd: 0.03,
    ms: 17_000,
    costPc: 85,
    timePc: 65,
    why: "The composer writes ~250 tokens of tags with no thinking (under $0.01). Nearly all the cost and wait is the backdrop on the 4 pages that paint one; the other pages take ~5 s. In a real book: about $0.01-0.015 and under 10 s a page (~93% cheaper).",
  },
};
