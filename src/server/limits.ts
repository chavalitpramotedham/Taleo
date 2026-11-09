import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "./auth";
import { readJson, writeJson } from "./store";

/**
 * Who may use the paid AI endpoints, and how often.
 *
 * Every endpoint that calls Claude or the voice provider requires a signed-in
 * account. The admin account (ADMIN_EMAIL) is unlimited; everyone else gets:
 *
 *   story       1 new story every 30 minutes (the headline limit)
 *   segment     continuing stories already started - room for a couple of books
 *   illustrate  painting pages - room for a couple of books' worth of pictures
 *   character   designing custom characters (incl. regenerating previews)
 *   tts         new read-aloud clips (already-made clips are free and unlimited)
 *
 * Only `story` is a product limit; the rest are generous caps whose job is to
 * stop anyone from scripting the endpoints and running up the bill.
 *
 * Only `story` counts are kept in the shared store (one small write per new
 * story). The high-frequency caps are counted in the server's memory: every
 * stored write is a metered Blob operation, and writing on each painted
 * page or voice clip would burn through the store's allowance. Memory is per
 * server instance, which is plenty for an anti-abuse cap.
 */

export type Bucket = "story" | "segment" | "illustrate" | "character" | "tts";

const WINDOW_MS = 30 * 60 * 1000;
const LIMITS: Record<Bucket, number> = {
  story: 1,
  segment: 16,
  illustrate: 80,
  character: 12,
  tts: 400,
};

type Usage = Partial<Record<Bucket, number[]>>;
const path = (userId: string) => `ratelimits/${userId}.json`;

const memory = new Map<string, Usage>();
const stored = (bucket: Bucket) => bucket === "story";
async function load(userId: string, bucket: Bucket): Promise<Usage> {
  if (!stored(bucket)) return memory.get(userId) ?? {};
  return (await readJson<Usage>(path(userId))) ?? {};
}
async function save(userId: string, bucket: Bucket, usage: Usage) {
  if (!stored(bucket)) {
    memory.set(userId, usage);
    return;
  }
  await writeJson(path(userId), { story: usage.story ?? [] });
}

export const isUnlimited = (session: Session | null) => Boolean(session?.user?.isAdmin);

function minutesText(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** What a user still has in a bucket, without using any of it. */
export async function peekLimit(userId: string, bucket: Bucket): Promise<{ ok: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const usage = await load(userId, bucket);
  const recent = (usage[bucket] ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length < LIMITS[bucket]) return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.ceil((Math.min(...recent) + WINDOW_MS - now) / 1000) };
}

/** Uses one from a bucket if there's room. */
async function take(userId: string, bucket: Bucket): Promise<{ ok: boolean; retryAfterSec: number; at: number }> {
  const now = Date.now();
  const usage = await load(userId, bucket);
  const recent = (usage[bucket] ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMITS[bucket]) {
    return { ok: false, retryAfterSec: Math.ceil((Math.min(...recent) + WINDOW_MS - now) / 1000), at: now };
  }
  usage[bucket] = [...recent, now];
  // Drop stale entries in other buckets while we're here.
  for (const b of Object.keys(usage) as Bucket[]) {
    if (b !== bucket) usage[b] = (usage[b] ?? []).filter((t) => now - t < WINDOW_MS);
  }
  await save(userId, bucket, usage);
  return { ok: true, retryAfterSec: 0, at: now };
}

/** Gives back a use that didn't produce anything (e.g. the story failed to
 *  write), so a failure never costs someone their allowance. */
export async function refund(userId: string, bucket: Bucket, at: number) {
  try {
    const usage = await load(userId, bucket);
    const list = usage[bucket] ?? [];
    const i = list.lastIndexOf(at);
    if (i < 0) return;
    usage[bucket] = [...list.slice(0, i), ...list.slice(i + 1)];
    await save(userId, bucket, usage);
  } catch (e) {
    console.error("[limits] refund failed", e);
  }
}

const LIMIT_MESSAGES: Record<Bucket, (wait: string) => string> = {
  story: (w) => `You can begin a new story in about ${w}. While Noomi is in early access, each family can start one new story every 30 minutes.`,
  segment: (w) => `That's a lot of story for one sitting! Please try again in about ${w}.`,
  illustrate: (w) => `The painter needs a little rest. The pictures will carry on in about ${w}.`,
  character: (w) => `You've dreamt up lots of characters! Try again in about ${w}.`,
  tts: (w) => `The storyteller's voice needs a rest. Try again in about ${w}.`,
};

export type Guard =
  | { ok: true; session: Session; release: () => Promise<void> }
  | { ok: false; response: NextResponse };

/**
 * Requires a signed-in user and takes one from `bucket` (admins skip the
 * limit). Call `release()` if the work then fails, to refund it.
 */
export async function guard(bucket: Bucket): Promise<Guard> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Please sign in to make stories." }, { status: 401 }) };
  }
  if (isUnlimited(session)) return { ok: true, session, release: async () => {} };
  let took: Awaited<ReturnType<typeof take>>;
  try {
    took = await take(session.user.id, bucket);
  } catch (e) {
    // If the counter itself is unavailable, fail closed for new stories
    // (the costly, limited action) but don't block reading in progress.
    console.error("[limits] couldn't check usage", e);
    if (bucket === "story") {
      return { ok: false, response: NextResponse.json({ error: "Couldn't start a story just now. Please try again." }, { status: 503 }) };
    }
    return { ok: true, session, release: async () => {} };
  }
  if (!took.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: LIMIT_MESSAGES[bucket](minutesText(took.retryAfterSec)), retryAfterSec: took.retryAfterSec, limited: bucket },
        { status: 429, headers: { "Retry-After": String(took.retryAfterSec) } },
      ),
    };
  }
  const userId = session.user.id;
  return { ok: true, session, release: () => refund(userId, bucket, took.at) };
}

export { LIMIT_MESSAGES, minutesText };
