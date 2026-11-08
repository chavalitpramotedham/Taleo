// Vocabulary for each page's tappable moment: the sound it makes and how it moves.
// Shared by the server (to tell Claude the options) and the browser.

export const SOUNDS = [
  "boing", // jumping, bouncing, hopping
  "splash", // water, puddles, rain
  "pop", // bubbles, balloons, surprises appearing
  "whoosh", // wind, running fast, flying, sliding
  "twinkle", // magic, stars, discoveries, wonder
  "knock", // doors, tapping, woodpeckers
  "munch", // eating, crunching
  "buzz", // bees, insects
  "tweet", // birds
  "roar", // dinosaurs, lions, big (friendly) noises
  "ding", // ideas, bells, finding something
  "thud", // falling, landing, bumping
  "rustle", // leaves, bushes, hiding, paper
  "trumpet", // elephants, toots, fanfares
  "squeak", // mice, tiny things, squeezes
  "snore", // sleeping, yawning
  "quack", // ducks
  "meow", // cats
  "giggle", // laughing, tickling, silliness
  "drip", // dripping, raindrops, tears
] as const;
export type SoundId = (typeof SOUNDS)[number];

export const isSound = (s: unknown): s is SoundId => typeof s === "string" && (SOUNDS as readonly string[]).includes(s);

export const MOTIONS = [
  // gentle, in place
  "bounce", "wiggle", "grow", "nod", "shake", "float",
  // livelier
  "hop", "spin", "zoom",
  // dramatic: the target leaves its spot and comes back
  "dash", "fly", "leap", "tumble", "burst", "dive",
] as const;
export type MotionId = (typeof MOTIONS)[number];
export const isMotion = (m: unknown): m is MotionId => typeof m === "string" && (MOTIONS as readonly string[]).includes(m);

/**
 * Motions grouped by what they express, each from gentlest to most dramatic,
 * indexed by age level 1-5 (1½–2 … 5–6). A toddler's car wiggles; a
 * five-year-old's car zooms right off the page and back.
 */
const FAMILIES: Record<string, MotionId[]> = {
  travel: ["wiggle", "zoom", "zoom", "dash", "dash"],
  jump: ["bounce", "bounce", "hop", "leap", "leap"],
  up: ["float", "float", "float", "fly", "fly"],
  turn: ["wiggle", "wiggle", "spin", "spin", "tumble"],
  size: ["grow", "grow", "grow", "burst", "burst"],
  down: ["nod", "nod", "dive", "dive", "dive"],
  shake: ["shake", "shake", "shake", "shake", "shake"],
};
const FAMILY_OF: Record<MotionId, keyof typeof FAMILIES> = {
  bounce: "jump", hop: "jump", leap: "jump",
  wiggle: "turn", spin: "turn", tumble: "turn",
  grow: "size", burst: "size",
  nod: "down", dive: "down",
  shake: "shake",
  float: "up", fly: "up",
  zoom: "travel", dash: "travel",
};

const AGE_LEVEL: Record<string, number> = { "1.5-2": 1, "2-3": 2, "3-4": 3, "4-5": 4, "5-6": 5, "6+": 5 };
export const ageLevel = (ageId: string) => AGE_LEVEL[ageId] ?? 3;

/** The version of a motion that suits the reader's age. */
export function motionForAge(motion: MotionId, ageId: string): MotionId {
  const family = FAMILIES[FAMILY_OF[motion] ?? "jump"];
  return family[ageLevel(ageId) - 1] ?? motion;
}

/** How far and how hard things move at each age level (scales every animation). */
export const AMPLITUDE = [0.7, 0.9, 1.15, 1.45, 1.75] as const;
