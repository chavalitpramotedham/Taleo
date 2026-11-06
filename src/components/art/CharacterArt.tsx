"use client";
import { useMemo } from "react";
import type { CharacterDef } from "@/lib/types";
import type { Expression, Pose } from "@/lib/vocab";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { Face } from "./Face";
import { PRESET_ART } from "./presetArt";

const POSE_CLASS: Partial<Record<Pose, string>> = {
  jump: "anim-bounce",
  dance: "anim-wiggle",
  float: "anim-float",
  wave: "anim-sway",
  run: "anim-run",
};

/** A character painted in a 200x200 coordinate box (feet at y≈190). */
export function CharacterBody({
  def,
  expression = "happy",
  pose = "stand",
  animate = true,
}: {
  def: CharacterDef;
  expression?: Expression;
  pose?: Pose;
  animate?: boolean;
}) {
  const preset = def.preset ? PRESET_ART[def.preset] : undefined;
  const customSvg = useMemo(() => (preset ? "" : sanitizeSvg(def.svg)), [preset, def.svg]);
  const art = preset ?? (customSvg ? null : PRESET_ART.star);
  const face = art?.face ?? def.face ?? { x: 100, y: 100, size: 56 };
  const sleeping = pose === "sleep";

  const lean = pose === "run" ? "rotate(7 100 190)" : pose === "dance" ? "rotate(-6 100 190)" : pose === "sleep" ? "rotate(-10 100 190)" : "";
  const lift = pose === "jump" ? "translate(0 -16)" : "";

  return (
    <g>
      {pose === "jump" && (
        <g stroke="#B9A9C9" strokeWidth="3" strokeLinecap="round" opacity="0.7">
          <path d="M70 196 L60 200" />
          <path d="M130 196 L140 200" />
          <path d="M100 198 L100 202" />
        </g>
      )}
      {pose === "run" && (
        <g stroke="#B9A9C9" strokeWidth="3" strokeLinecap="round" opacity="0.6">
          <path d="M18 120 L4 120" />
          <path d="M22 140 L2 140" />
          <path d="M18 160 L6 160" />
        </g>
      )}
      <g className={animate ? POSE_CLASS[pose] : undefined}>
        <g transform={`${lift} ${lean}`}>
          <g filter="url(#wc-paint)">
            {art ? art.body : <g dangerouslySetInnerHTML={{ __html: customSvg }} />}
          </g>
          <Face x={face.x} y={face.y} size={face.size} expression={expression} sleeping={sleeping} />
        </g>
      </g>
      {pose === "wave" && (
        <g fill="none" stroke="#B9A9C9" strokeWidth="3" strokeLinecap="round" opacity="0.8">
          <path d="M168 60 q8 -8 0 -16" />
          <path d="M178 64 q12 -12 0 -24" />
        </g>
      )}
      {pose === "sleep" && (
        <g fill="#9A8FCC" fontFamily="'Fredoka', 'Baloo 2', sans-serif" fontWeight="700" className={animate ? "anim-zzz" : undefined}>
          <text x="150" y="50" fontSize="22">z</text>
          <text x="166" y="32" fontSize="28">z</text>
          <text x="186" y="12" fontSize="34">Z</text>
        </g>
      )}
    </g>
  );
}

/** Standalone avatar (used in pickers and the library). */
export function CharacterAvatar({
  def,
  expression = "happy",
  pose = "stand",
  className,
  animate = false,
}: {
  def: CharacterDef;
  expression?: Expression;
  pose?: Pose;
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg viewBox="-10 0 220 210" className={className} role="img" aria-label={def.name}>
      <ellipse cx="100" cy="194" rx="62" ry="9" fill="#E9DDEB" opacity="0.6" />
      <CharacterBody def={def} expression={expression} pose={pose} animate={animate} />
    </svg>
  );
}
