import { AGES } from "@/lib/ages";
import type { CharacterDef, IllustrateRequest, Page, Story, StoryRequest } from "@/lib/types";
import { sanitizeSvg } from "@/lib/svg-sanitize";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const strs = (v: unknown, max: number, len = 40) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((x) => x.slice(0, len)) : [];

export function cleanCharacter(c: unknown, fallbackId = "hero"): CharacterDef {
  const o = (c ?? {}) as Record<string, unknown>;
  return {
    id: str(o.id, 40) || fallbackId,
    name: str(o.name, 40) || "Friend",
    // older saved stories used "description"
    look: str(o.look, 600) || str(o.description, 600),
    preset: typeof o.preset === "string" ? o.preset.slice(0, 30) : null,
    svg: sanitizeSvg(str(o.svg, 40000), 30000) || null,
  };
}

const cleanPage = (p: Partial<Page>): Pick<Page, "text" | "picture" | "characters" | "aside"> => ({
  text: str(p.text, 800),
  picture: str(p.picture, 1200),
  characters: strs(p.characters, 6),
  aside: p.aside ? str(p.aside, 400) : null,
});

/** Accept a story request from the browser, trimming anything oversized. */
export function parseStoryRequest(body: unknown): StoryRequest | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.kind === "start") {
    const age = AGES.find((a) => a.id === b.age)?.id;
    const theme = str(b.theme, 200).trim();
    if (!age || !theme) return null;
    return { kind: "start", age, theme, hero: cleanCharacter(b.hero) };
  }
  if (b.kind === "continue") {
    const s = (b.story ?? {}) as Partial<Story>;
    const age = AGES.find((a) => a.id === s.age)?.id;
    if (!age || !Array.isArray(s.segments) || s.segments.length === 0 || s.segments.length > 8) return null;
    return {
      kind: "continue",
      story: {
        age,
        title: str(s.title, 120),
        theme: str(s.theme, 200),
        world: str(s.world, 400),
        hero: cleanCharacter(s.hero),
        cast: (Array.isArray(s.cast) ? s.cast : []).slice(0, 10).map((c, i) => cleanCharacter(c, `friend${i}`)),
        segments: s.segments.map((seg) => ({
          pages: (Array.isArray(seg.pages) ? seg.pages : []).slice(0, 8).map((p) => ({ ...cleanPage(p), svg: null })),
          choice: null,
          chosen: seg.chosen ? { text: str(seg.chosen.text, 200), custom: Boolean(seg.chosen.custom) } : null,
        })),
      },
    };
  }
  return null;
}

export function parseIllustrateRequest(body: unknown): IllustrateRequest | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const page = cleanPage((b.page ?? {}) as Partial<Page>);
  if (!page.picture && !page.text) return null;
  return {
    world: str(b.world, 400),
    cast: (Array.isArray(b.cast) ? b.cast : []).slice(0, 6).map((c, i) => cleanCharacter(c, `friend${i}`)),
    page,
    previous: b.previous ? str(b.previous, 1200) : null,
  };
}
