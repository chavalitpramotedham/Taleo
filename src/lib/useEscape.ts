"use client";
import { useEffect, useRef } from "react";

/** Escape closes a dialog, as a tap outside it does. (`active`: only
 *  while it's open; a key already used by something nearer - a menu
 *  inside the dialog - is left alone.) */
export function useEscape(close: () => void, active = true) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      latest.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active]);
}
