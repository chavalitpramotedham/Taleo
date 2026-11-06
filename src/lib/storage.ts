"use client";
import type { Story } from "./types";

const KEY = "taleo.stories.v1";

function readAll(): Story[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Story[]) : [];
  } catch {
    return [];
  }
}

function writeAll(stories: Story[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stories));
    window.dispatchEvent(new Event("taleo:stories"));
    return true;
  } catch {
    return false;
  }
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
