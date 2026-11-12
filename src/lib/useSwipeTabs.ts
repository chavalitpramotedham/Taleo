"use client";
import { useEffect, useRef } from "react";

/** Does the touch start inside something that scrolls sideways (a row of
 *  plan cards, a wide table), or something that takes a sideways drag of
 *  its own (a slider, a text box)? Then that gets the swipe, not the tabs. */
function ownsSideways(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches("input, textarea, select, [contenteditable=''], [contenteditable='true'], .modal-backdrop")) return true;
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}

/**
 * Swiping sideways anywhere on the page moves between its tabs: a swipe to
 * the left (the finger moving left) goes to the next tab, to the right
 * back to the one before. Not where the touch begins on something that
 * scrolls sideways itself, nor while a popup is open. A swipe has to be
 * deliberate - clearly more sideways than up or down, and a fair distance
 * - so scrolling the page never changes tab.
 */
export function useSwipeTabs(onNext: (() => void) | null, onPrev: (() => void) | null) {
  const next = useRef(onNext);
  const prev = useRef(onPrev);
  next.current = onNext;
  prev.current = onPrev;
  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1 || document.querySelector(".modal-backdrop") || ownsSideways(e.target as Element)) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const up = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const quick = Date.now() - start.t < 600;
      start = null;
      // (a deliberate sideways swipe: far enough, and well more across than down)
      if (Math.abs(dx) < (quick ? 50 : 90) || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      if (dx < 0) next.current?.();
      else prev.current?.();
    };
    const cancel = () => (start = null);
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", cancel);
    };
  }, []);
}
