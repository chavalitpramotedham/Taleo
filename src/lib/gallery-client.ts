"use client";
import type { GalleryEntry, Story } from "./types";

export async function fetchGallery(): Promise<GalleryEntry[]> {
  const res = await fetch("/api/gallery", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { stories?: GalleryEntry[] };
  return data.stories ?? [];
}

export async function fetchGalleryStory(id: string): Promise<Story | null> {
  const res = await fetch(`/api/gallery/${id}`, { cache: "no-store" });
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
