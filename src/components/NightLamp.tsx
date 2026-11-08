/** Night mode's reading lamp: a little brass pendant lamp that drops in
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
          <svg viewBox="0 0 64 140" className="night-lamp-svg">
            <defs>
              <linearGradient id="nl-cord" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#a8957b" stopOpacity="0.5" />
                <stop offset="0.25" stopColor="#a8957b" stopOpacity="0.9" />
                <stop offset="1" stopColor="#7d6a54" />
              </linearGradient>
              <linearGradient id="nl-brass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#6e4d22" />
                <stop offset="0.3" stopColor="#c99a4c" />
                <stop offset="0.48" stopColor="#f0d28c" />
                <stop offset="0.7" stopColor="#b1843e" />
                <stop offset="1" stopColor="#5d4019" />
              </linearGradient>
              <radialGradient id="nl-halo">
                <stop offset="0" stopColor="#ffd58a" stopOpacity="0.75" />
                <stop offset="0.45" stopColor="#ffbf6b" stopOpacity="0.22" />
                <stop offset="1" stopColor="#ffb055" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nl-bulb" cx="0.45" cy="0.4" r="0.6">
                <stop offset="0" stopColor="#fffdf2" />
                <stop offset="0.55" stopColor="#ffe7a8" />
                <stop offset="1" stopColor="#f6bd5c" />
              </radialGradient>
            </defs>
            {/* warm halo around the bulb */}
            <circle className="night-lamp-halo" cx="32" cy="104" r="30" fill="url(#nl-halo)" />
            {/* cord, fading in from above */}
            <path d="M32 0V76" stroke="url(#nl-cord)" strokeWidth="1.8" />
            {/* fitting */}
            <rect x="28.5" y="72" width="7" height="7.5" rx="1.6" fill="#8c6a33" />
            <rect x="29.6" y="73" width="1.4" height="5.5" rx="0.7" fill="#e9c77e" opacity="0.7" />
            {/* the bulb, peeking out under the shade */}
            <circle cx="32" cy="101.5" r="6.4" fill="url(#nl-bulb)" />
            {/* brass dome shade */}
            <path d="M11 98C11 85 20 78.5 32 78.5S53 85 53 98Z" fill="url(#nl-brass)" />
            <path d="M17.5 92.5C18.5 86.8 23.4 82.6 29.5 81.6" stroke="#fff3cf" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            {/* rim, lit from beneath */}
            <ellipse cx="32" cy="98" rx="21" ry="3.3" fill="#f3d995" />
            <ellipse cx="32" cy="98.6" rx="17.5" ry="2.1" fill="#fff4cf" />
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
