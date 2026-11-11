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

/** Stop listening: a soft rounded square. */
export const StopIcon = () => (
  <svg {...base}>
    <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const SpeakerIcon = ({ on }: { on: boolean }) => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
);

/** A person speaking - sound waves from their mouth when on, a cross when
 *  off - for the "read aloud" toggle, distinct from the plain speaker
 *  cone used for volume/mute elsewhere. */
/** Read aloud: a head in profile, facing left, with sound waves coming
 *  from the mouth - full strength while reading aloud is on, faint while
 *  it's off (so the icon always reads as "speaking"). */
// Each wave is its own small layer, so pulsing it is a plain GPU fade and
// scale of a still picture - nothing inside an SVG is redrawn per frame.
// (origin: the wave's inner edge, as a share of the 24-unit icon)
const SPEECH_WAVES = [
  { d: "M6.9 10c-.9 1.1-.9 3.1 0 4.2", origin: "28.75% 50%" },
  { d: "M4.8 8.4c-1.6 1.9-1.6 5.5 0 7.4", origin: "20% 50%" },
  { d: "M2.7 6.9c-2.2 2.7-2.2 7.7 0 10.4", origin: "11.25% 50%" },
];

export const SpeechIcon = ({ on, speaking = false }: { on: boolean; speaking?: boolean }) => (
  <span className={speaking ? "speech-icon speaking" : "speech-icon"} aria-hidden>
    <svg {...base}>
      {/* back of the head, crown, forehead, nose, lips, chin and neck */}
      <path d="M19.6 15.4c1.7-2.8 1.6-7-.9-9.6-2-2.1-5.3-2.3-7.4-.8-1.6 1.1-2.2 2.9-1.9 4.6l-1.2 2.1c-.3.5 0 1 .5 1.1l.8.2c-.3.5-.2.9.3 1.1-.5.4-.5.9 0 1.2.1.8.4 1.5 1.4 1.6h1.9c1.1 0 1.7.8 1.7 1.8v.9" />
    </svg>
    {/* the sound waves - three arcs, pulsing outward while a page is read */}
    <span className="speech-waves" style={{ opacity: on ? 1 : 0.35 }}>
      {SPEECH_WAVES.map((w, i) => (
        <svg key={i} {...base} className={`wave w${i + 1}`} style={{ transformOrigin: w.origin }}>
          <path d={w.d} />
        </svg>
      ))}
    </span>
  </span>
);

export const MusicNoteIcon = () => (
  <svg {...base}>
    <path d="M9 16.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
    <path d="M11.5 14V4.8L18 3.5v9" />
    <path d="M15.5 12.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

/** Read again: a circular arrow. */
export const ReplayIcon = () => (
  <svg {...base}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v3.6h3.6" />
  </svg>
);

/** Copy link: two chain links. */
export const LinkIcon = () => (
  <svg {...base}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

/** Download / save: an arrow down into a tray. */
export const DownloadIcon = () => (
  <svg {...base}>
    <path d="M12 3.5v11" />
    <path d="M8 10.8l4 4 4-4" />
    <path d="M5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </svg>
);

/** The familiar iPhone "share": an open-topped box with an arrow rising out of it. */
export const ShareIcon = () => (
  <svg {...base}>
    <path d="M12 3.5v11" />
    <path d="M8.2 7.2L12 3.4l3.8 3.8" />
    <path d="M8.5 10.5H6.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
  </svg>
);

/** A small pencil: "edit". */
export const PencilIcon = () => (
  <svg {...base} width={14} height={14}>
    <path d="M15.5 4.5l4 4L9 19H5v-4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

/** A ribbon bookmark: "save to my bookshelf" (filled once saved). */
export const BookmarkIcon = ({ on = false }: { on?: boolean }) => (
  <svg {...base}>
    <path d="M7 3.8h10a.8.8 0 0 1 .8.8v15.2l-5.8-3.9-5.8 3.9V4.6a.8.8 0 0 1 .8-.8z" fill={on ? "currentColor" : "none"} />
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

/** One small maple leaf - five soft, rounded lobes (top, two upper side,
 *  two lower side) drawn with smooth curves rather than jagged teeth, so
 *  it reads as cute rather than spiky, plus a stem below the bottom notch
 *  so the silhouette reads unmistakably as a leaf rather than a blob.
 *  Painted in the house ink-and-wash style, pointing "up" (tip at the
 *  top) before its parent <g> rotates/positions it. */
const Leaf = ({ fill, rotate }: { fill: string; rotate: number }) => (
  <g transform={`rotate(${rotate}) scale(1.3)`}>
    <path
      d="M0,-7.2 C1.6,-6.8 2,-5.3 1.5,-4 C2.6,-4.6 4.2,-4.6 5.4,-3.4 C4.6,-2.2 3.4,-1.5 2.4,-1.2 C3.6,0.3 4.2,1.8 3.8,3.2 C2.4,2.6 1.1,2.1 0,1.6 C-1.1,2.1 -2.4,2.6 -3.8,3.2 C-4.2,1.8 -3.6,0.3 -2.4,-1.2 C-3.4,-1.5 -4.6,-2.2 -5.4,-3.4 C-4.2,-4.6 -2.6,-4.6 -1.5,-4 C-2,-5.3 -1.6,-6.8 0,-7.2 Z"
      fill={fill}
      stroke="#4F3A2A"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    <path d="M0,-5 L0,1.6" stroke="#4F3A2A" strokeWidth="0.4" opacity="0.55" />
    <path d="M0,1.5 C0,2.9 0,4.3 0.3,6.2" stroke="#4F3A2A" strokeWidth="0.7" strokeLinecap="round" fill="none" />
  </g>
);

/** Three maple leaves, each falling through the mark on its own loop - like
 *  ash sinking through a whirlwind, seen side-on: each leaf sways as it
 *  falls (the funnel's circling, seen from the side), spinning two turns
 *  with a squash at the sway's extremes for a real 3D tumble, fading in at
 *  the top and out at the bottom so the loop's reset is never seen.
 *  Durations and delays differ per leaf so they drift in and out of phase.
 *
 *  Performance: each leaf is drawn ONCE, as a still picture on its own
 *  layer, and only that layer is moved (transform + opacity in CSS) - the
 *  graphics card slides, turns and fades the finished picture, so the
 *  animation needs no drawing or layout work per frame, at any size, and
 *  stays crisp (no fixed-size GIF). The soft shadow sits on the leaf's
 *  still parent, so it always falls straight down. Coordinates are in the
 *  mark's 24-unit grid; 1 unit = 1em of the stage's font size. */
const LEAVES = [
  { key: "a", x: 6, y: 9, fill: "#9C4F32", rotate: 10 },
  { key: "b", x: 12, y: 14, fill: "#6F7F52", rotate: 130 },
  { key: "c", x: 18, y: 11, fill: "#C49A3E", rotate: 250 },
] as const;

const LeafTrio = ({ originX = 0, originY = 0 }: { originX?: number; originY?: number }) => (
  <>
    {LEAVES.map((l) => (
      <span key={l.key} className="leaf-pos" style={{ left: `${l.x - originX}em`, top: `${l.y - originY}em` }}>
        <span className={`leaf-whirl leaf-whirl-${l.key}`}>
          <svg viewBox="-10 -10 20 20" aria-hidden>
            <Leaf fill={l.fill} rotate={l.rotate} />
          </svg>
        </span>
      </span>
    ))}
  </>
);

export const BrandMark = () => (
  <span className="brand-mark leaf-stage-host" aria-hidden>
    <span className="leaf-stage" style={{ fontSize: `${18 / 24}px` }}>
      <LeafTrio />
    </span>
  </span>
);

/** The brand mark's falling-leaf whirl, sized up as a standard "please
 *  wait" indicator - so every busy moment in the app (writing, painting,
 *  saving) shares the same bit of visual language instead of a generic
 *  spinner. */
// The leaves fall from well above the 24x24 mark to well below it and sway
// sideways as they go, so the loader's box is enlarged to hold every leaf's
// whole path (and its soft shadow). `size` is still the size of the 24-unit
// mark, so the leaves look the same size whatever the box.
const LOADER_BOX = { x: -8, y: -10, w: 40, h: 45 };

export const LeafLoader = ({ size = 40, className }: { size?: number; className?: string }) => (
  <span
    className={`leaf-loader leaf-stage-host ${className || ""}`}
    style={{ width: (size * LOADER_BOX.w) / 24, height: (size * LOADER_BOX.h) / 24 }}
    role="img"
    aria-label="Loading"
  >
    <span className="leaf-stage" style={{ fontSize: `${size / 24}px` }}>
      <LeafTrio originX={LOADER_BOX.x} originY={LOADER_BOX.y} />
    </span>
  </span>
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

/** The story cards' flourish as a full-width section divider: the same
 *  knot-and-curls centrepiece, with long hairlines running out to either
 *  side and fading toward the edges, so it scales to any width while the
 *  centre stays crisp. */
export const OrnamentRule = ({ className }: { className?: string }) => (
  <div className={`ornament-rule ${className || ""}`} aria-hidden>
    <span className="ornament-rule-line" />
    <svg viewBox="42 0 36 14" width="45" height="17" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
      <path d="M42 7h6M72 7h6" />
      <path d="M60 2c-4 0-6 2.5-6 5s2 5 6 5 6-2.5 6-5-2-5-6-5z" />
      <path d="M48 7c2-3 4-3 6 0M66 7c2 3 4 3 6 0" />
      <circle cx="60" cy="7" r="1.2" fill="currentColor" />
    </svg>
    <span className="ornament-rule-line" />
  </div>
);

/** The CTA marker: one maple leaf in the brand's gold, front-facing and
 *  flat (the same five soft lobes and stem as the logo's leaves, upright
 *  and unrotated), used as a leading icon on the key calls to action -
 *  "Begin a story", "Next", "Send" - so they share one bit of the brand. */
/** A little fairytale crown: three rounded points topped with pearls, a
 *  gilt band set with a ruby - the Admin tier's mark. */
export const CrownMark = () => (
  <svg className="crown-mark" viewBox="0 0 32 26" aria-hidden focusable="false">
    <path
      d="M3.2 21 L1.6 7.6 C1.5 6.8 2.4 6.4 2.9 7 L8.6 13.2 L14.9 3.6 C15.4 2.9 16.6 2.9 17.1 3.6 L23.4 13.2 L29.1 7 C29.6 6.4 30.5 6.8 30.4 7.6 L28.8 21 Z"
      fill="#E2AE4A"
      stroke="#7A5420"
      strokeWidth="0.9"
      strokeLinejoin="round"
    />
    <path d="M3.4 19.2 H28.6" stroke="#9A6A26" strokeWidth="0.8" />
    <rect x="3" y="20.4" width="26" height="3.6" rx="1.4" fill="#D69A3A" stroke="#7A5420" strokeWidth="0.9" />
    <circle cx="16" cy="13.4" r="2.1" fill="#B2443A" stroke="#7A5420" strokeWidth="0.7" />
    <circle cx="9.6" cy="16.2" r="1.2" fill="#6F8FAF" stroke="#7A5420" strokeWidth="0.5" />
    <circle cx="22.4" cy="16.2" r="1.2" fill="#6F8FAF" stroke="#7A5420" strokeWidth="0.5" />
    <circle cx="1.9" cy="6.4" r="1.5" fill="#F4EFE4" stroke="#7A5420" strokeWidth="0.6" />
    <circle cx="16" cy="2.4" r="1.7" fill="#F4EFE4" stroke="#7A5420" strokeWidth="0.6" />
    <circle cx="30.1" cy="6.4" r="1.5" fill="#F4EFE4" stroke="#7A5420" strokeWidth="0.6" />
  </svg>
);

export const MapleMark = () => (
  <svg className="maple-mark" viewBox="-6.6 -8.4 13.2 15.6" aria-hidden focusable="false">
    <path
      d="M0,-7.2 C1.6,-6.8 2,-5.3 1.5,-4 C2.6,-4.6 4.2,-4.6 5.4,-3.4 C4.6,-2.2 3.4,-1.5 2.4,-1.2 C3.6,0.3 4.2,1.8 3.8,3.2 C2.4,2.6 1.1,2.1 0,1.6 C-1.1,2.1 -2.4,2.6 -3.8,3.2 C-4.2,1.8 -3.6,0.3 -2.4,-1.2 C-3.4,-1.5 -4.6,-2.2 -5.4,-3.4 C-4.2,-4.6 -2.6,-4.6 -1.5,-4 C-2,-5.3 -1.6,-6.8 0,-7.2 Z"
      fill="#E2AE4A"
      stroke="#7A5420"
      strokeWidth="0.45"
      strokeLinejoin="round"
    />
    <g stroke="#9A6A26" strokeWidth="0.38" strokeLinecap="round" fill="none" opacity="0.8">
      <path d="M0,-5.4 L0,1.5" />
      <path d="M0,-0.6 L-3.2,-3" />
      <path d="M0,-0.6 L3.2,-3" />
      <path d="M0,0.6 L-2.4,2" />
      <path d="M0,0.6 L2.4,2" />
    </g>
    <path d="M0,1.5 C0,2.9 0,4.3 0.3,6.2" stroke="#7A5420" strokeWidth="0.6" strokeLinecap="round" fill="none" />
  </svg>
);

/** Reading time: a simple round clock. */
export const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

// ------------------------------------------------- the account menu's items
// (a little smaller than the toolbar icons: they sit beside a line of text)
const menu = { ...base, width: 18, height: 18 };

/** My bookshelf: three books standing on a shelf, the last one leaning. */
export const ShelfIcon = () => (
  <svg {...menu}>
    <path d="M3 20.5h18" />
    <rect x="4.5" y="6" width="3.6" height="14.5" rx="0.6" />
    <rect x="8.1" y="9" width="3.6" height="11.5" rx="0.6" />
    <path d="M13.6 8.2l3.3-1 3.6 12.3-3.3 1z" />
  </svg>
);

/** My characters: a little bear's face. */
export const CharacterIcon = () => (
  <svg {...menu}>
    <circle cx="6.6" cy="6.6" r="2.6" />
    <circle cx="17.4" cy="6.6" r="2.6" />
    <circle cx="12" cy="13" r="7.5" fill="var(--page)" />
    <path d="M9.4 11.6v.4M14.6 11.6v.4" strokeWidth="2" />
    <path d="M10.2 15.4c.9 1 2.7 1 3.6 0" />
  </svg>
);

/** Manage account: a cog. */
export const CogIcon = () => (
  <svg {...menu}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8l1.6 2.6 2.9-.8.7 3 3 .7-.8 2.9 2.6 1.6-2.6 1.6.8 2.9-3 .7-.7 3-2.9-.8L12 21.2l-1.6-2.6-2.9.8-.7-3-3-.7.8-2.9L2 12.8l2.6-1.6-.8-2.9 3-.7.7-3 2.9.8z" transform="translate(0 -0.8)" />
  </svg>
);

/** Admin dashboard: a small bar chart. */
export const ChartIcon = () => (
  <svg {...menu}>
    <path d="M3.5 20.5h17M6.5 20.5v-6M12 20.5V5.5M17.5 20.5v-10" strokeWidth="2.2" />
  </svg>
);

/** Add shortcut: an app tile on the home screen, with a plus. */
export const AddTileIcon = () => (
  <svg {...menu}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

/** Sign out: an open door, and the way out of it. */
export const InfoIcon = () => (
  <svg {...menu}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
  </svg>
);
export const SignOutIcon = () => (
  <svg {...menu}>
    <path d="M10 3.5H5.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1H10" />
    <path d="M10.5 12h10M17 8.2l3.8 3.8-3.8 3.8" />
  </svg>
);
