export type AgeId = "1.5-2" | "2-3" | "3-4" | "4-5" | "5-6" | "6+";

export interface AgeLevel {
  id: AgeId;
  label: string;
  blurb: string;
  emoji: string;
  /** Number of decision points in a story, at this age's recommended length. */
  choices: number;
  /** Pages per segment (between choices), at this age's recommended length. */
  pagesPerSegment: [number, number];
  /** Words per page - fixed by age (reading level), independent of length. */
  words: [number, number];
  /** Number of options offered at a choice. */
  optionCount: number;
  /** The length slider's default for this age, in minutes. */
  recommendedMinutes: number;
  /** Roughly how long a page of this age's text takes to read aloud, in
   *  seconds, including pauses, pointing and repeating - used to scale
   *  page/choice counts to a chosen length. */
  secondsPerPage: number;
  guide: string;
  /** What kind of word each page's tappable "word to learn" should be at
   *  this age - from first concrete words up to richer vocabulary. */
  vocab: string;
}

export const MIN_MINUTES = 3;
export const MAX_MINUTES = 8;
// (the two ends of what a story's `minutes` has ever been; lengths are below)

export const AGES: AgeLevel[] = [
  {
    id: "1.5-2",
    label: "1 – 2",
    blurb: "First words",
    emoji: "🍼",
    choices: 2,
    pagesPerSegment: [3, 4],
    words: [16, 28],
    optionCount: 2,
    recommendedMinutes: 3,
    secondsPerPage: 20,
    vocab:
      "First words: everyday concrete nouns and very simple action words a toddler can point at or copy (ball, duck, splash, hug, clap, sleep). Prefer a real word to a noise; a fun sound word is fine once in a story. Repeat the word in the text so it's heard twice.",
    guide:
      "The very youngest listeners. A grown-up reads every word aloud, so write it to be a joy to PERFORM and a pleasure for the grown-up too - proper, well-made English in complete sentences, the kind found in the best picture books, never a list of labels or a string of noises. 2-4 short sentences per page with a gentle beat: a touch of rhyme or near-rhyme where it comes naturally, and a refrain that comes back every few pages with one word changed each time ('Not in the pot! Not in the sock!') so the child can join in. The refrain and the odd sound are seasoning, not the meal: most of every page is real storytelling - who did what, where, and how it felt - in simple, correct, musical sentences. Never a bare label like 'A ball.' or a flat description. On many pages (not every one) give the grown-up something to do: a question to ask the child and answer on the same page ('Where is Duck? There she is!'), a peekaboo reveal, counting one-two-three, a word that begs for a funny voice, or now and then an animal sound to make together (in the text, not as a stage direction). A tiny but real plot: someone wants or loses something, looks in two or three places with a small silly surprise in each (the wrong animal pops out, a hat on the wrong head, a great big sneeze), then finds it, and ends in a cuddle. Humour is physical and gentle: surprises, mix-ups, things going plop. Concrete things the child can point at in the picture, colours, counting to 3, present tense, simple everyday words. No abstract ideas, no time jumps. Choices are between two very concrete things (e.g. 'the red ball' or 'the yellow duck').",
  },
  {
    id: "2-3",
    label: "2 – 3",
    blurb: "Little talkers",
    emoji: "🧸",
    choices: 2,
    pagesPerSegment: [3, 5],
    words: [24, 36],
    optionCount: 2,
    recommendedMinutes: 4,
    secondsPerPage: 21,
    vocab:
      "Simple, vivid action words and familiar things (hop, roll, bubble, wave, peek, stomp). At most one sound word (like splash or pop) per segment - the rest should be real action words or objects.",
    guide:
      "Toddler talkers, read aloud by a grown-up - make it fun to perform and good to read: proper, well-made English in complete sentences, as in the best picture books. 3-5 short sentences per page with simple words and an easy rhythm. A refrain or repeated pattern the child can chant along with every few pages, a rhyme or a sound word ('Splish! Splash!') here and there - never page after page of noises - and now and then a question for the child ('Can you guess who is hiding?'). A small plot with a clear want, a funny mishap or two (things too big, too small, upside down, in the wrong place) and a happy fix. Simple feelings (happy, sleepy, surprised, a bit cross) shown in what characters do. Short speech lines between characters, each with their own way of talking. Simple cause and effect. Choices are concrete actions ('climb the tree' or 'look under the rock').",
  },
  {
    id: "3-4",
    label: "3 – 4",
    blurb: "Curious explorers",
    emoji: "🪁",
    choices: 3,
    pagesPerSegment: [3, 5],
    words: [32, 48],
    optionCount: 3,
    recommendedMinutes: 5,
    secondsPerPage: 19,
    vocab:
      "Lively, more specific verbs and describing words that grow vocabulary (tiptoe, wobble, scramble, gather, sparkle, gigantic). Avoid pure sound effects; prefer the word that names the action.",
    guide:
      "Pre-schoolers. 3-5 sentences per page, in clear, well-made English. Playful dialogue, silly jokes and funny mix-ups (absurd ideas said seriously, a character who keeps getting one thing wrong, a running gag that pays off at the end), simple problem-solving, naming feelings, sharing and kindness. Vocabulary is everyday with one fun new word now and then (explained by context). Choices are meaningful actions with different consequences.",
  },
  {
    id: "4-5",
    label: "4 – 5",
    blurb: "Big imaginations",
    emoji: "🚀",
    choices: 3,
    pagesPerSegment: [3, 5],
    words: [40, 60],
    optionCount: 3,
    recommendedMinutes: 6,
    secondsPerPage: 22,
    vocab:
      "Richer words a 4-5 year old is ready to learn, made clear by the sentence and picture (scamper, glide, tumble, peer, rescue, enormous, delighted). No sound-effect words.",
    guide:
      "Older pre-schoolers. 4-6 sentences per page. A clear little plot with a problem, a try-fail-try-again moment and a satisfying solution. Witty dialogue and gentle humour (wordplay, silly exaggeration), richer descriptive words, a small mystery or surprise. Choices can involve kindness, cleverness or bravery.",
  },
  {
    id: "5-6",
    label: "5 – 6",
    blurb: "Story makers",
    emoji: "🏰",
    choices: 3,
    pagesPerSegment: [4, 5],
    words: [50, 72],
    optionCount: 3,
    recommendedMinutes: 7,
    secondsPerPage: 23,
    vocab:
      "'Big words' that stretch vocabulary, with the meaning made obvious by the sentence and the picture (astonished, tremble, gallop, discover, enormous, cautiously, triumphant). Feelings and describing words are welcome, not just actions. No sound-effect words.",
    guide:
      "Early readers. 5-7 sentences per page. Lively dialogue with distinct character voices, jokes that play with words, a plot with a twist, and characters who learn something. Varied sentence lengths and vivid verbs. Choices can be tricky dilemmas with no wrong answer.",
  },
  {
    id: "6+",
    label: "6+",
    blurb: "Young readers",
    emoji: "📚",
    choices: 3,
    pagesPerSegment: [4, 6],
    words: [65, 95],
    optionCount: 3,
    recommendedMinutes: 8,
    secondsPerPage: 28,
    vocab:
      "Ambitious 'story words' a confident 6-8 year old reader enjoys learning, clear from the sentence and picture: vivid verbs, precise describing words and feelings (bewildered, determined, clambered, murmured, glimmering, reluctant, magnificent, whispered). No sound-effect words, and nothing so rare it needs a dictionary.",
    guide:
      "Confident young readers (about 6-8), the most advanced level - more like the opening of a beloved chapter book than a toddler's picture book. 6-8 sentences per page with varied rhythm: some long, flowing sentences and some short punchy ones for effect. A real plot that builds: a clear goal, a problem that gets harder, a turning point and a satisfying, earned resolution, with genuine (gentle) suspense, a mystery or a surprise twist, and small details planted early that pay off later. Characters have distinct voices and personalities, mixed feelings (nervous but brave, cross then sorry) and grow by the end. Humour can be cleverer - wordplay, irony the child is in on, running jokes. The heart of the story can be more thoughtful (fairness, honesty when it's hard, seeing someone else's side, perseverance, owning a mistake), shown through choices with real consequences rather than told. Choices are genuine dilemmas where each path has a cost or trade-off, and the story honours whichever is chosen. Still warm, safe and bedtime-calm at the end; no real danger, cruelty or scary villains.",
  },
];

export const ageById = (id: string): AgeLevel => AGES.find((a) => a.id === id) ?? AGES[2];

// ---------------------------------------------------------------- length
//
// A story comes in three lengths. Each has a set number of decisions, and
// a reading time - how long it takes to read straight through once it's
// all written and painted (no waiting, no deciding) - which is also what
// it costs: a credit a minute.
//
//   Quest      short    2 decisions   3 minutes straight through   3 credits   under 5 min at bedtime
//   Adventure  medium   3 decisions   5 minutes                    5 credits   5-8 min   (the standard)
//   Odyssey    long     4 decisions   8 minutes                    8 credits   over 8 min
//
// The library shows the bedtime range ("5-8 min"), never the names: those
// are only for choosing a length when making a story.
//
// A story's `minutes` is its length's reading time (3, 5 or 8). Stories
// made when length was a slider carry other numbers: they read as the
// nearest length.

export type LengthId = "quest" | "adventure" | "odyssey";
export interface StoryLength {
  id: LengthId;
  name: string;
  /** "short" / "medium" / "long" */
  size: string;
  /** Reading time straight through, in minutes - and its price in credits. */
  minutes: number;
  /** Decisions the child makes along the way. */
  decisions: number;
  /** About how long it takes at bedtime, as readers are told: "<5",
   *  "5–8", ">8" (minutes) - from reading it straight through to
   *  taking it slowly, with the decisions talked over. */
  time: string;
}
export const STORY_LENGTHS: StoryLength[] = [
  { id: "quest", name: "Quest", size: "short", minutes: 3, decisions: 2, time: "<5" },
  { id: "adventure", name: "Adventure", size: "medium", minutes: 5, decisions: 3, time: "5–8" },
  { id: "odyssey", name: "Odyssey", size: "long", minutes: 8, decisions: 4, time: ">8" },
];
/** The standard story: what a plan's own story covers. */
export const STANDARD_LENGTH = STORY_LENGTHS[1];
/** The length a number of minutes stands for (the nearest one). */
export const lengthOf = (minutes: number): StoryLength => {
  const m = Number(minutes) || STANDARD_LENGTH.minutes;
  return m <= 4 ? STORY_LENGTHS[0] : m <= 6 ? STORY_LENGTHS[1] : STORY_LENGTHS[2];
};
/** The same, said in words (for a screen reader): "under 5", "5 to 8", "over 8". */
export const timeWords = (minutes: number): string => lengthOf(minutes).time.replace("<", "under ").replace(">", "over ").replace("–", " to ");
/** A story's time as readers are shown it: "<5", "5–8", ">8" (minutes). */
export const timeRange = (minutes: number): string => lengthOf(minutes).time;
/** "an Odyssey", "a Quest" */
export const aLength = (l: StoryLength) => `${/^[AEIOU]/.test(l.name) ? "an" : "a"} ${l.name}`;

export const clampMinutes = (m: number): number => lengthOf(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m)))).minutes;

export interface LengthProfile {
  length: StoryLength;
  choices: number;
  pagesPerSegment: [number, number];
  /** Words on a page: a narrow band around this age's usual page. */
  words: [number, number];
}

/** How briskly a page of each age's text is read aloud (words a minute):
 *  the youngest pages are few words said slowly, with sounds and pointing. */
const PACE: Record<AgeId, number> = { "1.5-2": 70, "2-3": 85, "3-4": 110, "4-5": 130, "5-6": 140, "6+": 150 };
/** Turning the page and taking in the picture, in seconds. */
const PAGE_TURN_S = 4;

/** The most pages between two decisions, whatever the age. Every page is
 *  a painting, and paintings are what a story costs to make: a story has
 *  much the same number of pages at every age (a Quest 6-9, an Adventure
 *  8-12, an Odyssey 10-15), and the youngest get their length from fuller
 *  pages of real sentences rather than from many more pages. */
const MAX_PAGES_PER_PART = 3;

/**
 * What a story of this length is made of, for this age: its decisions
 * (set by the length), and pages and words that come to the length's
 * reading time. The words on a page follow the age (how hard it reads),
 * in a narrow band; the pages between decisions make up the time, two or
 * three at every age.
 */
export function lengthProfile(age: AgeLevel, minutes: number): LengthProfile {
  const length = lengthOf(minutes);
  const choices = length.decisions;
  const segments = choices + 1;
  const mid = (age.words[0] + age.words[1]) / 2;
  const words: [number, number] = [Math.round(mid * 0.85), Math.round(mid * 1.15)];
  const secondsPerPage = (mid / PACE[age.id]) * 60 + PAGE_TURN_S;
  const perPart = (length.minutes * 60) / secondsPerPage / segments;
  const low = Math.min(MAX_PAGES_PER_PART, Math.max(2, Math.floor(perPart)));
  const high = Math.min(MAX_PAGES_PER_PART, Math.max(low, Math.ceil(perPart)));
  return { length, choices, pagesPerSegment: [low, high], words };
}
