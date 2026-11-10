"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

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
  className = "",
}: {
  options: readonly Option<T>[];
  value: T;
  onChange?: (key: T) => void;
  label?: string;
  /** Pages rather than a setting: links in a <nav>. */
  nav?: boolean;
  className?: string;
}) {
  const shell = useRef<HTMLElement | null>(null);
  // where the chosen option lies, once it can be measured (until then, and
  // without scripts, the chosen option is simply coloured itself)
  const [at, setAt] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = shell.current;
    if (!el) return;
    const measure = () => {
      const on = el.querySelector<HTMLElement>(".seg-opt.on");
      if (!on) return setAt(null);
      setAt((cur) => (cur && cur.x === on.offsetLeft && cur.w === on.offsetWidth ? cur : { x: on.offsetLeft, w: on.offsetWidth }));
    };
    measure();
    // (the lettering's font arriving, the phone's narrower pills...)
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [value, options]);

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
          <Link key={o.key} href={o.href} className={`chip seg-opt${o.key === value ? " on" : ""}`} aria-current={o.key === value ? "page" : undefined}>
            {o.label}
          </Link>
        ) : (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={o.key === value}
            className={`chip seg-opt${o.key === value ? " on" : ""}`}
            onClick={() => onChange?.(o.key)}
          >
            {o.label}
          </button>
        ),
      )}
    </Shell>
  );
}
