"use client";
import { useEffect, useState } from "react";

/**
 * Which library stories you've saved to your bookshelf. Fetched once per
 * visit (per account) and shared by every Save button on the page, so a
 * preview opened later - or stepped to - shows the right state at once; a
 * tap updates every button immediately and is sent in the background.
 */
export const SAVED_EVENT = "taleo:saved";

let ids: Set<string> | null = null;
let owner: string | null = null;
let loading: Promise<Set<string>> | null = null;

function load(userId: string): Promise<Set<string>> {
  // (a different account on this device starts afresh)
  if (owner !== userId) {
    owner = userId;
    ids = null;
    loading = null;
  }
  if (ids) return Promise.resolve(ids);
  loading ??= fetch("/api/user/saved")
    .then((r) => (r.ok ? r.json() : { ids: [] }))
    .then((d: { ids?: string[] }) => (ids = new Set(d.ids ?? [])))
    .catch(() => (ids = new Set()));
  return loading;
}

const announce = (id: string, saved: boolean) => window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { id, saved } }));

/** Saves (or unsaves) a story. Resolves true once the server has it. */
export async function setStorySaved(userId: string, id: string, saved: boolean): Promise<boolean> {
  const set = await load(userId);
  if (saved) set.add(id);
  else set.delete(id);
  announce(id, saved);
  try {
    const res = await fetch("/api/user/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, saved }),
    });
    if (!res.ok) throw new Error();
    return true;
  } catch {
    // undo, so the button never shows a save that didn't happen
    if (saved) set.delete(id);
    else set.add(id);
    announce(id, !saved);
    return false;
  }
}

/** Whether this story is saved (null while finding out), always for the
 *  story asked about - right from the first render once the list is in. */
export function useSaved(id: string, userId: string | null | undefined): boolean | null {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    if (!ids || owner !== userId) void load(userId).then(() => live && bump((n) => n + 1));
    const on = () => bump((n) => n + 1);
    window.addEventListener(SAVED_EVENT, on);
    return () => {
      live = false;
      window.removeEventListener(SAVED_EVENT, on);
    };
  }, [userId]);
  if (!userId || !ids || owner !== userId) return null;
  return ids.has(id);
}
