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
 * indexed by age level 1-5 (1–2 … 5–6). A toddler's car wiggles; a
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

/**
 * How a word is acted out, where the word says it plainly: the motion's
 * family and the fitting sound. Used to give a page's word its motion and
 * sound when the word had to be replaced (its first one wasn't on the
 * page), and to correct a motion that contradicts its word (a "tiptoe"
 * that leaps, a "sank" that flies up). Words it doesn't know are left as
 * the storyteller chose.
 */
type Acting = [RegExp, MotionId[], SoundId[]];
/** (motions and sounds that act each kind of word out - the first of each
 *  is the one given when the storyteller's choice doesn't fit) */
const ACTING: Acting[] = [
  [/^(jump|hop|bounc|leap|spring|sprang|skip|bound|pounc)/, ["hop", "bounce", "leap"], ["boing", "splash", "giggle"]],
  [/^(tiptoe|creep|crept|sneak|snuck|peek|peep|peer|hid|hide|tuck)/, ["nod", "wiggle", "bounce"], ["rustle", "squeak"]],
  [/^(fly|flew|flown|soar|float|drift|flutter|glid|hover|rise|rose|lift|launch|blast)/, ["float", "fly"], ["whoosh", "twinkle", "tweet", "pop"]],
  [/^(zoom|race|raced|dash|rush|speed|sped|scurr|scamper|skitter|gallop|whizz|whoosh|sled|ski|skat|swoosh|zip|run|ran|carv|slid|slide)/, ["zoom", "dash", "fly", "float"], ["whoosh", "giggle"]],
  [/^(spin|spun|twirl|whirl|swirl|roll|somersault)/, ["spin", "tumble", "wiggle"], ["whoosh", "giggle"]],
  [/^(wobbl|wiggl|wriggl|jiggl|giggl|danc|sway|waddl|tickl|chuckl|laugh)/, ["wiggle", "shake", "bounce", "spin", "hop"], ["giggle", "boing", "twinkle", "quack"]],
  [/^(shiver|shake|shook|shudder|trembl|rattl|quiver|rumbl)/, ["shake", "grow", "wiggle"], ["thud", "roar", "rustle", "whoosh", "drip"]],
  [/^(grow|grew|swell|stretch|bloom|blossom|burst|pop|explod|sparkl|glow(?!er)|shine|shone|twinkl|gleam|glitter|unfold)/, ["grow", "burst", "hop", "float"], ["twinkle", "pop", "ding", "rustle"]],
  [/^(splash|dive|dove|dip|plop|plunge|sink|sank|sunk|drip|pour|paddl|wad)/, ["dive", "nod", "bounce", "burst", "tumble", "hop", "float"], ["splash", "drip", "quack"]],
  [/^(fall|fell|tumbl|trip|bump|crash|land|thud|plonk|flop|slip)/, ["tumble", "dive", "nod", "bounce", "spin"], ["thud", "giggle", "splash", "boing"]],
  [/^(sleep|slept|asleep|snor|yawn|doze|nap|snooz)/, ["nod"], ["snore"]],
  [/^(knock|tap|hammer|bang|clatter)/, ["bounce", "shake", "nod"], ["knock", "thud"]],
  [/^(munch|crunch|chomp|nibbl|gobbl|eat|ate|bite|slurp|lick|gulp)/, ["bounce", "nod", "wiggle"], ["munch"]],
  [/^(roar|growl|bellow|boom|stomp|stamp)/, ["shake", "grow", "bounce", "hop"], ["roar", "thud"]],
  [/^(buzz)/, ["wiggle", "shake", "float"], ["buzz"]],
  [/^(tweet|chirp|sing|sang|whistl|cheep)/, ["bounce", "wiggle", "float", "hop", "spin"], ["tweet", "twinkle", "giggle"]],
  [/^(squeak|squeez|squish)/, ["bounce", "wiggle", "shake", "grow", "hop"], ["squeak", "pop"]],
  [/^(meow|purr)/, ["wiggle", "nod"], ["meow"]],
  [/^(ring|rang|ding|chime|clink)/, ["shake", "bounce", "grow"], ["ding", "twinkle"]],
  [/^(rustl|crinkl|unwrap|flap)/, ["wiggle", "shake", "bounce", "float", "grow", "fly"], ["rustle", "whoosh", "tweet", "quack"]],
  [/^(toot|trumpet|honk)/, ["grow", "shake", "bounce"], ["trumpet"]],
];
/** A page's motion and sound, kept where they fit its word and put right
 *  where they plainly don't (the storyteller once had "asleep" float off,
 *  a "hop" nod, a "tiptoed" snore). Words this doesn't know keep what they
 *  were given. */
export function fitActing(word: string, motion: MotionId, sound: SoundId): { motion: MotionId; sound: SoundId } {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const hit = ACTING.find(([re]) => re.test(w));
  if (!hit) return { motion, sound };
  return { motion: hit[1].includes(motion) ? motion : hit[1][0], sound: hit[2].includes(sound) ? sound : hit[2][0] };
}
/** How a word is acted out, if it says so plainly: its first motion and sound. */
export function actingOut(word: string): { motion: MotionId; sound: SoundId } | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const hit = ACTING.find(([re]) => re.test(w));
  return hit ? { motion: hit[1][0], sound: hit[2][0] } : null;
}
