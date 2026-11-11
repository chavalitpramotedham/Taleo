"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** The specks of dust afloat in the light: where each is (across and
 *  down the screen, in hundredths of it - all in the upper part, where the
 *  light is), how big (px), and how its drifting is timed (seconds: delay,
 *  length - all different, so no two keep time). */
const MOTES: [number, number, number, number, number][] = [
  [8, 16, 3, 0, 9], [19, 27, 2, 1.4, 11], [31, 14, 2, 2.6, 12.5], [43, 33, 3, 0.7, 10],
  [55, 19, 2, 3.3, 13], [66, 40, 2, 1.9, 9.5], [77, 24, 3, 4.1, 11.5], [89, 36, 2, 2.2, 12],
  [13, 45, 2, 5, 10.5], [37, 52, 2, 3.8, 13.5], [60, 55, 2, 0.4, 12], [83, 13, 2, 2.9, 10],
  [25, 38, 3, 4.6, 11], [49, 12, 2, 1.1, 13],
];

/**
 * Daylight: light falling in as if from a skylight - broad, soft shafts
 * that already span the page as they pass under the menu bar, with specks
 * of dust afloat in them. The light is centred over the "Begin a story"
 * leaf in the menu on a phone, and over the Taleo leaves on wider screens.
 *
 * Behind the page (cards and words cover it), and built to cost next to
 * nothing: a handful of layers that are only ever faded (and the specks
 * nudged), which the browser's compositor does on its own; they hold
 * still while the page is scrolled; with reduced motion they don't move at
 * all. Shown by day only (see NightMode).
 */
export function DayLight() {
  const [at, setAt] = useState<{ x: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const narrow = window.matchMedia("(max-width: 640px)").matches;
      const from = document.querySelector(narrow ? ".nav-begin-pill" : ".brand-mark") ?? document.querySelector(".brand-mark");
      const r = from?.getBoundingClientRect();
      if (!r || !r.width) return setAt(null);
      setAt({ x: Math.round(r.left + r.width / 2) });
    };
    place();
    window.addEventListener("resize", place);
    // (still while the page is scrolled, like the night's lantern light)
    let rest = 0;
    const onScroll = () => {
      box.current?.classList.add("scrolling");
      window.clearTimeout(rest);
      rest = window.setTimeout(() => box.current?.classList.remove("scrolling"), 220);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(rest);
    };
  }, []);
  if (!at) return null;
  return createPortal(
    <div className="day-light" ref={box} aria-hidden style={{ "--sun-x": `${at.x}px` } as React.CSSProperties}>
      {/* the wash of brightness under the menu bar, then the shafts */}
      <div className="day-beams">
        <i className="day-glow" />
        <i className="day-ray r1" />
        <i className="day-ray r2" />
        <i className="day-ray r3" />
      </div>
      {MOTES.map(([x, y, size, delay, dur], i) => (
        <b key={i} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDelay: `-${delay}s`, animationDuration: `${dur}s` }} />
      ))}
    </div>,
    document.body,
  );
}
