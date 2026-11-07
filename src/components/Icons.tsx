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

export const Ornament = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 14" width="120" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
    <path d="M2 7h40M78 7h40" />
    <path d="M60 2c-4 0-6 2.5-6 5s2 5 6 5 6-2.5 6-5-2-5-6-5z" />
    <path d="M48 7c2-3 4-3 6 0M66 7c2 3 4 3 6 0" />
    <circle cx="60" cy="7" r="1.2" fill="currentColor" />
  </svg>
);
