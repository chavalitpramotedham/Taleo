import { allPages } from "@/lib/story-utils";
import type { GalleryEntry, RatingRecord, Story } from "@/lib/types";
import { deleteJson, readJson, writeJson } from "./store";
import { ADMIN_USER_ID } from "./users";

/** The public story store: every finished, published story lives here. */

const INDEX_PATH = "gallery/index.json";
const storyPath = (id: string) => `gallery/stories/${id}.json`;
const ratingsPath = (id: string) => `gallery/ratings/${id}.json`;

export async function listGallery(): Promise<GalleryEntry[]> {
  const entries = (await readJson<GalleryEntry[]>(INDEX_PATH)) ?? [];
  // Back-fill stories published before accounts existed.
  return entries.map((e) => ({ ...e, authorId: e.authorId ?? ADMIN_USER_ID, authorUsername: e.authorUsername ?? "taleo" }));
}

export async function getGalleryStory(id: string): Promise<Story | null> {
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  const story = await readJson<Story>(storyPath(id));
  if (!story) return null;
  return story.authorId ? story : { ...story, authorId: ADMIN_USER_ID, authorUsername: "taleo" };
}

export async function listMyStories(authorId: string): Promise<GalleryEntry[]> {
  const all = await listGallery();
  return all.filter((e) => e.authorId === authorId);
}

/** Publish (or re-publish) a finished story to the public store. */
export async function publishStory(story: Story, author: { id: string; username: string }): Promise<GalleryEntry> {
  const index = await listGallery();
  const existing = index.find((e) => e.id === story.id);
  const ratings = await listRatings(story.id);
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
  };
  const next = [entry, ...index.filter((e) => e.id !== story.id)];
  await Promise.all([writeJson(INDEX_PATH, next), writeJson(storyPath(story.id), { ...story, ratingSum, ratingCount, authorId, authorUsername })]);
  return entry;
}

export async function listRatings(storyId: string): Promise<RatingRecord[]> {
  return (await readJson<RatingRecord[]>(ratingsPath(storyId))) ?? [];
}

async function syncAggregate(storyId: string, ratings: RatingRecord[]) {
  const ratingSum = ratings.reduce((n, r) => n + r.rating, 0);
  const ratingCount = ratings.length;
  const [index, full] = await Promise.all([listGallery(), getGalleryStory(storyId)]);
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
  const ratings = await listRatings(storyId);
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
export async function deleteMyStories(authorId: string): Promise<number> {
  const index = await listGallery();
  const mine = index.filter((e) => e.authorId === authorId);
  if (mine.length === 0) return 0;
  const keep = index.filter((e) => e.authorId !== authorId);
  await Promise.all([
    writeJson(INDEX_PATH, keep),
    ...mine.flatMap((e) => [deleteJson(storyPath(e.id)), deleteJson(ratingsPath(e.id))]),
  ]);
  return mine.length;
}
