"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LanternArt, MoonIcon } from "./NightLamp";
import { NIGHT_AT_KEY, NIGHT_KEY } from "@/lib/night-clock";

/**
 * Night mode for the whole site: a cosy, dim bedtime theme with a little
 * storybook lantern hanging from the menu bar (next to its switch), its
 * warm light falling across the page, and fireflies drifting about.
 *
 * A page opens by the clock: daylight from 9am to 7pm, night otherwise
 * (lib/night-clock). The switch overrides that until day next turns to
 * night or night to day. An inline script in the root layout applies it
 * before first paint, so there's never a flash of the other theme.
 *
 * Switching never blanks the screen: the menu bar stays, its colours
 * blending into the new theme's; below it the page's contents fade out,
 * the theme flips while they're hidden, the old backgrounds (page and menu
 * bar) melt into the new ones, and the contents fade back in. Every step
 * is a layer's opacity (GPU work), not every element's colours animating.
 * The lantern and fireflies only start once the switch is done.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The next painted frame (or shortly after, in a tab that isn't painting). */
const nextFrame = () =>
  new Promise<void>((r) => {
    const t = window.setTimeout(r, 60);
    requestAnimationFrame(() => {
      window.clearTimeout(t);
      r();
    });
  });

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
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => (m.content = on ? "#181620" : "#F3ECDC"));
    try {
      localStorage.setItem(NIGHT_KEY, on ? "1" : "0");
      localStorage.setItem(NIGHT_AT_KEY, String(Date.now()));
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
      // Restyling the whole page for the new theme is the one heavy step
      // of the switch. It gets a frame to itself: the night's own pieces
      // (the room, and measuring where the lantern hangs) are set up in
      // the next one, so no single frame carries both.
      await nextFrame();
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
  // As a finger or the pointer comes down on the switch (a moment before
  // the tap itself), the page is got ready to fade: given its own layer,
  // which is the one slow step of starting the switch. By the tap, it's
  // done, and the fade begins on the very next frame. (Let go of again a
  // moment later if no tap follows.)
  const ready = useRef(0);
  const prepare = () => {
    const root = document.documentElement;
    root.classList.add("theme-ready");
    window.clearTimeout(ready.current);
    ready.current = window.setTimeout(() => root.classList.remove("theme-ready"), 1500);
  };
  useEffect(() => () => window.clearTimeout(ready.current), []);
  return (
    <span className="night-switch">
      <button
        type="button"
        className={`icon-btn night-toggle ${night ? "on" : ""}`}
        onPointerDown={prepare}
        onPointerEnter={prepare}
        onFocus={prepare}
        onClick={toggle}
        aria-pressed={night}
        aria-label={night ? "Turn off night mode" : "Turn on night mode"}
        title={night ? "Back to daylight" : "Night mode"}
      >
        {/* always the moon: an on/off switch for night mode, lit (a solid
            crescent and a bright sparkle) while it's on */}
        <MoonIcon on={night} />
      </button>
    </span>
  );
}

const FIREFLIES = 16;

/** The room at night: the lantern dropping down from under the menu bar
 *  beside the switch, its warm light, a soft dimming toward the edges, and
 *  fireflies drifting across the screen. Decorative only - never catches a
 *  tap. */

/** The stars: where each is on the screen (percent across, percent down),
 *  how big (px, tip to tip), and how its glimmer is timed (seconds:
 *  delay, length - each different, so no two keep time).
 *  A dozen or so, mostly at the sides and the top, where the page's own
 *  column leaves the sky open. */
const STARS: [number, number, number, number, number][] = [
  // (all in the top third of the screen - the sky is overhead. "Down" is
  // in hundredths of that band: from just under the menu bar, 0, to a
  // third of the way down the screen, 100.)
  [4, 20, 9, 0, 5.5], [9, 55, 7, 1.8, 7], [6, 86, 9, 3.1, 6.2], [13, 96, 7, 0.6, 8.3],
  [17, 36, 7, 2.4, 6.6], [23, 10, 10, 4, 7.4], [38, 7, 7, 1.2, 9.1], [58, 14, 7, 3.5, 6],
  [72, 27, 9, 0.9, 8], [83, 64, 7, 2.9, 7.2], [88, 92, 9, 1.5, 6.4], [93, 40, 10, 4.4, 5.7],
  [96, 76, 7, 0.3, 9.3], [79, 98, 7, 3.8, 7.7],
];

function NightAmbience({ leaving, settled }: { leaving: boolean; settled: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  // Arrive in stages so the switch itself stays smooth: first only the
  // theme's colours (behind the veil); as the page's contents return, the
  // lantern drops in with its light; a little later the fireflies come out. On a
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
      // as the page's contents come back (the backgrounds have melted by
      // then): the lantern slides out from under the bar while they
      // settle, rather than after a pause
      later(begin, 520);
    }
    return () => {
      timers.forEach(clearTimeout);
      if (idle) (window.cancelIdleCallback ?? clearTimeout)(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hang the lantern from the menu bar's bottom edge under the right-most button, and
  // centre the light on its glass. Measured from things
  // that never animate (the bar and the switch), using the lantern's
  // resting geometry (CSS: a --lamp-cord cord, then 64px-per-28px-wide of lantern with the
  // glass at 65%) - so it's right even mid drop-in.
  useLayoutEffect(() => {
    const place = () => {
      // Hangs from the right-most menu button (the profile), out past the
      // night switch and, in a story, past the sound controls.
      const sw = document.querySelector(".nav-tools > :last-child") || document.querySelector(".night-switch");
      const bar = document.querySelector(".topbar");
      const el = root.current;
      if (!sw || !bar || !el) return;
      const s = sw.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      // Always hangs straight down from the switch; sized to the screen
      // (small on a phone, never more than 28px wide).
      // A touch bigger than it used to be, but on a shorter cord, so it still
      // hangs no lower than about the homepage title's "bedtime" line.
      // Its glass about the size of the moon icon on a phone, growing on
      // larger screens up to about the night switch itself.
      // (The drawing includes its cord and space around the glass: at 40px
      // the glass matches the 19px moon; 60px - glass about 28px, just under
      // the switch - is the most it grows to.)
      // It grows with the page's content column, not the window: once the
      // content stops growing (1120px, or a story's wider 1360px book), so
      // does the lantern - at its largest just as the content reaches full width.
      const col = parseFloat(getComputedStyle(bar).getPropertyValue("--col")) || 1120;
      const content = Math.min(window.innerWidth, col);
      const w = Math.round(Math.min(60, Math.max(40, (content * 60) / col)));
      let cord = w <= 24 ? 6 : 12;
      // Screen coordinates: the bar is pinned to the top, and so is this
      // layer - so the lantern's place is the switch's place *within the
      // bar*, never where the bar happens to be measured on the screen. (On
      // a phone with the keyboard up, a field growing by a line scrolls the
      // page under the keyboard, and a measurement taken mid-scroll puts
      // the bar somewhere above the screen: the lantern went with it.)
      // Nothing to hang from (the bar not laid out yet): stay where it was.
      if (!s.width || !b.height) return;
      const x = s.left - b.left + s.width / 2;
      const top = b.height;
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
    // (and the page itself, so opening a story moves it)
    ["html", "body", ".topbar", ".nav-row", ".nav-tools"].forEach((q) => {
      const el = document.querySelector(q);
      if (el) ro.observe(el);
    });
    document.fonts?.ready.then(place);
    window.addEventListener("resize", place);
    // (a phone's keyboard coming and going resizes only this)
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, []);


  // While the page is being scrolled the lantern's light holds still (its
  // pulsing is paused, and picks up where it was a moment after): the
  // light is large, soft layers the browser must blend afresh on every
  // frame they move, and on a big screen that took frames a long page
  // needed for scrolling. Nobody watches a candle flicker mid-scroll.
  // (Only this layer's own class changes: nothing else is restyled.)
  useEffect(() => {
    let rest = 0;
    let held = false;
    const onScroll = () => {
      if (!held) {
        held = true;
        root.current?.classList.add("scrolling");
        document.querySelector(".night-stars")?.classList.add("scrolling");
      }
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        held = false;
        root.current?.classList.remove("scrolling");
        document.querySelector(".night-stars")?.classList.remove("scrolling");
      }, 220);
    };
    // (the page itself, and anything inside it that scrolls)
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.clearTimeout(rest);
    };
  }, []);

  return (
    <>
    {/* a few stars in the night sky behind the page (wide screens only:
        see the styles) - put on the page itself, behind everything. They
        come out with the fireflies, once the lights are down. */}
    {lit && createPortal(
      <div className={`night-stars ${leaving ? "leaving" : ""}`} aria-hidden>
        {STARS.map(([x, y, size, delay, dur], i) => (
          <i key={i} style={{ left: `${x}%`, "--y": y / 100, width: size, height: size, animationDelay: `${delay}s`, animationDuration: `${dur}s` } as React.CSSProperties} />
        ))}
      </div>,
      document.body,
    )}
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
              {/* a tap gives it a little knock: it swings and settles */}
              <div className="lantern-nudge" onClick={nudgeLantern}>
                <LanternArt />
              </div>
              {/* one firefly keeping the lantern company */}
              <span className="lantern-firefly" aria-hidden>
                <span className="lantern-firefly-y">
                  <span className="firefly-light" />
                </span>
              </span>
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
    </>
  );
}

/**
 * A knock on the lantern: it swings away from the side it was tapped on
 * and settles in under a second. One short transform animation on the
 * lantern's own (already separate) layer, run by the compositor - nothing
 * is re-rendered or repainted, and nothing runs when it isn't tapped.
 */
function nudgeLantern(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  if (typeof el.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = el.getBoundingClientRect();
  // tapped on its left: it swings right first (and the other way round)
  const d = e.clientX < box.left + box.width / 2 ? -1 : 1;
  const turn = (deg: number) => ({ transform: `rotate(${deg * d}deg)` });
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([turn(0), { ...turn(-7), offset: 0.16 }, { ...turn(4.5), offset: 0.4 }, { ...turn(-2.4), offset: 0.62 }, { ...turn(1), offset: 0.82 }, turn(0)], {
    duration: 1100,
    easing: "ease-in-out",
  });
}
