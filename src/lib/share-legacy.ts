import { decompressFromEncodedURIComponent } from "lz-string";
import type { Story } from "./types";

// (its own file, so only the old-link page carries the decompressor - not
// every page that has a share button)
/** Decodes a story from a pre-store share link (`/shared#...`), kept so old links still open. */
export function decodeShared(hash: string): Story | null {
  try {
    const json = decompressFromEncodedURIComponent(hash.replace(/^#/, ""));
    if (!json) return null;
    const s = JSON.parse(json) as Story;
    if (!s || !Array.isArray(s.segments) || !s.hero) return null;
    return { ...s, rating: 0, companions: s.companions ?? [] };
  } catch {
    return null;
  }
}
