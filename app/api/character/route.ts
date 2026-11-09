import { NextResponse } from "next/server";
import { designCharacter, hasApiKey } from "@/server/claude";
import { mockCharacter } from "@/server/mock";
import { errorResponse } from "@/server/errors";
import { guard } from "@/server/limits";
import { count, withMetricsUser } from "@/server/metrics";

export const runtime = "nodejs";
// High-effort character design can take a couple of minutes.
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { description?: unknown; name?: unknown; current?: unknown } | null;
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 200) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : undefined;
  if (!description) return NextResponse.json({ error: "Tell me about your character first!" }, { status: 400 });
  // Redrawing a saved character: their current look and who they are.
  const cur = body?.current as { look?: unknown; notes?: unknown; relationships?: unknown; gender?: unknown } | undefined;
  const current =
    cur && typeof cur.look === "string"
      ? {
          look: cur.look.slice(0, 600),
          notes: typeof cur.notes === "string" ? cur.notes.slice(0, 400) : null,
          relationships: typeof cur.relationships === "string" ? cur.relationships.slice(0, 400) : null,
          gender: cur.gender === "male" || cur.gender === "female" ? (cur.gender as "male" | "female") : null,
        }
      : undefined;
  const g = await guard("character");
  if (!g.ok) return g.response;

  // The reply streams as lines of JSON: progress while the character is
  // designed (so the waiting screen can show real headway), then the
  // finished character - or an error.
  const userId = g.session.user.id;
  const enc = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        let made;
        if (!hasApiKey()) {
          // Test mode: walk through the same stages, a little faster.
          const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
          send({ type: "progress", stage: "thinking" });
          await wait(1800);
          send({ type: "progress", stage: "sheet" });
          await wait(700);
          for (let n = 3; n <= 90; n += 6) {
            send({ type: "progress", stage: "painting", shapes: n });
            await wait(120);
          }
          made = mockCharacter({ description, name });
        } else {
          made = await withMetricsUser(userId, () => designCharacter({ description, name, current }, (p) => send({ type: "progress", ...p })));
          withMetricsUser(userId, () => count({ characters: 1 }));
        }
        send({ type: "done", ...made });
      } catch (err) {
        await g.release();
        const res = await errorResponse(err);
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        send({ type: "error", error: data.error || "Couldn't paint that one. Try again?" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body$, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
