"use client";
// Remembers this device's own vote per story, for stories the device hasn't
// necessarily saved to its bookshelf (e.g. browsing the public store).

const KEY = "taleo.myRatings.v1";

function readAll(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function getMyRating(id: string): number {
  return readAll()[id] ?? 0;
}

export function setMyRating(id: string, rating: number) {
  try {
    const all = readAll();
    all[id] = rating;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
