import type { CharacterDef, SavedCharacter } from "@/lib/types";
import { MAX_CHARACTERS } from "@/lib/characters";
import { readJson, writeJson } from "./store";

/** Each signed-in user's saved custom-character roster, used to populate
 *  the "Your characters" shelf in story creation without redrawing one
 *  each time. Private, never shown to anyone else. */

export { MAX_CHARACTERS };

const path = (ownerId: string) => `characters/${ownerId}.json`;
const newCharacterId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export class CharacterLimitError extends Error {}

export async function listCharacters(ownerId: string): Promise<SavedCharacter[]> {
  return (await readJson<SavedCharacter[]>(path(ownerId))) ?? [];
}

/** Saves a newly designed character, or - if `replaceId` is given -
 *  overwrites an existing one in place (keeping its id). Throws
 *  CharacterLimitError when the owner is already at the cap and no
 *  replaceId was given. */
export async function saveCharacter(
  ownerId: string,
  input: { name: string; look: string; svg: string | null },
  replaceId?: string,
): Promise<SavedCharacter> {
  const list = await listCharacters(ownerId);
  const name = input.name.trim().slice(0, 40) || "Friend";
  const look = input.look.trim().slice(0, 500);
  const now = Date.now();

  if (replaceId) {
    const i = list.findIndex((c) => c.id === replaceId);
    if (i < 0) throw new Error("That character doesn't exist any more.");
    const updated: SavedCharacter = { ...list[i], name, look, svg: input.svg, updatedAt: now };
    const next = [...list];
    next[i] = updated;
    await writeJson(path(ownerId), next);
    return updated;
  }

  if (list.length >= MAX_CHARACTERS) {
    throw new CharacterLimitError(`You can save up to ${MAX_CHARACTERS} characters - replace one to add another.`);
  }
  const created: SavedCharacter = { id: newCharacterId(), name, look, svg: input.svg, createdAt: now, updatedAt: now };
  await writeJson(path(ownerId), [...list, created]);
  return created;
}

export async function renameCharacter(ownerId: string, id: string, name: string): Promise<SavedCharacter> {
  const list = await listCharacters(ownerId);
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) throw new Error("That character doesn't exist any more.");
  const updated: SavedCharacter = { ...list[i], name: name.trim().slice(0, 40) || list[i].name, updatedAt: Date.now() };
  const next = [...list];
  next[i] = updated;
  await writeJson(path(ownerId), next);
  return updated;
}

export async function deleteCharacter(ownerId: string, id: string): Promise<void> {
  const list = await listCharacters(ownerId);
  await writeJson(
    path(ownerId),
    list.filter((c) => c.id !== id),
  );
}

export const toCharacterDef = (c: SavedCharacter, id: string): CharacterDef => ({ id, name: c.name, look: c.look, preset: null, svg: c.svg });
