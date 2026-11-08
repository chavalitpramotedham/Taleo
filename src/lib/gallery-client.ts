"use client";
import type { GalleryEntry, Story } from "./types";

export async function fetchGallery(opts: { sort?: "rating" | "recent"; limit?: number } = {}): Promise<GalleryEntry[]> {
  const q = new URLSearchParams();
  if (opts.sort) q.set("sort", opts.sort);
  if (opts.limit) q.set("limit", String(opts.limit));
  const res = await fetch(`/api/gallery${q.size ? `?${q}` : ""}`);
  // A failure is an error, not "an empty library".
  if (!res.ok) throw new Error(`Library unavailable (${res.status})`);
  const data = (await res.json()) as { stories?: GalleryEntry[] };
  return data.stories ?? [];
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
