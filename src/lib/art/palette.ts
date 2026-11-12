/**
 * The colours the standard scenery pieces (stamps, scatter) are painted in,
 * by named slot. A stamp never carries a colour of its own: it asks for
 * "leaf", "trunk", "bloom1"... and the book's season and the page's light
 * decide what those are. So one oak serves a summer meadow, an autumn lane
 * and a moonlit garden, and an autumn book never gets summer trees.
 *
 * Seasons and lights are read from the book's art direction and the page's
 * brief (see seasonOf / lightOf) until the writer says them outright.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Light = "day" | "golden" | "dusk" | "night" | "rain";

export type Slot =
  | "ink"
  | "leaf"
  | "leafDark"
  | "leafLight"
  | "trunk"
  | "trunkDark"
  | "grass"
  | "grassDark"
  | "bloom1"
  | "bloom2"
  | "bloom3"
  | "bloomCentre"
  | "stone"
  | "stoneDark"
  | "wood"
  | "woodDark"
  | "cloud"
  | "cloudShade"
  | "water"
  | "waterLight"
  | "sun"
  | "moon"
  | "star"
  | "fabric1"
  | "fabric2"
  | "wall"
  | "glass"
  | "lampGlow"
  | "cap"
  | "stem"
  | "wing1"
  | "wing2"
  | "snow"
  | "shadow";

export type Palette = Record<Slot, string>;

const SEASONS: Record<Season, Partial<Palette>> = {
  spring: { leaf: "#94A86A", leafDark: "#6F8650", leafLight: "#B9C68E", grass: "#A9B97E", grassDark: "#7F9460", bloom1: "#E7B3B8", bloom2: "#F1E2A0", bloom3: "#B7A6CC", bloomCentre: "#E3B84F" },
  summer: { leaf: "#7F905E", leafDark: "#5E6E44", leafLight: "#A6B27E", grass: "#AAB585", grassDark: "#7F8F5C", bloom1: "#B2443A", bloom2: "#D3A24F", bloom3: "#A99BB5", bloomCentre: "#E3B84F" },
  autumn: { leaf: "#C98A45", leafDark: "#A35E33", leafLight: "#DDB06A", grass: "#B9AE7C", grassDark: "#8F8458", bloom1: "#B5653E", bloom2: "#D3A24F", bloom3: "#8C5E3C", bloomCentre: "#6E3B32" },
  winter: { leaf: "#7F8F84", leafDark: "#5F6F66", leafLight: "#AEB9B2", grass: "#C9CCBE", grassDark: "#9AA095", bloom1: "#B2443A", bloom2: "#E8E2D2", bloom3: "#A99BB5", bloomCentre: "#D3A24F" },
};

const BASE: Palette = {
  ink: "#4F3A2A",
  leaf: "#7F905E",
  leafDark: "#5E6E44",
  leafLight: "#A6B27E",
  trunk: "#7A6250",
  trunkDark: "#5C4838",
  grass: "#AAB585",
  grassDark: "#7F8F5C",
  bloom1: "#B2443A",
  bloom2: "#D3A24F",
  bloom3: "#A99BB5",
  bloomCentre: "#E3B84F",
  stone: "#B7B0A0",
  stoneDark: "#8E8676",
  wood: "#A9805A",
  woodDark: "#7E5C40",
  cloud: "#F4F1E8",
  cloudShade: "#D9DCD8",
  water: "#AFC1C4",
  waterLight: "#E5ECEA",
  sun: "#EBCB86",
  moon: "#F3E3B0",
  star: "#F3E3B0",
  fabric1: "#B5653E",
  fabric2: "#6F8FAF",
  wall: "#EADFC8",
  glass: "#DCE3E1",
  lampGlow: "#F6DFA0",
  cap: "#B2443A",
  stem: "#EFE6D4",
  wing1: "#E8C766",
  wing2: "#B7A6CC",
  snow: "#FAF9F5",
  shadow: "#4A3020",
};

/** How the light changes everything after the season has been applied:
 *  a hue to mix towards, and how far. */
const LIGHTS: Record<Light, { towards: string; amount: number; extra?: Partial<Palette> }> = {
  day: { towards: "#FFFFFF", amount: 0 },
  golden: { towards: "#E9B060", amount: 0.16, extra: { cloud: "#F6E6CC", cloudShade: "#E3C9A8", sun: "#F0C070" } },
  dusk: { towards: "#7A6C8C", amount: 0.28, extra: { cloud: "#E3C9C0", cloudShade: "#A99BB5", glass: "#F0D9A0", lampGlow: "#F8D888" } },
  night: { towards: "#2F3550", amount: 0.45, extra: { cloud: "#8C93AC", cloudShade: "#5B6283", glass: "#F0D9A0", lampGlow: "#F8D888", moon: "#F3E3B0", star: "#F3E3B0" } },
  rain: { towards: "#8E9AA0", amount: 0.22, extra: { cloud: "#C7CDD0", cloudShade: "#9AA4AA", water: "#9FB2B6" } },
};

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t)).toUpperCase();
};

/** Slots that keep their colour whatever the light (they are the light). */
const SELF_LIT: Slot[] = ["ink", "sun", "moon", "star", "lampGlow", "shadow", "snow"];

export function paletteFor(season: Season, light: Light): Palette {
  const p = { ...BASE, ...SEASONS[season] } as Palette;
  const l = LIGHTS[light];
  for (const k of Object.keys(p) as Slot[]) if (!SELF_LIT.includes(k) && l.amount) p[k] = mix(p[k], l.towards, l.amount);
  return { ...p, ...l.extra };
}

const has = (text: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(text));

/** The book's season, from its art direction. */
export function seasonOf(world: string): Season {
  if (has(world, "autumn", "fall\\b", "harvest", "conker", "golden leaves")) return "autumn";
  if (has(world, "winter", "snow", "frost", "christmas", "ice")) return "winter";
  if (has(world, "spring", "blossom", "bluebell", "daffodil", "easter")) return "spring";
  return "summer";
}

/** The page's light, from its brief (and the book's direction). */
export function lightOf(brief: string): Light {
  if (has(brief, "night", "moon", "starry", "stars", "midnight", "bedtime", "asleep")) return "night";
  if (has(brief, "dusk", "sunset", "evening", "twilight")) return "dusk";
  if (has(brief, "raining", "rain\\b", "rainy", "drizzle", "storm")) return "rain";
  if (has(brief, "golden", "afternoon", "late sun", "sunrise", "dawn")) return "golden";
  return "day";
}
