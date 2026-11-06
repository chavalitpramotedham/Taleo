import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ageById } from "@/lib/ages";
import { characterArt, presetByKey } from "@/lib/presets";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import type {
  CharacterDef,
  CharacterRequest,
  CharacterResponse,
  IllustrateRequest,
  Page,
  SegmentResponse,
  StoryRequest,
} from "@/lib/types";
import { characterDesignerPrompt, illustratorPrompt, writerPrompt } from "./prompts";
import { CharacterDesignSchema, SegmentSchema, type SegmentOut } from "./schemas";

type Effort = "low" | "medium" | "high";
const STORY_MODEL = process.env.TALEO_MODEL || "claude-opus-5-5";
const ART_MODEL = process.env.TALEO_ART_MODEL || STORY_MODEL;
const STORY_EFFORT = (process.env.TALEO_EFFORT as Effort) || "low";
const ART_EFFORT = (process.env.TALEO_ART_EFFORT as Effort) || "low";

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export class StoryRefusal extends Error {}

async function ask<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens = 16000): Promise<z.infer<T>> {
  const response = await getClient().beta.messages.parse({
    model: STORY_MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: STORY_EFFORT, format: betaZodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") throw new StoryRefusal("The storyteller couldn't write that one.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The story came out jumbled. Please try again.");
  }
  return response.parsed_output as z.infer<T>;
}

// ---------------------------------------------------------------- stories

const modelSheet = (c: CharacterDef) =>
  `- id "${c.id}": ${c.name}: ${c.look}${c.preset ? ` (preset: ${c.preset})` : ""}`;

export async function generateSegment(req: StoryRequest): Promise<SegmentResponse> {
  const isStart = req.kind === "start";
  const age = ageById(isStart ? req.age : req.story.age);
  const hero = isStart ? req.hero : req.story.hero;
  const cast = isStart ? [] : req.story.cast;
  const theme = isStart ? req.theme : req.story.theme;
  const segments = isStart ? [] : req.story.segments;
  const totalSegments = age.choices + 1;
  const index = segments.length + 1;
  const isLast = index >= totalSegments;

  const parts: string[] = [];
  parts.push(`READER AGE: ${age.label} years (age id ${age.id}). Follow that age guide closely.`);
  parts.push(`THEME: ${theme}`);
  if (!isStart && req.story.world) parts.push(`BOOK ART DIRECTION: ${req.story.world}`);
  parts.push(`CHARACTERS SO FAR:\n${[hero, ...cast].map(modelSheet).join("\n")}`);

  if (isStart) {
    parts.push(
      `Write segment 1 of ${totalSegments}: give the story a short, charming title and the book's art direction ("world"), introduce ${hero.name} (id "hero") in a lively opening, set up the theme, and end on an exciting moment with a choice for the child.`,
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
        ? `Write segment ${index} of ${totalSegments}, the FINAL segment: show what happens because of the choice, then bring the story to a warm, satisfying ending (a cosy, happy last page). Set choice to null and ending to true. Leave title and world empty.`
        : `Write segment ${index} of ${totalSegments}: show the result of the choice, add a fun new twist, and end with a new choice for the child. Set ending to false. Leave title and world empty.`,
    );
  }
  parts.push(
    `Use ${age.pagesPerSegment[0]}-${age.pagesPerSegment[1]} pages, ${age.words[0]}-${age.words[1]} words per page${isLast ? "" : `, and exactly ${age.optionCount} choice options`}.`,
  );

  const out = await ask(SegmentSchema, writerPrompt(), parts.join("\n\n"));
  return normalizeSegment(out, { isLast, existingIds: ["hero", ...cast.map((c) => c.id)], optionCount: age.optionCount });
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
    newCharacters,
    segment: { pages, choice, chosen: null },
    ending: opts.isLast || (!choice && out.ending),
  };
}

// ---------------------------------------------------------------- illustrations

/** Streams the SVG markup of one painted page. */
export async function* paintPage(req: IllustrateRequest): AsyncGenerator<string> {
  const sheets = req.cast
    .map((c) => {
      const art = characterArt(c);
      return `CHARACTER "${c.id}": ${c.name}\nModel sheet: ${c.look}${art ? `\nReference painting (neutral pose, 200x200 canvas):\n${art.trim()}` : ""}`;
    })
    .join("\n\n");

  const user = [
    `BOOK ART DIRECTION: ${req.world || "a gentle English countryside in late summer, soft golden light"}`,
    sheets || "No characters in this picture.",
    req.previous ? `PREVIOUS PAGE'S PICTURE (for continuity of place and light): ${req.previous}` : "",
    `THIS PAGE'S TEXT: ${req.page.text}`,
    `PAINT THIS MOMENT: ${req.page.picture}`,
    `Characters in the picture: ${req.page.characters.join(", ") || "none"}. Output the SVG markup now.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = getClient().beta.messages.stream({
    model: ART_MODEL,
    max_tokens: 20000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: illustratorPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: ART_EFFORT },
  });

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
  const out = await ask(CharacterDesignSchema, characterDesignerPrompt(), user, 12000);
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
