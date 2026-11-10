import { NextResponse } from "next/server";
import { hasApiKey, paintPage, SlowPainter, StoryRefusal } from "@/server/claude";
import { reportError } from "@/server/alerts";
import { parseIllustrateRequest } from "@/server/validate";
import { composePainting } from "@/lib/art/compose";
import { guard } from "@/server/limits";
import { limitsFor } from "@/lib/tiers";
import { inLegacyGrace, pageIsSigned } from "@/server/tickets";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { count, withMetricsUser } from "@/server/metrics";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Streams one painted page as raw SVG markup. The stream ends with a marker
 * comment so the browser knows whether the painting finished:
 *   <!--taleo:done-->  or  <!--taleo:error-->
 */
export async function POST(req: Request) {
  const parsed = parseIllustrateRequest(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Nothing to paint." }, { status: 400 });
  const g = await guard(async (session) => {
    // Only the storyteller's own pages are painted: the page must carry the
    // signature it was given when it was written for this account...
    if (!limitsFor(session.user).verified || pageIsSigned(session.user.id, parsed.page, parsed.sig)) return "illustrate";
    // ...or be a page of a book this account already has in the library
    // (books from before pages were signed, being repainted)...
    if (parsed.storyId) {
      const book = await getGalleryStory(parsed.storyId).catch(() => null);
      if (book?.authorId === session.user.id && allPages(book).some((p) => p.text === parsed.page.text)) return "illustrate";
    }
    // ...or, for a short while, a story begun before signing existed.
    if (inLegacyGrace()) return "illustrate";
    return NextResponse.json({ error: "That page can't be painted." }, { status: 403 });
  });
  if (!g.ok) return g.response;
  // The quick painter takes the pages a reader waits on at the start of each
  // part (the story's beginning, and after every decision) - how many is
  // set by the plan; the rest get the main painter.
  const quickPages = limitsFor(g.session.user).quickPages;
  // A second go at a page (its first painting failed, or stalled and was
  // given up on) goes to the quick painter too: whatever troubled the main
  // one, the reader has waited long enough, and it costs less.
  parsed.quick = parsed.retry === true || (parsed.pageInPart !== undefined && parsed.pageInPart < quickPages);

  // If the reader leaves (closes the tab, moves to another page), stop the
  // model straight away: nobody will receive the rest, so finishing it
  // would only spend tokens on a result that's thrown away.
  const stop = new AbortController();
  req.signal.addEventListener("abort", () => stop.abort(), { once: true });
  const encoder = new TextEncoder();
  const body = withMetricsUser(g.session.user.id, () => new ReadableStream<Uint8Array>({
    cancel() {
      stop.abort();
    },
    async start(controller) {
      const send = (s: string) => {
        if (!stop.signal.aborted) controller.enqueue(encoder.encode(s));
      };
      try {
        if (!hasApiKey()) {
          // Demo mode: compose the picture and "paint" it in a few strokes.
          const svg = composePainting(parsed.page, parsed.cast);
          const chunks = svg.split(/(?=<g )/);
          for (const c of chunks) {
            send(c);
            await new Promise((r) => setTimeout(r, 220));
          }
        } else {
          for await (const delta of paintPage(parsed, stop.signal)) send(delta);
        }
        send("\n<!--taleo:done-->");
        if (hasApiKey()) count({ paintings: 1, paintings_quick: parsed.quick ? 1 : 0 });
      } catch (err) {
        // (a painter too slow to begin isn't a failure to report: the page
        // is asked for again at once and the quick painter takes it)
        const slow = err instanceof SlowPainter;
        if (!stop.signal.aborted) count(slow ? { paintings_slow: 1 } : { paintings_failed: 1 });
        console.error("illustration failed", err);
        if (!stop.signal.aborted && !slow && !(err instanceof StoryRefusal)) await reportError("painting", err);
        send("\n<!--taleo:error-->");
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  }));

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
