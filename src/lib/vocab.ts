// Shared vocabulary for the illustration engine. The server tells Claude which
// values exist; the client knows how to paint each one.

export const SETTINGS = [
  "meadow",
  "forest",
  "beach",
  "underwater",
  "sky",
  "garden",
  "snow",
  "kitchen",
  "bedroom",
  "playground",
  "farm",
  "town",
  "space",
  "castle",
  "candyland",
  "jungle",
  "pond",
  "mountain",
  "cave",
] as const;
export type Setting = (typeof SETTINGS)[number];

export const TIMES = ["day", "sunset", "night"] as const;
export type TimeOfDay = (typeof TIMES)[number];

export const WEATHERS = ["clear", "rain", "snow", "windy", "rainbow"] as const;
export type Weather = (typeof WEATHERS)[number];

export const EXPRESSIONS = [
  "happy",
  "excited",
  "laughing",
  "surprised",
  "sad",
  "sleepy",
  "silly",
  "thinking",
  "worried",
  "proud",
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const POSES = ["stand", "jump", "dance", "wave", "sleep", "float", "run"] as const;
export type Pose = (typeof POSES)[number];

export const SIZES = ["small", "medium", "large"] as const;
export type Size = (typeof SIZES)[number];

export const PROPS = [
  "tree",
  "pine",
  "flower",
  "flowers",
  "mushroom",
  "bush",
  "rock",
  "sun",
  "moon",
  "star",
  "cloud",
  "rainbow",
  "house",
  "boat",
  "balloon",
  "kite",
  "ball",
  "gift",
  "cake",
  "cupcake",
  "apple",
  "carrot",
  "cookie",
  "honeypot",
  "book",
  "bed",
  "map",
  "treasure",
  "key",
  "butterfly",
  "bee",
  "bird",
  "fish",
  "shell",
  "starfish",
  "snowman",
  "umbrella",
  "puddle",
  "leaf",
  "heart",
  "sparkles",
  "rocket",
  "planet",
  "car",
  "bucket",
  "sandcastle",
  "teddy",
  "crown",
  "wand",
  "basket",
  "door",
  "letter",
  "bubbles",
  "tent",
  "campfire",
  "music",
  "lantern",
  "bridge",
] as const;
export type PropKind = (typeof PROPS)[number];

export const isKnownProp = (k: string): k is PropKind =>
  (PROPS as readonly string[]).includes(k);
