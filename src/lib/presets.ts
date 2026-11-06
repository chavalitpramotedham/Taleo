import type { CharacterDef } from "./types";
import { PRESET_ART } from "./art/presetArt";

export interface Preset {
  key: string;
  name: string;
  group: "animal" | "food" | "object";
  kind: string;
  /** Model-sheet description used by the illustrator (keep colours in sync with presetArt). */
  look: string;
}

export const PRESETS: Preset[] = [
  { key: "bunny", name: "Pip", group: "animal", kind: "rabbit", look: "a young wild rabbit with warm grey-brown fur (#A98463, darker #9C7756), cream chest and muzzle (#E9DCC5), long upright ears with pale pink insides (#D9B8A0), a white cotton tail (#F4EFE4), dark shiny eyes; real rabbit proportions, quick and curious" },
  { key: "bear", name: "Bobo", group: "animal", kind: "bear cub", look: "a round little brown bear cub (fur #8E6A4C, paws #7A5A40) with a pale tan muzzle, tummy and ear insides (#C9AC88), a dark nose; soft and cuddly, loves snacks and naps" },
  { key: "kitty", name: "Miso", group: "animal", kind: "kitten", look: "a ginger tabby kitten (fur #D99A5B with darker stripes #A8642F) with a cream chest, muzzle and paws (#F3DDC0), pink ear insides, big round eyes and a long curling tail; playful and a little cheeky" },
  { key: "fox", name: "Fennel", group: "animal", kind: "fox cub", look: "a russet fox cub (#C46A3A) with a cream chest, cheeks and tail tip (#F3E6D0), dark brown legs and ear backs (#4A3A32), a pointed snout and a huge bushy tail; clever and kind" },
  { key: "owl", name: "Hoot", group: "animal", kind: "owl", look: "a small tawny owl (#A88560, darker wings #8C6A48) with a pale speckled breast (#E3D2B4), round pale face discs (#E8D9BC), big dark eyes, little ear tufts and a mustard beak and feet (#D3A24F); wise but forgetful" },
  { key: "elephant", name: "Ellie", group: "animal", kind: "baby elephant", look: "a baby elephant with soft blue-grey skin (#9EA7AA, shadows #8C979A), big floppy ears with dusty pink insides (#D9B2A6), a curling trunk and a little tail; gentle and strong" },
  { key: "penguin", name: "Pebble", group: "animal", kind: "penguin chick", look: "a little penguin with a slate back and flippers (#4E5B66), a creamy white front (#F2EFE6), an orange beak and feet (#D99447); waddles and slides on its tummy" },
  { key: "dino", name: "Dot", group: "animal", kind: "baby dinosaur", look: "a plump baby dinosaur with sage-green skin (#8FA77A), a pale cream belly (#DCD9B4), soft terracotta back plates (#C98F6E), darker green freckles and a long tail; big roar, bigger heart" },
  { key: "strawberry", name: "Berry", group: "food", kind: "strawberry", look: "a ripe red strawberry (#B9473F, highlight #D9776A) with golden seeds (#E8CF7E), a leafy green cap (#6F8F4E), a dot-eyed face, thin ink-line arms and legs and tiny dark boots; sweet and giggly" },
  { key: "cupcake", name: "Sprinkles", group: "food", kind: "cupcake", look: "a cupcake in a pale blue-grey pleated paper case (#C9D6D8) with a swirl of pale pink cream (#F1E2DA), coloured sprinkles and a red cherry (#B2443A); face on the case; thin ink-line arms and legs; a cheerful party-lover" },
  { key: "avocado", name: "Avo", group: "food", kind: "avocado half", look: "half an avocado with dark green skin (#5E6E3F), pale green flesh (#D9DDA0) and a round brown stone tummy (#8C5E3C); face above the stone; thin ink-line arms; calm and silly" },
  { key: "dumpling", name: "Bao", group: "food", kind: "steamed bun", look: "a soft white steamed bun (#F4EEE2, shadow #E2D6C2) with a pleated top knot, rosy cheeks and a tiny face; squishy and brave" },
  { key: "cloud", name: "Puff", group: "object", kind: "little cloud", look: "a small soft cloud (#EEF0EE, blue-grey underside #C7D0D4) with rosy cheeks and a tiny face that can float and sprinkle little showers; dreamy and kind" },
  { key: "star", name: "Twinkle", group: "object", kind: "little star", look: "a little golden star (#E8C766) with softly rounded points, a warm glow (#F3E3B0) and a tiny face; full of bright ideas" },
  { key: "teapot", name: "Tilly", group: "object", kind: "china teapot", look: "a round white china teapot (#F2EEE4) with blue painted flowers and lid band (#6F8FAF), a curved spout and handle, tiny blue feet and a gentle face; cosy, a bit fussy, loves tea parties" },
  { key: "robot", name: "Bolt", group: "object", kind: "tin toy robot", look: "an old-fashioned tin wind-up toy robot painted teal (#6F9A9A) with cream face and chest panels (#E9DFC6), round eyes, a red antenna bulb and heart button (#B2443A), rivets and a brass wind-up key (#C9A24F); helpful and beep-boopy" },
];

export const presetByKey = (key: string | null | undefined) => PRESETS.find((p) => p.key === key);

export const presetCharacter = (p: Preset, name?: string, id = "hero"): CharacterDef => ({
  id,
  name: name?.trim() || p.name,
  look: p.look,
  preset: p.key,
  svg: null,
});

/** The reference painting for a character (preset art, or the custom design). */
export const characterArt = (c: Pick<CharacterDef, "preset" | "svg">): string =>
  (c.preset && PRESET_ART[c.preset]) || c.svg || "";

export interface ThemeOption {
  key: string;
  label: string;
  line: string;
}

export const THEMES: ThemeOption[] = [
  { key: "friends", label: "Making new friends", line: "meeting someone new and becoming friends" },
  { key: "adventure", label: "A big adventure", line: "a brave adventure to somewhere new" },
  { key: "mission", label: "A special mission", line: "a special mission to find or fix something important" },
  { key: "family", label: "Family love", line: "a warm day with family and helping each other" },
  { key: "bedtime", label: "Sleepy bedtime", line: "a calm, cosy bedtime journey that ends in sleep" },
  { key: "feelings", label: "Big feelings", line: "learning what to do with a big feeling (like being shy or cross)" },
  { key: "mystery", label: "A little mystery", line: "a gentle mystery to solve with clues" },
  { key: "party", label: "Party time", line: "getting ready for a surprise party" },
  { key: "nature", label: "Nature & seasons", line: "exploring nature and noticing the season" },
  { key: "sharing", label: "Sharing & kindness", line: "learning that sharing and kindness feel good" },
];
