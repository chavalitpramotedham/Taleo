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
      {night && <NightAmbience leaving={leaving} />}
      {veil && <div className={`night-veil ${veil.phase}`} style={{ background: veil.colour }} aria-hidden />}
    </Ctx.Provider>
  );
}

/** The light switch in the menu bar - with the lantern hanging beside it at night. */
export function NightToggle() {
  const { night, leaving, settled, toggle } = useNightMode();
  return (
    <span className="night-switch">
      {night && (
        <span className={`nav-lantern ${leaving ? "leaving" : ""} ${settled ? "settled" : ""}`} aria-hidden>
          <LanternArt />
        </span>
      )}
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

/** The room at night: the lantern's warm light (anchored to the lantern in
 *  the menu bar), a soft dimming toward the edges, and fireflies drifting
 *  across the screen. Decorative only - never catches a tap. */
function NightAmbience({ leaving }: { leaving: boolean }) {
  const glow = useRef<HTMLDivElement>(null);

  // Centre the light on the lantern's glass, in page coordinates (the
  // lantern sits in the menu bar, so its light stays with the top of the
  // page as you scroll).
  useLayoutEffect(() => {
    // Measured from the switch (which never moves), using the lantern's
    // resting geometry (CSS: 28px wide, hanging 28px below the switch,
    // glass at 65% of its 64px height) - so it's right even mid drop-in.
    const place = () => {
      const sw = document.querySelector(".night-switch");
      const el = glow.current;
      if (!sw || !el) return;
      const r = sw.getBoundingClientRect();
      el.style.setProperty("--lamp-x", `${r.left - 6 - 14 + window.scrollX}px`);
      el.style.setProperty("--lamp-y", `${r.bottom + 28 - 64 * 0.35 + window.scrollY}px`);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  return (
    <div className={`night-ambience ${leaving ? "leaving" : ""}`} aria-hidden>
      <div className="night-room" />
      <div className="night-glow" ref={glow}>
        <div className="night-glow-halo" />
        <div className="night-glow-core" />
        <div className="night-glow-shimmer" />
      </div>
      <div className="fireflies">
        {Array.from({ length: FIREFLIES }, (_, i) => (
          <span key={i} className={`firefly f${i}`}>
            <span className="firefly-light" />
          </span>
        ))}
      </div>
    </div>
  );
}
