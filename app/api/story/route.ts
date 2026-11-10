import { NextResponse } from "next/server";
import { hasApiKey, StoryRefusal, streamSegment, type SegmentEvent } from "@/server/claude";
import { reportError } from "@/server/alerts";
import { errorResponse } from "@/server/errors";
import { mockSegment } from "@/server/mock";
import { parseStoryRequest } from "@/server/validate";
import { auth } from "@/server/auth";
import { guard, limitMessage, peekLimit } from "@/server/limits";
import { limitsFor } from "@/lib/tiers";
import { inLegacyGrace, signPage, storyTicket, storyTicketIsValid } from "@/server/tickets";
import type { Page } from "@/lib/types";
import { count, withMetricsUser } from "@/server/metrics";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Can the signed-in user begin a new story right now? (Checked by the
 *  setup wizard before it creates the story, so nobody ends up with an
 *  empty draft when they've hit the limit.) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ canStart: false, error: "Please sign in to make stories." }, { status: 401 });
  const { ok, retryAfterSec } = await peekLimit(session.user, "story");
  return NextResponse.json({
    canStart: ok,
    retryAfterSec,
    error: ok ? undefined : limitMessage(session.user, "story", retryAfterSec),
  });
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as { ticket?: unknown } | null;
  const parsed = parseStoryRequest(raw);
  if (!parsed) return NextResponse.json({ error: "That story request looks incomplete." }, { status: 400 });

  // A new story uses the plan's story allowance; continuing one already
  // started uses the (generous) segment cap - provided it really is a story
  // this account began: the request must carry the ticket the server gave
  // out with the part before. Anything else that calls itself a
  // continuation is counted as what it is, a new story.
  const g = await guard((session) => {
    if (parsed.kind === "start") return "story";
    if (!limitsFor(session.user).verified || storyTicketIsValid(session.user.id, parsed.story, raw?.ticket)) return "segment";
    // (for a short while, stories begun before tickets existed carry on)
    return inLegacyGrace() ? "segment" : "story";
  });
  if (!g.ok) return g.response;
  const userId = g.session.user.id;
  // Everything sent out is signed for this account: each page (to be
  // painted and published later), and the story so far (to ask for the
  // next part).
  const signed = (pages: Page[]) => pages.map((p) => ({ ...p, sig: signPage(userId, p) }));
  const soFar = parsed.kind === "start" ? { age: parsed.age, minutes: parsed.minutes, theme: parsed.theme, segments: [] } : parsed.story;
  const stamp = (event: SegmentEvent): SegmentEvent => {
    if (event.type === "pages") return { ...event, pages: signed(event.pages) };
    if (event.type !== "done") return event;
    const r = event.response;
    const segment = { ...r.segment, pages: signed(r.segment.pages) };
    const ticket = r.ending ? undefined : storyTicket(userId, { ...soFar, segments: [...soFar.segments, segment] });
    return { ...event, response: { ...r, segment, ticket } };
  };

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
  const body = withMetricsUser(userId, () => new ReadableStream<Uint8Array>({
    cancel() {
      stop.abort();
    },
    async start(controller) {
      const send = (event: SegmentEvent | { type: "error"; error: string }) => {
        if (!stop.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event.type === "error" ? event : stamp(event)) + "\n"));
      };
      try {
        if (!hasApiKey()) {
          // Demo mode: the templated storyteller, "written" page by page.
          const seg = mockSegment(parsed);
          if (seg.title) {
            await new Promise((r) => setTimeout(r, 700));
            send({ type: "title", title: seg.title });
          }
          for (let i = 1; i <= seg.segment.pages.length; i++) {
            await new Promise((r) => setTimeout(r, i === 1 ? 900 : 700));
            send({ type: "pages", newCharacters: seg.newCharacters, pages: seg.segment.pages.slice(0, i) });
          }
          send({ type: "done", response: { ...seg, demo: true } });
        } else {
          for await (const event of streamSegment(parsed, stop.signal)) {
            send(event);
            if (event.type === "done") {
              const pages = event.response.segment.pages;
              count({
                stories_started: parsed.kind === "start" ? 1 : 0,
                segments: 1,
                pages: pages.length,
                words: pages.reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0),
                stories_finished: event.response.ending ? 1 : 0,
              });
            }
          }
        }
      } catch (err) {
        if (!stop.signal.aborted && !(err instanceof StoryRefusal)) await reportError("story writing", err, { kind: parsed.kind });
        await g.release(); // a story that failed to write doesn't count
        const data = (await errorResponse(err).json().catch(() => ({}))) as { error?: string };
        send({ type: "error", error: data.error || "The story got stuck. Let's try again!" });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  }));
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
