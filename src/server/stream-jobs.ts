import { after } from "next/server";
import { readPrivate, writePrivate } from "./store";

/**
 * Work that streams to the reader (a part of the story being written, a
 * page being painted), kept apart from the request that asked for it.
 *
 * A phone that locks, or a reader who switches apps while their story is
 * being made, drops the connection. The work used to stop with it, and
 * coming back meant a failure ("Paint this page again", "The story got
 * stuck") and the same work paid for twice. Now it carries on to the end
 * whatever the page does, and what it sent is kept:
 *
 *  - in this server's memory (free), so a page that comes back and asks
 *    again for the same job - the same id - is given everything sent so
 *    far at once, then the rest as it comes, instead of a new start;
 *  - in storage - one write - only if nobody was listening at the moment
 *    it finished, so a page that comes back later, possibly to another
 *    server, still finds it. Read by its direct address, never listed.
 *
 * (The same idea as the character painter's jobs - see character-jobs.)
 */

type Listener = { chunk: (s: string) => void; end: () => void };

interface Job {
  userId: string;
  at: number;
  state: "running" | "done" | "failed";
  chunks: string[];
  listeners: Set<Listener>;
  finished: Promise<void>;
}

/** What waits in storage for a page that wasn't there when it finished. */
interface Parked {
  at: number;
  text: string;
}

const KEEP_MS = 40 * 60 * 1000;
const store = globalThis as unknown as { __taleoStreamJobs?: Map<string, Job> };
const jobs = (store.__taleoStreamJobs ??= new Map<string, Job>());

export const validStreamJobId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{6,90}$/.test(v);
const slot = (kind: string, userId: string, jobId: string) => `${kind}:${userId}:${jobId}`;
const parkedPath = (kind: string, userId: string, jobId: string) => `pending/${kind}/${userId}/${jobId}.json`;

function prune() {
  const old = Date.now() - KEEP_MS;
  for (const [k, j] of jobs) if (j.state !== "running" && j.at < old) jobs.delete(k);
}

/**
 * Start the work as a job of its own: `produce` sends text with `emit`.
 * Returns the reader's stream of it, and a promise for the work's end (to
 * keep the server working until then - `after(() => finished)`).
 * `failedIf` says whether what was sent ends in failure (such a job isn't
 * picked up again: asking again starts afresh).
 */
export function startStreamJob(
  kind: "story" | "painting",
  userId: string,
  jobId: string,
  produce: (emit: (s: string) => void) => Promise<void>,
  failedIf: (text: string) => boolean,
): { stream: ReadableStream<Uint8Array>; finished: Promise<void> } {
  prune();
  const key = slot(kind, userId, jobId);
  const job: Job = { userId, at: Date.now(), state: "running", chunks: [], listeners: new Set(), finished: Promise.resolve() };
  jobs.set(key, job);
  const emit = (s: string) => {
    if (!s) return;
    job.chunks.push(s);
    for (const l of job.listeners) l.chunk(s);
  };
  job.finished = (async () => {
    try {
      await produce(emit);
    } catch (e) {
      console.error(`[${kind} job] ended badly`, e);
    }
    const text = job.chunks.join("");
    job.state = failedIf(text) ? "failed" : "done";
    job.at = Date.now();
    const nobody = job.listeners.size === 0;
    for (const l of job.listeners) l.end();
    job.listeners.clear();
    // (finished with nobody there to receive it: kept for when they're back)
    if (nobody && job.state === "done") {
      await writePrivate(parkedPath(kind, userId, jobId), { at: job.at, text } satisfies Parked).catch((e) => console.error(`[${kind} job] couldn't keep the result for later`, e));
    }
  })();
  return { stream: listen(job), finished: job.finished };
}

/**
 * The reader asks again for a job they started (back after the phone
 * locked, or the connection dropped): its stream - everything sent so far,
 * then the rest - or null if there's nothing to pick up (never started,
 * failed, or long gone), when the work should simply start afresh.
 */
export async function resumeStreamJob(kind: "story" | "painting", userId: string, jobId: string): Promise<ReadableStream<Uint8Array> | null> {
  const job = jobs.get(slot(kind, userId, jobId));
  if (job && job.userId === userId && job.state !== "failed") return listen(job);
  if (job?.state === "failed") return null;
  const parked = await readPrivate<Parked>(parkedPath(kind, userId, jobId), { fresh: true }).catch(() => null);
  if (parked?.text && Date.now() - parked.at < KEEP_MS * 3) return once(parked.text);
  return null;
}

const encoder = new TextEncoder();

function once(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode(text));
      c.close();
    },
  });
}

/** A reader's stream of a job: what it has sent so far, then the rest. */
function listen(job: Job): ReadableStream<Uint8Array> {
  let me: Listener | null = null;
  return new ReadableStream<Uint8Array>({
    start(c) {
      const so = job.chunks.join("");
      if (so) c.enqueue(encoder.encode(so));
      if (job.state !== "running") return c.close();
      me = {
        chunk: (s) => {
          try {
            c.enqueue(encoder.encode(s));
          } catch {}
        },
        end: () => {
          try {
            c.close();
          } catch {}
        },
      };
      job.listeners.add(me);
    },
    // (the reader went away: the work goes on without them)
    cancel() {
      if (me) job.listeners.delete(me);
    },
  });
}

/**
 * A route's own reply stream run as a job: read to the end on the server
 * whatever the reader does (kept going with `after`), and the reader given
 * a stream of it that they can leave and pick up again.
 */
export function jobOf(kind: "story" | "painting", userId: string, jobId: string, body: ReadableStream<Uint8Array>, failedIf: (text: string) => boolean): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const { stream, finished } = startStreamJob(
    kind,
    userId,
    jobId,
    async (emit) => {
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (value) emit(decoder.decode(value, { stream: true }));
        if (done) break;
      }
      emit(decoder.decode());
    },
    failedIf,
  );
  after(() => finished);
  return stream;
}
