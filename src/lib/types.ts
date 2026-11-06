import type { Expression, Pose, Setting, Size, TimeOfDay, Weather } from "./vocab";
import type { AgeId } from "./ages";

/** A character that can appear in illustrations. */
export interface CharacterDef {
  id: string;
  name: string;
  /** Short look/personality description, used in prompts. */
  description: string;
  /** Preset art key (see presets.ts). Null for custom-drawn characters. */
  preset: string | null;
  /** Custom body art: SVG inner markup in a 200x200 viewBox, without a face. */
  svg?: string | null;
  /** Where to draw the face on custom art (200x200 coordinates). */
  face?: { x: number; y: number; size: number } | null;
}

export interface SceneCharacter {
  id: string;
  x: number; // 0-100, horizontal position
  expression: Expression;
  pose: Pose;
  size: Size;
  flip: boolean; // face left instead of right
}

export interface SceneProp {
  kind: string; // a PropKind or a custom prop key
  x: number; // 0-100
  y: number; // 0-100, where the bottom of the prop sits
  size: Size;
}

export interface Page {
  text: string;
  /** Optional big onomatopoeia drawn into the picture, e.g. "SPLASH!" */
  sound: string | null;
  /** Optional narrator aside shown in a bubble (used to steer silly requests). */
  aside: string | null;
  setting: Setting;
  time: TimeOfDay;
  weather: Weather;
  characters: SceneCharacter[];
  props: SceneProp[];
}

export interface ChoiceOption {
  label: string;
  emoji: string;
}

export interface ChoicePoint {
  prompt: string;
  options: ChoiceOption[];
}

export interface Segment {
  pages: Page[];
  choice: ChoicePoint | null;
  /** What the reader picked at the end of this segment. */
  chosen?: { text: string; custom: boolean } | null;
}

export interface CustomProp {
  key: string;
  svg: string; // inner markup in a 100x100 viewBox, bottom-centred
}

export interface Story {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  age: AgeId;
  theme: string;
  hero: CharacterDef;
  cast: CharacterDef[]; // side characters
  customProps: CustomProp[];
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
  story: Pick<Story, "age" | "theme" | "hero" | "cast" | "customProps" | "segments" | "title">;
}

export type StoryRequest = StartRequest | ContinueRequest;

export interface SegmentResponse {
  title?: string;
  newCharacters: CharacterDef[];
  newProps: CustomProp[];
  segment: Segment;
  ending: boolean;
  demo?: boolean;
}

export interface CharacterRequest {
  description: string;
  name?: string;
}

export interface CharacterResponse {
  character: CharacterDef;
  demo?: boolean;
}
