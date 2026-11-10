import { after, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { designCharacter, hasApiKey } from "@/server/claude";
import { mockCharacter } from "@/server/mock";
import { errorResponse } from "@/server/errors";
import { guard } from "@/server/limits";
import { count, withMetricsUser } from "@/server/metrics";
import { cancelJob, findJob, jobStatus, listen, startJob, validJobId, type JobEvent } from "@/server/character-jobs";

export const runtime = "nodejs";
// High-effort character design can take a couple of minutes.
export const maxDuration = 300;

const enc = new TextEncoder();
const NDJSON = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };

/** The reply streams as lines of JSON: progress while the character is
 *  designed (so the waiting screen can show real headway), then the
 *  finished character - or an error. Closing the connection only stops the
 *  listening: the painting itself carries on (see character-jobs). */
function streamOf(subscribe: (send: (e: JobEvent) => void) => () => void, signal: AbortSignal) {
  let unsubscribe = () => {};
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        let open = true;
        const stop = () => {
          open = false;
          unsubscribe();
        };
        signal.addEventListener("abort", stop);
        unsubscribe = subscribe((e) => {
          // (throwing tells the job nobody heard this one)
          if (!open) throw new Error("gone");
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
          if (e.type !== "progress") {
            open = false;
            controller.close();
          }
        });
        if (!open) unsubscribe();
      },
      cancel() {
        unsubscribe();
      },
    }),
    { headers: NDJSON },
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { description?: unknown; name?: unknown; current?: unknown; jobId?: unknown; resume?: unknown } | null;
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
  const jobId = validJobId(body?.jobId) ? body.jobId : crypto.randomUUID();

  // Asking again for a painting already begun (the page lost touch with
  // it): pick it up where it is rather than paying for another.
  // "attach" only ever listens in; "restart" starts afresh if it's gone.
  if ((body?.resume === "attach" || body?.resume === "restart") && validJobId(body?.jobId)) {
    const session = await auth();
    const userId = session?.user?.id;
    if (userId) {
      const running = findJob(jobId, userId);
      if (running) return streamOf((send) => listen(running, send), req.signal);
      const was = await jobStatus(jobId, userId);
      if (was.status === "done") return NextResponse.json({ character: was.character });
      if (was.status === "error") return NextResponse.json({ error: was.error }, { status: 500 });
    }
    if (body.resume === "attach") return NextResponse.json({ missing: true });
  }

  const g = await guard("character");
  if (!g.ok) return g.response;
  const userId = g.session.user.id;
  const job = startJob(
    jobId,
    userId,
    async (onProgress, signal) => {
      if (!hasApiKey()) {
        // Test mode: walk through the same stages, a little faster.
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const slow = Number(process.env.TALEO_MOCK_CHARACTER_SLOW) || 1;
        onProgress({ stage: "thinking" });
        await wait(1800 * slow);
        onProgress({ stage: "sheet" });
        await wait(700 * slow);
        for (let n = 3; n <= 90; n += 6) {
          signal.throwIfAborted();
          onProgress({ stage: "painting", shapes: n });
          await wait(120 * slow);
        }
        return mockCharacter({ description, name });
      }
      const made = await withMetricsUser(userId, () => designCharacter({ description, name, current }, onProgress, signal));
      withMetricsUser(userId, () => count({ characters: 1 }));
      return made;
    },
    async (err) => {
      await g.release();
      const res = await errorResponse(err);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return data.error || "Couldn't paint that one. Try again?";
    },
  );
  // Keep the server working until the painting is finished and handed
  // over (or put away for later), even if the page has gone.
  after(() => job.finished);
  return streamOf((send) => listen(job, send), req.signal);
}

/** "What became of my painting?" - asked by a page that lost touch with
 *  it (the phone locked, the connection dropped). Costs nothing. */
export async function GET(req: Request) {
  const session = await auth();
  const jobId = new URL(req.url).searchParams.get("job");
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!validJobId(jobId)) return NextResponse.json({ status: "unknown" });
  return NextResponse.json(await jobStatus(jobId, session.user.id), { headers: { "cache-control": "no-store" } });
}

/** The parent chose to stop a painting: end the work, discard the result. */
export async function DELETE(req: Request) {
  const session = await auth();
  const jobId = new URL(req.url).searchParams.get("job");
  if (session?.user?.id && validJobId(jobId)) cancelJob(jobId, session.user.id);
  return NextResponse.json({ ok: true });
}
