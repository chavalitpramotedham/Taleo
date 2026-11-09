import type { AgeId } from "./ages";
import type { MotionId, SoundId } from "./actions";

/** A character that appears in the book. */
/** Optional: a family can say whether a custom character is a boy/man or a
 *  girl/woman (or leave it open), so stories and pictures get it right. */
export type CharacterGender = "male" | "female";

export interface CharacterDef {
  id: string;
  name: string;
  /** Model-sheet description (species, colours with hex, features, personality). */
  look: string;
  /** Preset key (see presets.ts), or null for a custom character. */
  preset: string | null;
  /** Custom reference painting: layered SVG in a 200x200 canvas. */
  svg?: string | null;
  /** Freeform notes from the family: personality, likes, and especially
   *  relationships ("Pip's big sister", "Grandma's cat"). Fed to the story
   *  writer, never the illustrator. */
  notes?: string | null;
  /** How they're related to the family and to other characters ("Colin's
   *  big sister", "Grandma's cat", "best friends with Dot"), kept in its own
   *  box apart from the notes. Fed to the story writer only. */
  relationships?: string | null;
  /** The SavedCharacter this came from, if it's one of the user's own. */
  savedId?: string | null;
  gender?: CharacterGender | null;
}

/** A custom character a signed-in user has saved to their own roster (up to
 *  5), so it can be reused across stories without redrawing it each time. */
export interface SavedCharacter {
  id: string;
  name: string;
  look: string;
  svg: string | null;
  /** Optional freeform description / relationships (see CharacterDef.notes). */
  notes: string | null;
  /** Their relationships, in their own box (see CharacterDef.relationships). */
  relationships?: string | null;
  /** The last prompt their picture was painted from: the description they
   *  were first created with, or the latest redraw request. Kept apart
   *  from the notes. */
  prompt?: string | null;
  gender: CharacterGender | null;
  /** Ids of the stories this character has starred in, oldest first. Not
   *  shown yet - kept so future stories can recall shared adventures. */
  storyIds: string[];
  createdAt: number;
  updatedAt: number;
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
  /** Target read-aloud length in minutes (3-8), chosen alongside age. */
  minutes: number;
  theme: string;
  /** Art direction for the whole book: place, season, light, palette. */
  world: string;
  /** The story's heart: the one lesson the book builds to and lands at the
   *  end (chosen when the story starts, then kept for every later part). */
  moral?: string;
  /** One word for what the story is about ("Family", "Adventure"), shown as
   *  a pill on its card. Chosen by the writer; older stories derive it. */
  keyword?: string;
  hero: CharacterDef;
  /** Up to 2 more central characters chosen alongside the hero (ids
   *  "companion1", "companion2") - together with hero, up to 3 protagonists
   *  the story gives real page-time to. */
  companions: CharacterDef[];
  cast: CharacterDef[]; // side characters, introduced by the story itself
  segments: Segment[];
  status: "new" | "in-progress" | "complete";
  /** @deprecated superseded by per-user RatingRecord; kept only so very old local drafts still load. */
  rating: number;
  demo?: boolean;
  /** Mirrored to the public story store (possibly early, e.g. to share or rate it before every page is painted). */
  published?: boolean;
  /** The store copy includes every finished painting. */
  publishedPainted?: boolean;
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
  /** Who can find this person's stories in the library and on their
   *  bookshelf page. Missing means "public" (the default for everyone). */
  visibility?: ContentVisibility;
}

export type ContentVisibility = "public" | "private";

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
  minutes: number;
  theme: string;
  hero: CharacterDef;
  companions: CharacterDef[];
}

export interface ContinueRequest {
  kind: "continue";
  story: Pick<Story, "age" | "minutes" | "theme" | "world" | "hero" | "companions" | "cast" | "segments" | "title" | "moral">;
}

export type StoryRequest = StartRequest | ContinueRequest;

export interface SegmentResponse {
  title?: string;
  world?: string;
  moral?: string;
  keyword?: string;
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
  /** Card and preview details (filled at publish; back-filled for older
   *  entries), so the preview opens without loading the whole story. */
  keyword?: string;
  starring?: string[];
  minutes?: number;
  pages?: number;
}

export interface IllustrateRequest {
  world: string;
  cast: CharacterDef[]; // characters in this picture (hero included when present)
  page: Pick<Page, "text" | "picture" | "characters" | "action">;
  previous?: string | null; // previous page's picture brief, for continuity
  /** Paint with the quicker painter (set by the server from `pageInPart`
   *  and the account's plan). */
  quick?: boolean;
  /** This page's place in its part (0 = the first page after the story
   *  begins or after a decision). */
  pageInPart?: number;
}

export interface CharacterRequest {
  description: string;
  name?: string;
  /** Redrawing an existing character: their current model sheet, and who
   *  they are (family notes, male/female) - kept, with the description
   *  saying what to change. */
  current?: { look: string; notes?: string | null; relationships?: string | null; gender?: CharacterGender | null };
}

export interface CharacterResponse {
  character: CharacterDef;
  demo?: boolean;
}
