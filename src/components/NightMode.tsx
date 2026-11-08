"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LanternArt, MoonIcon, SunIcon } from "./NightLamp";

/**
 * Night mode for the whole site: a cosy, dim bedtime theme with a little
 * storybook lantern hanging from the menu bar (next to its switch), its
 * warm light falling across the page, and fireflies drifting about.
 *
 * Remembered on this device ("taleo.night"); an inline script in the root
 * layout applies it before first paint, so there's never a flash of the
 * light theme.
 *
 * Switching never blanks the screen: the menu bar stays, its colours
 * blending into the new theme's; below it the page's contents fade out,
 * the theme flips while they're hidden, the old backgrounds (page and menu
 * bar) melt into the new ones, and the contents fade back in. Every step
 * is a layer's opacity (GPU work), not every element's colours animating.
 * The lantern and fireflies only start once the switch is done.
 */

const KEY = "taleo.night";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface NightState {
  night: boolean;
  /** The lantern is rising away (night is about to switch off). */
  leaving: boolean;
  /** Night was already on when the page loaded (skip the lantern's drop-in). */
  settled: boolean;
  toggle: () => void;
}
const Ctx = createContext<NightState>({ night: false, leaving: false, settled: false, toggle: () => {} });
export const useNightMode = () => useContext(Ctx);

export function NightModeProvider({ children }: { children: React.ReactNode }) {
  const [night, setNight] = useState(false);
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** While switching: the theme being left, whose backgrounds fade away. */
  const [fadeFrom, setFadeFrom] = useState<"day" | "night" | null>(null);
  const busy = useRef(false);

  // The title's leaves start falling once the page has settled.
  useEffect(() => {
    const root = document.documentElement;
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    let t = 0;
    const idle = ric(() => (t = window.setTimeout(() => root.classList.add("brand-live"), 500)), { timeout: 2000 }) as number;
    return () => {
      (window.cancelIdleCallback ?? clearTimeout)(idle);
      window.clearTimeout(t);
    };
  }, []);

  // Pick up what the pre-paint script applied.
  useEffect(() => {
    if (document.documentElement.dataset.night === "1") {
      setSettled(true);
      setNight(true);
    }
  }, []);

  // The menu bar's height, for layouts that sit just under it (the story
  // reader, the theme switch's fading backgrounds).
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".topbar");
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty("--topbar-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const apply = (on: boolean) => {
    const root = document.documentElement;
    if (on) root.dataset.night = "1";
    else delete root.dataset.night;
    // The browser's own bar and the iPhone's status-bar area follow too.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => (m.content = on ? "#131017" : "#F3ECDC"));
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {}
  };

  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    // Rest the title's leaves through the switch; they carry on after.
    const root = document.documentElement;
    root.classList.remove("brand-live");
    const resume = () => window.setTimeout(() => root.classList.add("brand-live"), 600);
    const next = !night;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      apply(next);
      setSettled(true);
      setNight(next);
      busy.current = false;
      resume();
      return;
    }
    // 1. Straight after the tap: the page below the menu starts fading out
    //    (quickly), the old backgrounds are laid over the page, and the
    //    lantern starts rising away (going to day).
    root.classList.add("theme-switching", "theme-hidden");
    setFadeFrom(next ? "day" : "night");
    if (!next) setLeaving(true);
    await sleep(110);
    // 2. The theme flips while the old contents are nearly gone: the menu
    //    bar's colours and the backgrounds slide over to the new theme.
    apply(next);
    root.classList.add("theme-melting");
    if (next) {
      setSettled(false);
      setNight(true);
    }
    // 3. Once the colours have mostly settled, the new contents fade in.
    await sleep(300);
    root.classList.remove("theme-hidden");
    if (!next) {
      // the lantern has risen away by now
      setNight(false);
      setLeaving(false);
      setSettled(false);
    }
    await sleep(400);
    root.classList.remove("theme-switching", "theme-melting");
    setFadeFrom(null);
    busy.current = false;
    resume();
  }, [night]);

  return (
    <Ctx.Provider value={{ night, leaving, settled, toggle }}>
      {children}
      {night && <NightAmbience leaving={leaving} settled={settled} />}
      {fadeFrom && <div className={`theme-fade from-${fadeFrom}`} aria-hidden />}
    </Ctx.Provider>
  );
}

/** The light switch in the menu bar (the lantern hangs just below it at night). */
export function NightToggle() {
  const { night, toggle } = useNightMode();
  return (
    <span className="night-switch">
      <button
        type="button"
        className={`icon-btn night-toggle ${night ? "on" : ""}`}
        onClick={toggle}
        aria-pressed={night}
        aria-label={night ? "Turn off night mode" : "Turn on night mode"}
        title={night ? "Back to daylight" : "Night mode"}
      >
        {/* the mode it switches to: the moon by day, the sun at night */}
        {night ? <SunIcon /> : <MoonIcon on={false} />}
      </button>
    </span>
  );
}

const FIREFLIES = 16;

/** The room at night: the lantern dropping down from under the menu bar
 *  beside the switch, its warm light, a soft dimming toward the edges, and
 *  fireflies drifting across the screen. Decorative only - never catches a
 *  tap. */
function NightAmbience({ leaving, settled }: { leaving: boolean; settled: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  // Arrive in stages so the switch itself stays smooth: first only the
  // theme's colours (behind the veil); once the veil has gone, the lantern
  // drops in with its light; a little later the fireflies come out. On a
  // page that opens at night, wait for the page to settle first.
  const [lit, setLit] = useState(false);
  const [alive, setAlive] = useState(false);
  useEffect(() => {
    const timers: number[] = [];
    let idle = 0;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const begin = () => {
      setLit(true);
      later(() => setAlive(true), 1100);
    };
    if (settled) {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle = ric(() => later(begin, 150), { timeout: 900 }) as number;
    } else {
      later(begin, 700); // just after the veil has faded away
    }
    return () => {
      timers.forEach(clearTimeout);
      if (idle) (window.cancelIdleCallback ?? clearTimeout)(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hang the lantern from the menu bar's bottom edge under the switch, and
  // centre the light on its glass. Measured from things
  // that never animate (the bar and the switch), using the lantern's
  // resting geometry (CSS: a --lamp-cord cord, then 64px-per-28px-wide of lantern with the
  // glass at 65%) - so it's right even mid drop-in.
  useLayoutEffect(() => {
    const place = () => {
      const sw = document.querySelector(".night-switch");
      const bar = document.querySelector(".topbar");
      const el = root.current;
      if (!sw || !bar || !el) return;
      const s = sw.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      // Always hangs straight down from the switch; sized to the screen
      // (small on a phone, never more than 28px wide).
      // A touch bigger than it used to be, but on a shorter cord, so it still
      // hangs no lower than about the homepage title's "bedtime" line.
      const w = Math.round(Math.min(34, Math.max(22, window.innerWidth / 32)));
      const cord = w <= 24 ? 6 : 12;
      // Screen coordinates: the bar is fixed to the top, and so is this layer.
      const x = s.left + s.width / 2;
      const top = b.bottom;
      el.style.setProperty("--lamp-w", `${w}px`);
      el.style.setProperty("--lamp-x", `${x}px`);
      el.style.setProperty("--bar-y", `${top}px`);
      el.style.setProperty("--lamp-cord", `${cord}px`);
      el.style.setProperty("--lamp-y", `${top + cord + ((64 * w) / 28) * 0.65}px`);
    };
    // Re-measure whenever the menu could have moved - not just on window
    // resize but when the bar or its tools change size (the avatar or
    // fonts arriving, a wrap on a narrow screen) - so the light always
    // stays on the lantern.
    place();
    const ro = new ResizeObserver(place);
    ["html", ".topbar", ".nav-row", ".nav-tools"].forEach((q) => {
      const el = document.querySelector(q);
      if (el) ro.observe(el);
    });
    document.fonts?.ready.then(place);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);


  return (
    <div className={`night-ambience ${leaving ? "leaving" : ""}`} ref={root} aria-hidden>
      <div className="night-room" />
      {lit && (
        <>
          <div className="night-glow">
            <div className="night-glow-halo" />
            <div className="night-glow-core" />
            <div className="night-glow-shimmer" />
          </div>
          {/* above its own light, so the light never washes it out */}
          <div className={`nav-lantern ${leaving ? "leaving" : ""} ${settled ? "settled" : ""}`}>
            <div className="nav-lantern-drop">
              <LanternArt />
            </div>
          </div>
        </>
      )}
      {alive && (
        <div className="fireflies">
          {Array.from({ length: FIREFLIES }, (_, i) => (
            <span key={i} className={`firefly f${i}`}>
              <span className="firefly-light" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
