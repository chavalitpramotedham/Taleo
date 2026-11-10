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
    words: [8, 18],
    optionCount: 2,
    recommendedMinutes: 3,
    secondsPerPage: 20,
    vocab:
      "First words: everyday concrete nouns and very simple action words a toddler can point at or copy (ball, duck, splash, hug, clap, sleep). A fun sound word is fine now and then. Repeat the word in the text so it's heard twice.",
    guide:
      "The very youngest listeners. A grown-up reads every word aloud, so write it to be a joy to PERFORM, never a list of labels. 1-2 short, bouncy sentences per page with a strong beat, like a nursery rhyme: light rhyme or a near-rhyme, a sing-song rhythm, and a refrain that comes back on most pages with one word changed each time ('Not in the pot! Not in the sock!') so the child can join in. Never a bare label like 'A ball.' or a flat description. Give the grown-up something to do on every page: an animal sound or noise to make together (in the text, not as a stage direction), a question to ask the child and answer on the same page ('Where is Duck? There she is!'), a peekaboo reveal, counting one-two-three, or a word that begs for a funny voice. A tiny but real plot: someone wants or loses something, looks in two or three places with a small silly surprise in each (the wrong animal pops out, a hat on the wrong head, a great big sneeze), then finds it, and ends in a cuddle. Humour is physical and gentle: surprises, mix-ups, things going plop. Concrete things the child can point at in the picture, colours, counting to 3, present tense, simple everyday words. No abstract ideas, no time jumps. Choices are between two very concrete things (e.g. 'the red ball' or 'the yellow duck').",
  },
  {
    id: "2-3",
    label: "2 – 3",
    blurb: "Little talkers",
    emoji: "🧸",
    choices: 2,
    pagesPerSegment: [3, 5],
    words: [12, 26],
    optionCount: 2,
    recommendedMinutes: 4,
    secondsPerPage: 21,
    vocab:
      "Simple, vivid action words and familiar things (hop, roll, bubble, wave, peek, stomp). At most one sound word (like splash or pop) per segment - the rest should be real action words or objects.",
    guide:
      "Toddler talkers, read aloud by a grown-up - make it fun to perform. 2-3 short sentences per page with simple words and a bouncy rhythm. A refrain or repeated pattern the child can chant along with, rhymes and onomatopoeia ('Splish! Splash!'), and now and then a question for the child ('Can you guess who is hiding?'). A small plot with a clear want, a funny mishap or two (things too big, too small, upside down, in the wrong place) and a happy fix. Simple feelings (happy, sleepy, surprised, a bit cross) shown in what characters do. Short speech lines between characters, each with their own way of talking. Simple cause and effect. Choices are concrete actions ('climb the tree' or 'look under the rock').",
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
      "Pre-schoolers. 2-3 sentences per page. Playful dialogue, silly jokes and funny mix-ups (absurd ideas said seriously, a character who keeps getting one thing wrong, a running gag that pays off at the end), simple problem-solving, naming feelings, sharing and kindness. Vocabulary is everyday with one fun new word now and then (explained by context). Choices are meaningful actions with different consequences.",
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
