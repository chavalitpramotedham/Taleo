import type { Story } from "@/lib/types";
import { canMovePlainFiles, deleteJson, hiddenName, readJson, writeJson } from "./store";

/**
 * Each signed-in user's unfinished story (their latest one), saved to the
 * account so it can be resumed later or on another device - or discarded.
 * Finishing it publishes it as usual and clears the draft.
 *
 * Stored under an unguessable name (derived from the user id and the
 * server's secret): storage files are publicly addressable, and a draft
 * can hold family details - names, relationships - in its characters.
 */

const names = (userId: string) => hiddenName(`draft:${userId}`);
export const draftPath = (userId: string) => `drafts/${names(userId).now}.json`;
/** Where it was kept before the data secret was given a value of its own. */
export const oldDraftPath = (userId: string) => {
  const before = names(userId).before;
  return before ? `drafts/${before}.json` : null;
};
/** The stored draft, wherever it is (moved to its present name if found
 *  under the old one). */
async function stored(userId: string): Promise<Story | null> {
  const draft = await readJson<Story>(draftPath(userId), { fresh: true });
  const old = oldDraftPath(userId);
  if (draft || !old) return draft;
  const was = await readJson<Story>(old, { fresh: true });
  if (was && canMovePlainFiles) {
    await writeJson(draftPath(userId), was);
    await deleteJson(old).catch(() => {});
  }
  return was;
}
/** Moves an account's draft to its present name, if it's under the old one. */
export const moveDraft = (userId: string) => stored(userId).then(() => {});

/** Generous: a draft carries its finished paintings so they never need
 *  repainting (paid) when it's resumed elsewhere. */
export const DRAFT_MAX_BYTES = 4_000_000;

export async function getDraft(userId: string): Promise<Story | null> {
  const draft = await stored(userId);
  return draft && !(draft.status === "complete" && draft.publishedPainted) ? { ...draft, companions: draft.companions ?? [] } : null;
}

export async function saveDraft(userId: string, story: Story): Promise<void> {
  await writeJson(draftPath(userId), story);
}

/** Clears the draft - only if it's still the given story (a newer draft
 *  from another tab or device is left alone). */
export async function clearDraft(userId: string, storyId?: string): Promise<void> {
  if (storyId) {
    const cur = await stored(userId).catch(() => null);
    if (!cur || cur.id !== storyId) return;
  }
  const old = oldDraftPath(userId);
  await Promise.all([deleteJson(draftPath(userId)), old ? deleteJson(old).catch(() => {}) : null]);
}
