import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ageById } from "@/lib/ages";
import { presetByKey } from "@/lib/presets";
import type {
  CharacterDef,
  CharacterRequest,
  CharacterResponse,
  CustomProp,
  Page,
  SegmentResponse,
  StoryRequest,
} from "@/lib/types";
import { ART_RULES, systemPrompt } from "./prompts";
import { CharacterDesignSchema, SegmentSchema, type SegmentOut } from "./schemas";
import { stripUnsafeSvg } from "./sanitize";

const MODEL = process.env.TALEO_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high";
const EFFORT = (process.env.TALEO_EFFORT as Effort) || "low";

export const hasApiKey = () =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export class StoryRefusal extends Error {}

async function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  maxTokens = 16000,
): Promise<z.infer<T>> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") {
    throw new StoryRefusal("The storyteller couldn't write that one.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The story came out jumbled. Please try again.");
  }
  return response.parsed_output as z.infer<T>;
}

// ---------------------------------------------------------------- stories

const clamp = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : (lo + hi) / 2;

function describeCast(hero: CharacterDef, cast: CharacterDef[]) {
  const line = (c: CharacterDef) =>
    `- id "${c.id}": ${c.name} — ${c.description}${c.preset ? ` (preset look: ${c.preset})` : " (custom look)"}`;
  return [line(hero), ...cast.map(line)].join("\n");
}

export async function generateSegment(req: StoryRequest): Promise<SegmentResponse> {
  const isStart = req.kind === "start";
  const age = ageById(isStart ? req.age : req.story.age);
  const hero = isStart ? req.hero : req.story.hero;
  const cast = isStart ? [] : req.story.cast;
  const theme = isStart ? req.theme : req.story.theme;
  const segments = isStart ? [] : req.story.segments;
  const totalSegments = age.choices + 1;
  const index = segments.length + 1; // 1-based segment being written
  const isLast = index >= totalSegments;

  const parts: string[] = [];
  parts.push(`READER AGE: ${age.label} years (age id ${age.id}). Follow that age guide closely.`);
  parts.push(`THEME: ${theme}`);
  parts.push(`CHARACTERS SO FAR:\n${describeCast(hero, cast)}`);
  if (!isStart && req.story.customProps.length) {
    parts.push(`CUSTOM PROPS AVAILABLE: ${req.story.customProps.map((p) => p.key).join(", ")}`);
  }

  if (isStart) {
    parts.push(
      `Write segment 1 of ${totalSegments}: give the story a short, catchy title, introduce ${hero.name} (id "hero") in a lively opening, set up the theme, and end on an exciting moment with a choice for the child.`,
    );
  } else {
    const story = segments
      .map((s, i) => {
        const text = s.pages.map((p) => p.text).join("\n");
        const chosen = s.chosen
          ? `\n>> The child ${s.chosen.custom ? "TYPED THEIR OWN IDEA" : "chose"}: "${s.chosen.text}"`
          : "";
        return `[Segment ${i + 1}]\n${text}${chosen}`;
      })
      .join("\n\n");
    parts.push(`STORY SO FAR (title "${req.story.title}"):\n${story}`);
    const last = segments[segments.length - 1]?.chosen;
    if (last?.custom) {
      parts.push(
        `The child typed their own idea: "${last.text}". Decide if it fits the story world. If yes, run with it joyfully. If not, use "aside" on the first page to respond playfully and steer back to a positive, relevant plot.`,
      );
    }
    parts.push(
      isLast
        ? `Write segment ${index} of ${totalSegments}, the FINAL segment: show what happens because of the choice, then bring the story to a warm, satisfying ending (a cosy, happy last page). Set choice to null and ending to true.`
        : `Write segment ${index} of ${totalSegments}: show the result of the choice, add a fun new twist, and end with a new choice for the child. Set ending to false.`,
    );
  }
  parts.push(
    `Use ${age.pagesPerSegment[0]}-${age.pagesPerSegment[1]} pages, ${age.words[0]}-${age.words[1]} words per page${
      isLast ? "" : `, and exactly ${age.optionCount} choice options`
    }.`,
  );

  const out = await ask(SegmentSchema, systemPrompt(), parts.join("\n\n"));
  return normalizeSegment(out, { isLast, existingIds: ["hero", ...cast.map((c) => c.id)], optionCount: age.optionCount });
}

function normalizeSegment(
  out: SegmentOut,
  opts: { isLast: boolean; existingIds: string[]; optionCount: number },
): SegmentResponse {
  const taken = new Set(opts.existingIds);
  const idMap: Record<string, string> = {};
  const newCharacters: CharacterDef[] = [];
  for (const c of out.newCharacters.slice(0, 4)) {
    let id = (c.id || c.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "friend";
    const original = c.id;
    while (taken.has(id)) id += "2";
    taken.add(id);
    idMap[original] = id;
    const preset = presetByKey(c.preset) ? c.preset : null;
    const svg = preset ? null : stripUnsafeSvg(c.svg ?? "");
    newCharacters.push({
      id,
      name: c.name.slice(0, 40),
      description: c.description.slice(0, 200),
      preset: preset ?? (svg ? null : "star"),
      svg: svg || null,
      face: preset || !svg ? null : { x: clamp(c.faceX, 20, 180), y: clamp(c.faceY, 20, 180), size: clamp(c.faceSize, 20, 100) },
    });
  }

  const newProps: CustomProp[] = out.newProps
    .slice(0, 4)
    .map((p) => ({ key: p.key.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 30), svg: stripUnsafeSvg(p.svg) }))
    .filter((p) => p.key && p.svg);

  const pages: Page[] = out.pages.slice(0, 7).map((p) => ({
    text: p.text.trim(),
    sound: p.sound?.trim() ? p.sound.trim().slice(0, 16) : null,
    aside: p.aside?.trim() ? p.aside.trim() : null,
    setting: p.setting,
    time: p.time,
    weather: p.weather,
    characters: p.characters
      .map((c) => ({ ...c, id: idMap[c.id] ?? c.id, x: clamp(c.x, 5, 95) }))
      .filter((c) => taken.has(c.id))
      .slice(0, 4),
    props: p.props.slice(0, 8).map((pr) => ({
      kind: pr.kind.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      x: clamp(pr.x, 3, 97),
      y: clamp(pr.y, 8, 98),
      size: pr.size,
    })),
  }));

  let choice = out.choice;
  if (opts.isLast) choice = null;
  if (choice) {
    choice = {
      prompt: choice.prompt.trim(),
      options: choice.options.slice(0, Math.max(2, opts.optionCount)),
    };
  }

  return {
    title: out.title?.trim() || undefined,
    newCharacters,
    newProps,
    segment: { pages, choice, chosen: null },
    ending: opts.isLast || (!choice && out.ending),
  };
}

// ---------------------------------------------------------------- characters

export async function designCharacter(req: CharacterRequest): Promise<CharacterResponse> {
  const system = `You are the character designer for Taleo, a watercolour picture-book app for toddlers and pre-schoolers. You turn a child's or parent's description into one adorable, kid-friendly character that matches a set of cute, pastel, rounded preset characters (a bunny, a bear cub, a strawberry, a teapot, a cloud...).

If the description is unsafe, scary or inappropriate for small children, design the closest cute, friendly version instead (e.g. "scary monster" becomes a fluffy, smiling little monster).

${ART_RULES}`;
  const user = `Design this character: "${req.description}".${
    req.name ? ` Their name is "${req.name}".` : " Give them a short, fun name."
  }\nReturn the name, a one-sentence look-and-personality description, the body svg, and the face anchor.`;

  const out = await ask(CharacterDesignSchema, system, user, 12000);
  const svg = stripUnsafeSvg(out.svg);
  return {
    character: {
      id: "hero",
      name: (req.name?.trim() || out.name).slice(0, 40),
      description: out.description.slice(0, 200),
      preset: svg ? null : "star",
      svg: svg || null,
      face: { x: clamp(out.faceX, 20, 180), y: clamp(out.faceY, 20, 180), size: clamp(out.faceSize, 20, 100) },
    },
  };
}
