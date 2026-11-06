/**
 * The "paint box": shared SVG filters that turn flat shapes into a classic
 * country-watercolour look. Rendered once in the root layout and referenced by
 * every painting through the layer classes (see svg-sanitize.ts).
 *   tl-wash  – broad background washes: bleeding edges, blotchy pigment
 *   tl-paint – character/object washes: soft mottling, pooled darker edges
 *   tl-ink   – fine sepia pen line with a slight hand wobble
 *   tl-paper – paper grain overlay
 *   tl-vignette mask – pictures fade softly into the page, like a vignette plate
 */
export function PaintDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <filter id="tl-wash" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="11" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="12" xChannelSelector="R" yChannelSelector="G" result="wob" />
          <feGaussianBlur in="wob" stdDeviation="0.8" result="soft" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="5" result="blotch" />
          <feColorMatrix in="blotch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.6 1.15" result="ba" />
          <feComposite in="soft" in2="ba" operator="in" result="pig" />
          <feMorphology in="wob" operator="erode" radius="2" result="inner" />
          <feComposite in="wob" in2="inner" operator="out" result="edge" />
          <feGaussianBlur in="edge" stdDeviation="1.2" result="edgeS" />
          <feColorMatrix in="edgeS" type="matrix" values="0.8 0 0 0 0  0 0.78 0 0 0  0 0 0.74 0 0  0 0 0 0.35 0" result="edgeD" />
          <feMerge>
            <feMergeNode in="pig" />
            <feMergeNode in="edgeD" />
          </feMerge>
        </filter>

        <filter id="tl-paint" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" result="wob" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="8" result="mott" />
          <feColorMatrix in="mott" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.55 1.12" result="ma" />
          <feComposite in="wob" in2="ma" operator="in" result="pig" />
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.25 1.08" result="gra" />
          <feComposite in="pig" in2="gra" operator="in" result="pig2" />
          <feMorphology in="wob" operator="erode" radius="1.3" result="inner" />
          <feComposite in="wob" in2="inner" operator="out" result="edge" />
          <feGaussianBlur in="edge" stdDeviation="0.8" result="edgeS" />
          <feColorMatrix in="edgeS" type="matrix" values="0.72 0 0 0 0  0 0.68 0 0 0  0 0 0.64 0 0  0 0 0 0.45 0" result="edgeD" />
          <feMerge>
            <feMergeNode in="pig2" />
            <feMergeNode in="edgeD" />
          </feMerge>
        </filter>

        <filter id="tl-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.25" result="b" />
          <feComponentTransfer in="b">
            <feFuncA type="linear" slope="0.8" />
          </feComponentTransfer>
        </filter>

        <filter id="tl-paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="2" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0 0.32  0 0 0 0.16 0" />
        </filter>

        <filter id="tl-vig" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="21" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="34" />
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <mask id="tl-vignette" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="300">
          <rect x="20" y="18" width="360" height="266" rx="60" fill="#fff" filter="url(#tl-vig)" />
        </mask>
        <mask id="tl-vignette-sq" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <ellipse cx="100" cy="104" rx="92" ry="90" fill="#fff" filter="url(#tl-vig)" />
        </mask>
      </defs>
    </svg>
  );
}
