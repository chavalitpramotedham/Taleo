import type { CharacterDef, Page, Story } from "./types";

export const allPages = (story: Pick<Story, "segments">): Page[] => story.segments.flatMap((s) => s.pages);

/** Characters appearing on a page, as full definitions. */
export const castFor = (story: Pick<Story, "hero" | "companions" | "cast">, page: Pick<Page, "characters">): CharacterDef[] => {
  const all = [story.hero, ...story.companions, ...story.cast];
  return page.characters.map((id) => all.find((c) => c.id === id)).filter((c): c is CharacterDef => Boolean(c));
};

/** The first finished painting, for covers and thumbnails. */
export const coverSvg = (story: Pick<Story, "segments">): string | null =>
  allPages(story).find((p) => p.svg)?.svg ?? null;

export const wordCount = (story: Pick<Story, "segments">) =>
  allPages(story).reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);

export const pageKey = (seg: number, page: number) => `${seg}:${page}`;
