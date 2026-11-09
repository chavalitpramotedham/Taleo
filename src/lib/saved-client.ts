"use client";
import { useEffect, useState } from "react";

/**
 * Which library stories you've saved to your bookshelf. Fetched once per
 * visit and shared by every Save button on the page; a tap updates the
 * button at once and is sent in the background.
 */
export const SAVED_EVENT = "taleo:saved";

let ids: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

function load(): Promise<Set<string>> {
  if (ids) return Promise.resolve(ids);
  loading ??= fetch("/api/user/saved")
    .then((r) => (r.ok ? r.json() : { ids: [] }))
    .then((d: { ids?: string[] }) => (ids = new Set(d.ids ?? [])))
    .catch(() => (ids = new Set()));
  return loading;
}

export async function setStorySaved(id: string, saved: boolean): Promise<boolean> {
  const set = await load();
  if (saved) set.add(id);
  else set.delete(id);
  window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { id, saved } }));
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
    window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { id, saved: !saved } }));
    return false;
  }
}

/** Whether this story is saved (null while finding out), kept in step with
 *  every other Save button on the page. */
export function useSaved(id: string, enabled: boolean): boolean | null {
  const [saved, setSaved] = useState<boolean | null>(ids ? ids.has(id) : null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void load().then((s) => live && setSaved(s.has(id)));
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; saved: boolean }>).detail;
      if (d?.id === id) setSaved(d.saved);
    };
    window.addEventListener(SAVED_EVENT, on);
    return () => {
      live = false;
      window.removeEventListener(SAVED_EVENT, on);
    };
  }, [id, enabled]);
  return saved;
}
