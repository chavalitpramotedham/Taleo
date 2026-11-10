"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** How long the pill takes to slide across (the stylesheet's .seg-thumb). */
const SLIDE_MS = 260;

type Option<T extends string> = { key: T; label: React.ReactNode; href?: string };

/** An either/or choice as one grey pill: the options sit side by side in
 *  it and a smaller russet pill lies over the chosen one, sliding across
 *  when the choice changes. The whole is the height of an ordinary filter
 *  pill, so it sits level with whatever shares its row.
 *
 *  Options with an `href` are links (the choice is then a page, and
 *  `onChange` isn't needed). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  nav = false,
  keepScroll = false,
  className = "",
}: {
  options: readonly Option<T>[];
  value: T;
  onChange?: (key: T) => void;
  label?: string;
  /** Pages rather than a setting: links in a <nav>. */
  nav?: boolean;
  /** Links that only change what the page shows: stay where you are on it
   *  rather than jumping back to the top. */
  keepScroll?: boolean;
  className?: string;
}) {
  const shell = useRef<HTMLElement | null>(null);
  // where the chosen option lies, once it can be measured (until then, and
  // without scripts, the chosen option is simply coloured itself)
  const [at, setAt] = useState<{ x: number; w: number } | null>(null);
  // The pill slides first and the choice is passed on as it arrives: what
  // the choice changes (a shelf of paintings redrawn) is far heavier than
  // the slide, and done in the same moment it swallowed the slide's frames
  // - the pill simply appeared on the other side.
  const [picked, setPicked] = useState<T | null>(null);
  const passOn = useRef(0);
  useEffect(() => () => window.clearTimeout(passOn.current), []);
  // (the choice has caught up, or was changed from outside: follow it)
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setPicked(null);
  }
  const shown = picked ?? value;
  const pick = (key: T) => {
    if (key === shown) return;
    window.clearTimeout(passOn.current);
    // (nothing to wait for where nothing slides)
    if (!at || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onChange?.(key);
    setPicked(key);
    passOn.current = window.setTimeout(() => onChange?.(key), SLIDE_MS);
  };

  useLayoutEffect(() => {
    const el = shell.current;
    if (!el) return;
    const measure = () => {
      const on = el.querySelector<HTMLElement>(".seg-opt.on");
      if (!on) return setAt(null);
      setAt((cur) => (cur && cur.x === on.offsetLeft && cur.w === on.offsetWidth ? cur : { x: on.offsetLeft, w: on.offsetWidth }));
      // (a long row that scrolls sideways on a narrow screen keeps the
      // chosen option in sight)
      if (el.scrollWidth > el.clientWidth + 1) {
        const left = on.offsetLeft - 3;
        const right = on.offsetLeft + on.offsetWidth + 3 - el.clientWidth;
        if (el.scrollLeft > left) el.scrollLeft = left;
        else if (el.scrollLeft < right) el.scrollLeft = right;
      }
    };
    measure();
    // (the lettering's font arriving, the phone's narrower pills...)
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [shown, options]);

  const Shell = nav ? "nav" : "div";
  return (
    <Shell
      ref={shell as React.Ref<HTMLDivElement>}
      className={`seg${options.length === 2 ? " seg-even" : ""}${at ? " measured" : ""}${className ? ` ${className}` : ""}`}
      role={nav ? undefined : "tablist"}
      aria-label={label}
    >
      {at && <span className="seg-thumb" aria-hidden style={{ width: at.w, transform: `translateX(${at.x}px)` }} />}
      {options.map((o) =>
        o.href ? (
          <Link
            key={o.key}
            href={o.href}
            scroll={!keepScroll}
            // (the pill slides at once; the page follows when it arrives)
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              if (o.key === shown) return;
              setPicked(o.key);
              // (for a list waiting on this choice: see FilteredList)
              if (keepScroll) window.dispatchEvent(new Event("taleo:filtering"));
            }}
            className={`chip seg-opt${o.key === shown ? " on" : ""}`}
            aria-current={o.key === shown ? "page" : undefined}
          >
            {o.label}
          </Link>
        ) : (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={o.key === shown}
            className={`chip seg-opt${o.key === shown ? " on" : ""}`}
            onClick={() => pick(o.key)}
          >
            {o.label}
          </button>
        ),
      )}
    </Shell>
  );
}
