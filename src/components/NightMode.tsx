"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LanternArt, MoonIcon } from "./NightLamp";

/**
 * Night mode for the whole site: a cosy, dim bedtime theme with a little
 * storybook lantern hanging from the menu bar (next to its switch), its
 * warm light falling across the page, and fireflies drifting about.
 *
 * Remembered on this device ("taleo.night"); an inline script in the root
 * layout applies it before first paint, so there's never a flash of the
 * light theme.
 *
 * Switching is deliberately light on the device: one full-screen veil
 * fades in (dusk-dark going to night, cream going to light), the theme
 * flips instantly behind it, and the veil fades away - a single layer's
 * opacity, rather than animating every element's colours. The lantern
 * and fireflies only start once the switch is done.
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
  const [veil, setVeil] = useState<{ colour: string; phase: "in" | "out" } | null>(null);
  const busy = useRef(false);

  // Pick up what the pre-paint script applied.
  useEffect(() => {
    if (document.documentElement.dataset.night === "1") {
      setSettled(true);
      setNight(true);
    }
  }, []);

  const apply = (on: boolean) => {
    const root = document.documentElement;
    if (on) root.dataset.night = "1";
    else delete root.dataset.night;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {}
  };

  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const next = !night;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      apply(next);
      setSettled(true);
      setNight(next);
      busy.current = false;
      return;
    }
    if (!next) {
      setLeaving(true); // the lantern rises away first
      await sleep(420);
    }
    setVeil({ colour: next ? "#0f0c12" : "#f3ecdc", phase: "in" });
    await sleep(340);
    apply(next);
    setSettled(false);
    setNight(next);
    setLeaving(false);
    await sleep(60);
    setVeil((v) => (v ? { ...v, phase: "out" } : v));
    await sleep(560);
    setVeil(null);
    busy.current = false;
  }, [night]);

  return (
    <Ctx.Provider value={{ night, leaving, settled, toggle }}>
      {children}
      {night && <NightAmbience leaving={leaving} settled={settled} />}
      {veil && <div className={`night-veil ${veil.phase}`} style={{ background: veil.colour }} aria-hidden />}
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
        title={night ? "Night mode on" : "Night mode"}
      >
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
function NightAmbience({ leaving, settled }: { leaving: boolean; settled: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  // Hang the lantern from the menu bar's bottom edge just left of the
  // switch, and centre the light on its glass - in page coordinates, so
  // both stay with the top of the page as you scroll. Measured from things
  // that never animate (the bar and the switch), using the lantern's
  // resting geometry (CSS: a 14px cord, then 64px of lantern with the
  // glass at 65%) - so it's right even mid drop-in.
  useLayoutEffect(() => {
    const place = () => {
      const sw = document.querySelector(".night-switch");
      const bar = document.querySelector(".topbar");
      const el = root.current;
      if (!sw || !bar || !el) return;
      const s = sw.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      // On a phone the content runs edge to edge, so the lantern (a little
      // smaller) hangs in the right-hand margin instead of over headings.
      const phone = window.innerWidth < 640;
      const w = phone ? 20 : 28;
      const x = (phone ? document.documentElement.clientWidth - 13 : s.left - 20) + window.scrollX;
      const top = b.bottom + window.scrollY;
      el.style.setProperty("--lamp-w", `${w}px`);
      el.style.setProperty("--lamp-x", `${x}px`);
      el.style.setProperty("--bar-y", `${top}px`);
      el.style.setProperty("--lamp-y", `${top + 14 + ((64 * w) / 28) * 0.65}px`);
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

  // Scrolling drifts the fireflies past at their own depths (nearer ones
  // faster), like a little parallax, instead of them sitting still on the
  // glass. One that leaves the screen wraps round, out of sight, to come in
  // from the other edge. Uses the separate `translate` property, so their
  // wandering animation (on `transform`) carries on untouched.
  const flies = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = flies.current;
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(box.children) as HTMLElement[];
    const depth = els.map((_, i) => 0.18 + ((i * 7) % 16) / 16 * 0.5); // 0.18-0.68
    const M = 40; // wrap margin, beyond the edge of the screen
    let base: number[] = [];
    let h = 0;
    const measure = () => {
      h = box.clientHeight;
      els.forEach((el) => (el.style.translate = ""));
      base = els.map((el) => el.offsetTop);
    };
    let raf = 0;
    const draw = () => {
      raf = 0;
      const y = window.scrollY;
      const span = h + 2 * M;
      els.forEach((el, i) => {
        const at = (((base[i] - y * depth[i] + M) % span) + span) % span - M;
        el.style.translate = `0 ${(at - base[i]).toFixed(1)}px`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      measure();
      draw();
    };
    measure();
    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className={`night-ambience ${leaving ? "leaving" : ""}`} ref={root} aria-hidden>
      <div className="night-room" />
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
      <div className="fireflies" ref={flies}>
        {Array.from({ length: FIREFLIES }, (_, i) => (
          <span key={i} className={`firefly f${i}`}>
            <span className="firefly-light" />
          </span>
        ))}
      </div>
    </div>
  );
}
