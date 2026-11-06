import { z } from "zod";
import { EXPRESSIONS, POSES, SETTINGS, SIZES, TIMES, WEATHERS } from "@/lib/vocab";
import { PRESETS } from "@/lib/presets";

const presetKeys = PRESETS.map((p) => p.key) as [string, ...string[]];

export const PageSchema = z.object({
  text: z.string().describe("The words read aloud on this page."),
  sound: z
    .string()
    .nullable()
    .describe("Optional short onomatopoeia painted big into the picture, e.g. 'SPLASH!'. Null most of the time."),
  aside: z
    .string()
    .nullable()
    .describe("Optional narrator aside shown in a bubble. Use it to playfully respond to the reader's custom idea. Null otherwise."),
  setting: z.enum(SETTINGS),
  time: z.enum(TIMES),
  weather: z.enum(WEATHERS),
  characters: z.array(
    z.object({
      id: z.string().describe("'hero' or the id of a side character"),
      x: z.number().describe("Horizontal position 0-100"),
      expression: z.enum(EXPRESSIONS),
      pose: z.enum(POSES),
      size: z.enum(SIZES),
      flip: z.boolean().describe("true = facing left"),
    }),
  ),
  props: z.array(
    z.object({
      kind: z.string().describe("A prop from the library, or the key of a custom prop you designed"),
      x: z.number().describe("Horizontal centre 0-100"),
      y: z.number().describe("Vertical position of the prop's bottom edge 0-100 (ground is about 80-92, sky about 15-40)"),
      size: z.enum(SIZES),
    }),
  ),
});

export const NewCharacterSchema = z.object({
  id: z.string().describe("short lowercase id, e.g. 'duck' or 'grandma'"),
  name: z.string(),
  description: z.string().describe("look and personality in one sentence"),
  preset: z.enum(presetKeys).nullable().describe("Reuse a preset look if it fits, else null and draw svg"),
  svg: z.string().nullable().describe("Body art if preset is null (see art rules). Null if preset is used."),
  faceX: z.number(),
  faceY: z.number(),
  faceSize: z.number(),
});

export const SegmentSchema = z.object({
  title: z.string().describe("Story title (first segment only; empty string afterwards)"),
  newCharacters: z.array(NewCharacterSchema).describe("Side characters introduced in this segment (empty if none)"),
  newProps: z
    .array(z.object({ key: z.string(), svg: z.string() }))
    .describe("Custom props for important story objects not in the library (empty if none)"),
  pages: z.array(PageSchema),
  choice: z
    .object({
      prompt: z.string().describe("A question to the child, e.g. 'What should Pip do?'"),
      options: z.array(z.object({ label: z.string(), emoji: z.string() })),
    })
    .nullable(),
  ending: z.boolean(),
});

export const CharacterDesignSchema = z.object({
  name: z.string(),
  description: z.string(),
  svg: z.string(),
  faceX: z.number(),
  faceY: z.number(),
  faceSize: z.number(),
});

export type SegmentOut = z.infer<typeof SegmentSchema>;
export type CharacterDesignOut = z.infer<typeof CharacterDesignSchema>;
