import type { GalleryEntry } from "@/lib/types";
import { readJson, writeJson } from "./store";
import { listGallery } from "./gallery";
import { privateUserIds } from "./users";

/**
 * Stories someone has saved from the library to their bookshelf - just the
 * story ids, newest first, in one small file per person. Saving or
 * unsaving is a person's own tap (never a hot path), so it costs one
 * write; their bookshelf reads it alongside the library index it already
 * reads.
 */
const MAX = 500;
const pathFor = (userId: string) => `users/saved/${userId}.json`;

export async function savedIds(userId: string): Promise<string[]> {
  // (fresh: a tap on Save must show on the bookshelf straight away)
  return (await readJson<string[]>(pathFor(userId), { fresh: true })) ?? [];
}

export async function setSaved(userId: string, storyId: string, saved: boolean): Promise<string[]> {
  const ids = await savedIds(userId);
  const has = ids.includes(storyId);
  if (has === saved) return ids;
  const next = saved ? [storyId, ...ids].slice(0, MAX) : ids.filter((id) => id !== storyId);
  await writeJson(pathFor(userId), next);
  return next;
}

/** The saved stories still in the library, in the order they were saved
 *  (a story since deleted, or whose author made their shelf private, just
 *  drops out). Never your own stories - those are on your shelf anyway. */
export async function savedStories(userId: string): Promise<{ ids: string[]; stories: GalleryEntry[] }> {
  const [ids, all, hidden] = await Promise.all([savedIds(userId), listGallery(), privateUserIds().catch(() => new Set<string>())]);
  const byId = new Map(all.map((e) => [e.id, e]));
  const stories = ids
    .map((id) => byId.get(id))
    .filter((e): e is GalleryEntry => Boolean(e) && e!.authorId !== userId && !hidden.has(e!.authorId));
  return { ids, stories };
}
