"use client";
import { useMemo } from "react";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { AVATAR_ART } from "@/lib/art/avatarArt";

/** A character's smiling face-portrait avatar, cropped to a circle. */
export function Avatar({ avatarKey, className }: { avatarKey: string; className?: string }) {
  const svg = AVATAR_ART[avatarKey] || AVATAR_ART.star;
  const clean = useMemo(() => sanitizeSvg(svg), [svg]);
  return (
    <svg viewBox="0 0 200 200" className={`avatar ${className || ""}`} role="img" aria-label="Profile picture">
      <g dangerouslySetInnerHTML={{ __html: clean }} />
    </svg>
  );
}
