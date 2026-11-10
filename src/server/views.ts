import { metricsEnabled, pipeline } from "./metrics";

/**
 * How many times each library story was opened to be read on a given day:
 * what the story of the day is chosen by (see storyOfTheDay).
 *
 * One Redis hash per day (`views:<day>`, story id -> count), kept for a
 * few days and then dropped. A view is one small atomic increment, fire-
 * and-forget; the library reads the day's hash once per (edge-cached)
 * request. No Blob operations either way. Without Redis (local and mock
 * runs) the counts are kept in memory.
 */

const KEEP_SECONDS = 3 * 86_400;
const key = (day: string) => `views:${day}`;

type Memory = Map<string, Map<string, number>>;
const memory = (): Memory => {
  const g = globalThis as { __taleoViews?: Memory };
  return (g.__taleoViews ??= new Map());
};

/** One more reader opened this story on this day. Never throws. */
export function noteView(day: string, storyId: string) {
  if (!metricsEnabled()) {
    const m = memory();
    const d = m.get(day) ?? new Map<string, number>();
    m.set(day, d.set(storyId, (d.get(storyId) ?? 0) + 1));
    return;
  }
  pipeline([
    ["HINCRBY", key(day), storyId, 1],
    ["EXPIRE", key(day), KEEP_SECONDS],
  ]).catch((e) => console.error("[views] couldn't record", e));
}

/** The day's views by story id. Empty (never an error) when they can't be
 *  read: the story of the day then falls back to its tie-breaks. */
export async function viewsOn(day: string): Promise<Record<string, number>> {
  if (!metricsEnabled()) return Object.fromEntries(memory().get(day) ?? []);
  try {
    const [flat] = (await pipeline([["HGETALL", key(day)]])) as [unknown];
    const out: Record<string, number> = {};
    // (Upstash answers HGETALL as [field, value, field, value, ...])
    if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = Number(flat[i + 1]) || 0;
    else if (flat && typeof flat === "object") for (const [k, v] of Object.entries(flat)) out[k] = Number(v) || 0;
    return out;
  } catch (e) {
    console.error("[views] couldn't read", e);
    return {};
  }
}
