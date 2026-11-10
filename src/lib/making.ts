"use client";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Whether a story is being made right now on this page (its words being
 * written or its pictures painted). The reader says so; the menu's maple
 * leaf listens, and glows instead of offering to begin another.
 */
let making = false;
const listeners = new Set<() => void>();

function set(v: boolean) {
  if (making === v) return;
  making = v;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Marks a story as being made for as long as `on` holds on this page. */
export function useMarkMaking(on: boolean) {
  useEffect(() => {
    set(on);
    return () => set(false);
  }, [on]);
}

export const useMaking = () => useSyncExternalStore(subscribe, () => making, () => false);
