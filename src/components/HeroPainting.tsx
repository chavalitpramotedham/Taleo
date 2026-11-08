"use client";
import { useEffect, useRef, useState } from "react";
import { Painting } from "@/components/art/Painting";
import { HOME_SCENE } from "@/lib/art/homeScene";

const CAPTION = "“Wait for me!” laughed Bobo, as Pip leapt clean over the puddle.";

type Kind = "wash" | "paint" | "ink" | "detail";
type Step = { el: SVGElement; kind: Kind; dwell: number; stage: string };

/** What's being painted, group by group, in the sample scene's own order -
 *  told the way an illustrator would describe it. */
const STAGES = [
  "Washing in the sky…",
  "Washing in the hills and trees…",
  "Painting the meadow…",
  "Painting Bobo…",
  "Painting Bobo…",
  "Painting Bobo…",
  "Painting Pip…",
  "Painting Pip…",
  "A splash in the puddle…",
  "A few little surprises…",
  "Inking the finishing lines…",
  "Finishing touches…",
];
const DWELL: Record<Kind, number> = { wash: 1100, paint: 230, ink: 130, detail: 500 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The homepage picture, painted before your eyes like an illustrator at
 * work: the soft washes bloom in, then each colour is dabbed on (a little
 * brush hopping from shape to shape, its tip dipped in that colour), then
 * the pen lines are drawn and the tiny details added - while a line of the
 * story is written out underneath. It holds a moment, then starts again.
 *
 * Pacing is calm on purpose: shapes fade in gently and overlap, so the
 * picture builds in one flowing motion rather than popping; the brush
 * glides slowly on its own GPU layer. It pauses while
 * off-screen or in a hidden tab, and shows the finished painting straight
 * away for anyone who prefers reduced motion.
 */
export function HeroPainting() {
  const wrap = useRef<HTMLDivElement>(null);
  const brush = useRef<HTMLDivElement>(null);
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

    // The scene's top-level groups, in painting order (backgrounds first,
    // then each character, then the little extras) - any unlabelled group
    // counts as a finishing detail.
    const holder = svg.querySelector(":scope > g");
    const groups = Array.from(holder?.children ?? []).filter((el): el is SVGGElement => el.tagName.toLowerCase() === "g");
    const steps: Step[] = [];
    groups.forEach((g, gi) => {
      // Cleaned markup marks each layer by its watercolour filter (the
      // original class names are swapped for these).
      const filter = g.getAttribute("filter") || "";
      const kind: Kind = filter.includes("tl-wash") ? "wash" : filter.includes("tl-paint") ? "paint" : filter.includes("tl-ink") ? "ink" : "detail";
      const stage = STAGES[gi] ?? STAGES[STAGES.length - 1];
      if (kind === "wash" || kind === "detail") steps.push({ el: g, kind, dwell: DWELL[kind], stage });
      else for (const child of Array.from(g.children) as SVGElement[]) steps.push({ el: child, kind, dwell: DWELL[kind], stage });
    });
    // Pen strokes draw themselves along their length.
    for (const s of steps) {
      if (s.kind !== "ink") continue;
      const paths = s.el.matches("path, line, polyline, circle, ellipse, rect, polygon") ? [s.el] : Array.from(s.el.querySelectorAll("*"));
      for (const p of paths) p.setAttribute("pathLength", "1");
    }

    let cancelled = false;
    let visible = true;
    let pageVisible = !document.hidden;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.15 });
    io.observe(root);
    const onVis = () => (pageVisible = !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const waitUntilShown = async () => {
      while (!cancelled && !(visible && pageVisible)) await sleep(300);
    };

    const hideAll = () => {
      for (const s of steps) {
        s.el.classList.remove("hp-in", "hp-draw");
        s.el.classList.add("hp-hidden");
      }
    };
    const moveBrush = (el: SVGElement, colour: string | null) => {
      const b = brush.current;
      if (!b) return;
      const box = el.getBoundingClientRect();
      const host = root.getBoundingClientRect();
      if (!box.width && !box.height) return;
      const x = box.left - host.left + box.width / 2;
      const y = box.top - host.top + box.height / 2;
      b.style.transform = `translate(${x}px, ${y}px)`;
      if (colour && colour !== "none") b.style.setProperty("--tip", colour);
      b.classList.add("on");
    };
    const fillOf = (el: SVGElement) =>
      el.getAttribute("fill") || el.querySelector("[fill]")?.getAttribute("fill") || el.closest("[fill]")?.getAttribute("fill") || null;

    const run = async () => {
      setLive(true);
      while (!cancelled) {
        hideAll();
        setTyped(0);
        root.classList.remove("hero-paint-pending", "hero-paint-fade");
        await waitUntilShown();
        let typing: Promise<void> | null = null;
        for (let i = 0; i < steps.length && !cancelled; i++) {
          await waitUntilShown();
          const s = steps[i];
          setStage(s.stage);
          if (s.kind === "paint" || s.kind === "ink") moveBrush(s.el, s.kind === "paint" ? fillOf(s.el) : "#4F3A2A");
          if (s.kind === "wash") brush.current?.classList.remove("on");
          s.el.classList.remove("hp-hidden");
          s.el.classList.add(s.kind === "ink" ? "hp-draw" : "hp-in");
          // Start writing the story line once the colours are going on.
          if (!typing && s.kind === "paint") {
            typing = (async () => {
              await sleep(600);
              for (let c = 1; c <= CAPTION.length && !cancelled; c++) {
                setTyped(c);
                await sleep(CAPTION[c - 1] === " " ? 40 : 58);
              }
            })();
          }
          await sleep(s.dwell);
        }
        brush.current?.classList.remove("on");
        setStage(null);
        await typing;
        setTyped(CAPTION.length);
        await sleep(3600);
        if (cancelled) break;
        root.classList.add("hero-paint-fade");
        await sleep(1100);
      }
    };
    void run();
    return () => {
      cancelled = true;
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
        <div ref={brush} className="hero-brush" aria-hidden>
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
