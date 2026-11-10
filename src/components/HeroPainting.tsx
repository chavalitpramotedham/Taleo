"use client";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { HOME_LAYERS } from "@/lib/art/homeLayers";

const TITLE = "Pip the rabbit leaps over a puddle after a falling leaf while Bobo the bear laughs";

const CAPTION = "“Wait for me!” laughed Bobo, as Pip leapt clean over the puddle.";


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
/** Layers fetched straight away (the rest wait until painting begins). */
const EAGER = 2;
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
  // The pre-painted layers are asked for from the very first byte of the
  // page (the big base wash first, at high priority) rather than when the
  // picture is reached - the painting waits on them, and so does the
  // page's largest picture.
  // Only the first two (the washes painted in the first second) are asked
  // for up front; the rest are requested once painting begins, so on a slow
  // connection they don't hold up the first ones - they arrive well before
  // their turn, a few seconds into the painting.
  // (the torn-paper edge they're shown through is asked for by every
  // page: see the root layout)
  HOME_LAYERS.slice(0, EAGER).forEach((l, i) => {
    if ("src" in l) preload(l.src, { as: "image", fetchPriority: i === 0 ? "high" : "auto" });
  });
  const [rest, setRest] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(CAPTION.length);
  const [live, setLive] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.remove("hero-paint-pending");
      return;
    }
    root.style.setProperty("--paint-ms", `${PAINT_MS}ms`);

    // Start (or restart) the painting.
    const play = () => {
      root.classList.remove("playing");
      void root.offsetWidth; // restart the CSS animations from the top
      root.classList.add("playing");
    };

    // Don't start straight away: let the page arrive and settle first (fonts,
    // the rest of the page, the theme), then begin painting on blank paper,
    // so entering the page never competes with the painting's first frames.
    let stop: (() => void) | null = null;
    let cancelled = false;
    const start = async () => {
      // Start once the base wash (painted first) is ready - the later
      // layers are already on their way and arrive long before their turn
      // in the painting, so the picture begins seconds sooner on a slow
      // connection without anything popping in.
      const imgs = Array.from(root.querySelectorAll("img"));
      await Promise.race([
        Promise.all(imgs.slice(0, EAGER).map((img) => img.decode().catch(() => {}))),
        new Promise((r) => window.setTimeout(r, 4000)),
      ]);
      if (cancelled) return;
      root.classList.remove("hero-paint-pending");
      setRest(true);
      play();
      stop = run();
    };
    // Blank paper and an empty line, pen poised, while it waits.
    setTyped(0);
    setLive(true);
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    let wait = 0;
    const idle = ric(() => (wait = window.setTimeout(() => void start(), 120)), { timeout: 900 }) as number;

    const run = () => {
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
    };

    return () => {
      cancelled = true;
      (window.cancelIdleCallback ?? clearTimeout)(idle);
      clearTimeout(wait);
      stop?.();
    };
  }, []);

  return (
    <figure className="hero-art hero-paint">
      <div ref={wrap} className="hero-paint-canvas hero-paint-pending">
        {/* The scene as a stack of layers, one per part, in paint order:
            pre-painted images (see scripts/render-home-layers.cjs) that only
            fade in, and pen lines that draw on as live SVG - so playing the
            painting never re-runs the watercolour filters. */}
        <div className="hero-layers painted-edge" role="img" aria-label={TITLE}>
          <svg viewBox="0 0 400 300" className="hero-layer" aria-hidden>
            <rect className="paint-paper" width="400" height="300" />
          </svg>
          {HOME_LAYERS.map((l, i) => {
            const slot = SCHEDULE[i] ?? { start: Math.min(PAINT_MS - 1500, 1000 * i), dur: 1500 };
            const style = { "--d": `${slot.start}ms`, "--dur": `${slot.dur}ms` } as React.CSSProperties;
            return l.kind === "ink" ? (
              <svg
                key={i}
                viewBox="0 0 400 300"
                className="hero-layer hp-g hp-g-ink"
                style={style}
                aria-hidden
                dangerouslySetInnerHTML={{ __html: l.svg }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={i < EAGER || rest ? l.src : undefined} alt="" className={`hero-layer hp-g hp-g-${l.kind}`} style={style} decoding="async" />
            );
          })}
          <svg viewBox="0 0 400 300" className="hero-layer" aria-hidden>
            <rect className="paint-dim" width="400" height="300" />
            <rect width="400" height="300" filter="url(#tl-paper)" style={{ mixBlendMode: "multiply" }} />
          </svg>
        </div>
        <p className={`hero-stage ${stage ? "on" : ""}`} aria-hidden>
          {stage}
        </p>
        <div className="hero-brush" aria-hidden>
          {/* its shadow on the paper, offset down and to the right, so the
              brush reads as held just above the painting */}
          <span className="hero-brush-shadow">
            <BrushArt />
          </span>
          <BrushArt />
        </div>
      </div>
      <figcaption aria-label={CAPTION}>
        <span aria-hidden>{live ? CAPTION.slice(0, typed) : CAPTION}</span>
        <span className={`hero-quill ${live && typed < CAPTION.length ? "on" : ""}`} aria-hidden />
      </figcaption>
    </figure>
  );
}

const BrushArt = () => (
  <svg viewBox="0 0 40 120" width="22" height="66">
    {/* Lit from the upper left: each part is shaded round (a lighter band
        on the lit side, darker toward the far edge), with a glint on the
        metal ferrule - drawn once, so the shading costs nothing to move. */}
    <defs>
      <linearGradient id="hb-wood" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#6e4626" />
        <stop offset="0.3" stopColor="#c48a52" />
        <stop offset="0.55" stopColor="#9b6a3c" />
        <stop offset="1" stopColor="#5a3820" />
      </linearGradient>
      <linearGradient id="hb-metal" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8d8679" />
        <stop offset="0.28" stopColor="#f4efe4" />
        <stop offset="0.5" stopColor="#c9c2b4" />
        <stop offset="1" stopColor="#77705f" />
      </linearGradient>
      <linearGradient id="hb-hair" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#5a3f26" />
        <stop offset="0.35" stopColor="#9a744c" />
        <stop offset="1" stopColor="#4a321e" />
      </linearGradient>
    </defs>
    <path d="M20 118C17 108 16 86 17 62H23C24 86 23 108 20 118Z" fill="url(#hb-wood)" stroke="#4F3A2A" strokeWidth="1.4" />
    <path d="M18.6 66C18.2 84 18.6 100 19.6 110" fill="none" stroke="#f3d3a8" strokeOpacity="0.55" strokeWidth="0.9" strokeLinecap="round" />
    <path d="M16 46H24V64H16Z" fill="url(#hb-metal)" stroke="#4F3A2A" strokeWidth="1.4" />
    <path d="M16.6 51H23.4M16.6 58H23.4" stroke="#6f6857" strokeOpacity="0.5" strokeWidth="0.8" />
    <path d="M16 46C14 30 17 12 20 2C23 12 26 30 24 46Z" fill="url(#hb-hair)" stroke="#4F3A2A" strokeWidth="1.4" />
    <path className="hero-brush-tip" d="M17 22C18 13 19 7 20 2C21 7 22 13 23 22Z" />
    <path d="M18.4 20C18.8 13 19.3 8 19.9 4" fill="none" stroke="#e8a07c" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);
