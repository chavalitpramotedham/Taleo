"use client";
import type { Story } from "./types";

/**
 * Keeps the signed-in user's unfinished story saved to their account (see
 * /api/draft), batched: a burst of changes (pages streaming in, paintings
 * finishing) becomes one save a few seconds after it settles, rather than
 * a write per change. Finishing the story clears the draft.
 */

const DELAY_MS = 5000;
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
  if (story.status === "complete" && story.publishedPainted) return clearDraftFor(story.id);
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

export function clearDraftFor(id: string) {
  window.clearTimeout(timer);
  if (pending?.id === id) pending = null;
  void fetch(`/api/draft?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
}

export async function fetchDraft(): Promise<Story | null> {
  try {
    const res = await fetch("/api/draft", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { draft: Story | null }).draft;
  } catch {
    return null;
  }
}

export async function discardDraft(id: string) {
  clearDraftFor(id);
}
