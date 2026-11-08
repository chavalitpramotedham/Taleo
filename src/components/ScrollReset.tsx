"use client";
import { useLayoutEffect } from "react";

/** Every screen starts at the top: whenever a page is navigated to, the
 *  window scrolls back to the very top (instantly, before it's seen), so
 *  no screen opens part-way down because the last one was scrolled. */
export function ScrollReset() {
  useLayoutEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  return null;
}
