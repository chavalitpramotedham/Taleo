/** The night-mode lantern: a little storybook lantern (painted in the same
 *  watercolour and pen as the illustrations) that sways gently on its cord.
 *  Its halo and candle flame are separate, filter-free layers animated only
 *  by transform/opacity, so the painted lantern itself never repaints. */
export function LanternArt() {
  return (
    <div className="night-lamp-sway">
      {/* Performance: everything that moves (halo, flame) lives in its own
          light, filter-free layer, animated only with transform/opacity,
          so the browser never has to re-run the painted lantern's
          watercolour and pen filters - it just rotates one cached
          picture as the lantern sways. */}
      <svg viewBox="0 0 200 460" className="night-lamp-layer night-lamp-halo" aria-hidden>
        <defs>
          <radialGradient id="nl-halo">
            <stop offset="0" stopColor="#ffd58a" stopOpacity="0.42" />
            <stop offset="0.45" stopColor="#ffbf6b" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffb055" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="300" r="105" fill="url(#nl-halo)" />
      </svg>
      {/* A little storybook lantern, painted in the same watercolour and
          wobbly sepia pen as the illustrations (the global tl-paint and
          tl-ink filters), with a candle glowing behind its glass. */}
      <svg viewBox="0 0 200 460" className="night-lamp-svg">
        <defs>
          <radialGradient id="nl-glass" cx="0.5" cy="0.55" r="0.65">
            <stop offset="0" stopColor="#fff3c8" />
            <stop offset="0.55" stopColor="#ffd27c" />
            <stop offset="1" stopColor="#e8a24c" />
          </radialGradient>
        </defs>

        {/* the cord it hangs from - a lighter sepia so it reads in the dark */}
        <path d="M100 0C98 50 102 110 100 196" stroke="#a48b6c" strokeWidth="4" strokeLinecap="round" fill="none" filter="url(#tl-ink)" />

        <g filter="url(#tl-paint)">
          {/* glass panes, lit from within */}
          <path d="M66 252H134L128 338H72Z" fill="url(#nl-glass)" />
          {/* candle */}
          <path d="M91 300H109V336H91Z" fill="#F4EAD2" />
          {/* tin cap and base */}
          <path d="M56 254C62 226 82 212 100 212C118 212 138 226 144 254Z" fill="#A08C72" />
          <path d="M58 338H142L132 356H68Z" fill="#93806A" />
          <circle cx="100" cy="206" r="7" fill="#B29D80" />
        </g>

        {/* a faint warm rim of candlelight round the tin, so the lantern's
            shape reads against the dark */}
        <g fill="none" stroke="#e9c48e" strokeWidth="9" strokeLinejoin="round" opacity="0.35" filter="url(#tl-ink)">
          <path d="M56 254C62 226 82 212 100 212C118 212 138 226 144 254Z" />
          <path d="M58 338H142L132 356H68Z" />
          <path d="M66 254L72 338M134 254L128 338" />
        </g>

        {/* pen linework, sepia like the paintings */}
        <g
          fill="none"
          stroke="#4F3A2A"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#tl-ink)"
        >
          <circle cx="100" cy="200" r="9" />
          <path d="M56 254C62 226 82 212 100 212C118 212 138 226 144 254Z" />
          <path d="M66 254L72 338M134 254L128 338" />
          <path d="M88 254L90 338M112 254L110 338" strokeWidth="3" />
          <path d="M58 338H142L132 356H68Z" />
          <path d="M91 336V302H109V336" strokeWidth="3" />
          {/* a few loose sketch strokes, like the artist's hand */}
          <path d="M70 238C80 228 92 223 104 222" strokeWidth="2.4" opacity="0.6" />
          <path d="M76 350H124" strokeWidth="2.2" opacity="0.5" />
        </g>
      </svg>
      <svg viewBox="0 0 200 460" className="night-lamp-layer night-flame" aria-hidden>
        <path d="M100 262C111 278 112 290 100 298C88 290 89 278 100 262Z" fill="#FFF6D8" />
        <path d="M100 276C105 284 105 290 100 294C95 290 95 284 100 276Z" fill="#FFC85A" />
      </svg>
    </div>
  );
}

export const MoonIcon = ({ on }: { on: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {/* the crescent and its sparkle lean right and up as drawn: shifted so
        the whole mark sits on the button's centre */}
    <g transform="translate(-0.9 0.7)">
      {/* switched on: a solid crescent in the highlight colour */}
      <path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1Z" fill={on ? "currentColor" : "none"} />
      <path d="M16.6 3.6v2.6M15.3 4.9h2.6" opacity={on ? 1 : 0.6} />
      <circle cx="20.2" cy="8.6" r="0.55" fill="currentColor" stroke="none" opacity={on ? 1 : 0.6} />
    </g>
  </svg>
);

