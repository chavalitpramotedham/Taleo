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

export const AGES: AgeLevel[] = [
  {
    id: "1.5-2",
    label: "1½ – 2",
    blurb: "First words",
    emoji: "🍼",
    choices: 2,
    pagesPerSegment: [3, 4],
    words: [4, 12],
    optionCount: 2,
    recommendedMinutes: 3,
    secondsPerPage: 17,
    vocab:
      "First words: everyday concrete nouns and very simple action words a toddler can point at or copy (ball, duck, splash, hug, clap, sleep). A fun sound word is fine now and then. Repeat the word in the text so it's heard twice.",
    guide:
      "Very first words. One short sentence per page (often 3-8 words). Use concrete nouns the child can point at in the picture (ball, duck, moon), animal sounds and fun noises, lots of repetition and a repeated refrain. Name colours and simple counting to 3. Present tense. No abstract ideas, no time jumps. Choices are between two very concrete things (e.g. 'the red ball' or 'the yellow duck').",
  },
  {
    id: "2-3",
    label: "2 – 3",
    blurb: "Little talkers",
    emoji: "🧸",
    choices: 2,
    pagesPerSegment: [3, 5],
    words: [10, 22],
    optionCount: 2,
    recommendedMinutes: 4,
    secondsPerPage: 20,
    vocab:
      "Simple, vivid action words and familiar things (hop, roll, bubble, wave, peek, stomp). At most one sound word (like splash or pop) per segment - the rest should be real action words or objects.",
    guide:
      "Toddler talkers. 1-2 short sentences per page with simple words. Gentle repetition, rhymes and onomatopoeia ('Splish! Splash!'). Simple feelings (happy, sleepy, surprised). Short speech lines between characters. Simple cause and effect. Choices are concrete actions ('climb the tree' or 'look under the rock').",
  },
  {
    id: "3-4",
    label: "3 – 4",
    blurb: "Curious explorers",
    emoji: "🪁",
    choices: 3,
    pagesPerSegment: [3, 5],
    words: [20, 40],
    optionCount: 3,
    recommendedMinutes: 5,
    secondsPerPage: 19,
    vocab:
      "Lively, more specific verbs and describing words that grow vocabulary (tiptoe, wobble, scramble, gather, sparkle, gigantic). Avoid pure sound effects; prefer the word that names the action.",
    guide:
      "Pre-schoolers. 2-3 sentences per page. Playful dialogue, silly jokes and funny mix-ups, simple problem-solving, naming feelings, sharing and kindness. Vocabulary is everyday with one fun new word now and then (explained by context). Choices are meaningful actions with different consequences.",
  },
  {
    id: "4-5",
    label: "4 – 5",
    blurb: "Big imaginations",
    emoji: "🚀",
    choices: 3,
    pagesPerSegment: [3, 5],
    words: [30, 55],
    optionCount: 3,
    recommendedMinutes: 6,
    secondsPerPage: 22,
    vocab:
      "Richer words a 4-5 year old is ready to learn, made clear by the sentence and picture (scamper, glide, tumble, peer, rescue, enormous, delighted). No sound-effect words.",
    guide:
      "Older pre-schoolers. 3-4 sentences per page. A clear little plot with a problem, a try-fail-try-again moment and a satisfying solution. Witty dialogue and gentle humour (wordplay, silly exaggeration), richer descriptive words, a small mystery or surprise. Choices can involve kindness, cleverness or bravery.",
  },
  {
    id: "5-6",
    label: "5 – 6",
    blurb: "Story makers",
    emoji: "🏰",
    choices: 3,
    pagesPerSegment: [4, 5],
    words: [40, 70],
    optionCount: 3,
    recommendedMinutes: 7,
    secondsPerPage: 23,
    vocab:
      "'Big words' that stretch vocabulary, with the meaning made obvious by the sentence and the picture (astonished, tremble, gallop, discover, enormous, cautiously, triumphant). Feelings and describing words are welcome, not just actions. No sound-effect words.",
    guide:
      "Early readers. 3-5 sentences per page. Lively dialogue with distinct character voices, jokes that play with words, a plot with a twist, and characters who learn something. Varied sentence lengths and vivid verbs. Choices can be tricky dilemmas with no wrong answer.",
  },
  {
    id: "6+",
    label: "6+",
    blurb: "Young readers",
    emoji: "📚",
    choices: 3,
    pagesPerSegment: [4, 6],
    words: [60, 100],
    optionCount: 3,
    recommendedMinutes: 8,
    secondsPerPage: 28,
    vocab:
      "Ambitious 'story words' a confident 6-8 year old reader enjoys learning, clear from the sentence and picture: vivid verbs, precise describing words and feelings (bewildered, determined, clambered, murmured, glimmering, reluctant, magnificent, whispered). No sound-effect words, and nothing so rare it needs a dictionary.",
    guide:
      "Confident young readers (about 6-8), the most advanced level - more like the opening of a beloved chapter book than a toddler's picture book. 5-7 sentences per page with varied rhythm: some long, flowing sentences and some short punchy ones for effect. A real plot that builds: a clear goal, a problem that gets harder, a turning point and a satisfying, earned resolution, with genuine (gentle) suspense, a mystery or a surprise twist, and small details planted early that pay off later. Characters have distinct voices and personalities, mixed feelings (nervous but brave, cross then sorry) and grow by the end. Humour can be cleverer - wordplay, irony the child is in on, running jokes. The heart of the story can be more thoughtful (fairness, honesty when it's hard, seeing someone else's side, perseverance, owning a mistake), shown through choices with real consequences rather than told. Choices are genuine dilemmas where each path has a cost or trade-off, and the story honours whichever is chosen. Still warm, safe and bedtime-calm at the end; no real danger, cruelty or scary villains.",
  },
];

export const ageById = (id: string): AgeLevel => AGES.find((a) => a.id === id) ?? AGES[2];

export const clampMinutes = (m: number): number => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m)));

export interface LengthProfile {
  choices: number;
  pagesPerSegment: [number, number];
}

/** Scales choice count and pages-per-segment to a target read-aloud length.
 *  The age guide (vocabulary, sentence complexity, words per page) stays
 *  fixed by age - how long the story is and how hard it reads are
 *  independent choices. */
export function lengthProfile(age: AgeLevel, minutes: number): LengthProfile {
  const m = clampMinutes(minutes);
  const totalPages = Math.max(age.choices + 1, Math.round((m * 60) / age.secondsPerPage));
  const minChoices = Math.max(1, age.choices - 1);
  const maxChoices = age.choices + 2;
  const scaled = Math.round(age.choices * (m / age.recommendedMinutes));
  const choices = Math.min(maxChoices, Math.max(minChoices, scaled));
  const segments = choices + 1;
  const avgPages = Math.max(2, Math.round(totalPages / segments));
  return { choices, pagesPerSegment: [Math.max(2, avgPages - 1), avgPages + 1] };
}
