import type { CharacterDef, Page, Story } from "./types";

export const allPages = (story: Pick<Story, "segments">): Page[] =>
  story.segments.flatMap((s) => s.pages);

export const castMap = (story: Pick<Story, "hero" | "cast">): Record<string, CharacterDef> => {
  const m: Record<string, CharacterDef> = { hero: story.hero };
  for (const c of story.cast) m[c.id] = c;
  return m;
};

/** A representative page for covers/thumbnails. */
export const coverPage = (story: Pick<Story, "segments">): Page | undefined => {
  const pages = allPages(story);
  return pages.find((p) => p.characters.some((c) => c.id === "hero")) ?? pages[0];
};

export const wordCount = (story: Pick<Story, "segments">) =>
  allPages(story).reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
