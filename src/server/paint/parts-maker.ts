import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { characterArt } from "@/lib/presets";
import { PRESET_PARTS, type CharacterParts, type PartView } from "@/lib/art/parts";
import { hashOf } from "@/lib/art/stamps";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import type { CharacterDef } from "@/lib/types";
import { streamUsageTracker } from "../metrics";
import { once } from "./once";

/**
 * A character's parts (see lib/art/parts), for one without hand-made ones:
 * its existing reference portrait regrouped - not redrawn - into the head
 * and the body, with the places where its limbs and face go. The shapes
 * are copied from the portrait as they are (same coordinates, same
 * colours), so the character looks exactly as the family knows it.
 *
 * Done once per portrait, by the quick model, and kept (see once). A
 * character it can't be done for is simply painted in full.
 */

const MODEL = process.env.TALEO_PARTS_MODEL || "claude-sonnet-5-5";
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const Pt = z.object({ x: z.number(), y: z.number() });
const Shapes = z.object({
  paint: z.string().describe("the part's watercolour fill shapes, as SVG elements (no wrapping group)"),
  ink: z.string().describe("the part's pen lines, as SVG elements (no wrapping group)"),
  detail: z.string().describe("the part's small crisp marks that are not the face, as SVG elements (often empty)"),
});
const PartsSchema = z.object({
  facing: z.enum(["front", "right", "left"]).describe("which way the portrait's head and body face"),
  head: Shapes,
  torso: Shapes,
  anchors: z.object({
    neck: Pt,
    shoulderNear: Pt,
    shoulderFar: Pt,
    hipNear: Pt,
    hipFar: Pt,
    eyeNear: Pt,
    eyeFar: Pt,
    mouth: Pt,
  }),
  colours: z.object({
    limb: z.string().describe("hex: the arms and legs (fur, skin, or the sleeves and trousers they wear)"),
    limbFar: z.string().describe("hex: the far-side limbs, a shade darker"),
    hand: z.string().describe("hex: hands or paws"),
    foot: z.string().describe("hex: feet, paws or shoes"),
    footPad: z.string().describe("hex: a pale pad or the top of the foot, or the same as foot"),
    mouth: z.string().describe("hex: the inside of the mouth"),
    cheek: z.string().describe("hex: the cheeks' blush"),
  }),
  limbs: z.object({
    arm: z.number().describe("arm length against an ordinary cute storybook figure: 1 normal, 0.8 short, 1.3 long"),
    leg: z.number().describe("leg thickness: 1 normal, 0.8 slim, 1.3 chunky"),
    foot: z.number().describe("foot length: 1 normal, 1.8 long rabbit feet"),
  }),
  build: z.string().describe("one sentence: how its arms, legs, hands or paws, feet and eyes are drawn"),
});

const SYSTEM = `You regroup an existing character portrait (layered watercolour SVG on a 200x200 canvas, feet on the ground at about y 190) into reusable PARTS, so the character can be posed again on every page of a picture book without being redrawn. You do NOT redraw or restyle anything: you copy the portrait's own shapes, with their exact coordinates, colours and attributes, into the right part. The family must not be able to tell any difference.

THE PARTS
- head: everything of the head that stays the same from page to page - the skull or head shape, ears, hair, muzzle or snout and nose, beak, markings on the head, glasses, hats and anything worn on the head, and the soft shadow it casts on the chest. NOT the face: leave out the eyes and eye highlights, eyebrows, the mouth, tongue and teeth, and blush or cheeks - those are drawn afresh on every page.
- torso: the body - body shape, belly or chest, clothing, markings on the body, anything worn on the body, the tail (kept as it is), and the body's form shading. NOT the arms, hands, paws, legs or feet (drawn afresh in every pose), and NOT anything held.
- Each part has paint (fills), ink (pen lines) and detail (small crisp marks) shapes, taken from the portrait's own paint, ink and detail groups. Output plain SVG elements, no wrapping <g>.

MAKE THEM JOIN WELL
- The torso must be whole underneath where the arms, legs and head overlapped it: if the portrait's body shape had a bite taken out by a limb, or ended where the head began, extend that shape (same colour) so it is complete. Run the top of the torso up underneath the head as a short neck, so the head always sits on the body with no gap.
- Leave the pen contours OPEN where limbs and the head join (no outline across the shoulders, hips or neck): drop or shorten any pen line that ran across those joins.
- Keep everything on the 200x200 canvas exactly where it was.

ANCHORS (points on the 200x200 canvas, as seen in the portrait; "near" is the side nearer the viewer, or the viewer's left for a front-on figure): the neck pivot (where the head turns), both shoulders and both hips (where arms and legs attach), the centres of both eyes, and the mouth.
COLOURS: the exact hex values for the limbs (fur or skin, clothing on the arms and legs), hands or paws, feet or shoes, and the face (mouth, cheeks), copied from the portrait. LIMBS: its proportions, so limbs made for it look like its own.`;

/** Turns the model's answer into parts, or null if it can't be used. */
function toParts(out: z.infer<typeof PartsSchema>): CharacterParts | null {
  const piece = (s: { paint: string; ink: string; detail: string }) => ({ paint: sanitizeSvg(s.paint, 30000), ink: sanitizeSvg(s.ink, 30000), detail: sanitizeSvg(s.detail, 30000) });
  const head = piece(out.head);
  const torso = piece(out.torso);
  if (head.paint.length < 40 || torso.paint.length < 40) return null;
  const p = (q: { x: number; y: number }): [number, number] => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10];
  const a = out.anchors;
  const view: PartView = {
    head,
    torso,
    facesLeft: out.facing === "left",
    anchors: { neck: p(a.neck), shoulderL: p(a.shoulderNear), shoulderR: p(a.shoulderFar), hipL: p(a.hipNear), hipR: p(a.hipFar), eyeL: p(a.eyeNear), eyeR: p(a.eyeFar), mouth: p(a.mouth) },
  };
  const hex = (v: string, d: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const k = out.colours;
  const limb = hex(k.limb, "#A98463");
  const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 1);
  return {
    colours: { "arms and legs": limb, "far limbs": hex(k.limbFar, limb), "hands or paws": hex(k.hand, limb), feet: hex(k.foot, limb), mouth: hex(k.mouth, "#6E3B32"), cheeks: hex(k.cheek, "#E7A99A") },
    roles: { limb, limbFar: hex(k.limbFar, limb), hand: hex(k.hand, limb), foot: hex(k.foot, limb), footPad: hex(k.footPad, hex(k.foot, limb)), eye: "#2A1E15", mouth: hex(k.mouth, "#6E3B32"), tongue: "#C9786E", cheek: hex(k.cheek, "#E7A99A"), arm: clamp(out.limbs.arm, 0.6, 1.6), leg: clamp(out.limbs.leg, 0.6, 1.6), foot_: clamp(out.limbs.foot, 0.6, 2.2) },
    build: out.build.slice(0, 300),
    views: out.facing === "front" ? { front: view } : { three: view },
  };
}

async function regroup(c: CharacterDef): Promise<CharacterParts | null> {
  const art = characterArt(c);
  if (!art) return null;
  const usage = streamUsageTracker("painting", MODEL, { label: "parts maker", effort: "low", thinking: "off (between tools only)" });
  try {
    const res = await getClient().beta.messages.parse({
      model: MODEL,
      // (under the SDK's ceiling for a reply that isn't streamed - about
      // 21,000: above it the request is refused before it's sent. A
      // portrait's parts are well under this.)
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `CHARACTER: ${c.name}. Model sheet: ${c.look}\n\nTHE PORTRAIT (200x200):\n${art}\n\nRegroup it into parts.` }],
      thinking: { type: "between_tools" } as never,
      output_config: { effort: "low", format: betaZodOutputFormat(PartsSchema) },
    });
    usage.whole(res);
    return res.parsed_output ? toParts(res.parsed_output) : null;
  } catch (e) {
    usage.fail(e);
    console.warn("parts maker: couldn't regroup", c.name, e instanceof Error ? e.message : e);
    return null;
  } finally {
    usage.finish();
  }
}

/** A character's parts: hand-made for the presets that have them, else
 *  regrouped from its portrait (once, then kept). Null: paint it in full. */
export async function partsFor(c: CharacterDef): Promise<CharacterParts | null> {
  if (c.preset && PRESET_PARTS[c.preset] && !c.svg) return PRESET_PARTS[c.preset];
  const art = characterArt(c);
  if (!art) return null;
  const p = once(`parts:v1:${hashOf(art)}:${art.length}`, () => regroup(c), { ttlS: 90 * 86_400, waitMs: 90_000 });
  inFlight.add(p);
  void p.finally(() => inFlight.delete(p)).catch(() => {});
  return p;
}

/** Parts still being made: a page that stopped waiting for them hands
 *  this to after(), so they're finished and kept for the next page. */
const inFlight = new Set<Promise<unknown>>();
export const partsInFlight = (): Promise<unknown> => Promise.allSettled([...inFlight]);
