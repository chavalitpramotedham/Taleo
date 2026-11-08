import { NextResponse } from "next/server";
import { hasApiKey, streamSegment, type SegmentEvent } from "@/server/claude";
import { errorResponse } from "@/server/errors";
import { mockSegment } from "@/server/mock";
import { parseStoryRequest } from "@/server/validate";
import { auth } from "@/server/auth";
import { guard, isUnlimited, LIMIT_MESSAGES, minutesText, peekLimit } from "@/server/limits";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Can the signed-in user begin a new story right now? (Checked by the
 *  setup wizard before it creates the story, so nobody ends up with an
 *  empty draft when they've hit the limit.) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ canStart: false, error: "Please sign in to make stories." }, { status: 401 });
  if (isUnlimited(session)) return NextResponse.json({ canStart: true, retryAfterSec: 0 });
  const { ok, retryAfterSec } = await peekLimit(session.user.id, "story");
  return NextResponse.json({
    canStart: ok,
    retryAfterSec,
    error: ok ? undefined : LIMIT_MESSAGES.story(minutesText(retryAfterSec)),
  });
}

export async function POST(req: Request) {
  const parsed = parseStoryRequest(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "That story request looks incomplete." }, { status: 400 });

  // A new story uses the 1-per-30-minutes allowance; continuing one already
  // started uses the (generous) segment cap.
  const g = await guard(parsed.kind === "start" ? "story" : "segment");
  if (!g.ok) return g.response;

  // Streams newline-delimited JSON events: {type:"pages"} each time another
  // page is ready (so the reader can start on page 1 while the rest is
  // still being written), then {type:"done"} with the finished segment, or
  // {type:"error"}.
  // If the reader leaves (closes the tab, moves to another page), stop the
  // model straight away: nobody will receive the rest, so finishing it
  // would only spend tokens on a result that's thrown away.
  const stop = new AbortController();
  req.signal.addEventListener("abort", () => stop.abort(), { once: true });
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      stop.abort();
    },
    async start(controller) {
      const send = (event: SegmentEvent | { type: "error"; error: string }) => {
        if (!stop.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        if (!hasApiKey()) {
          // Demo mode: the templated storyteller, "written" page by page.
          const seg = mockSegment(parsed);
          for (let i = 1; i <= seg.segment.pages.length; i++) {
            await new Promise((r) => setTimeout(r, i === 1 ? 900 : 700));
            send({ type: "pages", newCharacters: seg.newCharacters, pages: seg.segment.pages.slice(0, i) });
          }
          send({ type: "done", response: { ...seg, demo: true } });
        } else {
          for await (const event of streamSegment(parsed, stop.signal)) send(event);
        }
      } catch (err) {
        await g.release(); // a story that failed to write doesn't count
        const data = (await errorResponse(err).json().catch(() => ({}))) as { error?: string };
        send({ type: "error", error: data.error || "The story got stuck. Let's try again!" });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
