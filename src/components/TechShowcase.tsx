import { SideScroll } from "./SideScroll";

/** The technology behind Taleo, told for parents: a row of glassy spec
 *  cards - a modern counterpoint to the storybook pages around it. Every
 *  point is something the app really does. */
const ICONS = {
  book: (
    <>
      <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" />
      <path d="M12 6.5v13" />
    </>
  ),
  grow: <path d="M4 20h4v-5H4zM10 20h4V10h-4zM16 20h4V4h-4z" />,
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  branch: (
    <>
      <path d="M6 20V9a3 3 0 0 1 3-3h6" />
      <path d="M12 3l3 3-3 3" />
      <path d="M6 13c0-2 1.5-3 3.5-3H18" />
      <path d="M15 7.5L18 10l-3 2.5" />
    </>
  ),
  family: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c0-3.2 2.5-5.2 5.5-5.2s5.5 2 5.5 5.2" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.2c1.8.7 3 2.4 3 4.8" />
    </>
  ),
  voice: <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />,
  tap: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 10.5a1.5 1.5 0 0 1 3 0V12a1.5 1.5 0 0 1 3 0v3.5a5.5 5.5 0 0 1-5.5 5.5h-.8a5 5 0 0 1-4-2l-2.5-3.4a1.5 1.5 0 0 1 2.3-1.9L9 15" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />,
  spark: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  devices: (
    <>
      <rect x="3" y="5" width="13" height="10" rx="1.5" />
      <path d="M7 19h5" />
      <rect x="16" y="9" width="5" height="10" rx="1.2" />
    </>
  ),
};

/** Written for parents: what the technology does for their child. */
const SPECS: { label: string; title: string; text: string; icon: React.ReactNode }[] = [
  {
    label: "Learning",
    title: "Built for growing minds",
    text: "Every story is shaped around a new word and a warm lesson, pitched to your child's age.",
    icon: ICONS.book,
  },
  {
    label: "Adaptive",
    title: "Grows with your child",
    text: "Vocabulary, pacing and plot adjust across six stages, from first words to confident young readers.",
    icon: ICONS.grow,
  },
  {
    label: "Safety",
    title: "AI you can trust at bedtime",
    text: "Always gentle and age-appropriate - no scary turns, no ads, no endless feeds.",
    icon: ICONS.shield,
  },
  {
    label: "Creativity",
    title: "Your child is the author",
    text: "They decide what happens next, building imagination, choice-making and a love of books.",
    icon: ICONS.branch,
  },
  {
    label: "Personal",
    title: "Your family, in the story",
    text: "Add a sibling, a pet or a favourite toy, with notes on who they are and how they're related.",
    icon: ICONS.family,
  },
  {
    label: "Literacy",
    title: "A read-along that teaches",
    text: "A warm, natural voice reads each page as the words light up, linking sounds to letters.",
    icon: ICONS.voice,
  },
  {
    label: "Vocabulary",
    title: "Tap, hear, remember",
    text: "Tap each page's special word to see it acted out and hear it spoken - learning through play.",
    icon: ICONS.tap,
  },
  {
    label: "Together",
    title: "Screen time that connects",
    text: "Made to be read side by side, so the screen becomes a shared moment, not a solo scroll.",
    icon: ICONS.heart,
  },
  {
    label: "Original",
    title: "Every book is one of a kind",
    text: "Nothing is pre-written: each story is created fresh for your child, to keep, revisit and share.",
    icon: ICONS.star,
  },
  {
    label: "Technology",
    title: "State-of-the-art, quietly",
    text: "Frontier AI from Anthropic writes, paints and narrates every story - and stays in the background.",
    icon: ICONS.spark,
  },
  {
    label: "Wind-down",
    title: "Calm for bedtime",
    text: "Soft music, a lamplit night mode and a gentle pace help little ones settle for sleep.",
    icon: ICONS.moon,
  },
  {
    label: "Everywhere",
    title: "Picks up where you left off",
    text: "On phone, tablet or computer - an unfinished story is waiting on whichever you reach for.",
    icon: ICONS.devices,
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
      <SideScroll className="tech-track" label="More of what's inside">
        {SPECS.map((s, i) => (
          <article key={s.label} className="tech-card">
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
      </SideScroll>
    </section>
  );
}
