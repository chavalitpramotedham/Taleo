"use client";
import type { SavedCharacter } from "./types";
import { PRESETS } from "./presets";
import { listStories } from "./storage";

/**
 * "What shall we make next?" - a ready-made idea for the next story,
 * offered once a story has just been finished: who it's about (the
 * family's own characters first, then friends they haven't met yet) and
 * what happens (a concept from the list below, beyond the wizard's
 * everyday kinds of story).
 *
 * Nothing here asks a storyteller or a painter, or touches the account:
 * the ideas are written in advance, the picking happens on the device,
 * and an idea "saved for later" is kept on the device too - so it never
 * counts as a story begun.
 */

export interface Idea {
  key: string;
  title: string;
  /** The line that sells it, with the cast's names woven in. */
  pitch: (hero: string, friends: string) => string;
  /** What the storyteller is told (the wizard's "your own idea" line). */
  line: string;
}

/** "with Pip and Bao" / "" - friends, ready to drop into a sentence. */
const withFriends = (friends: string, lead = " with ") => (friends ? `${lead}${friends}` : "");

export const IDEAS: Idea[] = [
  {
    key: "moon-hat",
    title: "The Moon's Lost Hat",
    pitch: (h, f) => `The moon has lost its hat, and the night is getting chilly. Only ${h}${withFriends(f, ", ")} can find it before bedtime.`,
    line: "the moon has lost its hat and needs help finding it before the night gets too cold",
  },
  {
    key: "tiny-door",
    title: "The Door Behind the Bookshelf",
    pitch: (h, f) => `A tiny door has appeared behind the bookshelf, and something is knocking from the other side. Will ${h} open it${withFriends(f)}?`,
    line: "a tiny door appears behind the bookshelf and leads somewhere small and wonderful",
  },
  {
    key: "upside-down",
    title: "Upside-Down Day",
    pitch: (h, f) => `Breakfast is on the ceiling and the rain is falling up. ${h} must turn the day the right way round${withFriends(f)}.`,
    line: "a silly day when everything is upside down and has to be turned the right way round",
  },
  {
    key: "cloud-bakery",
    title: "The Cloud Bakery",
    pitch: (h, f) => `High above the rooftops, a bakery makes the weather. Today it is up to ${h}${withFriends(f, ", ")} to bake tomorrow's sky.`,
    line: "a bakery in the clouds where the weather is baked fresh every morning",
  },
  {
    key: "shrunk",
    title: "The Day We Shrank",
    pitch: (h, f) => `One sneeze, and ${h} is as small as a button. The garden is a jungle now - what an adventure${withFriends(f)}!`,
    line: "shrinking to the size of a button and exploring the garden as a giant jungle",
  },
  {
    key: "lost-colour",
    title: "Who Took the Colour Yellow?",
    pitch: (h, f) => `The sun is grey, the bananas are grey - yellow has gone missing! ${h} follows the clues${withFriends(f)}.`,
    line: "the colour yellow has gone missing from the world and must be found and brought back",
  },
  {
    key: "night-train",
    title: "The Sleepy Night Train",
    pitch: (h, f) => `A little train stops outside the window, bound for the Land of Dreams. There is one seat left for ${h}${withFriends(f, ", and room for ")}.`,
    line: "a gentle night train that carries sleepy passengers through the stars to the land of dreams",
  },
  {
    key: "giant-turnip",
    title: "The Enormous Vegetable",
    pitch: (h, f) => `Something in the garden has grown bigger than the house. Pulling it up will take ${h}${withFriends(f, ", ")} and a very clever plan.`,
    line: "a vegetable grows bigger than a house and everyone must work together to pull it up",
  },
  {
    key: "lighthouse",
    title: "The Lighthouse That Couldn't Sleep",
    pitch: (h, f) => `The old lighthouse keeps blinking all night long. Can ${h} find out what is keeping it awake${withFriends(f)}?`,
    line: "a lighthouse that cannot fall asleep and the kind friends who help it rest",
  },
  {
    key: "treasure-map",
    title: "The Map in the Biscuit Tin",
    pitch: (h, f) => `At the bottom of the biscuit tin: crumbs, and a treasure map. ${h} sets off at once${withFriends(f)}.`,
    line: "a treasure map found in a biscuit tin leads to a treasure worth sharing",
  },
  {
    key: "dragon-hiccups",
    title: "The Dragon with the Hiccups",
    pitch: (h, f) => `Every hiccup sets something small on fire. A worried little dragon needs ${h}'s help${withFriends(f, " - and the help of ")}.`,
    line: "a small friendly dragon cannot stop hiccuping sparks and needs gentle help to stop",
  },
  {
    key: "snow-summer",
    title: "Snow in the Middle of Summer",
    pitch: (h, f) => `It is the hottest day of the year, and it has just begun to snow. ${h} goes to find out why${withFriends(f)}.`,
    line: "it snows on the hottest day of summer and the reason turns out to be a kind one",
  },
  {
    key: "star-catch",
    title: "The Star That Fell in the Pond",
    pitch: (h, f) => `Splash! A little star has fallen into the pond and wants to go home. ${h} has until sunrise${withFriends(f)}.`,
    line: "a little star falls into a pond and must be helped back up into the sky before sunrise",
  },
  {
    key: "museum-night",
    title: "A Night at the Toy Museum",
    pitch: (h, f) => `When the lights go out, the toys wake up - and one of them is missing. ${h} joins the search${withFriends(f)}.`,
    line: "the toys in a museum wake up at night and one of them has gone missing",
  },
  {
    key: "parade",
    title: "The Smallest Parade in the World",
    pitch: (h, f) => `A parade needs a band, a float and somebody to wave. ${h} has one afternoon to make one${withFriends(f)}.`,
    line: "putting together the smallest, happiest parade in the world in a single afternoon",
  },
  {
    key: "whale-song",
    title: "The Whale Who Forgot Her Song",
    pitch: (h, f) => `Deep under the waves, a whale has forgotten her song. ${h} dives down to help her remember${withFriends(f)}.`,
    line: "a gentle whale has forgotten her song and friends travel under the sea to help her find it",
  },
  {
    key: "rocket-box",
    title: "The Cardboard Rocket",
    pitch: (h, f) => `It was only a cardboard box - until the countdown reached zero. Next stop for ${h}${withFriends(f, ", ")}: the moon.`,
    line: "a cardboard box rocket really takes off and visits the moon in time to be home for supper",
  },
  {
    key: "wind-letters",
    title: "The Wind Took the Post",
    pitch: (h, f) => `A gust of wind has scattered every letter in town. ${h} must deliver them all before dark${withFriends(f)}.`,
    line: "the wind scatters all the town's letters and they must be gathered and delivered before dark",
  },
  {
    key: "shadow",
    title: "My Shadow Ran Away",
    pitch: (h, f) => `${h}'s shadow has slipped off to have an adventure of its own. Off to find it${withFriends(f)}!`,
    line: "a shadow runs away to have its own adventure and has to be found and made friends with again",
  },
  {
    key: "soup",
    title: "The Soup That Needed Everyone",
    pitch: (h, f) => `The biggest pot in the village is empty, and winter is coming. ${h} knows just what to do${withFriends(f)}.`,
    line: "a whole village makes one big soup together, each bringing one small thing to share",
  },
  {
    key: "rainbow-fix",
    title: "The Rainbow Has a Gap",
    pitch: (h, f) => `There is a piece missing from the rainbow, right in the middle. ${h} climbs up to mend it${withFriends(f)}.`,
    line: "a rainbow has a piece missing and must be mended with colours gathered along the way",
  },
  {
    key: "island-move",
    title: "The Island That Moved",
    pitch: (h, f) => `The little island was there yesterday. Today it is swimming away - with ${h}${withFriends(f, ", ")} on it!`,
    line: "a small island turns out to be a sleepy sea turtle who takes its visitors on a slow voyage",
  },
  {
    key: "echo",
    title: "The Cave That Answered Back",
    pitch: (h, f) => `${h} shouts hello into the cave - and something shouts back a different word. Who lives in there? ${h} tiptoes in to see${withFriends(f)}.`,
    line: "an echo in a cave answers with its own words and turns out to be a shy new friend",
  },
  {
    key: "pyjama-picnic",
    title: "The Midnight Pyjama Picnic",
    pitch: (h, f) => `Slippers on, lantern lit: there is a picnic under the stars tonight, and ${h} is invited${withFriends(f, " - along with ")}.`,
    line: "a cosy midnight picnic in pyjamas under the stars that ends with everyone fast asleep",
  },
];

export const ideaByKey = (key: string) => IDEAS.find((i) => i.key === key);

/** One of the cast, as it's shown and as the wizard picks it back up
 *  (`uid` is the wizard's own: "saved:<id>" or "preset:<key>"). */
export interface IdeaMember {
  uid: string;
  name: string;
  preset: string | null;
  svg: string | null;
}

export interface NextIdea {
  key: string;
  cast: IdeaMember[];
  /** When it was put away for later (ms). */
  savedAt?: number;
}

/** "Pip", "Pip and Bao", "Pip, Bao and Dot". */
export const nameList = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export const ideaPitch = (idea: NextIdea) => {
  const concept = ideaByKey(idea.key);
  const [hero, ...friends] = idea.cast.map((c) => c.name);
  return concept && hero ? concept.pitch(hero, nameList(friends)) : "";
};

// ------------------------------------------------------------- picking

const pick = <T,>(from: T[]): T => from[Math.floor(Math.random() * from.length)];
const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null") as T | null;
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const seenKey = (userId: string) => `taleo.ideas.seen.${userId}`;
const savedKey = (userId: string) => `taleo.ideas.saved.${userId}`;
const CAST_SIZE = 3;

/** The ready-made friends this device's stories have already starred. */
function presetsMet(): Set<string> {
  const met = new Set<string>();
  for (const s of listStories()) for (const c of [s.hero, ...(s.companions ?? [])]) if (c?.preset) met.add(c.preset);
  return met;
}

/**
 * A fresh idea: a concept not offered before (round again once they've
 * all been seen), starring up to two of the family's own characters -
 * the ones with the fewest stories first - joined by ready-made friends
 * this device's stories haven't met yet.
 */
export function freshIdea(userId: string, own: SavedCharacter[], { not }: { not?: string } = {}): NextIdea {
  let seen = read<string[]>(seenKey(userId), []);
  let unseen = IDEAS.filter((i) => !seen.includes(i.key) && i.key !== not);
  if (!unseen.length) {
    seen = [];
    unseen = IDEAS.filter((i) => i.key !== not);
  }
  const concept = pick(unseen);
  write(seenKey(userId), [...seen, concept.key]);

  const cast: IdeaMember[] = [...own]
    .sort((a, b) => (a.storyIds?.length ?? 0) - (b.storyIds?.length ?? 0))
    .slice(0, 2)
    .map((c) => ({ uid: `saved:${c.id}`, name: c.name, preset: null, svg: c.svg }));
  const met = presetsMet();
  const taken = new Set(cast.map((c) => c.name.toLowerCase()));
  let pool = PRESETS.filter((p) => !met.has(p.key) && !taken.has(p.name.toLowerCase()));
  if (pool.length < CAST_SIZE) pool = PRESETS.filter((p) => !taken.has(p.name.toLowerCase()));
  while (cast.length < CAST_SIZE && pool.length) {
    const p = pick(pool);
    // (one of each kind where there's the choice: an animal, a foodie...)
    const others = pool.filter((x) => x.group !== p.group);
    pool = others.length ? others : pool.filter((x) => x.key !== p.key);
    cast.push({ uid: `preset:${p.key}`, name: p.name, preset: p.key, svg: null });
  }
  return { key: concept.key, cast };
}

// ------------------------------------------------- saved for later

/** Fired when the idea saved for later changes. */
export const IDEA_EVENT = "taleo:idea";
const changed = () => window.dispatchEvent(new Event(IDEA_EVENT));

/** The idea put away for later on this device (one at a time). */
export function savedIdea(userId: string): NextIdea | null {
  const idea = read<NextIdea | null>(savedKey(userId), null);
  return idea && ideaByKey(idea.key) && Array.isArray(idea.cast) && idea.cast.length ? idea : null;
}
export function saveIdea(userId: string, idea: NextIdea) {
  write(savedKey(userId), { ...idea, savedAt: Date.now() });
  changed();
}
export function forgetIdea(userId: string) {
  try {
    localStorage.removeItem(savedKey(userId));
  } catch {}
  changed();
}

// -------------------------------------- handing over to the wizard

const USE = "taleo.idea.use";
const FINISHED = "taleo.justFinished";

export interface IdeaHandover {
  uids: string[];
  line: string;
  /** Begin at once (when nothing stands in the way) rather than stopping
   *  to let the cast and the idea be changed. */
  go: boolean;
}

/** Leave an idea for the wizard to open with. */
export function handOver(idea: NextIdea, go: boolean) {
  const concept = ideaByKey(idea.key);
  if (!concept) return;
  const h: IdeaHandover = { uids: idea.cast.map((c) => c.uid), line: concept.line, go };
  try {
    sessionStorage.setItem(USE, JSON.stringify(h));
  } catch {}
}
/** The wizard's side: take what was left (once). */
export function takeHandover(): IdeaHandover | null {
  try {
    const raw = sessionStorage.getItem(USE);
    if (!raw) return null;
    sessionStorage.removeItem(USE);
    const h = JSON.parse(raw) as IdeaHandover;
    return Array.isArray(h.uids) && typeof h.line === "string" ? h : null;
  } catch {
    return null;
  }
}

/** A story of one's own has just been read to its end (the reader says). */
export function markJustFinished() {
  try {
    sessionStorage.setItem(FINISHED, "1");
  } catch {}
}
/** ...and the bookshelf asks, once. */
export function takeJustFinished(): boolean {
  try {
    if (!sessionStorage.getItem(FINISHED)) return false;
    sessionStorage.removeItem(FINISHED);
    return true;
  } catch {
    return false;
  }
}
