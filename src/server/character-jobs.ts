import type { CharacterResponse } from "@/lib/types";
import type { CharacterProgress } from "@/lib/character-client";
import { ACCOUNT_DOCS, readPrivate, writePrivate } from "./private-store";

/**
 * A character being designed, kept apart from the request that asked for
 * it. The painting used to live only inside the open reply: if the phone
 * locked or the connection dropped halfway, the finished character had
 * nowhere to go and the parent saw a failure (and lost a painting from
 * their allowance). Now the work carries on to the end whatever the page
 * does, and the result waits to be picked up:
 *
 *  - in this server's memory (free), for whoever is still listening or
 *    asks again on the same instance;
 *  - in the private store - one small write - only when nobody was
 *    listening at the moment it finished, so a page that comes back later,
 *    possibly to a different instance, still finds it. One record per
 *    person, overwritten each time, and forgotten after a week.
 */

export type JobEvent = ({ type: "progress" } & CharacterProgress) | ({ type: "done" } & CharacterResponse) | { type: "error"; error: string };
type Listener = (e: JobEvent) => void;

interface Job {
  userId: string;
  at: number;
  state: "running" | "done" | "error";
  progress: CharacterProgress | null;
  result?: CharacterResponse;
  error?: string;
  listeners: Set<Listener>;
  /** Stops the (paid) design work when the parent chose to cancel. */
  stop: AbortController;
  cancelled: boolean;
  finished: Promise<void>;
}

/** What waits in storage for a page that wasn't there when it finished. */
interface Parked {
  jobId: string;
  at: number;
  character?: CharacterResponse["character"];
  error?: string;
}

const KEEP_MS = 30 * 60 * 1000;
const store = globalThis as unknown as { __taleoCharacterJobs?: Map<string, Job> };
const jobs = (store.__taleoCharacterJobs ??= new Map<string, Job>());
const parkedPath = ACCOUNT_DOCS.parkedCharacter;

export const validJobId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);

function prune() {
  const old = Date.now() - KEEP_MS;
  for (const [id, j] of jobs) if (j.state !== "running" && j.at < old) jobs.delete(id);
}

/** A job this person started that this instance knows about. */
export function findJob(jobId: string, userId: string): Job | null {
  const j = jobs.get(jobId);
  return j && j.userId === userId ? j : null;
}

/** Start the work. `run` does the designing; `onFail` (refunding the
 *  allowance) runs if it fails on its own - not when the parent cancelled. */
export function startJob(
  jobId: string,
  userId: string,
  run: (onProgress: (p: CharacterProgress) => void, signal: AbortSignal) => Promise<CharacterResponse>,
  failure: (err: unknown) => Promise<string>,
): Job {
  prune();
  const job: Job = {
    userId,
    at: Date.now(),
    state: "running",
    progress: null,
    listeners: new Set(),
    stop: new AbortController(),
    cancelled: false,
    finished: Promise.resolve(),
  };
  const tell = (e: JobEvent) => {
    let heard = 0;
    for (const l of [...job.listeners]) {
      try {
        l(e);
        heard++;
      } catch {
        job.listeners.delete(l); // (their connection has gone)
      }
    }
    return heard;
  };
  job.finished = (async () => {
    let last: JobEvent;
    try {
      const made = await run((p) => {
        job.progress = p;
        tell({ type: "progress", ...p });
      }, job.stop.signal);
      job.result = made;
      job.state = "done";
      last = { type: "done", ...made };
    } catch (err) {
      job.error = job.cancelled ? "Cancelled." : await failure(err).catch(() => "Couldn't paint that one. Try again?");
      job.state = "error";
      last = { type: "error", error: job.error };
    }
    job.at = Date.now();
    if (job.cancelled) return; // thrown away, as asked
    // Nobody there to hand it to: leave it where they'll find it.
    if (!tell(last)) {
      const parked: Parked = { jobId, at: job.at, character: job.result?.character, error: job.error };
      await writePrivate(parkedPath(userId), parked, { ttlSeconds: 7 * 86_400 }).catch((e) => console.error("[character] couldn't keep a finished painting for later", e));
    }
  })();
  jobs.set(jobId, job);
  return job;
}

/** Listen to a job from here on (catching up on where it has got to).
 *  Returns how to stop listening. */
export function listen(job: Job, l: Listener): () => void {
  if (job.state === "done" && job.result) l({ type: "done", ...job.result });
  else if (job.state === "error") l({ type: "error", error: job.error || "Couldn't paint that one. Try again?" });
  else {
    if (job.progress) l({ type: "progress", ...job.progress });
    job.listeners.add(l);
  }
  return () => void job.listeners.delete(l);
}

export type JobStatus =
  | { status: "running"; progress: CharacterProgress | null }
  | ({ status: "done" } & CharacterResponse)
  | { status: "error"; error: string }
  | { status: "unknown" };

/** What became of a job: from memory if this instance ran it, otherwise
 *  from what was left in the private store. "unknown" can also mean
 *  it's still being painted on another instance. */
export async function jobStatus(jobId: string, userId: string): Promise<JobStatus> {
  const job = findJob(jobId, userId);
  if (job?.state === "running") return { status: "running", progress: job.progress };
  if (job?.state === "done" && job.result) return { status: "done", ...job.result };
  if (job?.state === "error") return { status: "error", error: job.error || "Couldn't paint that one. Try again?" };
  const parked = await readPrivate<Parked>(parkedPath(userId)).catch(() => null);
  if (parked?.jobId === jobId) {
    if (parked.character) return { status: "done", character: parked.character };
    if (parked.error) return { status: "error", error: parked.error };
  }
  return { status: "unknown" };
}

/** The parent chose to stop: end the work and throw the result away. */
export function cancelJob(jobId: string, userId: string) {
  const job = findJob(jobId, userId);
  if (!job || job.state !== "running") return;
  job.cancelled = true;
  for (const l of [...job.listeners]) {
    try {
      l({ type: "error", error: "Cancelled." });
    } catch {}
  }
  job.listeners.clear();
  job.stop.abort();
}
