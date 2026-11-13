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

export async function once<T>(key: string, make: () => Promise<T>, opts: { ttlS: number; waitMs: number }): Promise<T> {
  const have = memory.get(key) as Promise<T> | undefined;
  if (have) return have;
  const p = (async (): Promise<T> => {
    if (!metricsEnabled()) return make();
    const read = async (): Promise<T | null> => {
      const [v] = await pipeline([["GET", key]]).catch(() => [null]);
      if (v === null || v === undefined) return null;
      try {
        return (typeof v === "string" ? JSON.parse(v) : v) as T;
      } catch {
        return null;
      }
    };
    const kept = await read();
    if (kept !== null) return kept;
    const [got] = await pipeline([["SET", `${key}:making`, "1", "NX", "EX", Math.ceil(opts.waitMs / 1000) + 30]]).catch(() => [null]);
    if (got !== "OK") {
      // (someone else is making it: wait for it)
      const until = Date.now() + opts.waitMs;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 1500));
        const now = await read();
        if (now !== null) return now;
      }
    }
    try {
      const made = await make();
      await pipeline([["SET", key, JSON.stringify(made), "EX", opts.ttlS], ["DEL", `${key}:making`]]).catch(() => {});
      return made;
    } catch (e) {
      await pipeline([["DEL", `${key}:making`]]).catch(() => {});
      throw e;
    }
  })();
  memory.set(key, p);
  // (a failure isn't kept: the next ask tries again)
  p.catch(() => memory.delete(key));
  if (memory.size > 500) memory.delete(memory.keys().next().value!);
  return p;
}
