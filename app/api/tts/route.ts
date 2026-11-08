import { NextResponse } from "next/server";
import { cachedClip, speechClip, ttsEnabled, type TtsKind } from "@/server/tts";
import { auth } from "@/server/auth";
import { guard } from "@/server/limits";
import { getGalleryStory } from "@/server/gallery";

export const runtime = "nodejs";

const MAX_CHARS = 800;

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

/** Every word that could be read aloud from a published story: its pages,
 *  asides, words to learn, choice prompts and options, plus the little
 *  joining words the reader adds ("or", "the end"). */
async function publishedStoryWords(storyId: string): Promise<Set<string> | null> {
  const story = await getGalleryStory(storyId).catch(() => null);
  if (!story) return null;
  const parts: string[] = ["or the end"];
  for (const seg of story.segments) {
    for (const p of seg.pages) parts.push(p.text, p.aside ?? "", p.action?.word ?? "");
    if (seg.choice) parts.push(seg.choice.prompt, ...seg.choice.options.map((o) => o.label));
  }
  return new Set(parts.flatMap(words));
}

const audio = (clip: Buffer) =>
  new Response(new Uint8Array(clip), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
  });

/**
 * GET /api/tts                    -> { enabled }: is a neural voice configured?
 * GET /api/tts?t=…&k=page&s=<id>  -> the phrase as MP3 (k = "page" | "word").
 *
 * Who may make NEW clips (each costs money): signed-in users, within their
 * read-aloud cap; signed-out readers only for words of the published story
 * they're reading (`s`). Clips that already exist are served to anyone -
 * they cost nothing. Anything refused falls back to the device's own voice
 * in the browser.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("t") || "").replace(/\s+/g, " ").trim();
  if (!text) return NextResponse.json({ enabled: ttsEnabled() });
  if (!ttsEnabled()) return NextResponse.json({ error: "Neural voice isn't configured." }, { status: 501 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: "Too long." }, { status: 413 });
  const kind: TtsKind = url.searchParams.get("k") === "word" ? "word" : "page";

  try {
    const existing = await cachedClip(text, kind);
    if (existing) return audio(existing);

    const session = await auth();
    if (session?.user?.id) {
      const g = await guard("tts");
      if (!g.ok) return g.response;
      try {
        return audio(await speechClip(text, kind));
      } catch (e) {
        await g.release();
        throw e;
      }
    }

    // Signed out: only the words of the published story being read.
    const storyId = url.searchParams.get("s");
    const allowed = storyId && /^[\w-]{1,80}$/.test(storyId) ? await publishedStoryWords(storyId) : null;
    if (!allowed || !words(text).every((w) => allowed.has(w))) {
      return NextResponse.json({ error: "Sign in to hear this read aloud." }, { status: 401 });
    }
    return audio(await speechClip(text, kind));
  } catch (e) {
    console.error("[tts]", e);
    return NextResponse.json({ error: "Couldn't make that clip." }, { status: 502 });
  }
}
