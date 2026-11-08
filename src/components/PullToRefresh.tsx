"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Every page offers pull-to-refresh, except where a reload would lose
 *  something: setting up a story (/create) and reading one (/story/<id>,
 *  a library story at /store/<id>, a shared link at /shared) - a stray
 *  pull mid-read mustn't reload the book. */
const canPullToRefresh = (path: string) => {
  const p = path.replace(/\/$/, "") || "/";
  return !(p.startsWith("/create") || p.startsWith("/story/") || p.startsWith("/store/") || p.startsWith("/shared"));
};

// A deliberate pull is needed to reload (about 130px of finger travel), so
// an ordinary scroll back to the top never reloads by accident.
const THRESHOLD = 64;
const MAX_PULL = 104;
const HOLD_MS = 350; // how long the spinner sits at full strength before fading
const FADE_MS = 450; // fade-out before the reload

/**
 * A touch-drag-down-from-the-top-of-the-page gesture reloads the app, the
 * way native pull-to-refresh does - needed because installed/standalone
 * PWAs (see manifest.ts) generally lose the browser's own version of it.
 *
 * Built to keep up with the finger: the page content slides down with a
 * transform (no re-layout of the page), the spinner is revealed behind it,
 * and each move is applied at most once per frame, straight to the DOM -
 * no React re-render while dragging.
 */
export function PullToRefresh() {
  const spinner = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const enabled = canPullToRefresh(usePathname());

  useEffect(() => {
    if (!enabled) return;
    const spin = spinner.current;
    const circle = ring.current;
    const content = () => document.querySelector<HTMLElement>("main > .page-enter");
    let startY: number | null = null;
    let pull = 0;
    let raf = 0;
    let refreshing = false;

    const draw = () => {
      raf = 0;
      const el = content();
      if (el) el.style.transform = pull ? `translate3d(0, ${pull}px, 0)` : "";
      if (spin) {
        // The holder only moves (and grows a touch once far enough); the
        // ring inside only turns, about its own centre.
        spin.style.opacity = String(Math.min(1, pull / THRESHOLD));
        spin.style.transform = `translate3d(-50%, ${pull / 2 - 11}px, 0) scale(${pull >= THRESHOLD ? 1.15 : 1})`;
        spin.classList.toggle("ready", pull >= THRESHOLD);
      }
      if (circle && !refreshing) circle.style.transform = `rotate(${pull * 4}deg)`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const settle = (to: number) => {
      const el = content();
      for (const n of [el, spin]) if (n) n.style.transition = "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease";
      pull = to;
      schedule();
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1) {
        startY = null;
        return;
      }
      startY = e.touches[0].clientY;
      for (const n of [content(), spin]) if (n) n.style.transition = "none";
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      if (window.scrollY > 0) {
        startY = null;
        settle(0);
        return;
      }
      const dy = e.touches[0].clientY - startY;
      pull = dy > 0 ? Math.min(dy * 0.5, MAX_PULL) : 0;
      schedule();
    };
    const onEnd = () => {
      if (startY == null) return;
      startY = null;
      if (pull >= THRESHOLD) {
        refreshing = true;
        settle(THRESHOLD);
        if (circle) circle.style.transform = "";
        spin?.classList.add("spinning");
        window.setTimeout(() => {
          document.documentElement.classList.add("pull-reloading");
          window.setTimeout(() => window.location.reload(), FADE_MS);
        }, HOLD_MS);
      } else {
        settle(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="pull-refresh" aria-hidden>
      <div className="pull-refresh-spin" ref={spinner}>
        <div className="pull-refresh-ring" ref={ring} />
      </div>
    </div>
  );
}
