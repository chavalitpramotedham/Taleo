// The painter test bench (development only): one fixed story, painted round
// after round, so changes to the painter can be compared page by page.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CharacterDef, IllustrateRequest, Page, StoryPlace } from "@/lib/types";

export const BENCH_DIR = join(process.cwd(), "scripts", "rsi");

interface BenchStory {
  title: string;
  world: string;
  hero: CharacterDef;
  companions: CharacterDef[];
  cast: CharacterDef[];
  places: StoryPlace[];
  segments: { pages: Page[] }[];
}

/** Rounds from 100 on paint the second book (story2.json), a check that
 *  what helps one book doesn't only fit that book. */
/** Part 2's books, by round: 200s Kai (snow, a human boy, a sledge and a
 *  troll), 300s Bao (tiny food and toy heroes in a giant kitchen), 400s the
 *  held-out test book (Nell and the dragon), painted only at the start and
 *  the end. */
const BOOKS: [number, string][] = [[900, "story6.json"], [400, "story5.json"], [300, "story4.json"], [200, "story3.json"], [100, "story2.json"], [0, "story.json"]];
export const benchStory = (round = 0): BenchStory => JSON.parse(readFileSync(join(BENCH_DIR, BOOKS.find(([from]) => round >= from)![1]), "utf8"));

/** Every page of the story, in order (page numbers start at 1). */
export const benchPages = (round = 0): Page[] => benchStory(round).segments.flatMap((s) => s.pages);

/** The painter's request for one page, built the way the reader's page
 *  builds it: the characters in the picture, the book's art direction, and
 *  the previous page's brief. */
export function benchRequest(n: number, round = 0): IllustrateRequest {
  const story = benchStory(round);
  const pages = benchPages(round);
  const page = pages[n - 1];
  if (!page) throw new Error(`No page ${n}`);
  const everyone = [story.hero, ...story.companions, ...story.cast];
  return {
    world: story.world,
    cast: page.characters.map((id) => everyone.find((c) => c.id === id)).filter((c): c is CharacterDef => Boolean(c)),
    page: { text: page.text, picture: page.picture, characters: page.characters, action: page.action },
    previous: n > 1 ? pages[n - 2].picture : null,
    // (as the reader's page sends it: the page's place from the story's
    // places, and its camera)
    place: story.places.find((p) => p.id === page.place) ?? null,
    camera: page.camera ?? null,
    pageInPart: pageInPart(n, round),
  };
}

/** The page's place in its part (0 = first after a decision). */
function pageInPart(n: number, round = 0): number {
  let i = n - 1;
  for (const s of benchStory(round).segments) {
    if (i < s.pages.length) return i;
    i -= s.pages.length;
  }
  return 0;
}

export const roundDir = (round: number, source: "live" | "emulated") => {
  const dir = join(BENCH_DIR, "rounds", `r${String(round).padStart(2, "0")}`, source);
  mkdirSync(dir, { recursive: true });
  return dir;
};

export const pageFile = (round: number, source: "live" | "emulated", n: number) => join(roundDir(round, source), `p${String(n).padStart(2, "0")}.svg`);

export function readPainting(round: number, source: "live" | "emulated", n: number): string | null {
  const dir = join(BENCH_DIR, "rounds", `r${String(round).padStart(2, "0")}`, source, `p${String(n).padStart(2, "0")}.svg`);
  return existsSync(dir) ? readFileSync(dir, "utf8") : null;
}

// ------------------------------------------------------------------ budget

const LEDGER = join(BENCH_DIR, "ledger.json");
// (raised for part 2: $5 more on top of the $6.75 part 1 spent)
export const BUDGET_USD = 11.75;

export interface Ledger {
  spentUsd: number;
  calls: { at: string; round: number; page: number; label: string; model: string; usd: number }[];
}

export const readLedger = (): Ledger => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { spentUsd: 0, calls: [] });
export const writeLedger = (l: Ledger) => writeFileSync(LEDGER, JSON.stringify(l, null, 1));
