import type { CharacterDef } from "./types";

export interface Preset {
  key: string;
  name: string;
  group: "animal" | "food" | "object";
  description: string;
}

export const PRESETS: Preset[] = [
  { key: "bunny", name: "Pip", group: "animal", description: "a fluffy cream bunny with long pink-lined ears and a cotton tail; bouncy and curious" },
  { key: "bear", name: "Bobo", group: "animal", description: "a round honey-brown bear cub with a pale tummy; cuddly, loves snacks and naps" },
  { key: "kitty", name: "Miso", group: "animal", description: "a peach kitten with stripy cheeks and a curly tail; playful and a little cheeky" },
  { key: "fox", name: "Fennel", group: "animal", description: "a coral-orange fox with a fluffy white-tipped tail; clever and kind" },
  { key: "owl", name: "Hoot", group: "animal", description: "a small sage-green owl with big round eyes and tiny wings; wise but forgetful" },
  { key: "elephant", name: "Ellie", group: "animal", description: "a baby-blue elephant with floppy ears and a curly trunk; gentle and strong" },
  { key: "penguin", name: "Pebble", group: "animal", description: "a little navy-and-white penguin with orange feet; waddles and slides on its tummy" },
  { key: "dino", name: "Dot", group: "animal", description: "a mint-green baby dinosaur with soft spikes and freckles; big roar, bigger heart" },
  { key: "strawberry", name: "Berry", group: "food", description: "a plump pink strawberry with a leafy green hat and seed freckles; sweet and giggly" },
  { key: "cupcake", name: "Sprinkles", group: "food", description: "a vanilla cupcake with pink swirly icing, rainbow sprinkles and a cherry on top; cheerful party-lover" },
  { key: "avocado", name: "Avo", group: "food", description: "a little green avocado with a round brown pit tummy; calm and silly" },
  { key: "dumpling", name: "Bao", group: "food", description: "a soft white steamed bun with a pleated top and rosy cheeks; squishy and brave" },
  { key: "cloud", name: "Puff", group: "object", description: "a fluffy pastel cloud that can float and make tiny rain showers; dreamy and kind" },
  { key: "star", name: "Twinkle", group: "object", description: "a golden-yellow star with rounded points that glows softly; bright ideas" },
  { key: "teapot", name: "Tilly", group: "object", description: "a round mint teapot with a pink lid and little spout; cosy, a bit fussy, loves tea parties" },
  { key: "robot", name: "Bolt", group: "object", description: "a small lilac toy robot with a springy antenna and a heart button; helpful and beep-boopy" },
];

export const presetByKey = (key: string | null | undefined) =>
  PRESETS.find((p) => p.key === key);

export const presetCharacter = (p: Preset, name?: string): CharacterDef => ({
  id: "hero",
  name: name?.trim() || p.name,
  description: p.description,
  preset: p.key,
  svg: null,
  face: null,
});

export interface ThemeOption {
  key: string;
  label: string;
  emoji: string;
  line: string;
}

export const THEMES: ThemeOption[] = [
  { key: "friends", label: "Making new friends", emoji: "🤝", line: "meeting someone new and becoming friends" },
  { key: "adventure", label: "A big adventure", emoji: "🗺️", line: "a brave adventure to somewhere new" },
  { key: "mission", label: "A special mission", emoji: "🎯", line: "a special mission to find or fix something important" },
  { key: "family", label: "Family love", emoji: "🏡", line: "a warm day with family and helping each other" },
  { key: "bedtime", label: "Sleepy bedtime", emoji: "🌙", line: "a calm, cosy bedtime journey that ends in sleep" },
  { key: "feelings", label: "Big feelings", emoji: "💛", line: "learning what to do with a big feeling (like being shy or cross)" },
  { key: "mystery", label: "A little mystery", emoji: "🔍", line: "a gentle mystery to solve with clues" },
  { key: "party", label: "Party time", emoji: "🎉", line: "getting ready for a surprise party" },
  { key: "nature", label: "Nature & seasons", emoji: "🍂", line: "exploring nature and noticing the season" },
  { key: "sharing", label: "Sharing & kindness", emoji: "🎁", line: "learning that sharing and kindness feel good" },
];
