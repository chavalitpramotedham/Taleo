"use client";
import type { Story } from "./types";

const KEY = "taleo.stories.v1";

// The stories as this tab last read or wrote them: every story on the
// device, paintings and all, is one long string in the browser's storage,
// and reading it back (parsing the lot) on every change to the story being
// read was work done many times a second while a story is being written.
// It's read once, and again only if another tab changes it.
let mem: Story[] | null = null;
let listening = false;
function readAll(): Story[] {
  if (mem) return [...mem];
  try {
    if (!listening) {
      listening = true;
      window.addEventListener("storage", (e) => {
        if (e.key === KEY || e.key === null) {
          // (another tab wrote: what this tab was about to write is put down first)
          flushStories();
          mem = null;
        }
      });
      // (anything still waiting to be written goes down as the page is left)
      window.addEventListener("pagehide", flushStories);
      document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushStories());
    }
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Stories saved before multi-character support existed have no companions.
    mem = (parsed as Story[]).map((s) => ({ ...s, companions: s.companions ?? [] }));
    return [...mem];
  } catch {
    return [];
  }
}

let waiting = 0;
function writeAll(stories: Story[]): boolean {
  window.clearTimeout(waiting);
  waiting = 0;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stories));
    mem = stories;
    window.dispatchEvent(new Event("taleo:stories"));
    return true;
  } catch {
    return false;
  }
}

/** Writes down anything saved "soon" that hasn't been written yet. */
export function flushStories() {
  if (!waiting || !mem) return;
  window.clearTimeout(waiting);
  waiting = 0;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {}
}

/** Saves a story that's changing many times a second (one being written:
 *  each page, each painting as it arrives). This tab sees the change at
 *  once; the browser's storage gets it a moment later, the changes of that
 *  moment in one write - and at once if the page is left. */
export function saveStorySoon(story: Story) {
  const all = readAll().filter((s) => s.id !== story.id);
  all.push({ ...story, updatedAt: Date.now() });
  mem = all;
  if (!waiting) waiting = window.setTimeout(flushStories, 400);
  window.dispatchEvent(new Event("taleo:stories"));
}

export const listStories = (): Story[] =>
  readAll().sort((a, b) => b.updatedAt - a.updatedAt);

export const getStory = (id: string): Story | undefined =>
  readAll().find((s) => s.id === id);

export function saveStory(story: Story): boolean {
  const all = readAll().filter((s) => s.id !== story.id);
  all.push({ ...story, updatedAt: Date.now() });
  return writeAll(all);
}

export function deleteStory(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export const newId = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
