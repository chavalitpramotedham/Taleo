import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { characterArt } from "@/lib/presets";
import { hashOf } from "@/lib/art/stamps";
import { SPRITE_POSES, SPRITE_POSE_IDS, type Sprite, type SpritePose } from "@/lib/art/sprites";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import type { CharacterDef } from "@/lib/types";
import { streamUsageTracker } from "../metrics";
import { kept, once } from "./once";

/**
 * A character's pre-painted poses (see lib/art/sprites): each painted once,
 * from the character's own portrait, and kept - so a page can place the
 * character in a pose without painting it. Made ahead ("Prepare poses" on
 * the bench), never while a reader waits.
 */
const MODEL = process.env.TALEO_SPRITE_MODEL || "claude-sonnet-5-5";
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const SpriteSchema = z.object({
  paint: z.string().describe("the watercolour fill shapes, as SVG elements (no wrapping group)"),
  ink: z.string().describe("the pen lines, as SVG elements (no wrapping group)"),
  detail: z.string().describe("small crisp marks: eye dots and highlights, tiny details (often short)"),
});

const SYSTEM = `You paint one character of a Taleo picture book in a given POSE, as layered watercolour SVG on a 200x200 canvas. You are given the character's reference portrait: keep EVERYTHING about how it looks - its exact colours (same hex values), markings, clothing, proportions, face and signature features - so the family can't tell it from the portrait. Only the pose changes: the body, limbs, head turn, ears and tail move naturally into it, with real weight and a clear line of action.
- Canvas: 200x200. Feet (or bottom, when sitting or lying) on the ground at about y 190, the character centred on x 100. Facing three-quarters to the viewer's RIGHT. Fill most of the height when standing.
- Layers: paint = the soft watercolour fills (body, clothing, limbs, form shading, a faint ground shadow); ink = the fine sepia pen lines (contours, a few fur or fabric marks); detail = the small crisp marks (eye dots with a white highlight, nose shine, tiny details).
- Nothing else: no background, no ground line, no props, no other characters.
- Whole-number coordinates. Keep it economical: about as many shapes as the portrait.`;

const spriteKey = (art: string, pose: SpritePose) => `sprite:v1:${hashOf(art)}:${art.length}:${pose}`;

async function paintSprite(c: CharacterDef, pose: SpritePose): Promise<Sprite | null> {
  const art = characterArt(c);
  if (!art) return null;
  const usage = streamUsageTracker("painting", MODEL, { label: "pose painter", effort: "medium" });
  try {
    const res = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            // (the portrait first and cached: every pose of a character repeats it)
            { type: "text", text: `CHARACTER: ${c.name}. Model sheet: ${c.look}\n\nREFERENCE PORTRAIT (200x200):\n${art}`, cache_control: { type: "ephemeral" } },
            { type: "text", text: `POSE: ${SPRITE_POSES[pose]}.\n\nPaint ${c.name} in this pose now.` },
          ],
        },
      ],
      output_config: { effort: "medium", format: betaZodOutputFormat(SpriteSchema) },
    });
    usage.whole(res);
    const out = res.parsed_output;
    if (!out) return null;
    const sprite = { paint: sanitizeSvg(out.paint, 40000), ink: sanitizeSvg(out.ink, 40000), detail: sanitizeSvg(out.detail, 20000) };
    return sprite.paint.length > 40 ? sprite : null;
  } catch (e) {
    usage.fail(e);
    console.warn("pose painter: couldn't paint", c.name, pose, e instanceof Error ? e.message : e);
    return null;
  } finally {
    usage.finish();
  }
}

/** Makes (once) and keeps one pose of a character. */
export async function prepareSprite(c: CharacterDef, pose: SpritePose): Promise<boolean> {
  const art = characterArt(c);
  if (!art) return false;
  const made = await once(spriteKey(art, pose), () => paintSprite(c, pose), { ttlS: 365 * 86_400, waitMs: 120_000, nothingTtlS: 600 });
  return Boolean(made);
}

/** A character's poses that are ready (never makes any). */
export async function spritesFor(c: CharacterDef): Promise<Partial<Record<SpritePose, Sprite>>> {
  const art = characterArt(c);
  if (!art) return {};
  const got = await Promise.all(SPRITE_POSE_IDS.map(async (p) => [p, await kept<Sprite>(spriteKey(art, p))] as const));
  return Object.fromEntries(got.filter(([, s]) => s)) as Partial<Record<SpritePose, Sprite>>;
}
