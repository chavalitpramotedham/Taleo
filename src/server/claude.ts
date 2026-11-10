import Anthropic from "@anthropic-ai/sdk";
import { streamUsageTracker, type AiFeature } from "./metrics";
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
import { characterBriefPrompt, characterDesignerPrompt, illustratorPrompt, LAYERED_CHARACTERS, sceneryPrompt, writerPrompt } from "./prompts";
import { CharacterDesignSchema, NewCharacterSchema, PageSchema, SegmentSchema, type SegmentOut } from "./schemas";

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
 *  to the smaller model at low effort, without thinking first, while the
 *  page's ordinary painter does only the characters: the quick painter at
 *  its usual effort on quick pages, the main painter on the rest.
 *  TALEO_SCENERY_MODEL / TALEO_SCENERY_EFFORT override the scenery. */
const SCENERY_MODEL = process.env.TALEO_SCENERY_MODEL || "claude-sonnet-5-5";
const SCENERY_EFFORT = (process.env.TALEO_SCENERY_EFFORT as Effort) || "low";
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
  if (heroes.some((h) => h.notes || h.relationships)) {
    parts.push(
      "Honour the FAMILY NOTES and RELATIONSHIPS above throughout this segment: let each character's personality and, above all, any relationship between them show in what they say and do together. The relationships must be exactly as given (who is whose sister, parent, grandparent, friend) - never swapped, changed or contradicted.",
    );
  }
  parts.push(`WORD LEVEL for this reader (each page's word to learn): ${age.vocab}`);
  const taught = [...new Set(segments.flatMap((sg) => sg.pages.map((p) => p.action?.word?.trim().toLowerCase()).filter(Boolean)))];
  if (taught.length) parts.push(`WORDS ALREADY TAUGHT in this book (don't reuse these or other forms of them): ${taught.join(", ")}`);
  if (cast.length) parts.push(`SUPPORTING CAST SO FAR:\n${cast.map(modelSheet).join("\n")}`);

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
      look: (preset && !c.look ? preset.look : c.look).slice(0, 600),
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
  /** Paint without thinking first (Sonnet 5.5's thinking-off setting). */
  unthinking: boolean;
  /** How long it may take to lay its first stroke (0: however long). */
  clockMs: number;
  system: string;
  content: Anthropic.Beta.BetaTextBlockParam[];
}

/** Streams one painter's strokes. What happened is noted on `log`. */
async function* brushStrokes(
  brush: Brush,
  signal: AbortSignal | undefined,
  log: Record<string, unknown>,
  /** Why the signal was thrown, when it wasn't the reader leaving. */
  stoppedBy?: () => string | undefined,
): AsyncGenerator<string> {
  const { model } = brush;
  let unthinking = brush.unthinking;
  const began = Date.now();
  let strokes = 0;
  for (;;) {
    // (this go's own switch: thrown by the reader leaving, or by the
    // first-stroke clock)
    const go = new AbortController();
    const leave = () => go.abort();
    signal?.addEventListener("abort", leave, { once: true });
    if (signal?.aborted) go.abort();
    let late = false;
    const clock = brush.clockMs
      ? setTimeout(() => {
          late = true;
          go.abort();
        }, brush.clockMs)
      : undefined;
    const usage = streamUsageTracker("painting", model, {
      label: brush.label,
      effort: brush.effort,
      thinking: unthinking ? "off (between tools only)" : "the model's own",
    });
    try {
      const stream = getClient().beta.messages.stream(
        {
          model,
          max_tokens: 32000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: brush.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: brush.content }],
          ...(unthinking ? { thinking: { type: "between_tools" as const } } : {}),
          output_config: { effort: brush.effort },
        },
        { signal: go.signal },
      );
      for await (const event of stream) {
        usage.see(event);
        if (event.type === "message_start") log.acceptedMs ??= Date.now() - began;
        else if (event.type === "message_delta") log.out = event.usage.output_tokens;
        else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          if (!strokes++) {
            clearTimeout(clock);
            log.firstStrokeMs = Date.now() - began;
          }
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      log.stop = final.stop_reason;
      if (final.stop_reason === "refusal") throw new StoryRefusal("The illustrator couldn't paint that one.");
      // (a painting cut off at the token limit is not a painting: without
      // this it would be sent on as finished, half a picture)
      if (final.stop_reason === "max_tokens") throw new Error("The painting ran out of room before it was finished.");
      return;
    } catch (err) {
      usage.fail(err, signal?.aborted ? (stoppedBy?.() ?? "The reader left (or their page gave up waiting).") : late ? `No first stroke after ${brush.clockMs / 1000}s: given up on.` : undefined);
      if (late && !signal?.aborted) throw new SlowPainter(`No first stroke from ${model} after ${brush.clockMs / 1000}s.`);
      // (should the thinking-off setting ever be turned away, paint the
      // page the ordinary way rather than not at all)
      if (unthinking && !strokes && !signal?.aborted && err instanceof Anthropic.BadRequestError) {
        console.warn("painting: thinking-off setting refused, painting with thinking", err.message);
        unthinking = false;
        log.thinkingOffRefused = true;
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
 *  If either fails the other is stopped and the failure is the picture's. */
type Layer = (stop: AbortSignal, why: () => string | undefined) => AsyncGenerator<string>;
async function* inLayers(under: Layer, over: Layer, signal?: AbortSignal): AsyncGenerator<string> {
  const stop = new AbortController();
  const leave = () => stop.abort();
  signal?.addEventListener("abort", leave, { once: true });
  if (signal?.aborted) stop.abort();
  let failed = false;
  let failure: unknown;
  // (a painter stopped because the other failed, not because anyone left)
  const why = () => (failed && !signal?.aborted ? "Stopped: the picture's other layer failed." : undefined);
  const down: string[] = [];
  const held: string[] = [];
  const ended = { under: false, over: false };
  let wake = () => {};
  const work = async (layer: Layer, into: string[], which: "under" | "over") => {
    try {
      for await (const strokes of layer(stop.signal, why)) {
        into.push(strokes);
        wake();
      }
      ended[which] = true;
    } catch (err) {
      if (!failed) {
        failed = true;
        failure = err;
        stop.abort();
      }
    } finally {
      wake();
    }
  };
  const both = Promise.all([work(under, down, "under"), work(over, held, "over")]);
  try {
    for (;;) {
      // (made before looking, so nothing that happens while strokes are
      // being sent on is missed)
      const more = new Promise<void>((r) => (wake = r));
      if (failed) throw failure;
      while (down.length) yield down.shift()!;
      if (ended.under) {
        while (held.length) yield held.shift()!;
        if (ended.over && !down.length && !held.length) return;
      }
      if (failed) throw failure;
      await more;
    }
  } finally {
    // (the reader's page stopped listening, or one layer failed: neither
    // painter goes on alone)
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

/** Streams the SVG markup of one painted page. */
export async function* paintPage(req: IllustrateRequest, signal?: AbortSignal): AsyncGenerator<string> {
  const sheet = (c: CharacterDef) => {
    const art = referenceArt(c);
    return `CHARACTER "${c.id}": ${c.name}${genderNote(c)}\nModel sheet: ${c.look}${art ? `\nReference painting (neutral pose, 200x200 canvas):\n${art}` : ""}`;
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
    `Characters in the picture: ${req.page.characters.join(", ") || "none"}. Keep each one's exact colours, signature features and proportions from their sheet. Output the SVG markup now.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: world },
    ...central.map((c): Anthropic.Beta.BetaTextBlockParam => ({ type: "text", text: sheet(c), cache_control: { type: "ephemeral" } })),
    { type: "text", text: rest },
  ];

  const model = req.quick ? QUICK_ART_MODEL : ART_MODEL;
  const main: Brush = {
    model,
    effort: req.quick ? QUICK_ART_EFFORT : layered ? LAYER_CHARACTERS_EFFORT : ART_EFFORT,
    label: layered ? "character painter" : req.quick ? "quick painter" : "main painter",
    unthinking: Boolean(req.quick) && QUICK_ART_UNTHINKING && model.startsWith("claude-sonnet-5-5"),
    clockMs: req.quick ? 0 : FIRST_STROKE_MS,
    system: illustratorPrompt(),
    content,
  };
  // One line per painting in the server log: which painter, how long until
  // the request was taken up, until the first stroke, and in all.
  const began = Date.now();
  const log: Record<string, unknown> = { model, quick: Boolean(req.quick), retry: Boolean(req.retry) };
  try {
    if (!layered) {
      yield* brushStrokes(main, signal, log);
      return;
    }
    // In layers: the scenery painter never sees the character sheets (it
    // paints none of them), so its request is small and it starts at once.
    const scenery: Brush = {
      model: SCENERY_MODEL,
      effort: SCENERY_EFFORT,
      label: "scenery painter",
      unthinking: QUICK_ART_UNTHINKING && SCENERY_MODEL.startsWith("claude-sonnet-5-5"),
      clockMs: FIRST_STROKE_MS,
      system: sceneryPrompt(),
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
    const logs = { scenery: { model: scenery.model } as Record<string, unknown>, characters: {} as Record<string, unknown> };
    Object.assign(log, { layered: true, ...logs });
    for await (const strokes of inLayers(
      (stop, why) => brushStrokes(scenery, stop, logs.scenery, why),
      (stop, why) => brushStrokes(main, stop, logs.characters, why),
      signal,
    )) {
      log.firstStrokeMs ??= Date.now() - began;
      yield strokes;
    }
  } catch (err) {
    log.error = signal?.aborted ? "reader left" : err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 200) : "unknown";
    throw err;
  } finally {
    log.totalMs = Date.now() - began;
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
async function streamCharacterDesign(user: string, onProgress?: (p: CharacterProgress) => void, signal?: AbortSignal) {
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
      system: characterBriefPrompt(),
      messages: [{ role: "user", content: about }],
      output_config: { effort: "low" },
    });
    usage.whole(res);
    const text = res.content.find((b) => b.type === "text");
    const brief = text && text.type === "text" ? text.text.trim() : "";
    return brief.length > 40 ? brief.slice(0, 2500) : null;
  } catch (err) {
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
  const out = await streamCharacterDesign(user, onProgress, signal);
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
