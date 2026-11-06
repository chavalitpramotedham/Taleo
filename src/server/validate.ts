import { AGES } from "@/lib/ages";
import type { CharacterDef, Story, StoryRequest } from "@/lib/types";
import { sanitizeSvg } from "@/lib/svg-sanitize";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function cleanCharacter(c: unknown, fallbackId = "hero"): CharacterDef {
  const o = (c ?? {}) as Record<string, unknown>;
  const face = o.face as CharacterDef["face"];
  return {
    id: str(o.id, 40) || fallbackId,
    name: str(o.name, 40) || "Friend",
    description: str(o.description, 300),
    preset: typeof o.preset === "string" ? o.preset.slice(0, 30) : null,
    svg: sanitizeSvg(str(o.svg, 40000)) || null,
    face:
      face && typeof face === "object"
        ? { x: Number(face.x) || 100, y: Number(face.y) || 100, size: Number(face.size) || 50 }
        : null,
  };
}

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
    const segments = s.segments.map((seg) => ({
      pages: (Array.isArray(seg.pages) ? seg.pages : []).slice(0, 8).map((p) => ({ ...p, text: str(p.text, 800) })),
      choice: seg.choice ?? null,
      chosen: seg.chosen ? { text: str(seg.chosen.text, 200), custom: Boolean(seg.chosen.custom) } : null,
    }));
    return {
      kind: "continue",
      story: {
        age,
        title: str(s.title, 120),
        theme: str(s.theme, 200),
        hero: cleanCharacter(s.hero),
        cast: (Array.isArray(s.cast) ? s.cast : []).slice(0, 10).map((c, i) => cleanCharacter(c, `friend${i}`)),
        customProps: (Array.isArray(s.customProps) ? s.customProps : []).slice(0, 12).map((p) => ({ key: str(p.key, 30), svg: "" })),
        segments,
      },
    };
  }
  return null;
}
