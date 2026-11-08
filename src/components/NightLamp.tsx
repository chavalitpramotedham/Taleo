/** Night mode's reading lamp: a little storybook lantern that drops in
 *  from the top corner of the book on its cord and sways gently, with a
 *  warm pool of light (and a few drifting motes) falling across the pages
 *  while the far corners sink into shadow. Purely decorative: it never
 *  catches taps meant for the story. `leaving` plays it back up out of
 *  sight before night mode switches off. */
export function NightLamp({ leaving = false }: { leaving?: boolean }) {
  return (
    <>
      <div className={`night-light ${leaving ? "leaving" : ""}`} aria-hidden>
        <div className="night-pool" />
        <div className="night-dark" />
        <div className="night-motes">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={`night-mote m${i}`} />
          ))}
        </div>
      </div>
      <div className={`night-lamp ${leaving ? "leaving" : ""}`} aria-hidden>
        <div className="night-lamp-sway">
          {/* A little storybook lantern, painted in the same watercolour and
              wobbly sepia pen as the illustrations (the global tl-paint and
              tl-ink filters), with a candle glowing behind its glass. */}
          <svg viewBox="0 0 200 460" className="night-lamp-svg">
            <defs>
              <radialGradient id="nl-halo">
                <stop offset="0" stopColor="#ffd58a" stopOpacity="0.7" />
                <stop offset="0.45" stopColor="#ffbf6b" stopOpacity="0.2" />
                <stop offset="1" stopColor="#ffb055" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nl-glass" cx="0.5" cy="0.55" r="0.65">
                <stop offset="0" stopColor="#fff3c8" />
                <stop offset="0.55" stopColor="#ffd27c" />
                <stop offset="1" stopColor="#e8a24c" />
              </radialGradient>
            </defs>

            {/* warm glow around the glass */}
            <circle className="night-lamp-halo" cx="100" cy="300" r="105" fill="url(#nl-halo)" />

            {/* the cord it hangs from - a lighter sepia so it reads in the dark */}
            <path d="M100 0C98 50 102 110 100 196" stroke="#a48b6c" strokeWidth="4" strokeLinecap="round" fill="none" filter="url(#tl-ink)" />

            <g filter="url(#tl-paint)">
              {/* glass panes, lit from within */}
              <path d="M66 252H134L128 338H72Z" fill="url(#nl-glass)" />
              {/* candle */}
              <path d="M91 300H109V336H91Z" fill="#F4EAD2" />
              {/* tin cap and base */}
              <path d="M56 254C62 226 82 212 100 212C118 212 138 226 144 254Z" fill="#7A6A58" />
              <path d="M58 338H142L132 356H68Z" fill="#6B5C4C" />
              <circle cx="100" cy="206" r="7" fill="#8A7862" />
            </g>

            {/* the flame */}
            <path d="M100 262C111 278 112 290 100 298C88 290 89 278 100 262Z" fill="#FFF6D8" />
            <path d="M100 276C105 284 105 290 100 294C95 290 95 284 100 276Z" fill="#FFC85A" />

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
        </div>
      </div>
    </>
  );
}

export const MoonIcon = ({ on }: { on: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1Z" fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.18 : 0} />
    <path d="M16.6 3.6v2.6M15.3 4.9h2.6" opacity={on ? 1 : 0.6} />
    <circle cx="20.2" cy="8.6" r="0.55" fill="currentColor" stroke="none" opacity={on ? 1 : 0.6} />
  </svg>
);
