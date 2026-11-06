export type AgeId = "1.5-2" | "2-3" | "3-4" | "4-5" | "5-6";

export interface AgeLevel {
  id: AgeId;
  label: string;
  blurb: string;
  emoji: string;
  /** Number of decision points in a story. */
  choices: number;
  /** Pages per segment (between choices). */
  pagesPerSegment: [number, number];
  /** Words per page. */
  words: [number, number];
  /** Number of options offered at a choice. */
  optionCount: number;
  guide: string;
}

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
    guide:
      "Early readers. 3-5 sentences per page. Lively dialogue with distinct character voices, jokes that play with words, a plot with a twist, and characters who learn something. Varied sentence lengths and vivid verbs. Choices can be tricky dilemmas with no wrong answer.",
  },
];

export const ageById = (id: string): AgeLevel => AGES.find((a) => a.id === id) ?? AGES[2];
