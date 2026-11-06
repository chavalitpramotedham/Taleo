import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Story } from "./types";

/** Encode a finished story into a self-contained link (no server storage needed). */
export function shareUrl(story: Story, origin: string): string {
  const { rating: _r, ...rest } = story;
  void _r;
  return `${origin}/shared#${compressToEncodedURIComponent(JSON.stringify(rest))}`;
}

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
