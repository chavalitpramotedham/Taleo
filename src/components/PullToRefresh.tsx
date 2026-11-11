"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { LeafLoader } from "./Icons";

/** Every page offers pull-to-refresh, story pages included (a pull has to
 *  be deliberate - well past a normal scroll to the top). Only story setup
 *  (/create) leaves it out: a reload there would lose what's been chosen. */
const canPullToRefresh = (path: string) => {
  const p = path.replace(/\/$/, "") || "/";
  return !p.startsWith("/create");
};

// A deliberate pull is needed to reload (about 130px of finger travel), so
// an ordinary scroll back to the top never reloads by accident.
const THRESHOLD = 64;
const MAX_PULL = 104;
const HOLD_MS = 350; // how long the spinner sits at full strength before fading
const FADE_MS = 450; // fade-out before the reload

const BOUNCE_MAX = 72; // furthest a plain elastic stretch goes

/** Is the touch inside something that scrolls on its own (the words column
 *  of an open book, a popup, a sideways row)? Then that gets the gesture. */
function inOwnScroller(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return true;
  }
  return false;
}

/**
 * The page's ends feel alive rather than dead-stopped. Pulled past the top,
 * a page reloads (pull-to-refresh, needed because installed/standalone PWAs
 * lose the browser's own; on story setup it only stretches and springs
 * back). Pulled past the bottom, every page stretches a little and springs
 * back.
 *
 * Built to keep up with the finger: the content slides with a transform (no
 * re-layout), the loader is revealed behind it, and each move is applied at
 * most once per frame, straight to the DOM - no React re-render while
 * dragging. Only the content moves, never anything pinned to the screen.
 */
export function PullToRefresh() {
  const spinner = useRef<HTMLDivElement>(null);
  const reloadable = canPullToRefresh(usePathname());

  useEffect(() => {
    const spin = reloadable ? spinner.current : null;
    // What moves: the page - or, on a story page, the title and the book
    // (its page buttons float, pinned to the screen, and must stay put).
    const targets = (): HTMLElement[] => {
      const story = document.querySelectorAll<HTMLElement>("main .reader > .reader-top, main .reader > .book-stage");
      if (story.length) return Array.from(story);
      const page = document.querySelector<HTMLElement>("main > .page-enter");
      return page ? [page] : [];
    };
    let startX = 0;
    let startY: number | null = null;
    let edge: "top" | "bottom" | "both" | null = null;
    let dir: 1 | -1 | 0 = 0; // 1 = pulling down at the top, -1 = up at the bottom
    let pull = 0;
    let raf = 0;
    let refreshing = false;
    let moving: HTMLElement[] = [];

    const draw = () => {
      raf = 0;
      for (const el of moving) el.style.transform = pull ? `translate3d(0, ${pull}px, 0)` : "";
      if (spin) {
        const p = Math.max(0, pull);
        spin.style.opacity = String(Math.min(1, p / THRESHOLD));
        spin.style.transform = `translate3d(-50%, ${p / 2 - 24}px, 0) scale(${p >= THRESHOLD ? 1.15 : 0.7 + (0.3 * p) / THRESHOLD})`;
        const ready = p >= THRESHOLD;
        if (spin.classList.contains("ready") !== ready) spin.classList.toggle("ready", ready);
        // The loader's leaves are the title's own: as the pull begins they
        // leave the title (which closes up, alone), and they go back to it
        // if the pull is let go.
        const taken = p > 10;
        const root = document.documentElement;
        if (root.classList.contains("leaves-taken") !== taken) root.classList.toggle("leaves-taken", taken);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const settle = (to: number) => {
      for (const n of [...moving, spin]) if (n) n.style.transition = "transform 0.45s cubic-bezier(0.22, 1.25, 0.36, 1), opacity 0.3s ease";
      pull = to;
      schedule();
      if (to === 0) {
        const done = moving;
        window.setTimeout(() => {
          if (startY == null && !refreshing) for (const el of done) el.style.willChange = "";
        }, 480);
      }
    };

    const atTop = () => window.scrollY <= 0;
    const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;

    const onStart = (e: TouchEvent) => {
      startY = null;
      // Never while a popup is open (moving the page would shift the popup
      // out from under the finger and lose the tap), never mid-reload, and
      // not inside something that scrolls by itself.
      if (refreshing || e.touches.length !== 1 || document.querySelector(".modal-backdrop") || inOwnScroller(e.target as Element)) return;
      const top = atTop();
      const bottom = atBottom();
      if (!top && !bottom) return;
      edge = top && bottom ? "both" : top ? "top" : "bottom";
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dir = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      // A tap (or a finger that barely moves) never moves the page; a
      // sideways swipe (turning a page) isn't a stretch either.
      if (!dir) {
        if (Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) return void (startY = null);
        const wantDown = dy > 0;
        if (wantDown && edge === "bottom") return void (startY = null);
        if (!wantDown && edge === "top") return void (startY = null);
        dir = wantDown ? 1 : -1;
        moving = targets();
        for (const el of moving) {
          el.style.transition = "none";
          el.style.willChange = "transform";
        }
        if (spin) spin.style.transition = "none";
      }
      // Scrolled away from the edge after all: let go.
      if ((dir === 1 && !atTop()) || (dir === -1 && !atBottom())) {
        startY = null;
        settle(0);
        return;
      }
      const d = Math.max(0, (dir === 1 ? dy : -dy) - 8);
      // Pull-to-refresh pulls further; a plain stretch gives sooner.
      const amount = dir === 1 && spin ? Math.min(d * 0.5, MAX_PULL) : BOUNCE_MAX * (1 - Math.exp(-d / 160));
      pull = dir * amount;
      schedule();
    };
    const onEnd = () => {
      if (startY == null) return;
      startY = null;
      if (!dir) return; // just a tap
      if (dir === 1 && spin && pull >= THRESHOLD) {
        refreshing = true;
        settle(THRESHOLD);
        spin.classList.add("spinning");
        window.setTimeout(() => {
          document.documentElement.classList.add("pull-reloading");
          // (the page that arrives opens without them too, and puts them
          // back in the title once it has loaded: see LEAVES_BACK)
          try {
            sessionStorage.setItem("taleo.pulled", "1");
          } catch {}
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
  }, [reloadable]);

  if (!reloadable) return null;
  return (
    <div className="pull-refresh" aria-hidden>
      <div className="pull-refresh-spin" ref={spinner}>
        {/* the app's own falling-leaves loader, as everywhere else */}
        <LeafLoader size={26} />
      </div>
    </div>
  );
}
