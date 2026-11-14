"use client";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sanitizeSvg, TARGET_CLASS } from "@/lib/svg-sanitize";
import { bakePainting, bakeWidth, canBake, peekBaked, type Baked } from "@/lib/bake";
import { playSound, sayWord } from "@/lib/sfx";
import { AMPLITUDE, type MotionId, type SoundId } from "@/lib/actions";
import { characterArt } from "@/lib/presets";
import type { CharacterDef } from "@/lib/types";

/**
 * A story illustration: layered SVG for a 400x300 canvas, faded into the page
 * with a soft watercolour vignette and paper grain. Works on partial markup, so
 * it can show a painting while it is still streaming in.
 *
 * The painting is shown as pictures drawn once from it (lib/bake): its
 * watercolour filters are worked out a single time, at a sensible size,
 * instead of by the screen every time anything on the page moves - which a
 * phone takes seconds over. The tappable character is a picture of its
 * own, so it can still hop and dance. A painting still arriving is drawn
 * again every second or so, each new drawing fading in over the last.
 * Where pictures can't be drawn, the painting itself is shown.
 */
export const Painting = memo(function Painting({
  svg,
  title,
  className,
  vignette = true,
  live = false,
  onReady,
  appear = true,
}: {
  svg: string;
  title?: string;
  className?: string;
  vignette?: boolean;
  /** Still being painted: drawn again as it grows, each drawing fading in. */
  live?: boolean;
  /** Called when the painting is on show (its pictures drawn and ready),
   *  and again each time a new drawing of it goes up. */
  onReady?: () => void;
  /** Fade in when it's ready (the reader fades the whole page instead). */
  appear?: boolean;
}) {
  const clean = useMemo(() => sanitizeSvg(svg), [svg]);
  const box = useRef<SVGSVGElement>(null);
  const night = useNight();
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState<{ b: Baked; key: string } | null>(null);
  const [prev, setPrev] = useState<{ b: Baked; key: string } | null>(null);
  const [plain, setPlain] = useState(false);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  // (said again whenever a new drawing goes up - after day/night, say -
  // so a tap target newly drawn gets its "tap me" hop)
  const tell = useCallback(() => readyRef.current?.(), []);

  // (measured before the first frame, so a painting already drawn - the
  // copy of a page on the turning leaf - shows at once)
  useLayoutEffect(() => {
    if (!canBake()) {
      return setPlain(true);
    }
    // (its laid-out width, not as it looks mid-animation: a book opening or
    // a page turning is scaled, and would ask for a drawing at another size)
    setWidth(bakeWidth(box.current?.clientWidth || box.current?.getBoundingClientRect().width || 0));
  }, []);

  const lastLive = useRef(0);
  const liveCost = useRef(400);
  // (a painting still arriving changes every moment: one drawing at a time
  // is made of whatever has arrived by then, and the next is due a little
  // after it - never put off by the painting changing again meanwhile)
  const latest = useRef({ clean, width, night, live });
  latest.current = { clean, width, night, live };
  const liveTimer = useRef<number | null>(null);
  const [kick, setKick] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    // (set here too: React mounts twice in development)
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
      liveTimer.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    if (plain || !width || !clean) return;
    let off = false;
    const split = !live;
    const show = (b: Baked | null, fade: boolean) => {
      if (off) return;
      if (!b) {
        if (!shownRef.current) setPlain(true);
        return;
      }
      const key = b.back.url;
      const cur = shownRef.current;
      if (cur?.key === key) return;
      setPrev(fade && cur ? cur : null);
      setShown({ b, key });
    };
    const now = peekBaked(clean, width, night, split);
    if (now !== undefined) {
      show(now, false);
      return;
    }
    if (live) {
      // (a growing painting: drawn again at most every second or so, and
      // less often if drawing it takes long)
      if (liveTimer.current !== null) return;
      // (drawing never takes more than a third of the time: in Safari most
      // of it is done away from the page, so that's often)
      const wait = Math.max(0, lastLive.current + Math.max(800, liveCost.current * 2) - performance.now());
      liveTimer.current = window.setTimeout(() => {
        const now = latest.current;
        const t0 = performance.now();
        // (a drawing of a painting still arriving is gone within a second:
        // drawn smaller - well under half the pixels to save and show -
        // while the finished one is drawn full size)
        const liveWidth = Math.round((now.width * 2) / 3 / 40) * 40;
        void bakePainting(now.clean, { width: liveWidth, night: now.night, split: false, soon: true }).then((b) =>
          ready(b).then(() => {
            liveTimer.current = null;
            liveCost.current = performance.now() - t0;
            lastLive.current = performance.now();
            // (finished meanwhile: the finished drawing is coming instead)
            if (!mounted.current || !latest.current.live) return;
            if (!b) return void (!shownRef.current && setPlain(true));
            const cur = shownRef.current;
            if (cur?.key === b.back.url) return;
            setPrev(cur);
            setShown({ b, key: b.back.url });
            // (and the next, if more has arrived since)
            if (latest.current.clean !== now.clean) setKick((k) => k + 1);
          }),
        );
      }, wait);
      return;
    }
    // (already showing a drawing - day/night just switched - the new one
    // waits for the switch to finish: the two differ only in the paper
    // under the figures, and the switch itself stays smooth)
    const again = Boolean(shownRef.current);
    const t = window.setTimeout(
      () => void bakePainting(clean, { width, night, split, soon: !again }).then((b) => ready(b).then(() => show(b, again))),
      again ? 1400 : 0,
    );
    return () => {
      off = true;
      window.clearTimeout(t);
    };
    // (`shown` is read, not followed: a new drawing replaces it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, width, night, live, plain, kick]);

  // the earlier drawing goes once the new one has faded in over it
  useEffect(() => {
    if (!prev) return;
    const t = window.setTimeout(() => setPrev(null), 700);
    return () => window.clearTimeout(t);
  }, [prev]);

  useEffect(() => {
    if (shown) tell();
  }, [shown, tell]);
  useEffect(() => {
    if (!plain) return;
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(tell)));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [plain, tell]);

  // (the drawing fading out keeps no tap target: there's only ever one)
  const layers = (b: Baked, live = true) => (
    <>
      <image href={b.back.url} width={400} height={300} preserveAspectRatio="none" />
      {b.target && (
        <g className={live ? TARGET_CLASS : undefined}>
          <image href={b.target.url} x={b.target.box.x} y={b.target.box.y} width={b.target.box.w} height={b.target.box.h} preserveAspectRatio="none" />
        </g>
      )}
      {b.front && <image href={b.front.url} x={b.front.box.x} y={b.front.box.y} width={b.front.box.w} height={b.front.box.h} preserveAspectRatio="none" pointerEvents="none" />}
    </>
  );

  return (
    <svg
      ref={box}
      viewBox="0 0 400 300"
      className={`${className || ""}${vignette ? " painted-edge" : ""}${appear && !plain && !shown ? " bake-wait" : ""}`}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* The soft, ragged watercolour edge is a pre-drawn mask image on the
          whole picture (.painted-edge) - drawn once, applied by the GPU -
          rather than a texture filter recomputed for every painting on
          every repaint. Night only (.paint-paper / .paint-dim): lamplit
          paper under the paint and a soft dimming over it, inside the same
          edge, so the picture never shows a rectangle. */}
      {vignette && <rect className="paint-paper" width="400" height="300" />}
      {plain ? (
        <Shapes clean={clean} live={live} />
      ) : (
        <>
          {prev && <g key={prev.key}>{layers(prev.b, false)}</g>}
          {shown && (
            <g key={shown.key} className={prev ? "bake-in" : appear ? "bake-shown" : undefined}>
              {layers(shown.b)}
            </g>
          )}
        </>
      )}
      {vignette && <rect className="paint-dim" width="400" height="300" pointerEvents="none" />}
      <rect width="400" height="300" fill="url(#tl-grain)" style={{ mixBlendMode: "multiply" }} pointerEvents="none" />
    </svg>
  );
});

const SVG_NS = "http://www.w3.org/2000/svg";

/** Brings a picture on the page up to date with its markup. While it is
 *  being painted the markup only ever grows at its end, so the shapes
 *  already drawn are left alone and the new ones are added (fading in);
 *  anything else - a different picture, or the finished one differing from
 *  what was streamed - is simply drawn afresh. */
function paintOnto(host: SVGGElement, clean: string, fade: boolean) {
  const next = document.createElementNS(SVG_NS, "g");
  next.innerHTML = clean;
  if (!host.firstChild) {
    // (a picture first seen part-painted comes in whole, with its page)
    host.replaceChildren(...Array.from(next.childNodes));
    return;
  }
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // (finished: one look over the whole picture, in case it isn't what
  // was streamed)
  if (!fade && next.innerHTML === host.innerHTML) return;
  if (!grow(host, next, fade && !calm)) settle(host, next, !calm);
}

/** The picture differs from what's shown (the finished one isn't quite
 *  what was streamed, or painting started over): what matches stays as it
 *  is, and only what's different is swapped - fading in, never popping. */
function settle(host: SVGGElement, next: Element, fade: boolean) {
  const have = Array.from(host.children);
  const want = Array.from(next.children);
  let same = 0;
  while (same < have.length && same < want.length && have[same].outerHTML === want[same].outerHTML) same++;
  for (const el of have.slice(same)) el.remove();
  for (const el of want.slice(same)) {
    host.appendChild(el);
    if (fade) el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-out" });
  }
}

/** How long a newly painted shape takes to fade in. */
const FADE_MS = 750;

/** Adds what `next` has beyond `old`, looking only down the last branch
 *  (the one still open while painting): a few nodes per chunk, however
 *  large the picture. False if `next` isn't `old` grown. */
function grow(old: Element, next: Element, fade: boolean): boolean {
  const have = old.children;
  const want = Array.from(next.children);
  if (want.length < have.length) return false;
  const last = have.length - 1;
  if (last >= 0) {
    const a = have[last];
    const b = want[last];
    if (a.tagName !== b.tagName) return false;
    if (a.children.length || b.children.length) {
      if (!grow(a, b, fade)) return false;
    } else if (a.textContent !== b.textContent) a.textContent = b.textContent;
  }
  for (const el of want.slice(have.length)) {
    old.appendChild(el);
    if (fade) el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-out" });
  }
  return true;
}

/** The painting itself, as shapes (where it isn't drawn as pictures). A
 *  painting first shown while it is arriving is added to rather than
 *  redrawn: each new shape is put on top of the ones already there and
 *  fades in, so the picture grows gently instead of flickering. */
function Shapes({ clean, live }: { clean: string; live: boolean }) {
  // (decided once: a picture that arrived in strokes keeps the shapes it
  // has when it is finished, rather than being drawn afresh)
  const [grown] = useState(live);
  const strokes = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    if (grown && strokes.current) paintOnto(strokes.current, clean, live);
  }, [grown, clean, live]);
  return grown ? <g ref={strokes} /> : <g dangerouslySetInnerHTML={{ __html: clean }} />;
}

/** Wait until a drawing's pictures are decoded, so they appear whole. */
async function ready(b: Baked | null) {
  if (!b) return;
  await Promise.all(
    [b.back, b.target, b.front]
      .filter((l): l is NonNullable<typeof l> => Boolean(l))
      .map((l) => {
        const img = new Image();
        img.src = l.url;
        return img.decode().catch(() => undefined);
      }),
  );
}

/** Whether night mode is on (html[data-night]), kept up to date. */
function useNight(): boolean {
  const [night, setNight] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.night === "1");
  useEffect(() => {
    const root = document.documentElement;
    const look = () => setNight(root.dataset.night === "1");
    look();
    const mo = new MutationObserver(look);
    mo.observe(root, { attributes: true, attributeFilter: ["data-night"] });
    return () => mo.disconnect();
  }, []);
  return night;
}

/** A character's reference portrait (picker, loading screens, library). */
export const CharacterPortrait = memo(function CharacterPortrait({
  character,
  className,
}: {
  character: Pick<CharacterDef, "preset" | "svg" | "name">;
  className?: string;
}) {
  const clean = useMemo(() => sanitizeSvg(characterArt(character)), [character]);
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={character.name}>
      <g dangerouslySetInnerHTML={{ __html: clean }} />
    </svg>
  );
});

// ---------------------------------------------------------------- interactive

export interface TapTarget {
  word: string;
  motion: MotionId;
  sound: SoundId;
  /** Reader's age level 1-5: scales how big and dramatic the animation is. */
  level: number;
  /** "Tap Pip!" / "Tap the puddle!" */
  hint: string;
}

export interface InteractivePaintingHandle {
  /** Act out the page's word: animate the target, play its sound, show and say the word. */
  play: () => void;
}

/**
 * A painting whose tap target (the group the illustrator marked with
 * class="target") can be tapped: it moves, makes its sound, and the word
 * appears and is spoken, so children link the word, the picture and the sound.
 */
export const InteractivePainting = forwardRef<
  InteractivePaintingHandle,
  { svg: string; title?: string; className?: string; target: TapTarget | null; live?: boolean; onReady?: () => void }
>(function InteractivePainting({ svg, title, className, target, live = false, onReady }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<{ word: string; x: number; y: number; key: number } | null>(null);
  const [tapped, setTapped] = useState(false);
  const [sparks, setSparks] = useState<{ x: number; y: number; key: number; dots: { dx: number; dy: number; c: string; s: number; star: boolean }[] } | null>(null);

  // (the first target with something in it: a newcomer that is the target
  // is laid in a target group of its own once painted, leaving the one its
  // place was marked in empty)
  const targetEl = useCallback(() => {
    const all = [...(box.current?.querySelectorAll<SVGGElement>(`.${TARGET_CLASS}`) ?? [])];
    return all.find((el) => el.childElementCount > 0) ?? all[0] ?? null;
  }, []);

  // Gentle idle nudge so children can see what to tap.
  const hasTarget = Boolean(target);
  // (the painting's pictures arrive a moment after it's put up: the tap
  // target is only there once they have)
  const [drawn, setDrawn] = useState(0);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const whenReady = useCallback(() => {
    setDrawn((n) => n + 1);
    readyRef.current?.();
  }, []);
  useEffect(() => {
    if (live || !hasTarget) return;
    const el = targetEl();
    el?.classList.add("tl-idle");
    return () => el?.classList.remove("tl-idle");
  }, [svg, live, hasTarget, targetEl, drawn]);

  const animate = (el: Element, cls: string) => {
    el.classList.remove("tl-idle", cls);
    void (el as HTMLElement).getBoundingClientRect(); // restart the animation
    el.classList.add(cls);
    const done = (e?: Event) => {
      if (e && e.target !== el) return;
      el.classList.remove(cls);
      el.removeEventListener("animationend", done);
      if (el.classList.contains(TARGET_CLASS)) el.classList.add("tl-idle");
    };
    el.addEventListener("animationend", done);
  };

  const play = useCallback(() => {
    if (!target || !box.current) return;
    const el = targetEl();
    const host = box.current.getBoundingClientRect();
    let x = host.width / 2;
    let y = host.height * 0.3;
    if (el) {
      const r = el.getBoundingClientRect();
      x = r.left - host.left + r.width / 2;
      y = r.top - host.top;
      animate(el, `tl-anim-${target.motion}`);
    } else {
      const svgEl = box.current.querySelector("svg");
      if (svgEl) animate(svgEl, "tl-anim-grow");
    }
    x = Math.min(Math.max(x, 60), host.width - 60);
    y = Math.min(Math.max(y, 40), host.height - 30);
    setBubble({ word: target.word, x, y, key: Date.now() });
    // Older readers get a burst of painted sparkles from the target.
    const n = target.level >= 5 ? 16 : target.level >= 4 ? 11 : target.level >= 3 ? 6 : 0;
    if (n && el) {
      const r = el.getBoundingClientRect();
      const cx = r.left - host.left + r.width / 2;
      const cy = r.top - host.top + r.height / 2;
      const colors = ["#B5653E", "#D3A24F", "#8FA77A", "#8FA7B5", "#B2443A", "#E8C766"];
      const reach = 50 + target.level * 18;
      setSparks({
        x: cx,
        y: cy,
        key: Date.now(),
        dots: Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
          const d = reach * (0.6 + Math.random() * 0.5);
          return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: colors[i % colors.length], s: 7 + Math.random() * 7, star: i % 3 === 0 };
        }),
      });
    }
    setTapped(true);
    playSound(target.sound);
    sayWord(target.word);
  }, [target, targetEl]);

  useImperativeHandle(ref, () => ({ play }), [play]);

  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 1800);
    return () => window.clearTimeout(t);
  }, [bubble]);

  useEffect(() => {
    if (!sparks) return;
    const t = window.setTimeout(() => setSparks(null), 1400);
    return () => window.clearTimeout(t);
  }, [sparks]);

  useEffect(() => setTapped(false), [svg]);

  const onClick = (e: React.MouseEvent) => {
    if (!target || live) return;
    if ((e.target as Element).closest?.(`.${TARGET_CLASS}`) || !targetEl()) play();
    else {
      const el = targetEl();
      if (el) animate(el, "tl-anim-hint");
    }
  };

  return (
    <div
      ref={box}
      className={`interactive-painting ${target && !live ? "has-target" : ""}`}
      onClick={onClick}
      style={{ ["--amp" as string]: AMPLITUDE[(target?.level ?? 3) - 1] ?? 1 }}
    >
      <Painting svg={svg} title={title} className={className} live={live} onReady={whenReady} appear={false} />
      {sparks && (
        <span key={`sparks-${sparks.key}`} className="sparks" style={{ left: sparks.x, top: sparks.y }} aria-hidden>
          {sparks.dots.map((d, i) => (
            <span
              key={i}
              className={d.star ? "spark star" : "spark"}
              style={{ ["--dx" as string]: `${d.dx}px`, ["--dy" as string]: `${d.dy}px`, ["--c" as string]: d.c, ["--s" as string]: `${d.s}px`, animationDelay: `${(i % 4) * 40}ms` }}
            />
          ))}
        </span>
      )}
      {bubble && (
        <span key={`word-${bubble.key}`} className="word-bubble" style={{ left: bubble.x, top: bubble.y }} aria-live="polite">
          {bubble.word}
        </span>
      )}
      {target && !live && (
        <button type="button" className={`tap-hint ${tapped ? "done" : ""}`} onClick={(e) => (e.stopPropagation(), play())}>
          <TapIcon /> {target.hint}
        </button>
      )}
    </div>
  );
});

const TapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.5-2.5 6-6 6h-1c-2.5 0-4-1.2-5.2-3L4.2 14a1.5 1.5 0 0 1 2.4-1.8L9 15" />
  </svg>
);
