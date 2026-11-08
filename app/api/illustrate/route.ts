import { NextResponse } from "next/server";
import { hasApiKey, paintPage } from "@/server/claude";
import { parseIllustrateRequest } from "@/server/validate";
import { composePainting } from "@/lib/art/compose";
import { guard } from "@/server/limits";

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

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
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
          for await (const delta of paintPage(parsed)) send(delta);
        }
        send("\n<!--taleo:done-->");
      } catch (err) {
        console.error("illustration failed", err);
        send("\n<!--taleo:error-->");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
