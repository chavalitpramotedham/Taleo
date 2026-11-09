/** Shared between client and server: how many custom characters a Free
 *  account may save to its roster (the admin is unlimited - see lib/tiers). */
export { FREE_CHARACTERS as MAX_CHARACTERS } from "./tiers";

/** Longest freeform "about them" note a character can carry. */
export const NOTES_MAX = 400;

import type { CharacterGender } from "./types";
export const asGender = (v: unknown): CharacterGender | null => (v === "male" || v === "female" ? v : null);
