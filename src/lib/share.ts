import { decompressFromEncodedURIComponent } from "lz-string";
import type { Story } from "./types";

/** A short, stable link to a story published in the public store. */
export function storeUrl(id: string, origin: string): string {
  return `${origin}/store/${id}`;
}

/** Decodes a story from a pre-store share link (`/shared#...`), kept so old links still open. */
export function decodeShared(hash: string): Story | null {
  try {
    const json = decompressFromEncodedURIComponent(hash.replace(/^#/, ""));
    if (!json) return null;
    const s = JSON.parse(json) as Story;
    if (!s || !Array.isArray(s.segments) || !s.hero) return null;
    return { ...s, rating: 0 };
  } catch {
    return null;
  }
}
