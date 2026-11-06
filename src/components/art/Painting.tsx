"use client";
import { memo, useMemo } from "react";
import { sanitizeSvg } from "@/lib/svg-sanitize";
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
