import { metricsEnabled, pipeline } from "../metrics";

/**
 * Makes something once and keeps it - a character's parts, a place's
 * backdrop - however many requests ask for it at the same moment, on
 * however many servers.
 *
 * Kept in Redis (and, on this server, in memory). The first to ask takes
 * a short lock and makes it; the others wait for it to appear, and only
 * make it themselves if it never does (the maker failed or was cut off).
 * Without Redis (a developer's machine) the memory copy does the same job.
 */
const memory = new Map<string, Promise<unknown>>();

export async function once<T>(key: string, make: () => Promise<T>, opts: { ttlS: number; waitMs: number; nothingTtlS?: number }): Promise<T> {
  const have = memory.get(key) as Promise<T> | undefined;
  if (have) return have;
  const p = (async (): Promise<T> => {
    if (!metricsEnabled()) return make();
    // (kept wrapped - {v: ...} - so that "made, and it came out as nothing"
    // (a character whose parts couldn't be made) is kept too, and isn't
    // mistaken for "not made yet": that had others waiting for it in vain)
    const read = async (): Promise<{ v: T } | null> => {
      const [v] = await pipeline([["GET", key]]).catch(() => [null]);
      if (v === null || v === undefined) return null;
      try {
        const got = (typeof v === "string" ? JSON.parse(v) : v) as unknown;
        return got && typeof got === "object" && "v" in got ? (got as { v: T }) : null;
      } catch {
        return null;
      }
    };
    const kept = await read();
    if (kept) return kept.v;
    const [got] = await pipeline([["SET", `${key}:making`, "1", "NX", "EX", Math.ceil(opts.waitMs / 1000) + 30]]).catch(() => [null]);
    if (got !== "OK") {
      // (someone else is making it: wait for it)
      const until = Date.now() + opts.waitMs;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 1500));
        const now = await read();
        if (now) return now.v;
        // (the maker gave up without leaving anything: make it here)
        const [making] = await pipeline([["EXISTS", `${key}:making`]]).catch(() => [1]);
        if (Number(making) === 0) break;
      }
    }
    try {
      const made = await make();
      // (nothing made - it may have been a passing failure - is kept only a
      // short while, so it's tried again later)
      const ttl = made === null || made === undefined ? (opts.nothingTtlS ?? 3600) : opts.ttlS;
      await pipeline([["SET", key, JSON.stringify({ v: made }), "EX", ttl], ["DEL", `${key}:making`]]).catch(() => {});
      return made;
    } catch (e) {
      await pipeline([["DEL", `${key}:making`]]).catch(() => {});
      throw e;
    }
  })();
  memory.set(key, p);
  // (with Redis, nothing made isn't held here either: Redis keeps it for
  // its short while, then it's tried again)
  p.then((v) => {
    if ((v === null || v === undefined) && metricsEnabled()) memory.delete(key);
  }, () => {});
  // (a failure isn't kept: the next ask tries again)
  p.catch(() => memory.delete(key));
  if (memory.size > 500) memory.delete(memory.keys().next().value!);
  return p;
}

/** What's kept under a key, if anything - without making it or waiting
 *  for it (null: nothing kept, or "made, nothing"). */
export async function kept<T>(key: string): Promise<T | null> {
  const have = memory.get(key) as Promise<T> | undefined;
  if (have) return have.catch(() => null);
  if (!metricsEnabled()) return null;
  const [v] = await pipeline([["GET", key]]).catch(() => [null]);
  if (v === null || v === undefined) return null;
  try {
    const got = (typeof v === "string" ? JSON.parse(v) : v) as { v?: T };
    return got && typeof got === "object" && "v" in got ? (got.v ?? null) : null;
  } catch {
    return null;
  }
}
