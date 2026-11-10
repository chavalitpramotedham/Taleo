import { after, NextResponse } from "next/server";
import { hasApiKey, paintPage, paintsInLayers, SlowPainter, StoryRefusal } from "@/server/claude";
import { reportError } from "@/server/alerts";
import { parseIllustrateRequest } from "@/server/validate";
import { composePainting } from "@/lib/art/compose";
import { guard } from "@/server/limits";
import { limitsFor, tierFor } from "@/lib/tiers";
import { inLegacyGrace, pageIsSigned } from "@/server/tickets";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { count, withMetricsUser } from "@/server/metrics";
import { auth } from "@/server/auth";
import { beginGen, logDenied } from "@/server/genlog";

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
  // (for the activity log: what was asked, of which painter)
  const logged = (user: { id: string } | undefined, tier?: string) => ({
    kind: "painting" as const,
    sub: `page ${(parsed.pageInPart ?? 0) + 1} of its part${parsed.quick ? ", quick painter" : ", main painter"}${parsed.retry ? ", second go" : ""}${paintsInLayers(parsed) ? ", in layers" : ""}`,
    what: parsed.page.text,
    userId: user?.id ?? null,
    tier,
    storyId: parsed.storyId,
    req,
    request: parsed,
    mock: !hasApiKey(),
  });
  if (!g.ok) {
    await logDenied(logged((await auth())?.user), g.response);
    return g.response;
  }
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
  const gen = beginGen(logged(g.session.user, tierFor(g.session.user).name));
  let svg = "";
  const body = withMetricsUser(g.session.user.id, () => gen.run(() => new ReadableStream<Uint8Array>({
    cancel() {
      stop.abort();
    },
    async start(controller) {
      const send = (s: string) => {
        if (stop.signal.aborted) return;
        controller.enqueue(encoder.encode(s));
        gen.sent(s.length);
      };
      const paint = (s: string) => {
        svg += s;
        send(s);
      };
      const shapes = () => `${(svg.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b/g) || []).length} shapes`;
      try {
        if (!hasApiKey()) {
          // Demo mode: compose the picture and "paint" it in a few strokes.
          const chunks = composePainting(parsed.page, parsed.cast).split(/(?=<g )/);
          for (const c of chunks) {
            paint(c);
            await new Promise((r) => setTimeout(r, 220));
          }
        } else {
          for await (const delta of paintPage(parsed, stop.signal)) paint(delta);
        }
        const left = stop.signal.aborted;
        send("\n<!--taleo:done-->");
        if (hasApiKey()) count({ paintings: 1, paintings_quick: parsed.quick ? 1 : 0 });
        // (a reader who left got no picture, whatever was painted)
        await gen.end(left ? "left" : "ok", { summary: left ? `${shapes()} painted before the reader left` : shapes(), result: svg });
      } catch (err) {
        // (a painter too slow to begin isn't a failure to report: the page
        // is asked for again at once and the quick painter takes it)
        const slow = err instanceof SlowPainter;
        if (!stop.signal.aborted) count(slow ? { paintings_slow: 1 } : { paintings_failed: 1 });
        console.error("illustration failed", err);
        const left = stop.signal.aborted;
        if (!left && !slow && !(err instanceof StoryRefusal)) await reportError("painting", err);
        send("\n<!--taleo:error-->");
        await gen.end(left ? "left" : slow ? "slow" : err instanceof StoryRefusal ? "refused" : "error", {
          error: left ? "The reader left (or their page gave up waiting) before it finished." : err,
          summary: `${shapes()} painted`,
          result: svg || undefined,
        });
      } finally {
        await gen.end("error", { error: "Ended without an answer." });
        try {
          controller.close();
        } catch {}
      }
    },
  })));
  // (the log's last line is written even if the reader has gone)
  after(() => gen.done);

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
