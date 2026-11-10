import type { CharacterResponse } from "@/lib/types";
import { PHOTO_PROBLEM, PhotoProblem } from "@/lib/character-photo";

/** How far a character's design has got (streamed from /api/character). */
export type CharacterProgress = { stage: "thinking" } | { stage: "sheet" } | { stage: "painting"; shapes: number };

/** Thrown when the parent chose to stop the painting (not a failure:
 *  callers show nothing for it). */
export class PaintingCancelled extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "PaintingCancelled";
  }
}

type Status = { status: "running"; progress: CharacterProgress | null } | ({ status: "done" } & CharacterResponse) | { status: "error"; error: string } | { status: "unknown" };
type Line = ({ type: "progress" } & CharacterProgress) | ({ type: "done" } & CharacterResponse) | { type: "error"; error: string };

/** A real answer from the server, as opposed to a connection that broke. */
class Answer extends Error {}

const FAILED = "Couldn't paint that one. Try again?";
/** How long a painting can reasonably still be under way somewhere we
 *  can't see, before asking for it afresh. */
const GIVE_UP_MS = 3 * 60 * 1000;
const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

function newJobId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Wait a moment - cut short (with PaintingCancelled) if the parent stops. */
function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new PaintingCancelled());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(t);
      reject(new PaintingCancelled());
    };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

/** Wait until the page is on screen again (and online, if we can tell). */
async function untilBack(signal?: AbortSignal) {
  while (hidden() || (typeof navigator !== "undefined" && navigator.onLine === false)) await pause(500, signal);
}

/**
 * Ask for a character to be designed (or redrawn), reporting progress as it
 * streams in. Resolves with the finished character; throws with a friendly
 * message on a real failure.
 *
 * What the page does in the meantime can't break it. The painting is made
 * on the server whether or not anyone is listening, so if the phone locks,
 * the app is put in the background or the connection drops, this lets go
 * of the live connection, then asks what became of the painting and picks
 * the finished character up. Only the parent stopping it (`signal`) ends
 * it - and that throws the result away.
 */
export async function requestCharacter(body: object, onProgress: (p: CharacterProgress) => void, opts: { signal?: AbortSignal } = {}): Promise<CharacterResponse> {
  const { signal } = opts;
  const jobId = newJobId();
  const started = Date.now();
  const cancelled = () => Boolean(signal?.aborted);
  // Whether the server ever took the request (so a painting may be under
  // way even though we've lost sight of it).
  let reached = false;

  /** One live connection. "lost" = it broke or was let go; the painting
   *  itself may be fine. */
  const connect = async (mode: "new" | "attach" | "restart"): Promise<CharacterResponse | "lost"> => {
    const conn = new AbortController();
    const drop = () => conn.abort();
    // Leaving the screen (locking the phone, switching apps): let go of
    // the connection cleanly now, rather than have it die halfway, so the
    // server knows to keep the finished painting for our return.
    const onHide = () => hidden() && drop();
    signal?.addEventListener("abort", drop);
    document.addEventListener("visibilitychange", onHide);
    try {
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // (only listening in again needs no photo: the painting has it)
        body: JSON.stringify({ ...body, ...(mode === "attach" ? { photo: undefined } : {}), jobId, resume: mode === "new" ? undefined : mode }),
        signal: conn.signal,
      });
      // Answered without a stream: refused before it started (signed out,
      // over the limit, no description), or already finished and kept.
      if (!res.ok || !res.headers.get("content-type")?.includes("ndjson") || !res.body) {
        const data = (await res.json().catch(() => null)) as (CharacterResponse & { error?: string; missing?: boolean }) | null;
        if (data?.character) return { character: data.character };
        if (data?.missing) return "lost"; // (not on the server we reached)
        // (a gateway hiccup rather than an answer from the app)
        if (!data?.error && res.status >= 502) return "lost";
        throw new Answer(data?.error || FAILED);
      }
      reached = true;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line) as Line;
          if (msg.type === "progress") onProgress(msg);
          else if (msg.type === "error") throw new Answer(msg.error);
          else if (msg.type === "done") {
            if (!msg.character) throw new Answer(FAILED);
            return { character: msg.character };
          }
        }
        if (done) return "lost"; // ended without a finished character
      }
    } catch (e) {
      if (cancelled()) throw new PaintingCancelled();
      // A real answer from the server stands; anything else is the
      // connection: dropped, let go, or never made.
      if (e instanceof Answer) throw new Error(e.message);
      return "lost";
    } finally {
      signal?.removeEventListener("abort", drop);
      document.removeEventListener("visibilitychange", onHide);
    }
  };

  const ask = async (): Promise<Status | null> => {
    try {
      const res = await fetch(`/api/character?job=${jobId}`, { cache: "no-store", signal });
      return res.ok ? ((await res.json()) as Status) : null;
    } catch {
      return null; // (still offline, or asleep again: ask later)
    }
  };

  try {
    let asked = 0;
    let attached = 0;
    for (let posts = 1; ; posts++) {
      const got = await connect(posts > 1 ? "restart" : "new");
      if (got !== "lost") return got;
      // Lost touch. If the server took the request, find out what became
      // of the painting - it finishes without us - and wait for it.
      if (reached) {
        const since = Date.now();
        for (;;) {
          if (cancelled()) throw new PaintingCancelled();
          const s = await ask();
          if (s) asked++;
          if (s?.status === "done") {
            if (!s.character) throw new Error(FAILED);
            return { character: s.character };
          }
          if (s?.status === "error") throw new Error(s.error || FAILED);
          if (s?.status === "running") {
            if (s.progress) onProgress(s.progress);
            // Still being painted, and we're back on screen: listen in
            // live again (it answers at once if this server isn't the one).
            if (!hidden() && attached < 3) {
              attached++;
              const again = await connect("attach");
              if (again !== "lost") return again;
              continue;
            }
          }
          // Nobody knows of it: it may still be under way on another
          // server, so give it its time (and at least a few asks since we
          // got back) before concluding it's gone.
          if (s?.status === "unknown" && asked >= 3 && Date.now() - started > GIVE_UP_MS && Date.now() - since > 6000) break;
          await pause(2000, signal);
        }
      }
      if (posts >= 3) throw new Error("The painting was interrupted. Please try again.");
      // Ask again (the server picks the same painting up if it can).
      await pause(1500, signal);
      await untilBack(signal);
    }
  } catch (e) {
    if (cancelled() || e instanceof PaintingCancelled) {
      // Tell the server to stop and throw it away.
      void fetch(`/api/character?job=${jobId}`, { method: "DELETE", keepalive: true }).catch(() => {});
      throw new PaintingCancelled();
    }
    // (the photo couldn't be used: said so, apart from a failed painting)
    if (e instanceof Error && e.message.startsWith(PHOTO_PROBLEM)) throw new PhotoProblem(e.message.slice(PHOTO_PROBLEM.length));
    throw e;
  }
}
