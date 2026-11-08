import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ageById, lengthProfile } from "@/lib/ages";
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
  SegmentResponse,
  StoryRequest,
} from "@/lib/types";
import { characterDesignerPrompt, illustratorPrompt, writerPrompt } from "./prompts";
import { CharacterDesignSchema, NewCharacterSchema, PageSchema, SegmentSchema, type SegmentOut } from "./schemas";

type Effort = "low" | "medium" | "high";
const STORY_MODEL = process.env.TALEO_MODEL || "claude-opus-5-5";
const ART_MODEL = process.env.TALEO_ART_MODEL || STORY_MODEL;
const STORY_EFFORT = (process.env.TALEO_EFFORT as Effort) || "low";
const ART_EFFORT = (process.env.TALEO_ART_EFFORT as Effort) || "low";
/** Designing a new character runs at high effort: their reference painting
 *  and model sheet are shown to the painter on every page they appear in,
 *  so getting them right once pays off across the whole book. */
const CHARACTER_EFFORT = (process.env.TALEO_CHARACTER_EFFORT as Effort) || "high";

/** False in demo mode (no key), or when TALEO_MOCK=1 forces the templated
 *  storyteller and painter - handy for testing flows without real stories. */
export const hasApiKey = () =>
  process.env.TALEO_MOCK !== "1" && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export class StoryRefusal extends Error {}

async function ask<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens = 16000, effort: Effort = STORY_EFFORT): Promise<z.infer<T>> {
  const response = await getClient().beta.messages.parse({
    model: STORY_MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
  });
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
  `${modelSheet(c)}${c.notes ? `\n  FAMILY NOTES about ${c.name}: "${c.notes.replace(/\s+/g, " ").trim()}"` : ""}`;

/** The writer's request for the next segment, and how to normalise its reply. */
function buildSegmentRequest(req: StoryRequest) {
  const isStart = req.kind === "start";
  const age = ageById(isStart ? req.age : req.story.age);
  const minutes = isStart ? req.minutes : req.story.minutes;
  const { choices, pagesPerSegment } = lengthProfile(age, minutes);
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
  parts.push(`TARGET LENGTH: about ${minutes} minute${minutes === 1 ? "" : "s"} read aloud in total, across ${totalSegments} segments.`);
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
  if (heroes.some((h) => h.notes)) {
    parts.push(
      "Honour the FAMILY NOTES above throughout this segment: let each character's personality and, above all, any relationship between them show in what they say and do together. The relationships must be exactly as the notes say (who is whose sister, parent, grandparent, friend) - never swapped, changed or contradicted.",
    );
  }
  parts.push(`WORD LEVEL for this reader (each page's word to learn): ${age.vocab}`);
  const taught = [...new Set(segments.flatMap((sg) => sg.pages.map((p) => p.action?.word?.trim().toLowerCase()).filter(Boolean)))];
  if (taught.length) parts.push(`WORDS ALREADY TAUGHT in this book (don't reuse these or other forms of them): ${taught.join(", ")}`);
  if (cast.length) parts.push(`SUPPORTING CAST SO FAR:\n${cast.map(modelSheet).join("\n")}`);

  if (isStart) {
    const names = heroes.map((h) => `${h.name} (id "${h.id}")`).join(heroes.length > 1 ? " and " : "");
    parts.push(
      `Write segment 1 of ${totalSegments}: first choose the story's heart ("moral") - one warm lesson that fits the theme (and any family notes) which this book will build to and land at the end. Then give the story a short, charming title and the book's art direction ("world"), introduce ${names} together in a lively opening that hooks the child straight away, plant the situation that will test the heart of the story, and end on an exciting moment with a choice for the child.`,
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
        ? `Write segment ${index} of ${totalSegments}, the FINAL segment: show what happens because of the choice, then LAND THE STORY'S HEART: let the characters live the lesson in a clear moment the child can see (the kind act, the brave try, the honest word), show the happy outcome it brings, and let a character put the lesson into their own simple, warm words before a cosy last page. Set choice to null and ending to true. Leave title, world, moral and keyword empty.`
        : `Write segment ${index} of ${totalSegments}: show the result of the choice, add a fun new twist that keeps the child hooked and moves the characters one step closer to discovering the story's heart, and end with a new choice for the child (at least one option should let them choose the kind, brave or wise path). Set ending to false. Leave title, world, moral and keyword empty.`,
    );
  }
  parts.push(
    `Use ${pagesPerSegment[0]}-${pagesPerSegment[1]} pages, ${age.words[0]}-${age.words[1]} words per page${isLast ? "" : `, and exactly ${age.optionCount} choice options`}.`,
  );

  return {
    user: parts.join("\n\n"),
    norm: { isLast, existingIds: [...heroes.map((h) => h.id), ...cast.map((c) => c.id)], optionCount: age.optionCount },
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
  | { type: "pages"; newCharacters: CharacterDef[]; pages: Page[] }
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
  for await (const event of stream) {
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
    try {
      const newCharacters = chars.items.map((c) => NewCharacterSchema.parse(JSON.parse(c)));
      const pages = pagesSoFar.items.map((p) => PageSchema.parse(JSON.parse(p)));
      const partial = normalizeSegment(
        { title: "", world: "", moral: "", keyword: "", newCharacters, pages, choice: null, ending: false },
        { ...norm, isLast: false },
      );
      sent = pages.length;
      yield { type: "pages", newCharacters: partial.newCharacters, pages: partial.segment.pages };
    } catch {
      // Not parseable yet (or odd) - the final result will carry it.
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new StoryRefusal("The storyteller couldn't write that one.");
  if (final.stop_reason === "max_tokens") throw new Error("The story came out jumbled. Please try again.");
  const lastText = [...final.content].reverse().find((b) => b.type === "text");
  const out = SegmentSchema.parse(JSON.parse(lastText && lastText.type === "text" ? lastText.text : text));
  yield { type: "done", response: normalizeSegment(out, norm) };
}

function normalizeSegment(out: SegmentOut, opts: { isLast: boolean; existingIds: string[]; optionCount: number }): SegmentResponse {
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
      look: (preset && !c.look ? preset.look : c.look).slice(0, 500),
      preset: preset ? preset.key : null,
      svg: null,
    });
  }

  const pages: Page[] = out.pages.slice(0, 7).map((p) => ({
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
    segment: { pages, choice, chosen: null },
    ending: opts.isLast || (!choice && out.ending),
  };
}

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

/** Streams the SVG markup of one painted page. */
export async function* paintPage(req: IllustrateRequest, signal?: AbortSignal): AsyncGenerator<string> {
  const sheets = req.cast
    .map((c) => {
      const art = characterArt(c);
      return `CHARACTER "${c.id}": ${c.name}${genderNote(c)}\nModel sheet: ${c.look}${art ? `\nReference painting (neutral pose, 200x200 canvas):\n${art.trim()}` : ""}`;
    })
    .join("\n\n");

  const user = [
    `BOOK ART DIRECTION: ${req.world || "a gentle English countryside in late summer, soft golden light"}`,
    sheets || "No characters in this picture.",
    req.previous ? `PREVIOUS PAGE'S PICTURE (for continuity of place and light): ${req.previous}` : "",
    `THIS PAGE'S TEXT: ${req.page.text}`,
    `PAINT THIS MOMENT: ${req.page.picture}`,
    req.page.action
      ? `TAP TARGET: "${req.page.action.target}"${req.cast.some((c) => c.id === req.page.action!.target) ? " (the character with that id)" : ""}, acting out the word "${req.page.action.word}". Wrap it in <g class="target">.`
      : "",
    `Characters in the picture: ${req.page.characters.join(", ") || "none"}. Output the SVG markup now.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = getClient().beta.messages.stream({
    model: ART_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: illustratorPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: req.quick ? "low" : ART_EFFORT },
  }, { signal });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new StoryRefusal("The illustrator couldn't paint that one.");
}

// ---------------------------------------------------------------- characters

export async function designCharacter(req: CharacterRequest): Promise<CharacterResponse> {
  const user = `Design this character: "${req.description}".${
    req.name ? ` Their name is "${req.name}".` : " Give them a short, fun name."
  }\nReturn the name, the model sheet ("look") and the reference painting ("svg").`;
  // (more room than other requests: high effort thinks longer before it paints)
  const out = await ask(CharacterDesignSchema, characterDesignerPrompt(), user, 20000, CHARACTER_EFFORT);
  const svg = sanitizeSvg(out.svg);
  return {
    character: {
      id: "hero",
      name: (req.name?.trim() || out.name).slice(0, 40),
      look: out.look.slice(0, 500),
      preset: svg ? null : "star",
      svg: svg || null,
    },
  };
}
