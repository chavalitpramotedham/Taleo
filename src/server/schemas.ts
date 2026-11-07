import { z } from "zod";
import { PRESETS } from "@/lib/presets";
import { MOTIONS, SOUNDS } from "@/lib/actions";

const presetKeys = PRESETS.map((p) => p.key) as [string, ...string[]];

export const PageSchema = z.object({
  text: z.string().describe("The words read aloud on this page."),
  aside: z
    .string()
    .nullable()
    .describe("Optional narrator aside, used to playfully respond to the reader's own idea. Null otherwise."),
  picture: z
    .string()
    .describe(
      "Illustrator's brief for this page's full-page painting (2-4 sentences): the single most dynamic moment, what each character is physically doing with their whole body, their expressions, where they are looking, key objects, setting details, camera (close-up / mid / wide, low or high angle) and composition.",
    ),
  characters: z.array(z.string()).describe("Ids of characters visible in the picture ('hero' and/or side-character ids)"),
  action: z
    .object({
      word: z
        .string()
        .describe("The page's key word, exactly as it appears in the text: one simple, concrete word a child can learn (a verb like 'jump' or a noun like 'duck'/'puddle')."),
      target: z
        .string()
        .describe("What the child taps in the picture to act out the word: a character id ('hero' or a side-character id) or a short object name ('puddle', 'kite')."),
      sound: z.enum(SOUNDS).describe("The sound effect that matches the action or object"),
      motion: z.enum(MOTIONS).describe("How the target moves when tapped"),
    })
    .describe("The one action or event this page is about, made tappable in the picture."),
});

export const NewCharacterSchema = z.object({
  id: z.string().describe("short lowercase id, e.g. 'duckling' or 'grandma'"),
  name: z.string(),
  look: z
    .string()
    .describe("Model sheet: species/kind, exact colours as hex codes, markings, size relative to the hero, clothing or accessories, personality"),
  preset: z.enum(presetKeys).nullable().describe("Reuse a preset character's look if it fits exactly, else null"),
});

export const SegmentSchema = z.object({
  title: z.string().describe("Story title (first segment only; empty string afterwards)"),
  world: z
    .string()
    .describe("First segment only (empty afterwards): art direction for the whole book in 1-2 sentences: place, season, time of day, light, signature colours"),
  newCharacters: z.array(NewCharacterSchema).describe("Side characters introduced in this segment (empty if none)"),
  pages: z.array(PageSchema),
  choice: z
    .object({
      prompt: z.string().describe("A question to the child, e.g. 'What should Pip do?'"),
      options: z.array(z.object({ label: z.string() })),
    })
    .nullable(),
  ending: z.boolean(),
});

export const CharacterDesignSchema = z.object({
  name: z.string(),
  look: z.string().describe("Model sheet: kind, exact hex colours, markings, proportions, accessories, personality"),
  svg: z.string().describe("Reference painting, layered SVG markup for a 200x200 canvas"),
});

export type SegmentOut = z.infer<typeof SegmentSchema>;
