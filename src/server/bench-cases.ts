import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { streamUsageTracker } from "./metrics";

/**
 * New test pages for the painting bench (admin only), written by the
 * model: a set that differs from each other and from the pages the bench
 * already has - in place, light, season, camera, how many characters, what
 * they do and feel, and whether there's something to tap.
 */
const MODEL = process.env.TALEO_BENCH_CASES_MODEL || "claude-sonnet-5-5";
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const Case = z.object({
  label: z.string().describe("a short name for the bench, 2-6 words, saying what this case tests (e.g. 'Rainy window, two friends')"),
  text: z.string().describe("the page's words, as in a picture book for small children: 1-2 short sentences"),
  picture: z.string().describe("the illustration brief: the camera (close-up, mid shot or wide shot), where everyone is and what they do, the place's landmarks and which side they're on, the light"),
  characters: z.array(z.string()).describe("names of the characters in the picture, from the list given, the main one first (0 to 3)"),
  place: z.object({
    id: z.string().describe("a short slug for the place, e.g. 'pond-reeds'; reuse one only to make pages that happen in the same place"),
    about: z.string().describe("the place as it always is: its landmarks and which side each one is on"),
    light: z.enum(["day", "golden", "dusk", "night", "rain"]),
  }),
  camera: z.enum(["close", "mid", "wide"]),
  action: z
    .object({ word: z.string().describe("one word from the page's text that is tapped"), target: z.string().describe("who or what acts it out: a character's name, or a thing in the picture") })
    .nullable()
    .describe("the tappable word and what acts it out, or null for none"),
});
const Cases = z.object({ cases: z.array(Case) });
export type BenchCase = z.infer<typeof Case>;

export async function generateBenchCases(o: { count: number; characters: { name: string; look: string }[]; existing: { label: string; picture: string }[] }): Promise<BenchCase[]> {
  const count = Math.max(1, Math.min(20, Math.round(o.count)));
  const usage = streamUsageTracker("story", MODEL, { label: "bench test cases", effort: "low" });
  try {
    const res = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: `You write test pages for a children's picture-book app's illustration test bench. Each test page is one page of a gentle bedtime picture book: its words, and a brief for the watercolour illustration. The bench compares several ways of painting the same page, so the pages must exercise the painter widely.

Make the set DIVERSE - no two pages alike, and none like the existing ones:
- places: meadows, woods, gardens, ponds and rivers, beaches, snowy hills, villages and lanes, and indoors (kitchens, bedrooms, a classroom, a library, a burrow, a treehouse); a few pages set in the same place as each other, to test a place reused over several pages
- light and weather: day, golden evening, dusk, night (moon, lanterns, stars), rain; the seasons
- camera: close-ups (faces, hands, something small held), mid shots, wide shots with characters small in the landscape
- cast: some pages with nobody, one character, two, or three; characters only from the list given
- what they do: walking, running, jumping, sitting, sleeping, hugging, reaching, carrying, playing, splashing, climbing, waving, hiding; and how they feel: joy, surprise, worry, sleepiness, pride, shyness, giggles
- props and effects: things held, things falling or flying, splashes, sparkles, leaves, kites, lanterns, books, food
- a tappable action on about two thirds of the pages (a verb in the text, acted out by a character or a thing), none on the rest
Keep everything gentle and age-appropriate.`,
      messages: [
        {
          role: "user",
          content: `CHARACTERS AVAILABLE (use these names exactly):\n${o.characters.map((c) => `- ${c.name}: ${c.look.slice(0, 140)}`).join("\n")}\n\nEXISTING TEST PAGES (do not repeat them):\n${o.existing.map((e) => `- ${e.label}: ${e.picture.slice(0, 140)}`).join("\n") || "(none)"}\n\nWrite ${count} new test pages.`,
        },
      ],
      output_config: { effort: "low", format: betaZodOutputFormat(Cases) },
    });
    usage.whole(res);
    return (res.parsed_output?.cases ?? []).slice(0, count);
  } catch (e) {
    usage.fail(e);
    throw e;
  } finally {
    usage.finish();
  }
}
