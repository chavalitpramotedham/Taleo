"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** The specks of dust afloat in the light: where each is (across and
 *  down the screen, in hundredths of it - gathered under the skylight,
 *  where the light is), how big (px), and how its drifting is timed
 *  (seconds: delay, length - all different, so no two keep time). */
const MOTES: [number, number, number, number, number][] = [
  [38, 16, 3, 0, 9], [57, 24, 2, 1.4, 11], [47, 13, 2, 2.6, 12.5], [29, 31, 3, 0.7, 10],
  [66, 19, 2, 3.3, 13], [52, 38, 2, 1.9, 9.5], [21, 22, 3, 4.1, 11.5], [74, 33, 2, 2.2, 12],
  [43, 46, 2, 5, 10.5], [61, 50, 2, 3.8, 13.5], [34, 55, 2, 0.4, 12], [83, 21, 2, 2.9, 10],
  [14, 36, 3, 4.6, 11], [55, 12, 2, 1.1, 13],
];

/**
 * Daylight: the day's answer to the night's lantern - sunshine coming in
 * through a skylight on the left of the menu bar, spreading in soft
 * shafts down and out across the page, with specks of dust afloat in it.
 *
 * Most of it is behind the page (words and cards stay crisp on top); a
 * faint wash of the same light lies over the page, so cards near the top
 * catch a little of it. Built to cost next to nothing: a handful of small
 * layers that are only ever faded (and the specks nudged), which the
 * browser's compositor does on its own; they hold still while the page is
 * scrolled; with reduced motion they don't move at all. Shown by day only
 * (see NightMode).
 */
export function DayLight() {
  // Where the light comes in, across the screen: over the "Begin a story"
  // leaf in the menu on a phone, over the Taleo title on wider screens.
  const [at, setAt] = useState<number | null>(null);
  const back = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const narrow = window.matchMedia("(max-width: 640px)").matches;
      const from = (narrow ? document.querySelector(".nav-begin-pill") : null) ?? document.querySelector(".brand");
      const r = from?.getBoundingClientRect();
      // (never hard against the edge of the screen: the light needs a little room to its left)
      setAt(r && r.width ? Math.max(Math.round(r.left + r.width / 2), Math.round(window.innerWidth * 0.14)) : Math.round(window.innerWidth * 0.2));
    };
    place();
    window.addEventListener("resize", place);
    // (still while the page is scrolled, like the night's lantern light)
    let rest = 0;
    const set = (on: boolean) => {
      back.current?.classList.toggle("scrolling", on);
      front.current?.classList.toggle("scrolling", on);
    };
    const onScroll = () => {
      set(true);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => set(false), 220);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(rest);
    };
  }, []);
  if (at === null) return null;
  const sun = { "--sun-x": `${at}px` } as React.CSSProperties;
  return createPortal(
    <>
      <div className="day-light" ref={back} aria-hidden style={sun}>
        <i className="day-room" />
        <div className="day-beams">
          <i className="day-glow" />
          <i className="day-ray r1" />
          <i className="day-ray r2" />
          <i className="day-ray r3" />
          <i className="day-ray r4" />
        </div>
        {MOTES.map(([x, y, size, delay, dur], i) => (
          <b key={i} style={{ left: `calc(var(--sun-x) + ${x - 30}vw)`, top: `${y}%`, width: size, height: size, animationDelay: `-${delay}s`, animationDuration: `${dur}s` }} />
        ))}
      </div>
      <div className="day-shine" ref={front} aria-hidden style={sun}>
        <i />
      </div>
    </>,
    document.body,
  );
}
