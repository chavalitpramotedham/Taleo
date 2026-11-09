"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** The keywords on a shelf, each once, in alphabetical order. */
export function categoriesOf(entries: { keyword?: string }[]): string[] {
  const seen = new Map<string, string>();
  for (const e of entries) {
    const k = e.keyword?.trim();
    if (k && !seen.has(k.toLowerCase())) seen.set(k.toLowerCase(), k);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export const matchesCategory = (entry: { keyword?: string }, category: string | null) =>
  !category || entry.keyword?.trim().toLowerCase() === category.toLowerCase();

/** "By category" pill for a shelf's filter row. Tapping it opens a list of
 *  the shelf's keywords; once one is picked the pill is selected and shows
 *  it, with an × to clear the filter - tapping the word itself reopens the
 *  list to pick another. Separate from the sort order. */
export function CategoryFilter({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // The filter row scrolls sideways on phones (and would clip a menu inside
  // it), so the menu is placed on the page itself, under the pill.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const w = menu.current?.offsetWidth ?? 200;
      // Right edge lined up with the pill's (it sits at the row's right end).
      const left = Math.max(12, Math.min(a.right - w, window.innerWidth - w - 12));
      setPos({ top: a.bottom + 8, left });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || anchor.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const scrolled = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scrolled);
    };
  }, [open]);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <span ref={anchor} className={`chip category-chip ${value ? "on" : ""}`}>
        <button
          type="button"
          className={`category-chip-label ${value ? "" : "category-chip-icon"}`}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={value ? `Category: ${value} - change` : "Filter by category"}
          title={value ? undefined : "Filter by category"}
        >
          {/* Not filtering: just a category icon. Filtering: the category's
              name (with the clear button beside it). */}
          {value ?? (
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden className="category-icon">
              <rect x="2.5" y="2.5" width="6.2" height="6.2" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11.3" y="2.5" width="6.2" height="6.2" rx="3.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2.5" y="11.3" width="6.2" height="6.2" rx="3.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11.3" y="11.3" width="6.2" height="6.2" rx="1.8" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
          {!value && (
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden className={`category-caret ${open ? "up" : ""}`}>
              <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {value && (
          <button type="button" className="category-chip-clear" onClick={() => pick(null)} aria-label={`Clear the ${value} filter`}>
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden>
              <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </span>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="music-dropdown category-menu"
            role="listbox"
            aria-label="Categories"
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, right: "auto" }}
          >
            <p className="music-dropdown-label">Category</p>
            <button type="button" role="option" aria-selected={!value} className={`music-dropdown-item ${!value ? "on" : ""}`} onClick={() => pick(null)}>
              All categories
            </button>
            {options.map((k) => (
              <button
                key={k}
                type="button"
                role="option"
                aria-selected={value === k}
                className={`music-dropdown-item ${value === k ? "on" : ""}`}
                onClick={() => pick(k)}
              >
                {k}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
