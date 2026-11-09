"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface StepItem {
  n: string;
  title: string;
  text: string;
  /** An illustration for the step, shown with the dreamy painted edge. */
  image?: string;
  alt?: string;
}

/** "How it works": a sideways-scrolling row of small step boxes. When the
 *  row runs off the edge (phones), a floating arrow on the right invites a
 *  swipe and scrolls one box per tap; it hides once the end is reached. */
export function StepsScroller({ steps }: { steps: StepItem[] }) {
  const ref = useRef<HTMLOListElement>(null);
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
    const box = el?.querySelector("li");
    if (!el || !box) return;
    // One step along - but never past the end.
    const to = Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + box.getBoundingClientRect().width + 12);
    el.scrollTo({ left: to, behavior: "smooth" });
  };

  return (
    <div className={`steps-wrap ${more ? "has-more" : ""}`}>
      <ol className="steps" aria-label="How it works" ref={ref}>
        {steps.map((s) => (
          <li key={s.n} className={`step ${s.image ? "step-pictured" : ""}`}>
            {s.image && (
              <span className="step-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="painted-edge-square" src={s.image} alt={s.alt ?? ""} width={560} height={560} loading="lazy" decoding="async" />
              </span>
            )}
            <h3>
              <span className="numeral">{s.n}</span> {s.title}
            </h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <button type="button" className="steps-more" onClick={next} aria-label="Next step" tabIndex={more ? 0 : -1}>
        ›
      </button>
    </div>
  );
}
