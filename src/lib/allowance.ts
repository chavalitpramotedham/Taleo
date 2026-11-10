"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ONGOING_EVENT } from "./ongoing";

/**
 * Can this account begin a new story right now - and if not, when again?
 * One answer for the whole app: every "Begin a story" button stays as it
 * is, with a small line under it once the plan's stories are used up
 * (see QuotaNote), and the "next adventure" idea leaves out "Start now".
 *
 * It's the wizard's own question (GET /api/story: one free read, nothing
 * written), asked once and shared by everything on the page for a short
 * while.
 */
export interface StoryAllowance {
  canStart: boolean;
  /** Seconds until a new story can begin (when it can't now). */
  retryAfterSec: number;
  limited?: string;
  plan?: string;
  /** The server's own, friendly explanation. */
  error?: string;
  startsLeft?: number;
  windowHours?: number;
  /** When this answer was given (ms). */
  at: number;
}

const FRESH_MS = 30_000;
let held: { userId: string; at: number; answer: Promise<StoryAllowance | null> } | null = null;

/** Ask (or reuse a very recent answer). Null: couldn't find out. */
export function askStoryAllowance(userId: string, { fresh = false } = {}): Promise<StoryAllowance | null> {
  if (!fresh && held && held.userId === userId && Date.now() - held.at < FRESH_MS) return held.answer;
  const answer = fetch("/api/story", { cache: "no-store" })
    .then(async (res) => {
      if (res.status === 401) return null;
      const d = (await res.json()) as Partial<StoryAllowance>;
      if (typeof d.canStart !== "boolean") return null;
      return { ...d, canStart: d.canStart, retryAfterSec: d.retryAfterSec ?? 0, at: Date.now() } as StoryAllowance;
    })
    .catch(() => null);
  held = { userId, at: Date.now(), answer };
  // (an answer that couldn't be had isn't kept)
  void answer.then((a) => {
    if (!a && held?.answer === answer) held = null;
  });
  return answer;
}

/** The signed-in account's allowance for new stories (null: signed out,
 *  still asking, or unknown - treat as "go ahead"; the server decides). */
export function useStoryAllowance(): StoryAllowance | null {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const [allowance, setAllowance] = useState<StoryAllowance | null>(null);
  useEffect(() => {
    if (!userId) return setAllowance(null);
    let live = true;
    const ask = (fresh = false) => void askStoryAllowance(userId, { fresh }).then((a) => live && setAllowance(a));
    ask();
    // (a story begun, replaced or thrown away can change the answer)
    const again = () => ask(true);
    window.addEventListener(ONGOING_EVENT, again);
    return () => {
      live = false;
      window.removeEventListener(ONGOING_EVENT, again);
    };
  }, [userId]);
  return allowance;
}

/** "5 hours", "20 minutes" - worded as the server words its own limits. */
export function waitText(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  if (m >= 90) {
    const h = Math.round(m / 60);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** The one line shown wherever a story could be begun but the plan's
 *  stories are used up. Null while there's room. */
export function quotaLine(a: StoryAllowance | null): string | null {
  if (!a || a.canStart) return null;
  const left = Math.max(0, a.retryAfterSec - Math.round((Date.now() - a.at) / 1000));
  return `Story limit reached. Refreshes in about ${waitText(left)}.`;
}
