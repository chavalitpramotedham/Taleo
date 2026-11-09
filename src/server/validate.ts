import { AGES, ageById, clampMinutes } from "@/lib/ages";
import type { CharacterDef, IllustrateRequest, Page, PageAction, Story, StoryRequest } from "@/lib/types";
import { isMotion, isSound } from "@/lib/actions";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { NOTES_MAX, asGender } from "@/lib/characters";


const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
// Back-compat: stories saved before the length slider existed have no `minutes`.
const minutesFor = (v: unknown, ageId: string) => (typeof v === "number" && Number.isFinite(v) ? clampMinutes(v) : ageById(ageId).recommendedMinutes);
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
    notes: str(o.notes, NOTES_MAX).trim() || null,
    savedId: str(o.savedId, 40) || null,
    gender: asGender(o.gender),
  };
}

const cleanAction = (a: unknown): PageAction | null => {
  const o = (a ?? null) as Partial<PageAction> | null;
  if (!o || typeof o !== "object") return null;
  const word = str(o.word, 30).trim();
  if (!word) return null;
  return {
    word,
    target: str(o.target, 40) || "hero",
    sound: isSound(o.sound) ? o.sound : "twinkle",
    motion: isMotion(o.motion) ? o.motion : "bounce",
  };
};

// Up to 2 extra central characters (ids "companion1", "companion2"), independent of the hero.
const cleanCompanions = (v: unknown): CharacterDef[] =>
  (Array.isArray(v) ? v : []).slice(0, 2).map((c, i) => cleanCharacter(c, `companion${i + 1}`));

const cleanPage = (p: Partial<Page>): Pick<Page, "text" | "picture" | "characters" | "aside" | "action"> => ({
  text: str(p.text, 800),
  picture: str(p.picture, 1200),
  characters: strs(p.characters, 6),
  aside: p.aside ? str(p.aside, 400) : null,
  action: cleanAction(p.action),
});

/** Accept a story request from the browser, trimming anything oversized. */
export function parseStoryRequest(body: unknown): StoryRequest | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.kind === "start") {
    const age = AGES.find((a) => a.id === b.age)?.id;
    const theme = str(b.theme, 200).trim();
    if (!age || !theme) return null;
    return { kind: "start", age, minutes: minutesFor(b.minutes, age), theme, hero: cleanCharacter(b.hero), companions: cleanCompanions(b.companions) };
  }
  if (b.kind === "continue") {
    const s = (b.story ?? {}) as Partial<Story>;
    const age = AGES.find((a) => a.id === s.age)?.id;
    if (!age || !Array.isArray(s.segments) || s.segments.length === 0 || s.segments.length > 8) return null;
    return {
      kind: "continue",
      story: {
        age,
        minutes: minutesFor(s.minutes, age),
        title: str(s.title, 120),
        theme: str(s.theme, 200),
        world: str(s.world, 400),
        moral: str(s.moral, 200),
        hero: cleanCharacter(s.hero),
        companions: cleanCompanions(s.companions),
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
    quick: false,
    pageInPart: typeof b.pageInPart === "number" && b.pageInPart >= 0 ? Math.floor(b.pageInPart) : undefined,
  };
}
