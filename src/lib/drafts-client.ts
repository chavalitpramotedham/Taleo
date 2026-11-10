"use client";
import type { Story } from "./types";

/**
 * Keeps the signed-in user's unfinished story saved to their account (see
 * /api/draft), batched: a burst of changes (pages streaming in, paintings
 * finishing) becomes one save a few seconds after it settles, rather than
 * a write per change. Finishing the story clears the draft.
 */

// (a burst of paintings finishing - several a minute - becomes one save;
// leaving the story saves at once, so nothing is lost)
const DELAY_MS = 12000;
let timer: number | undefined;
let pending: Story | null = null;

async function send(story: Story) {
  try {
    await fetch("/api/draft", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(story), keepalive: false });
  } catch {}
}

export function saveDraftSoon(story: Story) {
  if (story.demo || story.segments.length === 0) return;
  // Done = finished AND published with every painting (that's "saved as
  // usual"); until then it stays a draft, so nothing is lost if closed
  // while the last pictures are still painting.
  if (story.status === "complete" && story.publishedPainted) return void clearDraftFor(story.id);
  pending = story;
  window.clearTimeout(timer);
  timer = window.setTimeout(flushDraft, DELAY_MS);
}

/** Saves any change still waiting (e.g. as the reader leaves the story). */
export function flushDraft() {
  window.clearTimeout(timer);
  const s = pending;
  pending = null;
  if (s) void send(s);
}

// Finished stories whose draft this device has already cleared - so
// re-opening a finished story doesn't ask the server again every time.
const CLEARED = "taleo.draftsCleared.v1";
const cleared = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CLEARED) || "[]") as string[];
  } catch {
    return [];
  }
};

export function clearDraftFor(id: string): Promise<void> {
  window.clearTimeout(timer);
  if (pending?.id === id) pending = null;
  const done = cleared();
  if (done.includes(id)) return Promise.resolve();
  return fetch(`/api/draft?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    .then((r) => {
      if (!r.ok) return;
      try {
        localStorage.setItem(CLEARED, JSON.stringify([id, ...done].slice(0, 200)));
      } catch {}
    })
    .catch(() => {});
}

// (several parts of a page ask at once - the popup, the bookshelf card -
// and share the one answer)
let asked: { at: number; answer: Promise<Story | null> } | null = null;
export function fetchDraft(): Promise<Story | null> {
  if (asked && Date.now() - asked.at < 4000) return asked.answer;
  const answer = fetch("/api/draft", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<{ draft: Story | null }>) : { draft: null }))
    .then((d) => d.draft)
    .catch(() => null);
  asked = { at: Date.now(), answer };
  return answer;
}

/** Throws the draft away (done by the time this resolves). */
export async function discardDraft(id: string) {
  asked = null;
  await clearDraftFor(id);
}
