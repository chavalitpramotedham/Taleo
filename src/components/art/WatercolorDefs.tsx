/**
 * Shared SVG filters that give flat vector shapes a hand-painted watercolour
 * feel: wobbly edges, pigment granulation, darker pooled edges and paper grain.
 * Rendered once in the root layout; every illustration references these ids.
 */
export function WatercolorDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        {/* Characters & props: gentle edge wobble + pooled pigment at edges */}
        <filter id="wc-paint" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.5 1.2" result="grainAlpha" />
          <feComposite in="wobbly" in2="grainAlpha" operator="in" result="granulated" />
          <feMorphology in="wobbly" operator="erode" radius="1.6" result="inner" />
          <feComposite in="wobbly" in2="inner" operator="out" result="edge" />
          <feGaussianBlur in="edge" stdDeviation="0.9" result="edgeSoft" />
          <feColorMatrix in="edgeSoft" type="matrix" values="0.75 0 0 0 0  0 0.72 0 0 0  0 0 0.78 0 0  0 0 0 0.45 0" result="edgeDark" />
          <feMerge>
            <feMergeNode in="granulated" />
            <feMergeNode in="edgeDark" />
          </feMerge>
        </filter>

        {/* Backgrounds: bigger, softer washes that bleed a little */}
        <filter id="wc-wash" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="14" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feGaussianBlur in="wobbly" stdDeviation="1" result="soft" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="5" result="blotch" />
          <feColorMatrix in="blotch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.45 1.25" result="blotchAlpha" />
          <feComposite in="soft" in2="blotchAlpha" operator="in" />
        </filter>

        {/* Paper grain overlay */}
        <filter id="wc-paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="2" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.22 0" />
        </filter>

        <radialGradient id="wc-glow">
          <stop offset="0" stopColor="#FFF6C9" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFF6C9" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
