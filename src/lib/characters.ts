/** Longest freeform "about them" note a character can carry. */
export const NOTES_MAX = 400;

import type { CharacterGender } from "./types";
export const asGender = (v: unknown): CharacterGender | null => (v === "male" || v === "female" ? v : null);
