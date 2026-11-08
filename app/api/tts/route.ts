import { NextResponse } from "next/server";
import { speechClip, ttsEnabled, type TtsKind } from "@/server/tts";

export const runtime = "nodejs";

const MAX_CHARS = 800;

/** GET /api/tts            -> { enabled }: is the neural voice configured?
 *  GET /api/tts?t=…&k=page -> the phrase as MP3 (k = "page" | "word").
 *  Clips never change for the same text, so they're cached hard (browser
 *  and CDN) on top of the server-side cache. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("t") || "").replace(/\s+/g, " ").trim();
  if (!text) return NextResponse.json({ enabled: ttsEnabled() });
  if (!ttsEnabled()) return NextResponse.json({ error: "Neural voice isn't configured." }, { status: 501 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: "Too long." }, { status: 413 });
  const kind: TtsKind = url.searchParams.get("k") === "word" ? "word" : "page";
  try {
    const audio = await speechClip(text, kind);
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[tts]", e);
    return NextResponse.json({ error: "Couldn't make that clip." }, { status: 502 });
  }
}
