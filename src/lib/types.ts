import type { AgeId } from "./ages";

/** A character that appears in the book. */
export interface CharacterDef {
  id: string;
  name: string;
  /** Model-sheet description (species, colours with hex, features, personality). */
  look: string;
  /** Preset key (see presets.ts), or null for a custom character. */
  preset: string | null;
  /** Custom reference painting: layered SVG in a 200x200 canvas. */
  svg?: string | null;
}

export interface Page {
  text: string;
  /** Narrator aside shown as a marginal note (used to steer silly requests). */
  aside: string | null;
  /** The illustrator's brief for this page: the exact moment to paint. */
  picture: string;
  /** Ids of the characters in the picture. */
  characters: string[];
  /** The finished painting (layered SVG body for a 400x300 canvas). */
  svg?: string | null;
}

export interface ChoicePoint {
  prompt: string;
  options: { label: string }[];
}

export interface Segment {
  pages: Page[];
  choice: ChoicePoint | null;
  /** What the reader picked at the end of this segment. */
  chosen?: { text: string; custom: boolean } | null;
}

export interface Story {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  age: AgeId;
  theme: string;
  /** Art direction for the whole book: place, season, light, palette. */
  world: string;
  hero: CharacterDef;
  cast: CharacterDef[]; // side characters
  segments: Segment[];
  status: "new" | "in-progress" | "complete";
  rating: number; // 0 = unrated, 1-5
  demo?: boolean;
}

// ---- API contracts ----

export interface StartRequest {
  kind: "start";
  age: AgeId;
  theme: string;
  hero: CharacterDef;
}

export interface ContinueRequest {
  kind: "continue";
  story: Pick<Story, "age" | "theme" | "world" | "hero" | "cast" | "segments" | "title">;
}

export type StoryRequest = StartRequest | ContinueRequest;

export interface SegmentResponse {
  title?: string;
  world?: string;
  newCharacters: CharacterDef[];
  segment: Segment;
  ending: boolean;
  demo?: boolean;
}

export interface IllustrateRequest {
  world: string;
  cast: CharacterDef[]; // characters in this picture (hero included when present)
  page: Pick<Page, "text" | "picture" | "characters">;
  previous?: string | null; // previous page's picture brief, for continuity
}

export interface CharacterRequest {
  description: string;
  name?: string;
}

export interface CharacterResponse {
  character: CharacterDef;
  demo?: boolean;
}
