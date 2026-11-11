"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Schoolbell } from "next/font/google";
import { useNightMode } from "./NightMode";

// (a thin, wobbly notebook scribble: the same loose pencil line as the arrow)
// (not preloaded: one small note, and gone at night - it mustn't hold up
// the page it is pencilled on)
const pencil = Schoolbell({ subsets: ["latin"], weight: "400", display: "swap", preload: false });

/**
 * A pencilled note in the margin, shown by daylight on the first step of
 * making a story: "turn lights off for bedtime", with a looping
 * arrow up to the night-mode switch in the menu bar. It hangs just under
 * the bar, its arrowhead beneath the switch wherever the bar has put it,
 * and is gone the moment the lights go off.
 */
export function BedtimeHint() {
  const { night } = useNightMode();
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  useLayoutEffect(() => {
    if (night) return;
    const place = () => {
      const sw = document.querySelector(".night-toggle")?.getBoundingClientRect();
      const bar = document.querySelector(".topbar")?.getBoundingClientRect();
      if (!sw || !bar || !sw.width) return setAt(null);
      // (the bar stays at the top of the screen, so its height is where
      // the page below it begins)
      setAt({ top: Math.round(bar.height), right: Math.round(document.documentElement.clientWidth - (sw.left + sw.width / 2)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [night]);
  // While the note is up, the switch it points at catches the light (a
  // sheen crosses it once the note has been written out).
  const shown = !night && at !== null;
  useEffect(() => {
    if (!shown) return;
    const sw = document.querySelector(".night-toggle");
    sw?.classList.add("hinted");
    return () => sw?.classList.remove("hinted");
  }, [shown]);
  if (night || !at) return null;
  return createPortal(
    <p className={`bedtime-hint ${pencil.className}`} style={{ top: at.top, right: at.right }}>
      <span className="bedtime-hint-words">turn lights off<br />for bedtime</span>
      <svg className="bedtime-hint-arrow" viewBox="0 0 64 60" aria-hidden="true" focusable="false">
        <path d="M3 50 C14 56 27 52 30 41 C33 31 21 27 20 36 C19 46 38 45 46 33 C51 25 53 16 53 7" />
        <path d="M44 15 C48 12 51 9 53 5 C55 9 58 13 61 16" />
      </svg>
    </p>,
    document.body,
  );
}
