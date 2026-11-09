"use client";
import { useEffect, useRef, useState } from "react";
import type { CharacterProgress } from "@/lib/character-client";

/** About how many shapes a finished character portrait has. */
const EXPECTED_SHAPES = 100;

/**
 * The waiting screen while a character is designed: what's happening now
 * ("Imagining them…", "Writing their model sheet…", "Painting… 42 brush
 * strokes") and a bar that fills as it goes. Painting progress is measured
 * from the brush strokes actually laid down; the thinking before it can't
 * be measured, so the bar eases forward on its own until painting starts.
 */
export function CharacterProgressBar({ progress, name }: { progress: CharacterProgress | null; name?: string }) {
  const started = useRef(performance.now());
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const stage = progress?.stage ?? "thinking";
  const secs = (now - started.current) / 1000;
  let pct: number;
  if (stage === "thinking") pct = 4 + 36 * (1 - Math.exp(-secs / 35));
  else if (stage === "sheet") pct = 42;
  else pct = 46 + 52 * Math.min(1, (progress as { shapes: number }).shapes / EXPECTED_SHAPES);

  const who = name?.trim() || "them";
  const label =
    stage === "thinking"
      ? `Imagining ${who}…`
      : stage === "sheet"
        ? `Writing ${name?.trim() ? `${who}'s` : "their"} model sheet…`
        : `Painting ${who}… ${(progress as { shapes: number }).shapes} brush strokes`;
  const hint = stage === "thinking" ? "Thinking through their look, colours and pose" : stage === "sheet" ? "Choosing colours and little details" : "Laying down washes, then fine pen lines";

  return (
    <div className="char-progress" role="status" aria-live="polite">
      <div className="char-progress-head">
        <span className="char-progress-label">{label}</span>
        <span className="char-progress-pct">{Math.round(pct)}%</span>
      </div>
      <div className="char-progress-track" aria-hidden>
        <span className="char-progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <p className="char-progress-hint">{hint}</p>
    </div>
  );
}
