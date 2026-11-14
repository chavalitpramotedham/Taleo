"use client";
import { useEffect, useState } from "react";

/** About how many shapes a finished page painting has. */
const EXPECTED_SHAPES = 110;

/** Shapes drawn so far in a painting that's still coming in. */
export function countShapes(svg: string | undefined | null): number {
  if (!svg) return 0;
  return (svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/g) || []).length;
}

/**
 * The waiting page's progress (after a choice, or while the first part is
 * made): the next part is written, then its first page painted. Writing
 * can't be measured, so the bar eases forward on its own; painting is
 * measured from the brush strokes actually laid down. Styled like the
 * character designer's bar.
 */
export function StoryProgressBar({
  started,
  painting,
  shapes,
  hint,
  target = EXPECTED_SHAPES,
  writing = "Writing what happens next…",
  done = "Opening the page…",
}: {
  /** when this wait began (ms) */
  started: number;
  /** the words are in; the first page is being painted */
  painting: boolean;
  /** strokes painted so far (null once the painting is finished) */
  shapes: number | null;
  hint?: string;
  /** strokes at which the page opens (the bar is full) */
  target?: number;
  /** said while the words are being written, and once the bar is full */
  writing?: string;
  done?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const secs = Math.max(0, (now - started) / 1000);
  const pct = !painting
    ? 4 + 40 * (1 - Math.exp(-secs / 14))
    : shapes === null
      ? 100
      : 48 + 52 * Math.min(1, shapes / target);
  const label = !painting
    ? writing
    : shapes === null || shapes >= target
      ? done
      : shapes > 0
        ? `Painting the page… ${shapes} brush strokes`
        : "Painting the page…";

  return (
    <div className="char-progress story-progress" role="status" aria-live="polite">
      <div className="char-progress-head">
        <span className="char-progress-label">{label}</span>
        <span className="char-progress-pct">{Math.round(pct)}%</span>
      </div>
      <div className="char-progress-track" aria-hidden>
        <span className="char-progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      {hint && label !== done && <p className="char-progress-hint">{hint}</p>}
    </div>
  );
}
