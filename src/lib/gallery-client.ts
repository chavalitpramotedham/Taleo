"use client";
import type { GalleryEntry, Story } from "./types";
import { localDay } from "./daily";

export async function fetchGallery(opts: { sort?: "rating" | "recent"; limit?: number } = {}): Promise<GalleryEntry[]> {
  return (await fetchGalleryShelf(opts)).stories;
}

/** A shelf of the library: optionally sorted, narrowed to one category and
 *  limited to the top N - plus every category in the library, for the
 *  filter. */
export async function fetchGalleryShelf(
  opts: { sort?: "rating" | "recent"; limit?: number; category?: string | null; daily?: boolean } = {},
): Promise<{ stories: GalleryEntry[]; categories: string[]; daily: GalleryEntry | null }> {
  const q = new URLSearchParams();
  if (opts.sort) q.set("sort", opts.sort);
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.category) q.set("category", opts.category);
  // (the story of the day, for the date where the reader is)
  if (opts.daily) q.set("day", localDay());
  const res = await fetch(`/api/gallery${q.size ? `?${q}` : ""}`);
  // A failure is an error, not "an empty library".
  if (!res.ok) throw new Error(`Library unavailable (${res.status})`);
  const data = (await res.json()) as { stories?: GalleryEntry[]; categories?: string[]; daily?: GalleryEntry | null };
  const gone = typeof window === "undefined" ? new Set<string>() : deletedStoryIds();
  return {
    stories: (data.stories ?? []).filter((e) => !gone.has(e.id)),
    categories: data.categories ?? [],
    daily: data.daily && !gone.has(data.daily.id) ? data.daily : null,
  };
}

export async function fetchGalleryStory(id: string): Promise<Story | null> {
  const res = await fetch(`/api/gallery/${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { story?: Story };
  return data.story ?? null;
}

export async function publishToGallery(story: Story): Promise<boolean> {
  try {
    const res = await fetch("/api/gallery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(story),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface RatingAggregate {
  ratingSum: number;
  ratingCount: number;
}

export async function rateGalleryStory(id: string, rating: number, previousRating?: number): Promise<RatingAggregate | null> {
  try {
    const res = await fetch(`/api/gallery/${id}/rate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, previousRating: previousRating || undefined }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { entry?: GalleryEntry };
    return data.entry ? { ratingSum: data.entry.ratingSum, ratingCount: data.entry.ratingCount } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- deleting
const DELETED_KEY = "taleo.deletedStories";
/** Stories deleted on this device: hidden from shelves straight away (the
 *  library list is cached at the edge for a minute or so). */
export function deletedStoryIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}
export const STORY_DELETED_EVENT = "taleo:story-deleted";

/** Delete one of your own stories from the library (for good), then let
 *  every shelf on the page drop it. Throws with a friendly message. */
export async function deleteGalleryStory(id: string): Promise<void> {
  const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Couldn't delete the story. Please try again.");
  }
  try {
    const ids = [...deletedStoryIds(), id].slice(-100);
    localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
  } catch {}
  // its copy kept on this device, if there is one
  try {
    const { deleteStory } = await import("./storage");
    deleteStory(id);
  } catch {}
  window.dispatchEvent(new CustomEvent(STORY_DELETED_EVENT, { detail: { id } }));
}
