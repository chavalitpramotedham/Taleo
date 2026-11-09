import { sanitizeSvg } from "@/lib/svg-sanitize";
import type { CharacterDef, SavedCharacter } from "@/lib/types";
import { MAX_CHARACTERS, NOTES_MAX, asGender } from "@/lib/characters";
import { readJson, writeJson } from "./store";

/** Each signed-in user's saved custom-character roster, used to populate
 *  the "Your characters" shelf in story creation without redrawing one
 *  each time. Private, never shown to anyone else. */

export { MAX_CHARACTERS };

const path = (ownerId: string) => `characters/${ownerId}.json`;
const newCharacterId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const cleanNotes = (notes: string | null | undefined) => (notes ?? "").trim().slice(0, NOTES_MAX) || null;
/** How many story links to keep per character (most recent). */
const MAX_STORY_LINKS = 50;

export class CharacterLimitError extends Error {}

export async function listCharacters(ownerId: string): Promise<SavedCharacter[]> {
  const list = (await readJson<SavedCharacter[]>(path(ownerId))) ?? [];
  // Back-fill fields added after the first characters were saved.
  return list.map((c) => ({ ...c, notes: c.notes ?? null, relationships: c.relationships ?? null, gender: asGender(c.gender), storyIds: Array.isArray(c.storyIds) ? c.storyIds : [] }));
}

/** Saves a newly designed character, or - if `replaceId` is given -
 *  overwrites an existing one in place (keeping its slot id, but starting
 *  a fresh story history, since it's a different character now). Throws
 *  CharacterLimitError when the owner is already at the cap and no
 *  replaceId was given. */
/** A generation prompt, tidied (the painter only ever takes 200 characters). */
const cleanPrompt = (p: string | null | undefined) => (typeof p === "string" ? p.replace(/\s+/g, " ").trim().slice(0, 200) || null : null);

export async function saveCharacter(
  ownerId: string,
  input: { name: string; look: string; svg: string | null; notes?: string | null; relationships?: string | null; gender?: string | null; prompt?: string | null },
  replaceId?: string,
): Promise<SavedCharacter> {
  const list = await listCharacters(ownerId);
  const name = input.name.trim().slice(0, 40) || "Friend";
  const look = input.look.trim().slice(0, 500);
  const notes = cleanNotes(input.notes);
  const relationships = cleanNotes(input.relationships);
  const gender = asGender(input.gender);
  const prompt = cleanPrompt(input.prompt);
  const now = Date.now();

  if (replaceId) {
    const i = list.findIndex((c) => c.id === replaceId);
    if (i < 0) throw new Error("That character doesn't exist any more.");
    const updated: SavedCharacter = { ...list[i], name, look, svg: input.svg, notes, relationships, gender, prompt, storyIds: [], updatedAt: now };
    const next = [...list];
    next[i] = updated;
    await writeJson(path(ownerId), next);
    return updated;
  }

  if (list.length >= MAX_CHARACTERS) {
    throw new CharacterLimitError(`You can save up to ${MAX_CHARACTERS} characters - replace one to add another.`);
  }
  const created: SavedCharacter = { id: newCharacterId(), name, look, svg: input.svg, notes, relationships, gender, prompt, storyIds: [], createdAt: now, updatedAt: now };
  await writeJson(path(ownerId), [...list, created]);
  return created;
}

/** Renames a character and/or changes its notes or gender (undefined =
 *  leave as is; null gender = left open). */
export async function updateCharacter(
  ownerId: string,
  id: string,
  patch: { name?: string; notes?: string | null; relationships?: string | null; gender?: string | null; look?: string; svg?: string | null; prompt?: string | null },
): Promise<SavedCharacter> {
  const list = await listCharacters(ownerId);
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) throw new Error("That character doesn't exist any more.");
  const cur = list[i];
  const updated: SavedCharacter = {
    ...cur,
    name: patch.name === undefined ? cur.name : patch.name.trim().slice(0, 40) || cur.name,
    notes: patch.notes === undefined ? cur.notes : cleanNotes(patch.notes),
    relationships: patch.relationships === undefined ? (cur.relationships ?? null) : cleanNotes(patch.relationships),
    gender: patch.gender === undefined ? cur.gender : asGender(patch.gender),
    // a redrawn look (the painting is cleaned again here, never trusted)
    look: patch.look === undefined ? cur.look : patch.look.slice(0, 500) || cur.look,
    svg: patch.svg === undefined ? cur.svg : sanitizeSvg(patch.svg ?? "") || cur.svg,
    prompt: patch.prompt === undefined ? (cur.prompt ?? null) : cleanPrompt(patch.prompt),
    updatedAt: Date.now(),
  };
  const next = [...list];
  next[i] = updated;
  await writeJson(path(ownerId), next);
  return updated;
}

/** Records that these saved characters starred in a story. Unknown ids are
 *  ignored; linking the same story twice is a no-op. */
export async function linkStory(ownerId: string, characterIds: string[], storyId: string): Promise<void> {
  const list = await listCharacters(ownerId);
  let changed = false;
  const next = list.map((c) => {
    if (!characterIds.includes(c.id) || c.storyIds.includes(storyId)) return c;
    changed = true;
    return { ...c, storyIds: [...c.storyIds, storyId].slice(-MAX_STORY_LINKS) };
  });
  if (changed) await writeJson(path(ownerId), next);
}

/** Forget a deleted story on the owner's characters ("starred in" links). */
export async function unlinkStory(ownerId: string, storyId: string): Promise<void> {
  const list = await listCharacters(ownerId);
  if (!list.some((c) => c.storyIds.includes(storyId))) return;
  await writeJson(
    path(ownerId),
    list.map((c) => (c.storyIds.includes(storyId) ? { ...c, storyIds: c.storyIds.filter((s) => s !== storyId) } : c)),
  );
}

export async function deleteCharacter(ownerId: string, id: string): Promise<void> {
  const list = await listCharacters(ownerId);
  await writeJson(
    path(ownerId),
    list.filter((c) => c.id !== id),
  );
}

export const toCharacterDef = (c: SavedCharacter, id: string): CharacterDef => ({
  id,
  name: c.name,
  look: c.look,
  preset: null,
  svg: c.svg,
  notes: c.notes,
  relationships: c.relationships ?? null,
  savedId: c.id,
  gender: c.gender,
});
