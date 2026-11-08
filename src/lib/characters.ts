/** Shared between client and server: how many custom characters a user may
 *  save to their roster. */
export const MAX_CHARACTERS = 5;

/** Longest freeform "about them" note a character can carry. */
export const NOTES_MAX = 400;

import type { CharacterGender } from "./types";
export const asGender = (v: unknown): CharacterGender | null => (v === "male" || v === "female" ? v : null);
