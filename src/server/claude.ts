import Anthropic from "@anthropic-ai/sdk";
import { streamUsageTracker, type AiFeature } from "./metrics";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { aLength, ageById, lengthProfile } from "@/lib/ages";
import { characterArt, presetByKey } from "@/lib/presets";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { isMotion, isSound } from "@/lib/actions";
import type {
  CharacterDef,
  CharacterRequest,
  CharacterResponse,
  IllustrateRequest,
  Page,
  PageAction,
  ReuseSettings,
  SegmentResponse,
  StoryRequest,
  StoryPlace,
} from "@/lib/types";
import { PHOTO_PROBLEM } from "@/lib/character-photo";
import { layoutComposed, type LayoutOptions } from "./paint/layout";
import { keepNewcomer, newcomerPortrait, sawNewcomerAgain } from "./paint/newcomers";
import { expandStream, newStats, sizeLine, type ExpandStats, sizingFor, type Box, type ExpandContext } from "./paint/expand";
import { hashOf } from "@/lib/art/stamps";
import { lightOf, paletteFor, seasonOf, type Light, type Season } from "@/lib/art/palette";
import { BACKDROP_BRIEF, MOMENT_DETAILS, characterBriefPrompt, composerPrompt, composerSheet, newcomerPrompt, newcomerSheet, NEWCOMERS_SECTION, spriteComposerPrompt, spriteSheet, characterDesignerPrompt, illustratorPrompt, LAYERED_CHARACTERS, PAGE_LAYER_BRIEF, PARTS_SECTION, partsSheet, sceneryPrompt, writerPrompt } from "./prompts";
import { partsFor } from "./paint/parts-maker";
import { kept, once } from "./paint/once";
import { LIVE } from "@/lib/bench-ways";
import { codePageLayer } from "./paint/page-layer";
import { spritesFor } from "./paint/sprite-maker";
import { SPRITE_POSES, SPRITE_POSE_IDS, type Sprite, type SpritePose } from "@/lib/art/sprites";
import type { CharacterParts } from "@/lib/art/parts";
import { CharacterDesignSchema, NewCharacterSchema, PageSchema, PlaceSchema, SegmentSchema, type SegmentOut } from "./schemas";

type Effort = "low" | "medium" | "high";
const STORY_MODEL = process.env.TALEO_MODEL || "claude-opus-5-5";
/** Each job has its own model and effort setting, independent of the
 *  others (changing the story writer never changes the painter). */
const ART_MODEL = process.env.TALEO_ART_MODEL || "claude-opus-5-5";
/** The character designer has its own model setting (it used to follow the
 *  story writer's). */
const CHARACTER_MODEL = process.env.TALEO_CHARACTER_MODEL || "claude-opus-5-5";
const STORY_EFFORT = (process.env.TALEO_EFFORT as Effort) || "low";
const ART_EFFORT = (process.env.TALEO_ART_EFFORT as Effort) || "low";
/** The pictures a reader is waiting on (the first page or two of each part - see app/api/illustrate) are painted
 *  by a quicker model: in side-by-side tests Sonnet 5.5 at medium effort
 *  painted the same pages ~15% faster and at about half the cost, with
 *  somewhat less careful characters - a fair trade for the one page that
 *  holds everyone up. Every other page keeps the main painter. */
const QUICK_ART_MODEL = process.env.TALEO_QUICK_ART_MODEL || "claude-sonnet-5-5";
const QUICK_ART_EFFORT = (process.env.TALEO_QUICK_ART_EFFORT as Effort) || "medium";
/** The quick painter paints without thinking first. Left to itself Sonnet
 *  5.5 thinks before every reply, and none of that thinking is sent on: the
 *  reader sees nothing at all until it's over - on the very pages (the
 *  first of each part, and every second go) where the wait is the point.
 *  "between_tools" is that model's thinking-off setting (only it accepts
 *  it). TALEO_QUICK_ART_THINKING=adaptive puts the thinking back. */
const QUICK_ART_UNTHINKING = process.env.TALEO_QUICK_ART_THINKING !== "adaptive";
/** How long the main painter may take to lay its first stroke. Opus 5.5
 *  always thinks before it paints (it can't be turned off - effort is the
 *  only dial), silently; past this the page is handed to the quick painter
 *  instead of keeping the reader waiting on a blank page. The clock starts
 *  when the request is sent, so time spent queueing behind a rate limit
 *  (the SDK retries those quietly) counts too. TALEO_FIRST_STROKE_S
 *  overrides (0: wait however long it takes). */
const FIRST_STROKE_MS = Math.max(0, Number(process.env.TALEO_FIRST_STROKE_S ?? 60) || 0) * 1000;
/** Painting in layers (see paintsInLayers; every picture unless
 *  TALEO_LAYERED_PAINT says otherwise): the scenery - sky, land, room, the
 *  things that stand about - is the plainer half of a picture, so it goes
 *  to the quick model (Sonnet 5.5, at low effort), without thinking
 *  first. (Haiku 5.5 at medium was tried and its places came out
 *  plainer and less finished; Haiku still works if set here.) while the page's ordinary painter does only the
 *  characters: the quick painter at its usual effort on quick pages, the
 *  main painter on the rest.
 *  TALEO_SCENERY_MODEL / TALEO_SCENERY_EFFORT override the scenery. */
const SCENERY_MODEL = process.env.TALEO_SCENERY_MODEL || "claude-sonnet-5-5";
const SCENERY_EFFORT = (process.env.TALEO_SCENERY_EFFORT as Effort) || "low";
/** How a model is told to paint without thinking first, if it can be:
 *  Sonnet 5.5 has its own setting for it, Haiku 5.5 takes the plain
 *  "disabled" (at these efforts), and Opus 5.5 can't be told at all. */
function thinkingOff(model: string): { type: "between_tools" } | { type: "disabled" } | null {
  if (model.startsWith("claude-sonnet-5-5")) return { type: "between_tools" };
  if (model.startsWith("claude-haiku-5-5")) return { type: "disabled" };
  return null;
}
/** The main painter's effort when it paints only the characters of a
 *  layered page. Its own setting, deliberately NOT TALEO_ART_EFFORT: that
 *  one was raised for whole pictures, and at medium the characters arrived
 *  long after the scenery (or not inside the first-stroke limit at all).
 *  TALEO_LAYER_CHARACTERS_EFFORT overrides. */
const LAYER_CHARACTERS_EFFORT = (process.env.TALEO_LAYER_CHARACTERS_EFFORT as Effort) || "low";
/** Designing a character runs at medium effort: with the art director's
 *  brief to work from (see characterBrief) it needs less thinking of its
 *  own, and designs finish well inside the 300-second limit (at high effort
 *  they took up to ~5 minutes). TALEO_CHARACTER_EFFORT overrides. */
const CHARACTER_EFFORT = (process.env.TALEO_CHARACTER_EFFORT as Effort) || "medium";

/** False in demo mode (no key), or when TALEO_MOCK=1 forces the templated
 *  storyteller and painter - handy for testing flows without real stories. */
export const hasApiKey = () =>
  process.env.TALEO_MOCK !== "1" && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export class StoryRefusal extends Error {}
/** The main painter was still thinking when its time to begin ran out. */
export class SlowPainter extends Error {}

async function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  maxTokens = 16000,
  effort: Effort = STORY_EFFORT,
  feature: AiFeature = "story",
): Promise<z.infer<T>> {
  const usage = streamUsageTracker(feature, STORY_MODEL, { effort });
  const response = await getClient()
    .beta.messages.parse({
      model: STORY_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    })
    .catch((err) => {
      usage.fail(err);
      usage.finish();
      throw err;
    });
  usage.whole(response);
  if (response.stop_reason === "refusal") throw new StoryRefusal("The storyteller couldn't write that one.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The story came out jumbled. Please try again.");
  }
  return response.parsed_output as z.infer<T>;
}

// ---------------------------------------------------------------- stories

/** The family's choice, if they made one: a boy/man or a girl/woman. */
const genderNote = (c: Pick<CharacterDef, "gender">) =>
  c.gender === "male" ? " [male - he/him]" : c.gender === "female" ? " [female - she/her]" : "";

const modelSheet = (c: CharacterDef) =>
  `- id "${c.id}": ${c.name}${genderNote(c)}: ${c.look}${c.preset ? ` (preset: ${c.preset})` : ""}`;

/** A central character's model sheet plus the family's notes about them
 *  (personality, relationships), which only the writer sees. */
const centralSheet = (c: CharacterDef) =>
  `${modelSheet(c)}${c.notes ? `\n  FAMILY NOTES about ${c.name}: "${c.notes.replace(/\s+/g, " ").trim()}"` : ""}${
    c.relationships ? `\n  RELATIONSHIPS of ${c.name} (from the family - exactly as given): "${c.relationships.replace(/\s+/g, " ").trim()}"` : ""
  }`;

/** The writer's request for the next segment, and how to normalise its reply. */
function buildSegmentRequest(req: StoryRequest) {
  const isStart = req.kind === "start";
  const age = ageById(isStart ? req.age : req.story.age);
  const minutes = isStart ? req.minutes : req.story.minutes;
  const { choices, pages, words, length } = lengthProfile(age, minutes);
  const hero = isStart ? req.hero : req.story.hero;
  const companions = isStart ? req.companions : req.story.companions;
  const heroes = [hero, ...companions];
  const cast = isStart ? [] : req.story.cast;
  const theme = isStart ? req.theme : req.story.theme;
  const segments = isStart ? [] : req.story.segments;
  const totalSegments = choices + 1;
  const index = segments.length + 1;
  const isLast = index >= totalSegments;

  const parts: string[] = [];
  parts.push(`READER AGE: ${age.label} years (age id ${age.id}). Follow that age guide closely.`);
  parts.push(
    `TARGET LENGTH: ${aLength(length)} - ${length.size}: about ${length.minutes} minutes to read aloud straight through, in ${totalSegments} segments with ${choices} decisions between them. Keep to the pages and words asked for below: the length was chosen, and paid for, by the family.`,
  );
  parts.push(`THEME: ${theme}`);
  const moral = isStart ? "" : req.story.moral?.trim();
  if (moral) parts.push(`THE STORY'S HEART (the lesson this book builds to and lands at the end): ${moral}`);
  if (!isStart && req.story.world) parts.push(`BOOK ART DIRECTION: ${req.story.world}`);
  parts.push(
    `CENTRAL CHARACTERS (the story's protagonists - give each one real presence and at least one moment to shine, not just the first):\n${heroes.map(centralSheet).join("\n")}`,
  );
  const gendered = [...heroes, ...cast].filter((h) => h.gender);
  if (gendered.length) {
    parts.push(
      `GENDER, as the family chose it - follow exactly, every page: ${gendered.map((h) => `${h.name} is ${h.gender === "male" ? "male (he/him)" : "female (she/her)"}`).join("; ")}.`,
    );
  }
  if (heroes.some((h) => h.notes || h.relationships)) {
    parts.push(
      "Honour the FAMILY NOTES and RELATIONSHIPS above throughout this segment: let each character's personality and, above all, any relationship between them show in what they say and do together. The relationships must be exactly as given (who is whose sister, parent, grandparent, friend) - never swapped, changed or contradicted.",
    );
  }
  parts.push(`WORD LEVEL for this reader (each page's word to learn): ${age.vocab}`);
  const taught = [...new Set(segments.flatMap((sg) => sg.pages.map((p) => p.action?.word?.trim().toLowerCase()).filter(Boolean)))];
  if (taught.length) parts.push(`WORDS ALREADY TAUGHT in this book (don't reuse these or other forms of them): ${taught.join(", ")}`);
  if (cast.length) parts.push(`SUPPORTING CAST SO FAR:\n${cast.map(modelSheet).join("\n")}`);
  // (the story's places so far: pages set in one reuse its id, so each is
  // painted once and its look kept)
  const known = isStart ? [] : (req.story.places ?? []);
  parts.push(
    known.length
      ? `PLACES SO FAR (set each page in one of these by its id whenever the story is there; add a new place only when the story truly goes somewhere new, or the light changes):\n${known.map((p) => `- "${p.id}" (${p.light}): ${p.about}`).join("\n")}`
      : `PLACES: plot the book's main places now (usually 2-4), in "places", and set every page in one of them by its id. Pages in one place share one painted backdrop, so keep each place's landmarks where you put them.`,
  );

  if (isStart) {
    const names = heroes.map((h) => `${h.name} (id "${h.id}")`).join(heroes.length > 1 ? " and " : "");
    parts.push(
      `Write segment 1 of ${totalSegments}: first choose the story's heart ("moral") - one warm lesson that fits the theme (and any family notes) which this book will build to and land at the end. Then give the story a short, charming title and the book's art direction ("world"), introduce ${names} together in a lively opening that hooks the child on the very first page (start in the middle of something happening, not with a description), make clear what they want today, plant one small detail you will pay off at the end, set up the situation that will test the heart of the story, and end on an exciting moment with a choice for the child.`,
    );
  } else {
    const story = segments
      .map((s, i) => {
        const text = s.pages.map((p) => p.text).join("\n");
        const chosen = s.chosen ? `\n>> The child ${s.chosen.custom ? "TYPED THEIR OWN IDEA" : "chose"}: "${s.chosen.text}"` : "";
        return `[Segment ${i + 1}]\n${text}${chosen}`;
      })
      .join("\n\n");
    parts.push(`STORY SO FAR (title "${req.story.title}"):\n${story}`);
    const lastPicture = segments[segments.length - 1]?.pages.slice(-1)[0]?.picture;
    if (lastPicture) parts.push(`LAST PICTURE: ${lastPicture}`);
    const last = segments[segments.length - 1]?.chosen;
    if (last?.custom) {
      parts.push(
        `The child typed their own idea: "${last.text}". Decide if it fits the story world. If yes, run with it joyfully. If not, use "aside" on the first page to respond playfully and steer back to a positive, relevant plot.`,
      );
    }
    parts.push(
      isLast
        ? `Write segment ${index} of ${totalSegments}, the FINAL segment: show what happens because of the choice, bring the problem to its biggest (still gentle) moment, then LAND THE STORY'S HEART: let the characters live the lesson in a clear moment the child can see (the kind act, the brave try, the honest word), show the happy outcome it brings, and let a character put the lesson into their own simple, warm words. Pay off something planted earlier (a detail, the refrain, the running joke - one last time, with a twist). End on a calm, cosy last page that echoes the opening and feels like a goodnight. Set choice to null and ending to true. Leave title, world, moral and keyword empty.`
        : `Write segment ${index} of ${totalSegments}: show the result of the choice on the first page so the child sees their decision mattered, then raise things a notch - a fun new twist, a try that doesn't quite work or a funny complication - that keeps the child hooked and moves the characters one step closer to discovering the story's heart, and end with a new choice for the child (at least one option should let them choose the kind, brave or wise path). Set ending to false. Leave title, world, moral and keyword empty.`,
    );
  }
  parts.push(
    `This segment is ${pages[Math.min(index, pages.length) - 1]} pages (the whole story is planned as ${pages.join(", ")} pages across its ${totalSegments} segments - ${pages.reduce((a, b) => a + b, 0)} in all; one page more or fewer here only if the plot truly needs it, never more than ${Math.max(...pages) + 1}), ${words[0]}-${words[1]} words per page${isLast ? "" : `, and exactly ${age.optionCount} choice options`}.`,
  );

  return {
    user: parts.join("\n\n"),
    norm: { isLast, existingIds: [...heroes.map((h) => h.id), ...cast.map((c) => c.id)], optionCount: age.optionCount, knownPlaces: known.map((p) => p.id) },
  };
}

export async function generateSegment(req: StoryRequest): Promise<SegmentResponse> {
  const { user, norm } = buildSegmentRequest(req);
  const out = await ask(SegmentSchema, writerPrompt(), user);
  return normalizeSegment(out, norm);
}

// ---------------------------------------------------------------- streaming

/** What the story stream sends: each time another page is complete, every
 *  page written so far (so the reader can show page 1 while the rest is
 *  still being written), then the final, validated segment. */
export type SegmentEvent =
  | { type: "title"; title: string }
  | { type: "pages"; newCharacters: CharacterDef[]; pages: Page[]; places?: StoryPlace[]; world?: string }
  | { type: "done"; response: SegmentResponse };

/** Finds the complete top-level items of the JSON array under `"key"` in a
 *  still-streaming JSON document. `closed` once the array has ended. */
function completeItems(json: string, key: string): { items: string[]; closed: boolean } | null {
  const m = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(json);
  if (!m) return null;
  const items: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = m.index + m[0].length; i < json.length; i++) {
    const c = json[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}" || c === "]") {
      if (depth === 0) return { items, closed: true }; // the array itself ended
      depth--;
      if (depth === 0 && start >= 0) {
        items.push(json.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return { items, closed: false };
}

/**
 * Writes the next segment as a stream, so the reader doesn't wait for the
 * whole thing: each page is passed on the moment it's complete (validated
 * and normalised exactly like the final result), and the finished segment
 * follows at the end.
 */
export async function* streamSegment(req: StoryRequest, signal?: AbortSignal): AsyncGenerator<SegmentEvent> {
  const { user, norm } = buildSegmentRequest(req);
  const stream = getClient().beta.messages.stream({
    model: STORY_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: writerPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: STORY_EFFORT, format: betaZodOutputFormat(SegmentSchema) },
  }, { signal });

  let text = "";
  let sent = 0;
  let titleSent = false;
  const usage = streamUsageTracker("story", STORY_MODEL, { label: "storyteller", effort: STORY_EFFORT });
  try {
  for await (const event of stream) {
    usage.see(event);
    // A new text block starts the JSON afresh (e.g. after a server-side
    // fallback to another model mid-reply).
    if (event.type === "content_block_start" && event.content_block.type === "text") {
      text = "";
      sent = 0;
      continue;
    }
    if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
    text += event.delta.text;

    // The title is written first: pass it on the moment it's complete, so
    // the book's cover can show it long before the first page is ready.
    if (!titleSent) {
      const t = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
      if (t) {
        titleSent = true;
        let title = "";
        try {
          title = (JSON.parse(`"${t[1]}"`) as string).trim();
        } catch {}
        if (title) yield { type: "title", title: title.slice(0, 120) };
      }
    }

    const pagesSoFar = completeItems(text, "pages");
    if (!pagesSoFar || pagesSoFar.items.length <= sent) continue;
    const chars = completeItems(text, "newCharacters");
    if (!chars?.closed) continue;
    // (the book's art direction and its places, written before the pages:
    // sent with the first ones, so the reader's app paints them in the
    // right world and place, and the places can be readied at once)
    const placesSoFar = completeItems(text, "places");
    const worldSaid = /"world"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
    let world = "";
    try {
      world = worldSaid ? (JSON.parse(`"${worldSaid[1]}"`) as string).trim() : "";
    } catch {}
    try {
      const newCharacters = chars.items.map((c) => NewCharacterSchema.parse(JSON.parse(c)));
      const pages = pagesSoFar.items.map((p) => PageSchema.parse(JSON.parse(p)));
      const places = placesSoFar?.closed ? placesSoFar.items.map((p) => PlaceSchema.parse(JSON.parse(p))) : [];
      const partial = normalizeSegment(
        { title: "", world: "", moral: "", keyword: "", newCharacters, places, pages, choice: null, ending: false },
        { ...norm, isLast: false },
      );
      sent = pages.length;
      yield { type: "pages", newCharacters: partial.newCharacters, pages: partial.segment.pages, ...(partial.places ? { places: partial.places } : {}), ...(world ? { world } : {}) };
    } catch {
      // Not parseable yet (or odd) - the final result will carry it.
    }
  }

  } catch (err) {
    usage.fail(err, signal?.aborted ? "The reader left." : undefined);
    throw err;
  } finally {
    usage.finish();
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new StoryRefusal("The storyteller couldn't write that one.");
  if (final.stop_reason === "max_tokens") throw new Error("The story came out jumbled. Please try again.");
  const lastText = [...final.content].reverse().find((b) => b.type === "text");
  const out = SegmentSchema.parse(JSON.parse(lastText && lastText.type === "text" ? lastText.text : text));
  yield { type: "done", response: normalizeSegment(out, norm) };
}

function normalizeSegment(out: SegmentOut, opts: { isLast: boolean; existingIds: string[]; optionCount: number; knownPlaces?: string[] }): SegmentResponse {
  const taken = new Set(opts.existingIds);
  const idMap: Record<string, string> = {};
  const newCharacters: CharacterDef[] = [];
  for (const c of out.newCharacters.slice(0, 4)) {
    let id = (c.id || c.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "friend";
    while (taken.has(id)) id += "2";
    taken.add(id);
    idMap[c.id] = id;
    const preset = presetByKey(c.preset);
    newCharacters.push({
      id,
      name: c.name.slice(0, 40),
      look: (preset && !c.look ? preset.look : c.look).slice(0, 600),
      preset: preset ? preset.key : null,
      svg: null,
    });
  }

  // (places: new ones named here, cleaned; a page set somewhere unnamed is
  // left without one)
  const placeIds = new Set([...(opts.knownPlaces ?? []), ...(out.places ?? []).map((p) => slugPlace(p.id))]);
  const places: StoryPlace[] = (out.places ?? [])
    .map((p) => ({ id: slugPlace(p.id), about: p.about.trim().slice(0, 400), light: p.light }))
    .filter((p) => p.id && p.about && !(opts.knownPlaces ?? []).includes(p.id))
    .slice(0, 6);
  const pages: Page[] = out.pages.slice(0, 7).map((p) => ({
    place: placeIds.has(slugPlace(p.place ?? "")) ? slugPlace(p.place ?? "") : null,
    camera: p.camera ?? null,
    text: p.text.trim(),
    aside: p.aside?.trim() ? p.aside.trim() : null,
    picture: p.picture.trim().slice(0, 1200),
    characters: [...new Set(p.characters.map((id) => idMap[id] ?? id))].filter((id) => taken.has(id)).slice(0, 5),
    action: cleanAction(p.action, p.text, idMap),
    svg: null,
  }));

  let choice = opts.isLast ? null : out.choice;
  if (choice) {
    choice = {
      prompt: choice.prompt.trim(),
      options: choice.options.slice(0, Math.max(2, opts.optionCount)).map((o) => ({ label: o.label.trim() })),
    };
  }

  return {
    title: out.title?.trim() || undefined,
    world: out.world?.trim() || undefined,
    moral: out.moral?.trim().slice(0, 200) || undefined,
    keyword: out.keyword?.trim().split(/\s+/)[0]?.replace(/[^\p{L}-]/gu, "").slice(0, 24) || undefined,
    newCharacters,
    ...(places.length ? { places } : {}),
    segment: { pages, choice, chosen: null },
    ending: opts.isLast || (!choice && out.ending),
  };
}

/** A place id as the story keeps it: lowercase letters, digits, hyphens. */
const slugPlace = (id: string) => id.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function cleanAction(a: SegmentOut["pages"][number]["action"] | undefined, text: string, idMap: Record<string, string>): PageAction | null {
  if (!a) return null;
  const word = a.word.trim().replace(/[^\p{L}\p{N}' -]/gu, "").slice(0, 30);
  if (!word) return null;
  return {
    word,
    target: (idMap[a.target] ?? a.target).trim().slice(0, 40) || "hero",
    sound: isSound(a.sound) ? a.sound : "twinkle",
    motion: isMotion(a.motion) ? a.motion : "bounce",
  };
  void text;
}

// ---------------------------------------------------------------- illustrations

const CENTRAL_IDS = ["hero", "companion1", "companion2"];

/** A character's reference painting as the painter reads it: the same
 *  shapes, with needlessly precise coordinates rounded to one decimal place
 *  (invisible at this size, and a good deal shorter to read). */
const referenceArt = (c: Pick<CharacterDef, "preset" | "svg">) =>
  characterArt(c)
    .trim()
    .replace(/(\d+)\.(\d{2,})/g, (n, whole: string) => (whole === "0" ? n : String(Math.round(Number(n) * 10) / 10)))
    .replace(/>\s+</g, "><");

/** One painter's part in a picture: which model, how hard it works, and
 *  what it's given. */
interface Brush {
  model: string;
  effort: Effort;
  /** As the activity log names it. */
  label: string;
  /** Paint without thinking first (see thinkingOff). */
  unthinking: boolean;
  /** How long it may take to lay its first stroke (0: however long). */
  clockMs: number;
  system: string;
  content: Anthropic.Beta.BetaTextBlockParam[];
}

/** How much room each painter's reply is given (max_tokens): sized to what
 *  it writes, thinking included, with room to spare. The service's
 *  per-minute limits count this room when a request starts, not what is
 *  used - so a composer writing 400 tokens of tags no longer books 32,000.
 *  Should a reply ever need more, the painter carries on (see
 *  brushStrokes), so nothing is lost by sizing it close. */
function replyRoom(brush: Pick<Brush, "label" | "unthinking">): number {
  const l = brush.label;
  // (a handful of tags; with thinking now on for placement)
  if (/composer/.test(l)) return 12_000;
  // (one character, alone, ~25-45 shapes)
  if (/newcomer/.test(l)) return 8_000;
  // (a page's own small layer over a backdrop)
  if (/page-layer/.test(l)) return 6_000;
  // (a whole scene or a standing backdrop, without thinking)
  if (/scenery|backdrop/.test(l)) return 12_000;
  // (only the characters' faces, limbs and actions: short without
  // thinking, longer with it)
  if (/character painter/.test(l)) return brush.unthinking ? 10_000 : 24_000;
  if (/quick/.test(l)) return 16_000;
  // (the whole picture, thinking first)
  return 32_000;
}

/** Times a painter cut off part-way is asked to carry on (see brushStrokes)
 *  - when the connection dropped, it broke, or it ran out of room. */
const MAX_RESUMES = 3;
/** How long, in all, a painter waits on a busy service (429 too many
 *  requests, 529 overloaded) before giving up: such limits last up to a
 *  minute, so it waits them out rather than counting tries. */
const BUSY_PATIENCE_MS = 120_000;

/** Whether a painter's failure is worth trying again: the service busy or
 *  briefly unwell, the connection dropping, the reply running out of room.
 *  Not a refusal, a request it rejected as wrong, or a missing key. */
function resumable(err: unknown): boolean {
  if (err instanceof StoryRefusal || err instanceof SlowPainter) return false;
  if (err instanceof Anthropic.APIError) {
    const st = err.status as number | undefined;
    return st === undefined || st === 408 || st === 409 || st === 429 || st >= 500;
  }
  return true;
}

/** What a painter cut off part-way is told, after its own brief. */
const carryOn = (soFar: string) =>
  `YOUR PICTURE SO FAR. You were cut off part-way through painting it. Everything below is kept, exactly as you wrote it, and is already on the page:\n${soFar}\n\nCarry on from exactly where it stops: write ONLY what comes next. Never repeat any of it and never start again. Close any groups it leaves open when you are done with them.`;

/** Streams one painter's strokes. What happened is noted on `log`.
 *
 *  Nothing it paints is ever thrown away. Strokes go on only as whole tags
 *  (never half of one), and if the painter is cut off part-way - the
 *  service busy, the connection dropped, the reply out of room - it is
 *  asked again, shown everything it has painted so far, to carry on from
 *  there (up to MAX_RESUMES times, after the wait the service asks for). */
async function* brushStrokes(
  brush: Brush,
  signal: AbortSignal | undefined,
  log: Record<string, unknown>,
  /** Why the signal was thrown, when it wasn't the reader leaving. */
  stoppedBy?: () => string | undefined,
): AsyncGenerator<string> {
  const { model } = brush;
  let unthinking = brush.unthinking ? thinkingOff(model) : null;
  // (Haiku 5.5 has no stand-in model: it turns a request that asks for one
  // away, so it isn't asked)
  const standIn = !model.startsWith("claude-haiku-5-5");
  const began = Date.now();
  let strokes = 0;
  // everything sent on so far (whole tags), and the start of a tag not yet
  // finished, held back
  let kept = "";
  let pending = "";
  let resumes = 0;
  let broken = 0;
  let busyWaited = 0;
  for (;;) {
    // (this go's own switch: thrown by the reader leaving, or by the
    // first-stroke clock)
    const go = new AbortController();
    const leave = () => go.abort();
    signal?.addEventListener("abort", leave, { once: true });
    if (signal?.aborted) go.abort();
    let late = false;
    // (the first-stroke clock is for the first go only: a painter carrying
    // on has already shown it can paint)
    const clock =
      brush.clockMs && !resumes
        ? setTimeout(() => {
            late = true;
            go.abort();
          }, brush.clockMs)
        : undefined;
    const usage = streamUsageTracker("painting", model, {
      label: resumes ? `${brush.label} (carrying on)` : brush.label,
      effort: brush.effort,
      thinking: unthinking ? (unthinking.type === "disabled" ? "off" : "off (between tools only)") : "the model's own",
    });
    try {
      const stream = getClient().beta.messages.stream(
        {
          model,
          max_tokens: replyRoom(brush),
          ...(standIn ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
          system: [{ type: "text", text: brush.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: kept ? [...brush.content, { type: "text", text: carryOn(kept) }] : brush.content }],
          ...(unthinking ? { thinking: unthinking } : {}),
          output_config: { effort: brush.effort },
        },
        { signal: go.signal },
      );
      for await (const event of stream) {
        usage.see(event);
        if (event.type === "message_start") log.acceptedMs ??= Date.now() - began;
        else if (event.type === "message_delta") log.out = Number(log.outBefore ?? 0) + event.usage.output_tokens;
        else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          if (!strokes++) {
            clearTimeout(clock);
            log.firstStrokeMs = Date.now() - began;
          }
          pending += event.delta.text;
          const cut = pending.lastIndexOf(">");
          if (cut >= 0) {
            const whole = pending.slice(0, cut + 1);
            pending = pending.slice(cut + 1);
            kept += whole;
            yield whole;
          }
        }
      }
      const final = await stream.finalMessage();
      log.stop = final.stop_reason;
      if (final.stop_reason === "refusal") throw new StoryRefusal("The illustrator couldn't paint that one.");
      // (cut off at the token limit: not finished - it carries on, below)
      if (final.stop_reason === "max_tokens") throw new Error("The painting ran out of room before it was finished.");
      if (pending) {
        kept += pending;
        yield pending;
        pending = "";
      }
      // On the bench: how many of the output tokens were the strokes
      // themselves (counted exactly, by the same tokenizer), so the rest
      // was thinking.
      // (counted after the painting, not before it's done: waiting for the
      // count put a second or so on every painter's time - and held back
      // the characters, which wait for the scenery to finish)
      if (log.measure) {
        const text = kept;
        log.measuring = (async () => {
          try {
            const count = (t: string) => getClient().messages.countTokens({ model, messages: [{ role: "user", content: t }] });
            const [all, none] = await Promise.all([count(text || "."), count(".")]);
            log.strokeTokens = Math.max(0, all.input_tokens - none.input_tokens + 1);
            log.thinkingTokens = Math.max(0, Number(log.out ?? 0) - Number(log.strokeTokens));
          } catch (e) {
            console.warn("painting: couldn't count the strokes", e);
          }
        })();
      }
      return;
    } catch (err) {
      usage.fail(err, signal?.aborted ? (stoppedBy?.() ?? "The reader left (or their page gave up waiting).") : late ? `No first stroke after ${brush.clockMs / 1000}s: given up on.` : undefined);
      if (late && !signal?.aborted) throw new SlowPainter(`No first stroke from ${model} after ${brush.clockMs / 1000}s.`);
      // (should the thinking-off setting ever be turned away, paint the
      // page the ordinary way rather than not at all)
      if (unthinking && !strokes && !signal?.aborted && err instanceof Anthropic.BadRequestError) {
        console.warn("painting: thinking-off setting refused, painting with thinking", err.message);
        unthinking = null;
        log.thinkingOffRefused = true;
        continue;
      }
      // Cut off: everything painted is kept, and the painter carries on
      // from there (after the wait the service asks for, if it was busy).
      const busy = busyFor(err);
      const again = busy ? busyWaited + busy <= BUSY_PATIENCE_MS : broken < MAX_RESUMES;
      if (!signal?.aborted && again && resumable(err)) {
        resumes++;
        if (!busy) broken++;
        // (the start of a tag it hadn't finished is dropped: it writes the
        // tag again, whole)
        pending = "";
        log.resumes = resumes;
        log.outBefore = Number(log.out ?? 0);
        // (busy: the wait asked for, plus a little at random so painters
        // turned away together don't all come back together)
        const wait = busy ? busy + Math.round(Math.random() * 2000) : 1500 * broken;
        if (busy) busyWaited += wait;
        console.warn(`painting: ${brush.label} cut off (${err instanceof Error ? err.message.slice(0, 120) : String(err)}); carrying on in ${wait} ms, ${kept.length} characters kept`);
        await new Promise<void>((r) => {
          const t = setTimeout(r, wait);
          signal?.addEventListener("abort", () => (clearTimeout(t), r()), { once: true });
        });
        if (signal?.aborted) throw err;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(clock);
      signal?.removeEventListener("abort", leave);
      usage.finish();
    }
  }
}

/** Two painters at once, one picture: everything the first paints is sent
 *  on as it comes; what the second paints is held until the first has
 *  finished and then follows it, so the second's work always lies on top.
 *  The picture takes as long as the slower of the two, not both together.
 *  If one fails (after carrying on as far as it can), the other is NOT
 *  stopped: it finishes, everything both painted is sent, and the failure
 *  is reported after - nothing painted is thrown away. */
type Layer = (stop: AbortSignal, why: () => string | undefined) => AsyncGenerator<string>;
async function* inLayers(under: Layer, over: Layer, signal?: AbortSignal): AsyncGenerator<string> {
  const stop = new AbortController();
  const leave = () => stop.abort();
  signal?.addEventListener("abort", leave, { once: true });
  if (signal?.aborted) stop.abort();
  let failure: unknown;
  let failed = false;
  const why = () => undefined;
  const down: string[] = [];
  const held: string[] = [];
  // (a layer that failed has ended too: what it painted stays)
  const ended = { under: false, over: false };
  let wake = () => {};
  const work = async (layer: Layer, into: string[], which: "under" | "over") => {
    try {
      for await (const strokes of layer(stop.signal, why)) {
        into.push(strokes);
        wake();
      }
    } catch (err) {
      if (!failed) {
        failed = true;
        failure = err;
      }
    } finally {
      ended[which] = true;
      wake();
    }
  };
  const both = Promise.all([work(under, down, "under"), work(over, held, "over")]);
  try {
    for (;;) {
      // (made before looking, so nothing that happens while strokes are
      // being sent on is missed)
      const more = new Promise<void>((r) => (wake = r));
      while (down.length) yield down.shift()!;
      if (ended.under) {
        while (held.length) yield held.shift()!;
        if (ended.over && !down.length && !held.length) break;
      }
      await more;
    }
    if (failed) throw failure;
  } finally {
    // (the reader's page stopped listening: neither painter goes on)
    stop.abort();
    signal?.removeEventListener("abort", leave);
    await both;
  }
}

/** Is this page painted in layers - the scenery by a cheaper, quicker
 *  painter while the main one paints only the characters over it?
 *
 *  Set by TALEO_LAYERED_PAINT: "all" (the default) for every page, "1" for
 *  the main painter's pages only, "0" for off. A second go is a quick page,
 *  so it is layered whenever those are (both hands the quick model, which
 *  paints without thinking first). A page with nobody and nothing on its
 *  stage is always one painter. */
export function paintsInLayers(req: IllustrateRequest): boolean {
  // (every page unless narrowed with "1" or switched off with "0")
  const mode = process.env.TALEO_LAYERED_PAINT || "all";
  if (mode !== "1" && mode !== "all") return false;
  if (req.quick && mode !== "all") return false;
  return req.cast.length > 0 || Boolean(req.page.action);
}

/** The characters' space on the page, as a box (see stageFor). */
function stageBox(req: IllustrateRequest): Box {
  const half = Math.min(150, 45 + 35 * Math.max(1, req.page.characters.length));
  return { x0: 200 - half, x1: 200 + half, y0: 75, y1: 250 };
}

/** Which reuse savings a page is painted with: the request's own (set by
 *  the server for the admin's comparison bench), else the settings -
 *  TALEO_PAINT_STAMPS, TALEO_PAINT_PARTS, TALEO_PAINT_BACKDROPS ("1": on).
 *  All off unless switched on. */
export function reuseOf(req: Pick<IllustrateRequest, "reuse">): ReuseSettings {
  if (req.reuse) return req.reuse;
  // (readers' pages: the live version, pinned in bench-ways - unless
  // switched back to the env's own settings)
  if (process.env.TALEO_PAINT_LIVE !== "0") return LIVE.settings;
  const on = (v: string | undefined) => v === "1" || v === "true";
  return { stamps: on(process.env.TALEO_PAINT_STAMPS), parts: on(process.env.TALEO_PAINT_PARTS), backdrops: on(process.env.TALEO_PAINT_BACKDROPS) };
}
const NO_REUSE: ReuseSettings = { stamps: false, parts: false, backdrops: false };

/** How long a page waits for a character's parts to be made (see paintOnce). */
const PARTS_WAIT_MS = 20_000;

/** Once sent down the painting's stream when a page painted from reused
 *  pieces went wrong part-way, to throw away what was sent and paint the
 *  page again the ordinary way. No longer sent (nothing painted is thrown
 *  away now); still understood, for pages already open. */
export const RESTART = "\u0000restart\u0000";

/** Where the characters stand, worked out the same way for both painters:
 *  neither sees the other's work, so this is what makes the layers fit. */
function stageFor(req: IllustrateRequest): string {
  const half = Math.min(150, 45 + 35 * Math.max(1, req.page.characters.length));
  return `THE STAGE (this picture is painted by two hands at once - one lays the scenery, the other paints the characters over it - and neither sees the other's work, so both keep to this exactly)
- The ground or floor the characters stand on crosses the picture at about y 240. Out of doors the horizon sits at about y 150; indoors the floor meets the wall there.
- The characters and the tap target have the middle of the picture: x ${200 - half} to ${200 + half}, from about y 75 down to their feet at y 235-250. The brief's camera decides how large they are inside it (a close-up fills it; a wide shot leaves them small on the ground line).
- The scenery's landmarks (trees, houses, furniture, doors, hills) stand to the left and right of that space and behind it above y 150, on the sides the brief gives them.
- The light comes from the upper left; shadows fall to the lower right.`;
}

/** How long to wait after the service turned a request away for being
 *  busy (429 too many requests, 529 overloaded): its retry-after, up to
 *  20 s (10 s if it gave none). 0 for any other error. */
function busyFor(err: unknown): number {
  const e = err as { status?: number; headers?: Headers | Record<string, string> } | null;
  if (!e || (e.status !== 429 && e.status !== 529)) return 0;
  const h = e.headers;
  const after = Number(h instanceof Headers ? h.get("retry-after") : h?.["retry-after"]);
  return Math.min(20_000, Number.isFinite(after) && after > 0 ? after * 1000 : 10_000);
}

/** Streams the SVG markup of one painted page. `notes`: what the reuse
 *  did, for the activity log. */
export async function* paintPage(req: IllustrateRequest, signal?: AbortSignal, notes: Record<string, unknown> = {}): AsyncGenerator<string> {
  // (no second, ordinary painting if something goes wrong part-way: every
  // stage mends or carries on instead, and what's painted is kept - see
  // expandStream, brushStrokes and inLayers)
  yield* paintOnce({ ...req, reuse: reuseOf(req) }, signal, notes);
}

/** How big a character is against the page's grown characters, from its
 *  kind (a ladybird, a squirrel), added to its sheet - so a painter or
 *  composer doesn't paint a squirrel bigger than a rabbit (lesson 1, see
 *  docs/painting-lessons.md). Nothing for ordinary-sized characters. */
export function relativeSize(c: Pick<CharacterDef, "name" | "look">): string | null {
  const t = `${c.name} ${c.look}`.toLowerCase();
  if (/\b(ladybird|ladybug|ant|ants|bee|bumblebee|butterfly|dragonfly|snail|beetle|caterpillar|firefly|spider|fairy|fly)\b/.test(t)) return "TINY: about a tenth of a grown character's height - it fits on a hand or a leaf";
  if (/\b(mouse|mice|frog|toad|crab|bird|robin|sparrow|blackbird|wren|chick|duckling|hedgehog|mole|squirrel|vole|shrew|gosling|kitten|lizard|newt)\b/.test(t)) return "SMALL: smaller than the grown characters, about two thirds of their height";
  if (/\b(goose|duck|hen|chicken|puppy|tortoise|otter|badger|seal pup|lamb)\b/.test(t)) return "a little smaller than a grown character (about three quarters of the height)";
  return null;
}
/** A character's size against a grown one, as a number (see relativeSize). */
function sizeShare(c: Pick<CharacterDef, "name" | "look">): number {
  const r = relativeSize(c);
  return !r ? 1 : r.startsWith("TINY") ? 0.15 : r.startsWith("SMALL") ? 0.67 : 0.75;
}
const withSize = (c: CharacterDef, sheet: string) => {
  const r = relativeSize(c);
  return r ? `${sheet}\nSIZE AGAINST THE OTHERS: ${r}.` : sheet;
};

/** Where a place's prepared backdrop is kept: by the place itself (its id
 *  and description), its light and the book's season - shared by every
 *  page and way set there, as a character's prepared parts are. */
const placeKey = (place: { id: string; about?: string }, light: Light, world: string) =>
  `bd:place:v2:${hashOf(`${place.id}|${place.about ?? ""}|${light}|${seasonFor(place.about, "", world)}`)}`;

/** A scene's season: the place's own if it names one ("an autumn wood"),
 *  else the page's ("orange and gold leaves falling"), else the book's.
 *  (The book's alone had autumn places painted in summer greens.) */
function seasonFor(placeAbout: string | undefined, picture: string, world: string): Season {
  // (a season named, or plainly implied: falling leaves are autumn, a
  // snowman winter, blossom spring)
  const said = (t: string): Season | null => {
    if (!t) return null;
    if (/\b(autumn|fall|harvest|pumpkins?|conkers?|copper beech|russet|falling leaves|fallen leaves|leaf pile|(orange|gold|golden|red) (and \w+ )?leaves)\b/i.test(t)) return "autumn";
    if (/\b(winter|snow\w*|frost\w*|frozen|icicles?|sledg\w*|christmas)\b/i.test(t)) return "winter";
    if (/\b(spring|blossom\w*|bluebells?|daffodils?|lambs?|easter)\b/i.test(t)) return "spring";
    if (/\bsummer\b/i.test(t)) return "summer";
    return null;
  };
  return said(placeAbout ?? "") ?? said(picture) ?? seasonOf(world);
}
/** The season said plainly, for a painter whose book says otherwise. */
const SEASON_LOOK: Record<Season, string> = {
  autumn: "autumn: trees in copper, orange, gold and russet with a few still green, warm ochre ground, fallen leaves",
  winter: "winter: bare or snow-laden trees, white ground, cool blue-grey shadows",
  spring: "spring: fresh light greens, blossom, bright young grass and flowers",
  summer: "summer: full deep greens, warm light, flowers in the grass",
};
const lightFor = (place: { about?: string; light?: string }, extra = ""): Light =>
  (["day", "golden", "dusk", "night", "rain"] as const).find((l) => l === place.light) ?? lightOf(`${place.light ?? ""} ${place.about ?? ""} ${extra}`);

/** Paints a place's standing backdrop ahead of any page and keeps it (the
 *  bench's "Prepare places", or a story's places as soon as they're
 *  known): a page set there then never waits for it. Painted once - one
 *  already made, or being made, is found. False if it couldn't be. The
 *  scene's details still change on every page: each page's own sky and
 *  foreground, its framing, and the moment's details over it. */
export async function prepareBackdrop(place: { id: string; about?: string; light?: string }, world: string): Promise<boolean> {
  const light = lightFor(place);
  const key = placeKey(place, light, world);
  const made = await once(key, () => paintBackdropSvg(place, light, world, key, undefined, {}), { ttlS: 365 * 86_400, waitMs: 180_000, nothingTtlS: 20 }).catch(() => null);
  return Boolean(made);
}

/** Whether a place's backdrop is prepared (never paints it). */
export async function backdropReady(place: { id: string; about?: string; light?: string }, world: string): Promise<boolean> {
  return Boolean(await kept<string>(placeKey(place, lightFor(place), world)));
}

/** A place's standing backdrop, painted (see BACKDROP_BRIEF). `onStroke`
 *  sees it as it comes, for a page showing it being painted. */
async function paintBackdropSvg(place: { id: string; about?: string }, light: Light, world: string, key: string, signal: AbortSignal | undefined, log: Record<string, unknown>, onStroke?: (s: string) => void, why?: () => string | undefined): Promise<string | null> {
  const painter: Brush = {
    model: SCENERY_MODEL,
    effort: SCENERY_EFFORT,
    label: "backdrop painter",
    unthinking: QUICK_ART_UNTHINKING,
    clockMs: 0,
    system: sceneryPrompt({ stamps: true }),
    content: [{ type: "text", text: [`BOOK ART DIRECTION: ${world || "a gentle English countryside in late summer, soft golden light"}`, `THE PLACE: ${place.about || place.id}`, `THE LIGHT: ${light}`, `THE SEASON HERE (this place's own, which wins over the book's art direction): ${SEASON_LOOK[seasonFor(place.about, "", world)]}`, BACKDROP_BRIEF, stageFor({ page: { characters: ["a", "b"] } } as unknown as IllustrateRequest), "Output the SVG markup now."].join("\n\n") }],
  };
  const season = seasonFor(place.about, "", world);
  const ctx: ExpandContext = { bookSeed: hashOf(key), pageSeed: hashOf(key), palette: paletteFor(season, light), stamps: true, stage: { x0: 85, x1: 315, y0: 75, y1: 250 } };
  let svg = "";
  for await (const c of expandStream(brushStrokes(painter, signal, log, why), ctx, newStats())) {
    svg += c;
    onStroke?.(c);
  }
  return svg || null;
}

/** Readies a character the storyteller has just brought in with no
 *  portrait, before any page is painted: its portrait is painted (standing,
 *  in its own look) and kept for the book, and its parts made, so every
 *  page it's on paints it the same and the reuse ways place it cheaply.
 *  (Its poses follow when it comes back - see paint/newcomers.) Nothing if
 *  it already has a portrait or art. */
export async function readyNewcomer(c: CharacterDef, world: string): Promise<void> {
  if (characterArt(c) || !world || !c.name) return;
  if (await newcomerPortrait(c, world)) return;
  const req = { world, cast: [c], page: { text: "", picture: `${c.name} standing, relaxed and smiling, as in a model sheet.`, characters: [c.id] } } as unknown as IllustrateRequest;
  const sp = await paintNewcomer(c, req, undefined, {});
  if (sp) await keepNewcomer(c, sp, world);
}

/** A character painter's strokes, checked for everyone: each character
 *  it paints begins with a marker, <who c="id"/> (taken out here), or is a
 *  <fig> or <sprite> for them. When it has finished, anyone on the page it
 *  left out is asked for - it carries on, shown what it painted, to paint
 *  ONLY them - so nobody goes missing (lesson 4). Costs nothing when
 *  everyone is there. */
async function* everyone(brush: Brush, signal: AbortSignal | undefined, log: Record<string, unknown>, why: (() => string | undefined) | undefined, onPage: { id: string; name: string }[], notes: Record<string, unknown>): AsyncGenerator<string> {
  let raw = "";
  const seen = new Set<string>();
  const look = (text: string) => {
    for (const m of text.matchAll(/<\s*(?:who|fig|sprite|npc)\b[^>]*\bc\s*=\s*"([^"]+)"/gi)) seen.add(m[1].trim());
  };
  const strip = (text: string) => text.replace(/<\s*who\b[^>]*\/?>\s*/gi, "").replace(/<\s*\/\s*who\s*>/gi, "");
  for await (const s of brushStrokes(brush, signal, log, why)) {
    raw += s;
    look(s);
    const out = strip(s);
    if (out) yield out;
  }
  // (a painter that marked nobody didn't follow the markers at all: that
  // proves nothing, and asking again could paint everyone twice)
  if (!seen.size) {
    notes.missing = "not checked: the painter marked no one";
    return;
  }
  // (by id or by name: a painter may mark a character either way)
  const missing = onPage.filter((c) => !seen.has(c.id) && ![...seen].some((x) => x.toLowerCase() === c.name.toLowerCase()));
  if (!missing.length || signal?.aborted) return;
  const names = missing.map((c) => `${c.name} ("${c.id}")`).join(" and ");
  notes.missing = `${missing.map((c) => c.name).join(", ")} left out at first: asked for again`;
  const again: Brush = {
    ...brush,
    label: `${brush.label} (missing characters)`,
    clockMs: 0,
    content: [...brush.content, { type: "text", text: `${carryOn(raw)}\n\nSTILL MISSING: you have not painted ${names}, and the page needs them. Paint ONLY ${missing.length > 1 ? "them" : "that character"} now, in the right place for the moment, each starting with its <who c="ID"/> marker - nothing else, and never anything again.` }],
  };
  for await (const s of brushStrokes(again, signal, log, why)) {
    const out = strip(s);
    if (out) yield out;
  }
}

/** A composer's tags, whole, through the layout pass (see layoutComposed);
 *  its changes are noted with the page's other mends. */
async function* laidOut(src: AsyncIterable<string>, opts: LayoutOptions, stats: ExpandStats): AsyncGenerator<string> {
  let all = "";
  for await (const s of src) all += s;
  const { markup, notes } = layoutComposed(all, opts);
  stats.fixes.push(...notes.map((n) => `layout: ${n}`));
  yield markup;
}

/** A newcomer's painting for one page: the character alone, in the pose
 *  this moment needs, on its own 200x200 canvas (feet at 100,190, facing
 *  right) - placed where the composer's tag puts it, like a pre-painted
 *  pose. Painted by the scenery's model at medium effort without thinking:
 *  more care than the composer's tags, a fraction of a full painter. It
 *  carries on if cut off, as every painter does. */
async function paintNewcomer(c: CharacterDef, req: IllustrateRequest, signal: AbortSignal | undefined, log: Record<string, unknown>): Promise<Sprite | null> {
  const brush: Brush = {
    model: SCENERY_MODEL,
    effort: "medium",
    label: `newcomer painter (${c.name})`,
    unthinking: true,
    clockMs: 0,
    system: newcomerPrompt(),
    content: [
      {
        type: "text",
        text: [
          `BOOK ART DIRECTION: ${req.world || "a gentle English countryside in late summer, soft golden light"}`,
          `THE CHARACTER: ${c.name}${genderNote(c)}. ${c.look || "A small woodland creature."}`,
          // (painted before, in this book: the very same character again)
          characterArt(c) ? `ITS PORTRAIT (200x200) - paint exactly this character: the same colours (same hex values), markings, shape and face; only the pose changes:\n${characterArt(c)}` : "",
          `THIS PAGE'S TEXT: ${req.page.text}`,
          `THE MOMENT: ${req.page.picture}`,
          `Paint ${c.name} alone, doing what this moment has them do. Output the three groups now.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  };
  let svg = "";
  for await (const s of brushStrokes(brush, signal, log)) svg += s;
  // (nothing usable: one more try, rather than leaving them out)
  const sp = splitLayers(svg);
  if (sp || signal?.aborted) return sp;
  let again = "";
  for await (const s of brushStrokes({ ...brush, label: `${brush.label} (again)` }, signal, log)) again += s;
  return splitLayers(again);
}

/** A painter's three layer groups, gathered (any number of each, in
 *  order) into a pose's paint, ink and detail. Null if it painted nothing. */
function splitLayers(svg: string): Sprite | null {
  const out = { paint: "", ink: "", detail: "" } as Record<"paint" | "ink" | "detail", string>;
  let depth = 0;
  let layer: "paint" | "ink" | "detail" | null = null;
  let start = 0;
  for (const m of svg.matchAll(/<\/?g\b[^>]*>/g)) {
    const tag = m[0];
    const closing = tag.startsWith("</");
    const self = tag.endsWith("/>");
    if (!closing && !self) {
      if (depth === 0) {
        layer = (tag.match(/class="(paint|ink|detail)"/)?.[1] as typeof layer) ?? "paint";
        start = m.index! + tag.length;
      }
      depth++;
    } else if (closing) {
      depth--;
      if (depth === 0 && layer) {
        out[layer] += svg.slice(start, m.index);
        layer = null;
      }
      if (depth < 0) depth = 0;
    }
  }
  return out.paint.length > 40 ? out : null;
}

async function* paintOnce(req: IllustrateRequest, signal: AbortSignal | undefined, notes: Record<string, unknown>): AsyncGenerator<string> {
  const reuse = req.reuse ?? NO_REUSE;
  // A newcomer already painted in this book (see paint/newcomers) has its
  // first painting as its portrait: from here on it's like anyone else -
  // painted from that portrait, placed from its parts and poses once
  // they're ready - and each page it's on is counted (its poses are
  // prepared when it comes back).
  // (a book is known by its art direction - the same on every page and
  // when the storyteller first brings a character in - else its id)
  const book = req.world || req.storyId || "";
  if (reuse.parts && book) {
    const cast = await Promise.all(
      req.cast.map(async (c) => {
        if (characterArt(c)) return c;
        const portrait = await newcomerPortrait(c, book, req.benchVariant);
        if (!portrait) return c;
        const known = { ...c, preset: null, svg: portrait };
        sawNewcomerAgain(known, book, req.benchVariant);
        return known;
      }),
    );
    const promoted = cast.filter((c, i) => c !== req.cast[i]).map((c) => c.name);
    if (promoted.length) notes.portraits = `${promoted.join(", ")} painted from their portrait in this book`;
    req = { ...req, cast };
  }
  // (the pieces' colours: the book's season, the page's light; their
  // seeds: the book, and the page)
  const stats = newStats();
  if (reuse.stamps || reuse.parts) notes.reuse = stats;
  const light: Light = (["day", "golden", "dusk", "night", "rain"] as const).find((l) => l === req.place?.light) ?? lightOf(`${req.place?.light ?? ""} ${req.page.picture} ${req.page.text}`);
  // (the place's or page's own season over the book's: an autumn wood in a
  // late-summer book is still an autumn wood)
  const season = seasonFor(req.place?.about, `${req.page.picture} ${req.page.text}`, req.world);
  const expandCtx = (stage: Box | null): ExpandContext => ({
    bookSeed: hashOf(req.storyId || req.world || "taleo"),
    pageSeed: hashOf(`${req.storyId ?? ""}|${req.page.text}`),
    palette: paletteFor(season, light),
    stamps: reuse.stamps,
    stage,
    // (characters placed from parts or poses kept to the page's camera)
    sizing: reuse.parts || reuse.sprites ? sizingFor(req.camera, req.page.picture, req.page.characters.length) : undefined,
  });
  // Characters from their kept parts: the hand-made ones, or their
  // portrait regrouped (once, then kept). One that has none is painted in
  // full, as before.
  const partsOf = new Map<string, CharacterParts>();
  if (reuse.parts && req.cast.length) {
    const began = Date.now();
    // (a character's parts are made once, the first time it's needed -
    // which can take a minute or two. A page doesn't wait long for them:
    // past PARTS_WAIT_MS that character is painted in full this time, and
    // its parts go on being made for the pages after.)
    const inTime = <T,>(p: Promise<T>) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), PARTS_WAIT_MS))]);
    for (const [id, p] of await Promise.all(req.cast.map(async (c) => [c.id, await inTime(partsFor(c, req.benchVariant).catch(() => null))] as const))) if (p) partsOf.set(id, p);
    notes.parts = { from: [...partsOf.keys()], full: req.cast.filter((c) => !partsOf.has(c.id)).map((c) => c.id), readyMs: Date.now() - began };
  }
  // The cheapest way: when every character has its parts, nobody is drawn
  // at all - the composer only places and poses them from the library.
  // The pre-painted poses, where they're ready (made ahead, never here):
  // with every character's ready, nobody is drawn - the composer places
  // their poses.
  const spritesOf = new Map<string, Partial<Record<SpritePose, Sprite>>>();
  if (reuse.sprites && req.cast.length)
    for (const [id, sp] of await Promise.all(req.cast.map(async (c) => [c.id, await spritesFor(c).catch(() => ({}))] as const))) if (Object.keys(sp).length) spritesOf.set(id, sp);
  // Newcomers: characters with no portrait at all (a squirrel, a bird, an
  // alien the story brings in), so no parts and no poses can exist. They
  // don't stop the composer: it still places everyone, and leaves each
  // newcomer a spot, while a stronger painter paints just that newcomer, in
  // this moment's pose, at the same time (see paintNewcomer).
  // (on a composed page, anyone who can't be placed from poses or parts -
  // a newcomer, or a character whose parts aren't ready - is painted for
  // the page the same way, from its portrait when it has one: the
  // composer still places everyone)
  const placeable = (c: CharacterDef) => partsOf.has(c.id) || (Boolean(reuse.sprites) && spritesOf.has(c.id));
  const posing = Boolean(reuse.poses) && req.cast.length > 0;
  const spriting = posing && Boolean(reuse.sprites);
  const newcomers = posing ? req.cast.filter((c) => !placeable(c)) : [];
  if (reuse.sprites) notes.sprites = req.cast.every((c) => spritesOf.has(c.id)) ? "placed from pre-painted poses" : `poses not ready for ${req.cast.filter((c) => !spritesOf.has(c.id)).map((c) => c.name).join(", ")}: from parts, or painted for the page`;
  if (reuse.poses) notes.composer = "posed from the library";
  if (newcomers.length) notes.newcomers = `${newcomers.map((c) => c.name).join(", ")} painted for this page`;
  // (begun at once, alongside everything else; the composer's tag says
  // where each goes)
  const newcomerPaintings: Record<string, Promise<Sprite | null>> = {};
  const newcomerLogs: Record<string, Record<string, unknown>> = {};
  if (posing)
    for (const c of newcomers) {
      newcomerLogs[c.id] = { model: SCENERY_MODEL, measure: Boolean(req.bench) };
      newcomerPaintings[c.id] = paintNewcomer(c, req, signal, newcomerLogs[c.id]).then((sp) => {
        // (a true newcomer's first painting: kept as its portrait for the
        // book, and made ready for reuse in the background)
        if (sp && !characterArt(c) && book) void keepNewcomer(c, sp, book, req.benchVariant).catch(() => {});
        return sp;
      }).catch((e) => {
        console.warn("painting: a newcomer couldn't be painted", c.name, e);
        return null;
      });
    }
  const sheet = (c: CharacterDef) => withSize(c, sheetOf(c));
  const sheetOf = (c: CharacterDef) => {
    if (newcomers.includes(c)) return newcomerSheet(c);
    const parts = partsOf.get(c.id);
    // (with no poses yet but its parts: any pose word, made from its parts)
    if (spriting) return spriteSheet(c, spritesOf.has(c.id) ? Object.keys(spritesOf.get(c.id)!) : SPRITE_POSE_IDS);
    if (parts && posing) return composerSheet(c, Object.keys(parts.views));
    if (parts) return partsSheet(c, parts);
    const art = referenceArt(c);
    // (on a page where others are painted from parts: this one isn't - it
    // is drawn whole, never as a <fig>, or it can go missing)
    const whole = partsOf.size ? " - DRAWN IN FULL by you, the ordinary way: never as a <fig>" : "";
    return `CHARACTER "${c.id}": ${c.name}${genderNote(c)}${whole}\nModel sheet: ${c.look}${art ? `\nReference painting (neutral pose, 200x200 canvas):\n${art}` : ""}`;
  };
  // The book's central characters come first, always in the same order and
  // each as its own cached block: their reference paintings are by far the
  // largest part of the request, and every page of the book repeats them.
  // Read back from the cache they cost a tenth as much, and the painter
  // starts sooner. (Four cache points at most: the system prompt and up to
  // three central characters.)
  const central = CENTRAL_IDS.map((id) => req.cast.find((c) => c.id === id)).filter((c): c is CharacterDef => Boolean(c));
  const others = req.cast.filter((c) => !central.includes(c));
  const layered = paintsInLayers(req);
  const target = req.page.action
    ? `TAP TARGET: "${req.page.action.target}"${req.cast.some((c) => c.id === req.page.action!.target) ? " (the character with that id)" : ""}, acting out the word "${req.page.action.word}".`
    : "";
  const world = `BOOK ART DIRECTION: ${req.world || "a gentle English countryside in late summer, soft golden light"}`;
  const previous = req.previous ? `PREVIOUS PAGE'S PICTURE (for continuity of place and light): ${req.previous}` : "";

  const rest = [
    others.map(sheet).join("\n\n"),
    req.cast.length ? "" : "No characters in this picture.",
    previous,
    `THIS PAGE'S TEXT: ${req.page.text}`,
    `PAINT THIS MOMENT: ${req.page.picture}`,
    target ? `${target} Wrap it in <g class="target">.` : "",
    layered ? `${stageFor(req)}\n\n${LAYERED_CHARACTERS}` : "",
    partsOf.size && !posing ? PARTS_SECTION : "",
    // (the size every placed character is kept to - better aimed at than
    // corrected)
    posing || partsOf.size ? sizeLine(sizingFor(req.camera, req.page.picture, req.page.characters.length)) : "",
    posing && newcomers.length ? NEWCOMERS_SECTION : "",
    // (the place is a standing backdrop, the page's sky and foreground
    // made in code: so this moment's own scene details - what makes this
    // page's scene unlike the last one there - come from whoever paints the
    // characters)
    reuse.backdrops && reuse.codeLayer && req.place?.id && layered ? MOMENT_DETAILS : "",
    posing
      ? `Characters in the picture: ${req.page.characters.join(", ") || "none"}. Output the tags now.`
      : `Characters in the picture: ${req.page.characters.join(", ") || "none"} - every one of them must be in it. Start each character's strokes with its marker, <who c="ID"/> (its id), once, so the app can check everyone is there. Keep each one's exact colours, signature features and proportions from their sheet. Output the SVG markup now.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: world },
    ...central.map((c): Anthropic.Beta.BetaTextBlockParam => (posing ? { type: "text", text: sheet(c) } : { type: "text", text: sheet(c), cache_control: { type: "ephemeral" } })),
    { type: "text", text: rest },
  ];

  // (who paints the characters: the page's usual painter, unless the
  // reuse settings name another - a cheaper one for reused parts)
  const chosen = reuse.painter && layered ? reuse.painter : null;
  const model = chosen?.model ?? (req.quick ? QUICK_ART_MODEL : ART_MODEL);
  const main: Brush = {
    model,
    effort: chosen?.effort ?? (req.quick ? QUICK_ART_EFFORT : layered ? LAYER_CHARACTERS_EFFORT : ART_EFFORT),
    label: spriting ? "pose composer" : posing ? "composer" : layered ? "character painter" : req.quick ? "quick painter" : "main painter",
    unthinking: chosen ? chosen.unthinking : Boolean(req.quick) && QUICK_ART_UNTHINKING,
    clockMs: req.quick || chosen ? 0 : FIRST_STROKE_MS,
    // (the standard pieces are offered to whoever paints the scenery:
    // the illustrator only when it paints the whole picture alone)
    // (and to the characters' painter when it paints from parts: for the
    // things the characters touch - the tree climbed, the bench sat on)
    system: spriting ? spriteComposerPrompt(SPRITE_POSES) : posing ? composerPrompt() : illustratorPrompt({ stamps: reuse.stamps && (!layered || partsOf.size > 0 || Boolean(reuse.backdrops && reuse.codeLayer && req.place?.id)) }),
    content,
  };
  // One line per painting in the server log: which painter, how long until
  // the request was taken up, until the first stroke, and in all.
  const began = Date.now();
  const log: Record<string, unknown> = { model, quick: Boolean(req.quick), retry: Boolean(req.retry), measure: Boolean(req.bench) };
  try {
    if (!layered) {
      notes.painters = { painter: log };
      const strokes = brushStrokes(main, signal, log);
      yield* reuse.stamps ? expandStream(strokes, expandCtx(null), stats) : strokes;
      return;
    }
    // In layers: the scenery painter never sees the character sheets (it
    // paints none of them), so its request is small and it starts at once.
    const scenery: Brush = {
      model: SCENERY_MODEL,
      effort: SCENERY_EFFORT,
      label: "scenery painter",
      unthinking: QUICK_ART_UNTHINKING,
      clockMs: FIRST_STROKE_MS,
      system: sceneryPrompt({ stamps: reuse.stamps }),
      content: [
        {
          type: "text",
          text: [
            world,
            previous,
            `THIS PAGE'S TEXT: ${req.page.text}`,
            `THE MOMENT BEING PAINTED: ${req.page.picture}`,
            stageFor(req),
            `Painted by the other hand, so NOT by you: ${[...req.cast.map((c) => c.name), req.page.action && !req.cast.some((c) => c.id === req.page.action!.target) ? `the ${req.page.action.target}` : ""].filter(Boolean).join(", ") || "the tap target"}, and whatever they hold, wear or set moving. Paint the place they are in. Output the SVG markup now.`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    };
    // (who must be in the picture: the page's characters that are in its cast)
    const onPage = req.page.characters.filter((id) => req.cast.some((c) => c.id === id)).map((id) => ({ id, name: req.cast.find((c) => c.id === id)!.name }));
    const logs = { scenery: { model: scenery.model, measure: Boolean(req.bench) } as Record<string, unknown>, characters: { model, measure: Boolean(req.bench) } as Record<string, unknown>, ...Object.fromEntries(Object.entries(newcomerLogs).map(([id, l]) => [`newcomer ${id}`, l])) };
    notes.painters = logs;
    Object.assign(log, { layered: true, ...logs });
    // (with the pieces on, the scenery painter's placeholders are expanded
    // as they come - kept out of the characters' space - and the character
    // painter's bare pen groups given the house pen)
    const sceneryStrokes = (stop: AbortSignal, why: () => string | undefined) =>
      reuse.stamps ? expandStream(brushStrokes(scenery, stop, logs.scenery, why), expandCtx(stageBox(req)), stats) : brushStrokes(scenery, stop, logs.scenery, why);
    const characterStrokes = (stop: AbortSignal, why: () => string | undefined) =>
      reuse.stamps || partsOf.size || spriting
        ? expandStream(
            // (a composer's tags are read whole - they're short - and its
            // placement checked before anything is drawn: see layoutComposed)
            posing ? laidOut(brushStrokes(main, stop, logs.characters, why), { targetId: req.page.action && req.cast.some((c) => c.id === req.page.action!.target) ? req.page.action.target : null, usualS: sizingFor(req.camera, req.page.picture, req.page.characters.length).s, sizeOf: Object.fromEntries(req.cast.map((c) => [c.id, sizeShare(c)])), targetThing: req.page.action && !req.cast.some((c) => c.id === req.page.action!.target) ? req.page.action.target : null }, stats) : everyone(main, stop, logs.characters, why, onPage, notes),
            {
              ...expandCtx(null),
              stamps: posing || (reuse.stamps && (partsOf.size > 0 || Boolean(reuse.backdrops && reuse.codeLayer && req.place?.id))),
              figures: Object.fromEntries(partsOf),
              sprites: Object.fromEntries(spritesOf),
              // (a tag that names a character finds it; on a composed page,
              // anyone the composer leaves out is placed in code)
              ids: Object.fromEntries(req.cast.flatMap((c) => [[c.id.toLowerCase(), c.id], [c.name.toLowerCase(), c.id]])),
              mustPlace: posing ? req.page.characters.filter((id) => partsOf.has(id) || spritesOf.has(id) || id in newcomerPaintings) : undefined,
              sizeOf: Object.fromEntries(req.cast.map((c) => [c.id, sizeShare(c)])),
              newcomers: newcomerPaintings,
            },
            stats,
          )
        : everyone(main, stop, logs.characters, why, onPage, notes);
    // With backdrops: the place is painted once (the first page set there
    // paints it, every other page reuses it), framed a little differently
    // for each page, and the scenery painter adds only this page's own
    // layer over it.
    const place = reuse.backdrops && req.place?.id ? req.place : null;
    const under = place
      ? async function* (stop: AbortSignal, why: () => string | undefined): AsyncGenerator<string> {
          // (on the bench, each variant paints and keeps its own)
          // (readers' pages: the same key the story's place is prepared
          // under, so a page that asks while it's being painted waits for
          // that painting rather than starting a second; on the bench,
          // each variant paints its own unless the place was prepared)
          const key = req.benchVariant ? `bd:v2:${hashOf(`${req.storyId ?? ""}|${place.id}|${light}|${seasonFor(place.about, "", req.world)}`)}:bench:${req.benchVariant}` : placeKey(place, light, req.world);
          const backdropLog: Record<string, unknown> = { model: SCENERY_MODEL, measure: Boolean(req.bench) };
          // (this page's framing: a modest zoom about the ground line and
          // a pan, chosen from the page itself - a close-up comes closer)
          const h = hashOf(req.page.text);
          // (gentle enough that a landmark at either side - where the
          // backdrop puts them, about x 30-370 - stays in the picture: at
          // up to 1.25 and a 24-pixel pan, a tree on the right bank was
          // cut off)
          const zoom = req.camera === "close" ? 1.12 : req.camera === "wide" ? 1 : [1, 1.04, 1.08][h % 3];
          const dx = zoom > 1.05 ? 0 : (((h >> 3) % 3) - 1) * 8;
          notes.frame = `zoom ${zoom}, pan ${dx}`;
          // The page that paints the place shows it stroke by stroke as it
          // is painted (not blank until it's done); a page that reuses it
          // shows it whole at once.
          let made = false;
          const live: string[] = [];
          let settled = false;
          let wake = () => {};
          // (prepared ahead - "Prepare places", or the story's places - it's
          // here already, whole: no waiting, nothing to pay)
          const prepared = await kept<string>(placeKey(place, light, req.world)).catch(() => null);
          const backdrop = prepared ? Promise.resolve(prepared) : once(
            key,
            async () => {
              made = true;
              (logs as Record<string, Record<string, unknown>>).backdrop = backdropLog;
              const painter: Brush = {
                ...scenery,
                label: "backdrop painter",
                content: [{ type: "text", text: [world, `THE PLACE: ${place.about || place.id}`, `THE LIGHT: ${light}`, BACKDROP_BRIEF, stageFor({ ...req, page: { ...req.page, characters: ["a", "b"] } }), "Output the SVG markup now."].join("\n\n") }],
              };
              let svg = "";
              for await (const c of expandStream(brushStrokes(painter, stop, backdropLog, why), { ...expandCtx({ x0: 85, x1: 315, y0: 75, y1: 250 }), pageSeed: hashOf(key) }, newStats())) {
                svg += c;
                live.push(c);
                wake();
              }
              return svg;
            },
            { ttlS: 30 * 86_400, waitMs: 120_000 },
          );
          void backdrop.then(
            () => ((settled = true), wake()),
            () => ((settled = true), wake()),
          );
          yield `<g transform="translate(${Math.round((200 - 200 * zoom + dx) * 10) / 10} ${Math.round(240 * (1 - zoom) * 10) / 10}) scale(${zoom})">`;
          for (;;) {
            const more = new Promise<void>((r) => (wake = r));
            while (live.length) yield live.shift()!;
            if (settled) break;
            await more;
          }
          const whole = await backdrop;
          // (reused, or made by another page: all of it now)
          if (!made) yield whole;
          yield "</g>";
          notes.backdrop = prepared ? "prepared ahead" : made ? "painted for this page, kept for the others" : "reused";
          if (reuse.codeLayer) {
            // (this page's own sky and foreground, made in code)
            notes.pageLayer = "made in code";
            const layer = codePageLayer({ place: place.about || place.id, picture: req.page.picture, light, season, seed: `${req.storyId ?? ""}|${req.page.text}` });
            yield* expandStream((async function* () { yield layer; })(), expandCtx(stageBox(req)), stats);
            return;
          }
          const pageLayer: Brush = {
            ...scenery,
            label: "page-layer painter",
            content: [{ type: "text", text: [world, `THE PLACE: ${place.about || place.id}`, PAGE_LAYER_BRIEF, previous, `THIS PAGE'S TEXT: ${req.page.text}`, `THE MOMENT BEING PAINTED: ${req.page.picture}`, stageFor(req), `Painted by the other hand, so NOT by you: ${[...req.cast.map((c) => c.name), req.page.action && !req.cast.some((c) => c.id === req.page.action!.target) ? `the ${req.page.action.target} (unless it is part of the place's change)` : ""].filter(Boolean).join(", ")}. Output the SVG markup now.`].filter(Boolean).join("\n\n") }],
          };
          (logs as Record<string, Record<string, unknown>>).pageLayer = logs.scenery;
          yield* expandStream(brushStrokes(pageLayer, stop, logs.scenery, why), expandCtx(stageBox(req)), stats);
        }
      : sceneryStrokes;
    for await (const strokes of inLayers(under, characterStrokes, signal)) {
      log.firstStrokeMs ??= Date.now() - began;
      yield strokes;
    }
  } catch (err) {
    log.error = signal?.aborted ? "reader left" : err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 200) : "unknown";
    throw err;
  } finally {
    log.totalMs = Date.now() - began;
    if (reuse.stamps || reuse.parts) log.reuse = stats;
    console.info("painting", JSON.stringify(log));
  }
}

// ---------------------------------------------------------------- characters

/** How far a character design has got, for the waiting screen: thinking it
 *  through, writing the model sheet, then painting (with the number of
 *  brush strokes - SVG shapes - laid down so far). */
export type CharacterProgress = { stage: "thinking" } | { stage: "sheet" } | { stage: "painting"; shapes: number };

/** The design request, streamed so progress can be reported as it goes
 *  (the reply is JSON in schema order: name, look, then the svg). */
async function streamCharacterDesign(user: string | Anthropic.Beta.BetaContentBlockParam[], onProgress?: (p: CharacterProgress) => void, signal?: AbortSignal) {
  const stream = getClient().beta.messages.stream({
    model: CHARACTER_MODEL,
    // (plenty of room: at high effort it thinks at length before it paints,
    // and a design cut off at the limit fails outright - in testing one in
    // nine designs ran past 24k)
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: characterDesignerPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: CHARACTER_EFFORT, format: betaZodOutputFormat(CharacterDesignSchema) },
  }, { signal });
  const usage = streamUsageTracker("character", CHARACTER_MODEL, { label: "character designer", effort: CHARACTER_EFFORT });
  let text = "";
  let stage: CharacterProgress["stage"] | null = null;
  let shapes = 0;
  onProgress?.({ stage: "thinking" });
  try {
    for await (const event of stream) {
      usage.see(event);
      if (event.type === "content_block_start" && event.content_block.type === "text") {
        text = "";
        continue;
      }
      if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
      text += event.delta.text;
      const svgAt = text.indexOf('"svg"');
      if (svgAt < 0) {
        if (stage !== "sheet") onProgress?.({ stage: (stage = "sheet") });
        continue;
      }
      // Count the shapes painted so far (each element opens with "<" plus a
      // letter); report every few so the stream stays light.
      const n = (text.slice(svgAt).match(/<[a-z]/g) || []).length;
      if (stage !== "painting" || n >= shapes + 3) {
        stage = "painting";
        shapes = n;
        onProgress?.({ stage: "painting", shapes });
      }
    }
  } catch (err) {
    usage.fail(err, signal?.aborted ? "Stopped by the parent." : undefined);
    throw err;
  } finally {
    usage.finish();
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new StoryRefusal("The storyteller couldn't design that one.");
  if (final.stop_reason === "max_tokens") throw new Error("The painting came out jumbled. Please try again.");
  const lastText = [...final.content].reverse().find((b) => b.type === "text");
  return CharacterDesignSchema.parse(JSON.parse(lastText && lastText.type === "text" ? lastText.text : text));
}

/** A quick art-director pass over the parent's description (see
 *  characterBriefPrompt): a clear, fuller brief for the designer that keeps
 *  everything they said. If it fails, the design simply goes ahead from
 *  their own words. */
const BRIEF_MODEL = process.env.TALEO_BRIEF_MODEL || "claude-sonnet-5-5";
/** The photo as the model takes it. */
const photoBlock = (p: NonNullable<CharacterRequest["photo"]>): Anthropic.Beta.BetaImageBlockParam => ({
  type: "image",
  source: { type: "base64", media_type: p.type, data: p.data },
});

/** The photo didn't show one clear subject to paint (or nothing in it
 *  matched the description): the message is for the parent. */
export class PhotoProblem extends Error {
  constructor(message: string) {
    super(`${PHOTO_PROBLEM}${message}`);
  }
}

async function characterBrief(req: CharacterRequest): Promise<string | null> {
  const about = [
    req.name ? `Their name: ${req.name}` : "",
    req.current ? `They already exist - their current model sheet: ${req.current.look}` : "",
    req.current?.notes ? `Who they are (from their family): ${req.current.notes}` : "",
    req.current?.relationships ? `Their relationships (from their family): ${req.current.relationships}` : "",
    `The parent's description${req.current ? " of how they should look now" : ""}: "${req.description}"`,
  ]
    .filter(Boolean)
    .join("\n");
  const usage = streamUsageTracker("character", BRIEF_MODEL, { label: "art director's brief", effort: "low" });
  try {
    const res = await getClient().beta.messages.create({
      model: BRIEF_MODEL,
      max_tokens: 1500,
      system: characterBriefPrompt(Boolean(req.photo)),
      messages: [{ role: "user", content: req.photo ? [photoBlock(req.photo), { type: "text", text: about }] : about }],
      output_config: { effort: "low" },
    });
    usage.whole(res);
    const text = res.content.find((b) => b.type === "text");
    let brief = text && text.type === "text" ? text.text.trim() : "";
    if (req.photo) {
      // (its first line says whether the photo could be used)
      const verdict = /^PHOTO:\s*(OK|UNCLEAR)\b[:\s-]*(.*)$/im.exec(brief.split("\n")[0] ?? "");
      if (verdict?.[1].toUpperCase() === "UNCLEAR") {
        throw new PhotoProblem(verdict[2].trim().slice(0, 240) || "We couldn't find one clear subject in that photo to paint.");
      }
      brief = brief.replace(/^PHOTO:.*\n?/i, "").trim();
    }
    return brief.length > 40 ? brief.slice(0, 3000) : null;
  } catch (err) {
    if (err instanceof PhotoProblem) {
      usage.finish();
      throw err;
    }
    usage.fail(err);
    usage.finish();
    console.error("[character] brief failed - designing from the parent's words", err);
    return null;
  }
}

export async function designCharacter(req: CharacterRequest, onProgress?: (p: CharacterProgress) => void, signal?: AbortSignal): Promise<CharacterResponse> {
  onProgress?.({ stage: "thinking" });
  const brief = await characterBrief(req);
  const briefNote = brief
    ? `\nOur art director's brief, expanding on that (the parent's own words above always win if anything differs): ${brief}`
    : "";
  const user = req.current
    ? `Redraw this existing character, named "${req.name ?? ""}"${genderNote({ gender: req.current.gender ?? null })}.` +
      `\nTheir current model sheet: ${req.current.look}` +
      (req.current.notes ? `\nWho they are (from their family): ${req.current.notes}` : "") +
      (req.current.relationships ? `\nTheir relationships (from their family): ${req.current.relationships}` : "") +
      `\nTheir description is now: "${req.description}". Redraw them to match it. Anything it doesn't mention stays as in the current model sheet (kind, colours, markings, accessories, personality), so they're clearly still the same character.` +
      briefNote +
      `\nReturn the same name, the updated model sheet ("look") and a new reference painting ("svg").`
    : `Design this character: "${req.description}".${
        req.name ? ` Their name is "${req.name}".` : " Give them a short, fun name."
      }${briefNote}\nReturn the name, the model sheet ("look") and the reference painting ("svg").`;
  signal?.throwIfAborted();
  // With a photo, the designer sees it too: the brief carries its colours
  // and features in words, the picture itself everything words miss.
  const photoNote =
    "\nA photo of them is attached. Paint its main subject (the one the description is about): follow its colours, markings, proportions and distinctive features as closely as you can, as a storybook watercolour character in our style - not a photographic likeness. The parent's words win wherever they differ from the photo.";
  const out = await streamCharacterDesign(req.photo ? [photoBlock(req.photo), { type: "text", text: user + photoNote }] : user, onProgress, signal);
  const svg = sanitizeSvg(out.svg);
  return {
    character: {
      id: "hero",
      name: (req.name?.trim() || out.name).slice(0, 40),
      look: out.look.slice(0, 600),
      preset: svg ? null : "star",
      svg: svg || null,
    },
  };
}
