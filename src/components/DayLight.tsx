"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** The specks of dust afloat in the beams: where each is, measured from
 *  the point the light comes from (across and down, in hundredths of the
 *  screen's longer side, so they stay inside the beams on any screen), how
 *  big (px), and how its drifting is timed (seconds: delay, length - all
 *  different, so no two keep time). */
const MOTES: [number, number, number, number, number][] = [
  [3, 13, 3, 0, 9], [8, 21, 2, 1.4, 11], [2, 29, 2, 2.6, 12.5], [13, 25, 3, 0.7, 10],
  [7, 37, 2, 3.3, 13], [17, 38, 2, 1.9, 9.5], [5, 47, 3, 4.1, 11.5], [21, 31, 2, 2.2, 12],
  [11, 50, 2, 5, 10.5], [26, 44, 2, 3.8, 13.5],
];

/**
 * Daylight: three soft rays of sunshine fanning down and across from the
 * top left of the page, with a few motes of dust catching the light. They
 * start from the "Begin a story" leaf in the menu on a phone, and from the
 * Taleo leaves on wider screens - as if the light came in over them.
 *
 * Behind the page (cards and words cover it), and built to cost next to
 * nothing: a handful of small layers that are only ever faded (and the
 * motes nudged), which the browser's compositor does on its own; they hold
 * still while the page is scrolled; with reduced motion they don't move at
 * all. Shown by day only (see NightMode).
 */
export function DayLight() {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const narrow = window.matchMedia("(max-width: 640px)").matches;
      const from = document.querySelector(narrow ? ".nav-begin-pill" : ".brand-mark") ?? document.querySelector(".brand-mark");
      const r = from?.getBoundingClientRect();
      if (!r || !r.width) return setAt(null);
      setAt({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
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
    <div className="day-light" ref={box} aria-hidden style={{ "--sun-x": `${at.x}px`, "--sun-y": `${at.y}px` } as React.CSSProperties}>
      {/* the bright spot the light comes from, then its beams */}
      <i className="day-glow" />
      <i className="day-ray r1" />
      <i className="day-ray r2" />
      <i className="day-ray r3" />
      {MOTES.map(([x, y, size, delay, dur], i) => (
        <b key={i} style={{ left: `calc(var(--sun-x) + ${x}vmax)`, top: `calc(var(--sun-y) + ${y}vmax)`, width: size, height: size, animationDelay: `-${delay}s`, animationDuration: `${dur}s` }} />
      ))}
    </div>,
    document.body,
  );
}
