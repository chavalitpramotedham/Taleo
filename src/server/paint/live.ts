import { metricsEnabled, pipeline } from "../metrics";

/**
 * A painting being made, shown while it's made - to anyone else waiting
 * for it.
 *
 * A place's backdrop is painted once (see `once`) and shared: the story's
 * places are begun the moment the storyteller names them, well before
 * page 1 is written. Page 1's own painting then finds its place already
 * being painted - by another request, often on another server - and used
 * to wait for it unseen, showing nothing until the whole backdrop was done.
 * Now the painter publishes its strokes as they come (in memory on its own
 * server, and every moment or so to Redis for the others), and the waiting
 * page shows them stroke by stroke, as if it were painting them itself.
 *
 * What's published is always whole strokes, in order: a prefix of the
 * finished painting.
 */

type Entry = { text: string; done: boolean; wake: Set<() => void> };
const here = new Map<string, Entry>();
const liveKey = (key: string) => `${key}:live`;
const FLUSH_MS = 900;

/** For the one painting it: each stroke as it comes, then `end`. */
export function liveWriter(key: string) {
  const e: Entry = { text: "", done: false, wake: new Set() };
  here.set(key, e);
  if (here.size > 200) here.delete(here.keys().next().value!);
  let sent = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing: Promise<unknown> = Promise.resolve();
  const flush = () => {
    timer = null;
    if (!metricsEnabled() || e.text.length <= sent) return;
    const piece = e.text.slice(sent);
    sent = e.text.length;
    flushing = flushing.then(() => pipeline([["APPEND", liveKey(key), piece], ["EXPIRE", liveKey(key), 600]]).catch(() => {}));
  };
  const ring = () => {
    for (const w of e.wake) w();
    e.wake.clear();
  };
  return {
    push(stroke: string) {
      e.text += stroke;
      ring();
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    },
    /** Finished (or given up): nothing more is coming. */
    end() {
      if (timer) clearTimeout(timer);
      timer = null;
      e.done = true;
      ring();
      // (the finished painting is kept under its own key; the live copy
      // only needs to last for anyone still reading it)
      if (metricsEnabled()) void flushing.then(() => pipeline([["EXPIRE", liveKey(key), 60]]).catch(() => {}));
      setTimeout(() => here.get(key) === e && here.delete(key), 60_000);
    },
  };
}

/** For a page waiting on someone else's painting: the strokes published so
 *  far and then each new one, until `settled` resolves (the painting is
 *  finished, or the wait is over). Everything yielded is a prefix of the
 *  finished painting - the caller adds the rest once it has it. */
export async function* liveReader(key: string, settled: Promise<unknown>, signal?: AbortSignal): AsyncGenerator<string> {
  let over = false;
  let poke = () => {};
  void settled.then(
    () => ((over = true), poke()),
    () => ((over = true), poke()),
  );
  let at = 0;
  // (which copy is followed is settled by the first stroke found: memory
  // offsets are characters, Redis's are bytes)
  let mine: Entry | undefined;
  let fromRedis = false;
  for (;;) {
    if (signal?.aborted) return;
    if (!mine && !fromRedis) mine = here.get(key);
    const e = mine;
    if (e) {
      // (painted on this server: every stroke the moment it comes)
      if (e.text.length > at) {
        const piece = e.text.slice(at);
        at = e.text.length;
        yield piece;
        continue;
      }
      if (e.done || over) return;
      await new Promise<void>((r) => {
        e.wake.add(r);
        poke = r;
      });
      continue;
    }
    if (over) return;
    if (metricsEnabled()) {
      // (painted on another: read what's been published since last time)
      const [got] = await pipeline([["GETRANGE", liveKey(key), at, -1]]).catch(() => [null]);
      const piece = typeof got === "string" ? got : "";
      if (piece && !here.get(key)) {
        fromRedis = true;
        at += Buffer.byteLength(piece);
        yield piece;
      }
    }
    if (over) return;
    await new Promise<void>((r) => {
      poke = r;
      setTimeout(r, fromRedis ? 1000 : 250);
    });
  }
}
