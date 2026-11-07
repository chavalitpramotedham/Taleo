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

export const MOTIONS = ["bounce", "hop", "wiggle", "spin", "grow", "shake", "float", "nod", "zoom"] as const;
export type MotionId = (typeof MOTIONS)[number];
export const isMotion = (m: unknown): m is MotionId => typeof m === "string" && (MOTIONS as readonly string[]).includes(m);
