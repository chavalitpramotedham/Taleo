import { NextResponse } from "next/server";
import { cachedClip, chosenVoice, clipMarks, speechClip, ttsEnabled, voiceChoices, type TtsKind } from "@/server/tts";
import { auth } from "@/server/auth";
import { guard } from "@/server/limits";
import { count } from "@/server/metrics";
import { getGalleryStory } from "@/server/gallery";
import { beginGen } from "@/server/genlog";
import { tierFor } from "@/lib/tiers";

export const runtime = "nodejs";

const MAX_CHARS = 800;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** The exact phrases the reader can say aloud for a published story - built
 *  the same way the reader builds them (each page with its aside, each
 *  choice with its options, each word to learn, "The end."). Signed-out
 *  readers may only create clips for these, so nobody can script endless
 *  new combinations of the story's words onto the voice bill. */
async function publishedStoryPhrases(storyId: string): Promise<Set<string> | null> {
  const story = await getGalleryStory(storyId).catch(() => null);
  if (!story) return null;
  const phrases = ["The end."];
  for (const seg of story.segments) {
    for (const p of seg.pages) {
      phrases.push([p.aside, p.text].filter(Boolean).join(" "));
      if (p.action?.word) phrases.push(p.action.word);
    }
    if (seg.choice) phrases.push(`${seg.choice.prompt} ${seg.choice.options.map((o) => o.label).join("? Or ")}?`);
  }
  return new Set(phrases.map(norm));
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
  if (!text) return NextResponse.json({ enabled: ttsEnabled(), voices: voiceChoices() });
  if (!ttsEnabled()) return NextResponse.json({ error: "Neural voice isn't configured." }, { status: 501 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: "Too long." }, { status: 413 });
  const kind: TtsKind = url.searchParams.get("k") === "word" ? "word" : "page";
  // the reader's chosen voice (OpenAI's built-in ones), or the default
  const picked = chosenVoice(url.searchParams.get("v"));
  // made ready before anyone asked to hear it (the page's tappable word as
  // the page opens, the next page while this one is read aloud)
  const ahead = req.headers.get("x-taleo-ahead") === "1";

  // When each word is spoken in the clip (m=1), for lighting the words as
  // they're read: only ever for a clip that exists, kept once worked out.
  if (url.searchParams.get("m") === "1") {
    const starts = await clipMarks(text, kind, picked).catch(() => null);
    if (!starts) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ starts }, { headers: { "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
  }

  // A new clip, made and logged (clips served from the cache aren't: they
  // cost nothing and there'd be one line for every page turned).
  const make = async (user: { id: string } | null, tier?: string) => {
    const gen = beginGen({
      kind: "voice",
      sub: `${kind === "word" ? "a word" : "a page"} ${ahead ? "made ready ahead" : "read aloud"}${user ? "" : " (signed-out reader of a published story)"}`,
      what: text,
      cases: [kind === "word" ? "a word" : "a page", picked ? `voice: ${picked}` : "the default voice", user ? "signed in" : "signed-out reader", ahead && "fetched ahead, not tapped"].filter((c): c is string => !!c),
      userId: user?.id ?? null,
      tier,
      storyId: url.searchParams.get("s") || undefined,
      req,
      request: { text, kind, voice: picked },
    });
    try {
      const clip = await speechClip(text, kind, picked);
      gen.sent(clip.length);
      await gen.end("ok", { summary: `${text.length} characters spoken, ${Math.round(clip.length / 1024)} KB of sound` });
      return clip;
    } catch (e) {
      await gen.end("error", { error: e });
      throw e;
    }
  };

  try {
    const existing = await cachedClip(text, kind, picked);
    if (existing) {
      count({ tts_cached: 1 });
      return audio(existing);
    }

    // "Only if it's already made" (o=1): a page being got ready before
    // anyone has asked to hear it. Nothing is made, nothing is counted.
    if (url.searchParams.get("o") === "1") return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

    const session = await auth();
    if (session?.user?.id) {
      const g = await guard("tts");
      if (!g.ok) return g.response;
      try {
        const clip = await make(g.session.user, tierFor(g.session.user).name);
        count({ tts_clips: 1, tts_chars: text.length });
        return audio(clip);
      } catch (e) {
        await g.release();
        throw e;
      }
    }

    // Signed out: only the words of the published story being read.
    const storyId = url.searchParams.get("s");
    const allowed = storyId && /^[\w-]{1,80}$/.test(storyId) ? await publishedStoryPhrases(storyId) : null;
    if (!allowed?.has(norm(text))) {
      return NextResponse.json({ error: "Sign in to hear this read aloud." }, { status: 401 });
    }
    const clip = await make(null);
    count({ tts_clips: 1, tts_chars: text.length });
    return audio(clip);
  } catch (e) {
    console.error("[tts]", e);
    return NextResponse.json({ error: "Couldn't make that clip." }, { status: 502 });
  }
}
