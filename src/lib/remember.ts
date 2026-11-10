"use client";
/**
 * What the app last heard from the server, kept for as long as the tab is
 * open, so going back to a page shows it at once instead of a waiting
 * shelf: the page still asks again every time, and what comes back replaces
 * this within a moment. Nothing is kept across a reload or between
 * accounts (see <Providers>, which empties it when the account changes).
 */
const kept = new Map<string, unknown>();

export const recall = <T,>(key: string): T | undefined => kept.get(key) as T | undefined;
export function remember<T>(key: string, value: T): T {
  kept.set(key, value);
  return value;
}
export const forgetEverything = () => kept.clear();

/** A story deleted (or taken off the saved shelf) leaves what's kept too,
 *  so it can't flicker back the next time a page opens. */
type Listed = { id: string };
const without = (v: unknown, id: string): unknown =>
  Array.isArray(v)
    ? v.filter((e: Listed) => e?.id !== id)
    : v && typeof v === "object" && Array.isArray((v as { stories?: Listed[] }).stories)
      ? { ...(v as object), stories: (v as { stories: Listed[] }).stories.filter((e) => e?.id !== id) }
      : v;
export function forgetStory(id: string, only?: string) {
  for (const [key, v] of kept) if (!only || key === only) kept.set(key, without(v, id));
}
