"use client";
import { useId, useState } from "react";

/** The technology behind Taleo, told for parents: four glassy spec cards (a row where
 *  they fit, two by two where they don't) - a modern counterpoint to the storybook pages around it. Every
 *  point is something the app really does. */
const ICONS = {
  grow: <path d="M4 20h4v-5H4zM10 20h4V10h-4zM16 20h4V4h-4z" />,
  family: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c0-3.2 2.5-5.2 5.5-5.2s5.5 2 5.5 5.2" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.2c1.8.7 3 2.4 3 4.8" />
    </>
  ),
  voice: <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />,
  spark: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
};

/** Written for parents: what each part of the technology does, and how it
 *  helps their child. */
const SPECS: { label: string; title: string; text: string; icon: React.ReactNode }[] = [
  {
    label: "For all ages",
    title: "Matched to your child's age",
    text: "Sentence length and vocabulary adjust to their age, from toddlers to early readers.",
    icon: ICONS.grow,
  },
  {
    label: "Generative AI",
    title: "Painted for you, in real-time",
    text: "Every story is written for your child, with each picture painted before your eyes.",
    icon: ICONS.spark,
  },
  {
    label: "Adaptive stories",
    title: "Your characters, your choices",
    text: "Add your own characters, then decide together what happens on each page.",
    icon: ICONS.family,
  },
  {
    label: "Read-aloud",
    title: "Natural voice and calm music",
    text: "Practise reading aloud with a clear, natural voice, and soothing music to end the day.",
    icon: ICONS.voice,
  },
];

export function TechShowcase() {
  // Collapsed by default: a pulsing "Learn more" opens the four cards, and
  // "Show less" folds them away again. (The cards stay in the page either
  // way, for search engines; folded away they're hidden from everyone else.)
  const [open, setOpen] = useState(false);
  const gridId = useId();
  return (
    <section className="tech" aria-labelledby="tech-title">
      <div className="tech-glow" aria-hidden />
      <header className="tech-head">
        <p className="tech-eyebrow">Gently powered by generative AI</p>
        <h2 id="tech-title">To keep the magic alive</h2>
      </header>
      <button
        type="button"
        className={`tech-more ${open ? "open" : ""}`}
        aria-expanded={open}
        aria-controls={gridId}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{open ? "Show less" : "Learn more"}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={`tech-fold ${open ? "open" : ""}`} id={gridId} inert={!open}>
        <div className="tech-fold-inner">
      <div className="tech-grid">
        {SPECS.map((s, i) => (
          <article key={s.label} className="tech-card" style={{ "--i": i } as React.CSSProperties}>
            <div className="tech-card-head">
              <span className="tech-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {s.icon}
                </svg>
              </span>
              <h3 className="tech-title">{s.title}</h3>
            </div>
            <p className="tech-text">{s.text}</p>
          </article>
        ))}
      </div>
        </div>
      </div>
    </section>
  );
}
