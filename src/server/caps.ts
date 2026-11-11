import { metricsEnabled, pipeline } from "./metrics";

/**
 * A ceiling on how much paid work one account can ask for in a day,
 * whatever else allows it - kept in the shared store, so every server
 * instance counts the same uses (the burst caps in server/limits are per
 * instance, and start again whenever an instance does).
 *
 * These sit far above anything a family does in a day (a story is about
 * six requests to the storyteller and a dozen paintings): they exist so a
 * script, or a stolen sign-in, can't run up the bill without end.
 */
export type CapKind = "story" | "illustrate" | "tts" | "character" | "upload";
const DAILY: Record<CapKind, number> = { story: 90, illustrate: 500, tts: 2500, character: 40, upload: 30 };

const local = new Map<string, number>();
const day = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Counts one use; false if the account has reached today's ceiling. If
 *  the store can't be reached the request is let through (the burst caps
 *  still stand): a hiccup there never stops a bedtime story. */
export async function underDailyCap(userId: string, kind: CapKind, scale = 1): Promise<boolean> {
  const max = DAILY[kind] * scale;
  const key = `cap:${day(Date.now())}:${kind}:${userId}`;
  if (!metricsEnabled()) {
    if (local.size > 5000) local.clear();
    const n = (local.get(key) ?? 0) + 1;
    local.set(key, n);
    return n <= max;
  }
  try {
    const [n] = await pipeline([
      ["INCR", key],
      ["EXPIRE", key, 2 * 86_400],
    ]);
    return Number(n) <= max;
  } catch (e) {
    console.error("[caps] couldn't count a use", e);
    return true;
  }
}
