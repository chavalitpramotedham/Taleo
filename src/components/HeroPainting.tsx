"use client";
import { useEffect, useRef, useState } from "react";
import { Painting } from "@/components/art/Painting";
import { HOME_SCENE } from "@/lib/art/homeScene";

const CAPTION = "“Wait for me!” laughed Bobo, as Pip leapt clean over the puddle.";

type Kind = "wash" | "paint" | "ink" | "detail";

/** When each part of the sample scene starts painting in, and how long it
 *  takes - in the scene's own order (sky and hills, the meadow, Bobo, Pip,
 *  the splash, little extras), with each part beginning before the last
 *  has finished so the picture builds in one calm, overlapping flow. */
const SCHEDULE: { start: number; dur: number; stage: string }[] = [
  { start: 0, dur: 2600, stage: "Washing in the sky…" },
  { start: 900, dur: 2600, stage: "Washing in the hills and trees…" },
  { start: 2600, dur: 2200, stage: "Painting the meadow…" },
  { start: 4300, dur: 2200, stage: "Painting Bobo…" },
  { start: 5800, dur: 2000, stage: "Painting Bobo…" },
  { start: 7000, dur: 1400, stage: "Painting Bobo…" },
  { start: 7400, dur: 2200, stage: "Painting Pip…" },
  { start: 8900, dur: 2000, stage: "Painting Pip…" },
  { start: 10200, dur: 1400, stage: "A splash in the puddle…" },
  { start: 11000, dur: 2000, stage: "A few little surprises…" },
  { start: 12200, dur: 2000, stage: "Inking the finishing lines…" },
  { start: 13600, dur: 1400, stage: "Finishing touches…" },
];
const PAINT_MS = 15200; // all parts in
const HOLD_MS = 4200; // admire the finished picture
const FADE_MS = 1200; // soft fade before it starts again
const CAPTION_START = 2400;
const CAPTION_CHAR_MS = 66;

/**
 * The homepage picture, painted gently before your eyes: whole parts of the
 * scene fade in together (washes, then the meadow, then each character with
 * its pen lines drawing on), overlapping so it builds in one calm flow,
 * while a brush drifts slowly across the page and a line of the story is
 * written underneath. Then it rests, fades, and begins again.
 *
 * The painting and the brush are CSS animations (scheduled per part with
 * custom properties), so they run smoothly on the browser's animation
 * engine; a light clock keeps the caption and stage label in step, and
 * everything pauses together while off-screen or in a hidden tab. Reduced
 * motion shows the finished picture.
 */
export function HeroPainting() {
  const wrap = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(CAPTION.length);
  const [live, setLive] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    const root = wrap.current;
    const svg = root?.querySelector("svg");
    if (!root || !svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.remove("hero-paint-pending");
      return;
    }

    // Tag each top-level part of the scene with its kind and schedule.
    // (Cleaned markup marks layers by their watercolour filter.)
    const holder = svg.querySelector(":scope > g");
    const groups = Array.from(holder?.children ?? []).filter((el): el is SVGGElement => el.tagName.toLowerCase() === "g");
    groups.forEach((g, i) => {
      const filter = g.getAttribute("filter") || "";
      const kind: Kind = filter.includes("tl-wash") ? "wash" : filter.includes("tl-paint") ? "paint" : filter.includes("tl-ink") ? "ink" : "detail";
      const slot = SCHEDULE[i] ?? { start: Math.min(PAINT_MS - 1500, 1000 * i), dur: 1500, stage: "Finishing touches…" };
      g.classList.add("hp-g", `hp-g-${kind}`);
      g.style.setProperty("--d", `${slot.start}ms`);
      g.style.setProperty("--dur", `${slot.dur}ms`);
      if (kind === "ink") g.querySelectorAll("*").forEach((p) => p.setAttribute("pathLength", "1"));
    });
    root.style.setProperty("--paint-ms", `${PAINT_MS}ms`);

    // Start (or restart) the painting.
    const play = () => {
      root.classList.remove("playing");
      void root.offsetWidth; // restart the CSS animations from the top
      root.classList.add("playing");
    };
    root.classList.remove("hero-paint-pending");
    play();
    setLive(true);

    // A light clock that only advances while the picture is on screen,
    // keeping caption + stage in step with the (paused-alongside) CSS.
    // Time is measured on the real clock minus paused time (not by adding
    // up frames), so the caption stays in step with the CSS animations even
    // when frames are slow or dropped.
    let visible = true;
    let pageVisible = !document.hidden;
    let cycleStart = performance.now();
    let pausedAt: number | null = document.hidden ? performance.now() : null;
    let pausedTotal = 0;
    const syncPause = () => {
      const paused = !(visible && pageVisible);
      root.classList.toggle("paused", paused);
      const now = performance.now();
      if (paused && pausedAt === null) pausedAt = now;
      if (!paused && pausedAt !== null) {
        pausedTotal += now - pausedAt;
        pausedAt = null;
      }
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        syncPause();
      },
      { threshold: 0.1 },
    );
    io.observe(root);
    const onVis = () => {
      pageVisible = !document.hidden;
      syncPause();
    };
    document.addEventListener("visibilitychange", onVis);

    let raf = 0;
    let lastStage: string | null = null;
    let lastTyped = -1;
    const frame = () => {
      const now = performance.now();
      const elapsed = (pausedAt ?? now) - cycleStart - pausedTotal;

      const st = elapsed < PAINT_MS ? ([...SCHEDULE].reverse().find((s) => s.start <= elapsed)?.stage ?? null) : null;
      if (st !== lastStage) setStage((lastStage = st));
      const t = Math.max(0, Math.min(CAPTION.length, Math.floor((elapsed - CAPTION_START) / CAPTION_CHAR_MS)));
      if (t !== lastTyped) setTyped((lastTyped = t));

      if (elapsed >= PAINT_MS + HOLD_MS && !root.classList.contains("hero-paint-fade")) root.classList.add("hero-paint-fade");
      if (elapsed >= PAINT_MS + HOLD_MS + FADE_MS) {
        cycleStart = now;
        pausedTotal = 0;
        play();
        root.classList.remove("hero-paint-fade");
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <figure className="hero-art hero-paint">
      <div ref={wrap} className="hero-paint-canvas hero-paint-pending">
        <Painting svg={HOME_SCENE} title="Pip the rabbit leaps over a puddle after a falling leaf while Bobo the bear laughs" />
        <p className={`hero-stage ${stage ? "on" : ""}`} aria-hidden>
          {stage}
        </p>
        <div className="hero-brush" aria-hidden>
          <svg viewBox="0 0 40 120" width="22" height="66">
            <path d="M20 118C17 108 16 86 17 62H23C24 86 23 108 20 118Z" fill="#9b6a3c" stroke="#4F3A2A" strokeWidth="1.4" />
            <path d="M16 46H24V64H16Z" fill="#c9c2b4" stroke="#4F3A2A" strokeWidth="1.4" />
            <path d="M16 46C14 30 17 12 20 2C23 12 26 30 24 46Z" fill="#7a5a3a" stroke="#4F3A2A" strokeWidth="1.4" />
            <path className="hero-brush-tip" d="M17 22C18 13 19 7 20 2C21 7 22 13 23 22Z" />
          </svg>
        </div>
      </div>
      <figcaption aria-label={CAPTION}>
        <span aria-hidden>{live ? CAPTION.slice(0, typed) : CAPTION}</span>
        <span className={`hero-quill ${live && typed < CAPTION.length ? "on" : ""}`} aria-hidden />
      </figcaption>
    </figure>
  );
}
