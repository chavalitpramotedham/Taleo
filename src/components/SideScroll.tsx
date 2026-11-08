"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** A row that slides sideways when it runs past the edge (phones), with
 *  arrows to scroll one item at a time - right while there's more to see,
 *  left once you've moved along - each hiding at its end. */
export function SideScroll({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [less, setLess] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
    setLess(el.scrollLeft > 6);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    el?.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el?.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [check]);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    const item = el?.firstElementChild as HTMLElement | null;
    if (!el || !item) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 8;
    const max = el.scrollWidth - el.clientWidth;
    // One card along - but never past either end.
    const to = Math.min(max, Math.max(0, el.scrollLeft + dir * (item.getBoundingClientRect().width + gap)));
    el.scrollTo({ left: to, behavior: "smooth" });
  };

  return (
    <div className={`side-scroll ${more ? "has-more" : ""} ${less ? "has-less" : ""}`}>
      <div className={className} ref={ref}>
        {children}
      </div>
      <button type="button" className="steps-more side-scroll-btn side-scroll-prev" onClick={() => step(-1)} aria-label="Back" tabIndex={less ? 0 : -1}>
        ‹
      </button>
      <button type="button" className="steps-more side-scroll-btn side-scroll-next" onClick={() => step(1)} aria-label={label} tabIndex={more ? 0 : -1}>
        ›
      </button>
    </div>
  );
}
