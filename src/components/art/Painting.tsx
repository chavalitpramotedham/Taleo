"use client";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { sanitizeSvg, TARGET_CLASS } from "@/lib/svg-sanitize";
import { playSound, sayWord } from "@/lib/sfx";
import { AMPLITUDE, type MotionId, type SoundId } from "@/lib/actions";
import { characterArt } from "@/lib/presets";
import type { CharacterDef } from "@/lib/types";

/**
 * A story illustration: layered SVG for a 400x300 canvas, faded into the page
 * with a soft watercolour vignette and paper grain. Works on partial markup, so
 * it can show a painting while it is still streaming in.
 */
export const Painting = memo(function Painting({
  svg,
  title,
  className,
  vignette = true,
}: {
  svg: string;
  title?: string;
  className?: string;
  vignette?: boolean;
}) {
  const clean = useMemo(() => sanitizeSvg(svg), [svg]);
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
      <g mask={vignette ? "url(#tl-vignette)" : undefined} dangerouslySetInnerHTML={{ __html: clean }} />
      <rect width="400" height="300" filter="url(#tl-paper)" style={{ mixBlendMode: "multiply" }} pointerEvents="none" />
    </svg>
  );
});

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
  { svg: string; title?: string; className?: string; target: TapTarget | null; live?: boolean }
>(function InteractivePainting({ svg, title, className, target, live = false }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<{ word: string; x: number; y: number; key: number } | null>(null);
  const [tapped, setTapped] = useState(false);
  const [sparks, setSparks] = useState<{ x: number; y: number; key: number; dots: { dx: number; dy: number; c: string; s: number; star: boolean }[] } | null>(null);

  const targetEl = useCallback(() => box.current?.querySelector<SVGGElement>(`.${TARGET_CLASS}`) ?? null, []);

  // Gentle idle nudge so children can see what to tap.
  const hasTarget = Boolean(target);
  useEffect(() => {
    if (live || !hasTarget) return;
    const el = targetEl();
    el?.classList.add("tl-idle");
    return () => el?.classList.remove("tl-idle");
  }, [svg, live, hasTarget, targetEl]);

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
      <Painting svg={svg} title={title} className={className} />
      {sparks && (
        <span key={sparks.key} className="sparks" style={{ left: sparks.x, top: sparks.y }} aria-hidden>
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
        <span key={bubble.key} className="word-bubble" style={{ left: bubble.x, top: bubble.y }} aria-live="polite">
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
