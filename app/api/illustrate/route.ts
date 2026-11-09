import { NextResponse } from "next/server";
import { hasApiKey, paintPage, StoryRefusal } from "@/server/claude";
import { reportError } from "@/server/alerts";
import { parseIllustrateRequest } from "@/server/validate";
import { composePainting } from "@/lib/art/compose";
import { guard } from "@/server/limits";
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
  const g = await guard("illustrate");
  if (!g.ok) return g.response;
  // The quick painter takes the pages a reader waits on at the start of each
  // part (the story's beginning, and after every decision): the first two
  // on the Free plan, just the first for the admin; the rest get the main
  // painter.
  const quickPages = g.session.user.isAdmin ? 1 : 2;
  parsed.quick = parsed.pageInPart !== undefined && parsed.pageInPart < quickPages;

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
        if (!stop.signal.aborted) count({ paintings_failed: 1 });
        console.error("illustration failed", err);
        if (!stop.signal.aborted && !(err instanceof StoryRefusal)) await reportError("painting", err);
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
