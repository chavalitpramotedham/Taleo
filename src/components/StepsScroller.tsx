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
 *  swipe and scrolls one box per tap; it hides once the end is reached,
 *  and a matching arrow on the left appears once you've moved along. */
export function StepsScroller({ steps }: { steps: StepItem[] }) {
  const ref = useRef<HTMLOListElement>(null);
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

  /** One step along either way - but never past either end. */
  const step = (dir: 1 | -1) => {
    const el = ref.current;
    const box = el?.querySelector("li");
    if (!el || !box) return;
    const to = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + dir * (box.getBoundingClientRect().width + 12)));
    el.scrollTo({ left: to, behavior: "smooth" });
  };

  return (
    <div className={`steps-wrap ${more ? "has-more" : ""} ${less ? "has-less" : ""}`}>
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
      <button type="button" className="steps-more steps-back" onClick={() => step(-1)} aria-label="Previous step" tabIndex={less ? 0 : -1}>
        ‹
      </button>
      <button type="button" className="steps-more steps-next" onClick={() => step(1)} aria-label="Next step" tabIndex={more ? 0 : -1}>
        ›
      </button>
    </div>
  );
}
