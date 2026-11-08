"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** A row that slides sideways when it runs past the edge (phones), with a
 *  floating arrow on the right that scrolls one item per tap and hides once
 *  the end is reached - like the homepage's "How it works" row. */
export function SideScroll({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (el) setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
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

  const next = () => {
    const el = ref.current;
    const item = el?.firstElementChild as HTMLElement | null;
    if (!el || !item) return;
    el.scrollBy({ left: item.getBoundingClientRect().width + 8, behavior: "smooth" });
  };

  return (
    <div className={`side-scroll ${more ? "has-more" : ""}`}>
      <div className={className} ref={ref}>
        {children}
      </div>
      <button type="button" className="steps-more side-scroll-more" onClick={next} aria-label={label} tabIndex={more ? 0 : -1}>
        ›
      </button>
    </div>
  );
}
