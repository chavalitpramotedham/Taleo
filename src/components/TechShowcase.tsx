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

/** Written for parents: four things the technology does for their child. */
const SPECS: { label: string; title: string; text: string; icon: React.ReactNode }[] = [
  {
    label: "Generative AI",
    title: "Made fresh, just for them",
    text: "State-of-the-art AI writes and paints every page of every story.",
    icon: ICONS.spark,
  },
  {
    label: "Adaptive",
    title: "Your characters, your story",
    text: "Bring in your own characters and shape the plot together, page by page.",
    icon: ICONS.family,
  },
  {
    label: "Read-aloud",
    title: "Soothing sound, clear voice",
    text: "Gentle music and a natural voice that reads along, helping with pronunciation.",
    icon: ICONS.voice,
  },
  {
    label: "Grows with them",
    title: "Learning at every age",
    text: "Stories and vocabulary grow richer as your child does, from toddlers to young readers.",
    icon: ICONS.grow,
  },
];

export function TechShowcase() {
  return (
    <section className="tech" aria-labelledby="tech-title">
      <div className="tech-glow" aria-hidden />
      <header className="tech-head">
        <p className="tech-eyebrow">Thoughtful technology</p>
        <h2 id="tech-title">The magic inside</h2>
        <p className="tech-sub">Generative AI, used gently and for good - to help little imaginations grow.</p>
      </header>
      <div className="tech-grid">
        {SPECS.map((s, i) => (
          <article key={s.label} className="tech-card" style={{ "--i": i } as React.CSSProperties}>
            <span className="tech-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {s.icon}
              </svg>
            </span>
            <p className="tech-label">
              <span>{String(i + 1).padStart(2, "0")}</span>
              {s.label}
            </p>
            <h3 className="tech-title">{s.title}</h3>
            <p className="tech-text">{s.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
