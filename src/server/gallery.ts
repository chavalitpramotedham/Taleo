import { allPages } from "@/lib/story-utils";
import { ageById } from "@/lib/ages";
import { isCategory, storyKeyword } from "@/lib/keywords";
import type { CharacterDef, GalleryEntry, RatingRecord, Story } from "@/lib/types";
import { deleteJson, readJson, writeJson } from "./store";
import { ADMIN_USER_ID } from "./users";

/** The public story store: every finished, published story lives here. */

const INDEX_PATH = "gallery/index.json";
const storyPath = (id: string) => `gallery/stories/${id}.json`;
const ratingsPath = (id: string) => `gallery/ratings/${id}.json`;

/** The card/preview details kept on each library entry. */
function cardDetails(story: Story): Pick<GalleryEntry, "keyword" | "starring" | "minutes" | "pages"> {
  return {
    keyword: storyKeyword(story),
    starring: [story.hero, ...(story.companions ?? [])].map((c) => c.name).filter(Boolean),
    minutes: story.minutes || ageById(story.age).recommendedMinutes,
    pages: allPages(story).length,
  };
}

/** `cacheSeconds`: only for pages that are themselves cached (the sitemap).
 *  `fresh`: the index exactly as it is this moment, past any cached copy -
 *  for everything that is about to change it and write it back (a copy a
 *  minute old would silently undo whatever was published, rated or
 *  deleted in that minute). */
export async function listGallery(opts: { cacheSeconds?: number; fresh?: boolean } = {}): Promise<GalleryEntry[]> {
  let entries = (await readJson<GalleryEntry[]>(INDEX_PATH, opts)) ?? [];
  // One-off back-fill of card details for entries published before they
  // were stored: read those stories once, then save the index.
  // (and of cards whose category isn't one of the library's - filed again
  // from the story itself)
  const missing = entries.filter((e) => !e.keyword || !isCategory(e.keyword) || !e.starring);
  if (missing.length) {
    const filled = new Map<string, ReturnType<typeof cardDetails>>();
    for (let i = 0; i < missing.length; i += 8) {
      await Promise.all(
        missing.slice(i, i + 8).map(async (e) => {
          const story = await readJson<Story>(storyPath(e.id)).catch(() => null);
          if (story) filled.set(e.id, cardDetails(story));
        }),
      );
    }
    if (filled.size) {
      entries = entries.map((e) => (filled.has(e.id) ? { ...e, ...filled.get(e.id) } : e));
      await writeJson(INDEX_PATH, entries).catch((err) => console.error("[gallery] back-fill save failed", err));
    }
  }
  // Back-fill stories published before accounts existed.
  return entries.map((e) => ({ ...e, authorId: e.authorId ?? ADMIN_USER_ID, authorUsername: e.authorUsername ?? "taleo" }));
}

/** `cacheSeconds`: only for pages that are themselves cached (the shared
 *  story page and its preview image). */
export async function getGalleryStory(id: string, opts: { cacheSeconds?: number } = {}): Promise<Story | null> {
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  const story = await readJson<Story>(storyPath(id), opts);
  if (!story) return null;
  return {
    ...story,
    authorId: story.authorId ?? ADMIN_USER_ID,
    authorUsername: story.authorUsername ?? "taleo",
    // Stories saved before multi-character support existed have no companions.
    companions: story.companions ?? [],
  };
}

export async function listMyStories(authorId: string): Promise<GalleryEntry[]> {
  const all = await listGallery();
  return all.filter((e) => e.authorId === authorId);
}

/** Publish (or re-publish) a finished story to the public store. */
export async function publishStory(story: Story, author: { id: string; username: string; isAdmin?: boolean }): Promise<GalleryEntry> {
  const index = await listGallery({ fresh: true });
  const existing = index.find((e) => e.id === story.id);
  // A book already in the library can only be re-published by its author
  // (or the admin) - never overwritten by another account using its id.
  if (existing && existing.authorId !== author.id && !author.isAdmin) throw new NotYourStoryError();
  const ratings = await listRatings(story.id, { fresh: true });
  const ratingSum = ratings.reduce((n, r) => n + r.rating, 0);
  const ratingCount = ratings.length;
  // Keep the original author even on re-publish (repainting shouldn't change ownership).
  const authorId = existing?.authorId ?? author.id;
  const authorUsername = existing?.authorUsername ?? author.username;

  const entry: GalleryEntry = {
    id: story.id,
    title: story.title || "An untitled story",
    createdAt: story.createdAt,
    ratingSum,
    ratingCount,
    age: story.age,
    heroName: story.hero.name,
    cover: allPages(story).find((p) => p.svg)?.svg ?? null,
    authorId,
    authorUsername,
    ...cardDetails(story),
  };
  const next = [entry, ...index.filter((e) => e.id !== story.id)];
  // Family notes about a character (and the link back to the author's
  // private roster) never go public with the story.
  const strip = (c: CharacterDef): CharacterDef => {
    const { notes: _notes, savedId: _savedId, ...rest } = c;
    return rest;
  };
  const publicStory: Story = { ...story, hero: strip(story.hero), companions: (story.companions ?? []).map(strip) };
  await Promise.all([
    writeJson(INDEX_PATH, next),
    writeJson(storyPath(story.id), { ...publicStory, ratingSum, ratingCount, authorId, authorUsername }),
  ]);
  return entry;
}

export async function listRatings(storyId: string, opts: { fresh?: boolean } = {}): Promise<RatingRecord[]> {
  return (await readJson<RatingRecord[]>(ratingsPath(storyId), opts)) ?? [];
}

async function syncAggregate(storyId: string, ratings: RatingRecord[]) {
  const ratingSum = ratings.reduce((n, r) => n + r.rating, 0);
  const ratingCount = ratings.length;
  const [index, full] = await Promise.all([listGallery({ fresh: true }), getGalleryStory(storyId)]);
  const i = index.findIndex((e) => e.id === storyId);
  const writes: Promise<void>[] = [];
  if (i >= 0) {
    const nextIndex = [...index];
    nextIndex[i] = { ...nextIndex[i], ratingSum, ratingCount };
    writes.push(writeJson(INDEX_PATH, nextIndex));
  }
  if (full) writes.push(writeJson(storyPath(storyId), { ...full, ratingSum, ratingCount }));
  await Promise.all(writes);
  return { ratingSum, ratingCount };
}

/** One rating (and optional comment) per signed-in user per story — once
 *  recorded it can't be changed, only read back. Returns null if the story
 *  doesn't exist, or the existing record if this user already rated it. */
export async function addRating(
  storyId: string,
  user: { id: string; username: string },
  rating: number,
  comment: string | null,
): Promise<{ record: RatingRecord; alreadyRated: boolean; ratingSum: number; ratingCount: number } | null> {
  const full = await getGalleryStory(storyId);
  if (!full) return null;
  const ratings = await listRatings(storyId, { fresh: true });
  const existing = ratings.find((r) => r.userId === user.id);
  if (existing) {
    const agg = await syncAggregate(storyId, ratings);
    return { record: existing, alreadyRated: true, ...agg };
  }
  const record: RatingRecord = { userId: user.id, username: user.username, rating, comment: comment?.trim() || null, createdAt: Date.now() };
  const next = [...ratings, record];
  await writeJson(ratingsPath(storyId), next);
  const agg = await syncAggregate(storyId, next);
  return { record, alreadyRated: false, ...agg };
}

export function myRating(ratings: RatingRecord[], userId: string): RatingRecord | null {
  return ratings.find((r) => r.userId === userId) ?? null;
}

/** Removes every story this user published (and each one's ratings file).
 *  Returns how many were deleted. */
export class NotYourStoryError extends Error {}

/** Delete one story from the library - only its author can. Removes it
 *  from the index (so every shelf, bookshelf and count drops it) along
 *  with the story itself and its ratings. Returns the author's username,
 *  for refreshing their bookshelf page. */
export async function deleteStory(storyId: string, authorId: string): Promise<{ authorUsername: string } | null> {
  const index = await listGallery({ fresh: true });
  const entry = index.find((e) => e.id === storyId);
  if (!entry) return null;
  if (entry.authorId !== authorId) throw new NotYourStoryError("Only the story's author can delete it.");
  await writeJson(
    INDEX_PATH,
    index.filter((e) => e.id !== storyId),
  );
  await Promise.all([deleteJson(storyPath(storyId)).catch(() => {}), deleteJson(ratingsPath(storyId)).catch(() => {})]);
  return { authorUsername: entry.authorUsername };
}

export async function deleteMyStories(authorId: string): Promise<number> {
  const index = await listGallery({ fresh: true });
  const mine = index.filter((e) => e.authorId === authorId);
  if (mine.length === 0) return 0;
  const keep = index.filter((e) => e.authorId !== authorId);
  await Promise.all([
    writeJson(INDEX_PATH, keep),
    ...mine.flatMap((e) => [deleteJson(storyPath(e.id)), deleteJson(ratingsPath(e.id))]),
  ]);
  return mine.length;
}
