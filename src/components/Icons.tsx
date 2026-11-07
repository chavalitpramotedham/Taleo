// Small pen-line icons to match the illustrations.
const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const MicIcon = () => (
  <svg {...base}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);

export const SpeakerIcon = ({ on }: { on: boolean }) => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
);

export const ShareIcon = () => (
  <svg {...base}>
    <path d="M4 7.5h16v11H4z" />
    <path d="M4 8l8 6 8-6" />
  </svg>
);

export const BrushIcon = () => (
  <svg {...base}>
    <path d="M19.5 4.5c-3 1.5-7.5 6-9 8.5l1.5 1.5c2.5-1.5 7-6 8.5-9z" />
    <path d="M10.5 13c-2 0-3.5 1.5-3.5 3.5 0 1.2-.8 2.3-2 2.5 3 1.2 7 .3 7-3.5" />
  </svg>
);

/** A storybook take on the usual "person" icon: a head and shoulders, with
 *  a small accent dot echoing the brand mark (the dot before "Taleo"). */
export const AccountIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="9" r="3.4" />
    <path d="M5 20c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5" />
    <circle cx="17.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

/** One small maple leaf (a faceted, 11-point silhouette - the classic
 *  five-lobed outline), painted in the house ink-and-wash style, pointing
 *  "up" (tip at the top) before its parent <g> rotates/positions it. */
const Leaf = ({ fill, rotate }: { fill: string; rotate: number }) => (
  <g transform={`rotate(${rotate})`}>
    <path
      d="M0,-6.2 L1,-4.1 L3.1,-4.8 L2.3,-2.7 L4.9,-2.8 L2.8,-0.9 L4.1,0.9 L1.8,0.5 L2,3.3 L0.7,1.8 L0.5,5.7 L0,4.4 L-0.5,5.7 L-0.7,1.8 L-2,3.3 L-1.8,0.5 L-4.1,0.9 L-2.8,-0.9 L-4.9,-2.8 L-2.3,-2.7 L-3.1,-4.8 L-1,-4.1 Z"
      fill={fill}
      stroke="#4F3A2A"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    <path d="M0,-4.4 L0,2.6" stroke="#4F3A2A" strokeWidth="0.4" opacity="0.55" />
  </g>
);

/** Three maple leaves, each rising and falling through the mark on its own
 *  loop - like ash caught in a whirlwind, seen side-on: the funnel's actual
 *  circling (around a vertical axis) reads from this angle as side-to-side
 *  sway, so each leaf sways as it climbs, fading in at the bottom and out
 *  at the top so the loop's reset is never seen. A continuous two-turn
 *  spin, paired with a periodic horizontal squash timed to the sway's
 *  extremes (the moment it would be edge-on to the viewer), gives the
 *  tumble real depth rather than a flat spin in place. Durations and
 *  delays differ per leaf so they drift in and out of phase instead of
 *  orbiting a shared centre in lockstep. (The static base rotation is an
 *  SVG attribute on each leaf; the whirl itself is a separate wrapping
 *  group animated in CSS, so the two never fight.) */
export const BrandMark = () => (
  <svg className="brand-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <g transform="translate(12,12)">
      <g className="leaf-whirl leaf-whirl-a">
        <Leaf fill="#9C4F32" rotate={10} />
      </g>
    </g>
    <g transform="translate(12,12)">
      <g className="leaf-whirl leaf-whirl-b">
        <Leaf fill="#6F7F52" rotate={130} />
      </g>
    </g>
    <g transform="translate(12,12)">
      <g className="leaf-whirl leaf-whirl-c">
        <Leaf fill="#C49A3E" rotate={250} />
      </g>
    </g>
  </svg>
);

/** A single filled star, sized by its parent's font-size - for compact
 *  inline ratings (e.g. the cover overlay on a book card). */
export const StarGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2.8l2.7 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.7 6.3 19.9l1.4-6.3L2.9 9.3l6.4-.6z" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export const Ornament = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 14" width="120" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
    <path d="M2 7h40M78 7h40" />
    <path d="M60 2c-4 0-6 2.5-6 5s2 5 6 5 6-2.5 6-5-2-5-6-5z" />
    <path d="M48 7c2-3 4-3 6 0M66 7c2 3 4 3 6 0" />
    <circle cx="60" cy="7" r="1.2" fill="currentColor" />
  </svg>
);
