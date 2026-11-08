import { createHash } from "crypto";
import type { Story } from "@/lib/types";
import { deleteJson, readJson, writeJson } from "./store";

/**
 * Each signed-in user's unfinished story (their latest one), saved to the
 * account so it can be resumed later or on another device - or discarded.
 * Finishing it publishes it as usual and clears the draft.
 *
 * Stored under an unguessable name (derived from the user id and the
 * server's secret): storage files are publicly addressable, and a draft
 * can hold family details - names, relationships - in its characters.
 */

const secret = process.env.AUTH_SECRET || "taleo-dev";
const draftPath = (userId: string) =>
  `drafts/${createHash("sha256").update(`${secret}:draft:${userId}`).digest("hex").slice(0, 40)}.json`;

/** Generous: a draft carries its finished paintings so they never need
 *  repainting (paid) when it's resumed elsewhere. */
export const DRAFT_MAX_BYTES = 4_000_000;

export async function getDraft(userId: string): Promise<Story | null> {
  const draft = await readJson<Story>(draftPath(userId), { fresh: true });
  return draft && !(draft.status === "complete" && draft.publishedPainted) ? { ...draft, companions: draft.companions ?? [] } : null;
}

export async function saveDraft(userId: string, story: Story): Promise<void> {
  await writeJson(draftPath(userId), story);
}

/** Clears the draft - only if it's still the given story (a newer draft
 *  from another tab or device is left alone). */
export async function clearDraft(userId: string, storyId?: string): Promise<void> {
  if (storyId) {
    const cur = await readJson<Story>(draftPath(userId), { fresh: true }).catch(() => null);
    if (!cur || cur.id !== storyId) return;
  }
  await deleteJson(draftPath(userId));
}
