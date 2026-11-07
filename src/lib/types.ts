import type { AgeId } from "./ages";
import type { MotionId, SoundId } from "./actions";

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

/** The one action or event a page is about. The picture's target can be tapped
 *  to animate it, hear a sound effect and see/hear the word. */
export interface PageAction {
  /** The word to learn, as it appears in the text (e.g. "jump", "duck", "splash"). */
  word: string;
  /** What to tap: a character id ("hero", "duckling") or an object name ("puddle"). */
  target: string;
  sound: SoundId;
  motion: MotionId;
}

export interface Page {
  text: string;
  /** The page's key action/event and its tappable target. */
  action?: PageAction | null;
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
  /** @deprecated superseded by per-user RatingRecord; kept only so very old local drafts still load. */
  rating: number;
  demo?: boolean;
  /** Mirrored to the public story store once finished and fully painted. */
  published?: boolean;
  /** Community rating, mirrored from the store once published. */
  ratingSum?: number;
  ratingCount?: number;
  /** The account that created this story (back-filled to the admin account for pre-accounts stories). */
  authorId?: string;
  authorUsername?: string;
}

// ---- accounts ----

export interface UserProfile {
  /** Stable id (the Google account's subject claim). */
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  /** Chosen once, right after first sign-in; null until then. */
  username: string | null;
  /** One of the preset character keys (see presets.ts); assigned a default on sign-up. */
  avatarKey: string;
  isAdmin: boolean;
  createdAt: number;
}

/** One reader's rating (and optional comment) on a published story. One per user per story. */
export interface RatingRecord {
  userId: string;
  username: string;
  rating: number; // 1-5
  comment: string | null;
  createdAt: number;
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

// ---- public story store ----

/** One card in the public story store: everything needed to list it, no full content. */
export interface GalleryEntry {
  id: string;
  title: string;
  createdAt: number;
  ratingSum: number;
  ratingCount: number;
  age: AgeId;
  heroName: string;
  cover: string | null;
  authorId: string;
  authorUsername: string;
}

export interface IllustrateRequest {
  world: string;
  cast: CharacterDef[]; // characters in this picture (hero included when present)
  page: Pick<Page, "text" | "picture" | "characters" | "action">;
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
