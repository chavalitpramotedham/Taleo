import { metricsEnabled, pipeline } from "./metrics";
import { STORYTELLER_MODES, isStorytellerMode, type Storyteller, type StorytellerMode } from "@/lib/storyteller";

/**
 * Who writes the stories, as the admin last switched it (the switch at the
 * top of the admin's account menu). Kept in Redis so every server follows
 * it; each server reads it at most every 15 seconds, so a switch is
 * followed everywhere within that. Never switched: the env's TALEO_MODEL /
 * TALEO_EFFORT / TALEO_STORY_FAST, or Sonnet 5.5 at medium effort.
 */
const KEY = "cfg:storyteller";
const FRESH_MS = 15_000;
let cached: { mode: StorytellerMode | null; at: number } | null = null;

export function envStoryteller(): Storyteller {
  const model = process.env.TALEO_MODEL || "claude-sonnet-5-5";
  return {
    model,
    effort: (process.env.TALEO_EFFORT as Storyteller["effort"]) || "medium",
    fast: process.env.TALEO_STORY_FAST === "1" && /opus-5/.test(model),
  };
}

export async function storyteller(): Promise<Storyteller & { switched: boolean }> {
  if (!cached || Date.now() - cached.at > FRESH_MS) {
    let mode: StorytellerMode | null = cached?.mode ?? null;
    if (metricsEnabled()) {
      try {
        const [got] = await pipeline([["GET", KEY]]);
        mode = isStorytellerMode(got) ? got : null;
      } catch {
        // (the store can't be reached: keep what was last known)
      }
    }
    cached = { mode, at: Date.now() };
  }
  const m = STORYTELLER_MODES.find((x) => x.id === cached!.mode);
  return m ? { ...m.is, switched: true } : { ...envStoryteller(), switched: false };
}

export async function switchStoryteller(mode: StorytellerMode): Promise<void> {
  if (!metricsEnabled()) throw new Error("No settings store to keep the switch in.");
  await pipeline([["SET", KEY, mode]]);
  cached = { mode, at: Date.now() };
}
