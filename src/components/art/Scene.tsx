"use client";
import { memo, useMemo } from "react";
import type { CharacterDef, CustomProp, Page } from "@/lib/types";
import { isKnownProp, type Size } from "@/lib/vocab";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { Background } from "./Background";
import { CharacterBody } from "./CharacterArt";
import { PROP_ART } from "./propArt";

const CHAR_H: Record<Size, number> = { small: 72, medium: 98, large: 124 };
const PROP_H: Record<Size, number> = { small: 38, medium: 58, large: 88 };
const FLOATY = new Set(["sky", "underwater"]);

interface Props {
  page: Page;
  cast: Record<string, CharacterDef>;
  customProps?: CustomProp[];
  animate?: boolean;
  className?: string;
  title?: string;
}

function SceneImpl({ page, cast, customProps = [], animate = true, className, title }: Props) {
  const custom = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of customProps) m[p.key] = sanitizeSvg(p.svg);
    return m;
  }, [customProps]);

  const propNode = (kind: string) => {
    if (isKnownProp(kind)) return PROP_ART[kind];
    if (custom[kind]) return <g dangerouslySetInnerHTML={{ __html: custom[kind] }} />;
    // Unknown prop names: try a loose match ("red balloon" -> balloon) before giving up.
    const loose = Object.keys(PROP_ART).find((k) => kind.includes(k));
    return loose ? PROP_ART[loose as keyof typeof PROP_ART] : PROP_ART.sparkles;
  };

  const renderProp = (p: Page["props"][number], i: number) => {
    const h = PROP_H[p.size] ?? 58;
    const s = h / 100;
    const x = (p.x / 100) * 400 - 50 * s;
    const y = (p.y / 100) * 300 - 98 * s;
    return (
      <g key={`p${i}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`} filter="url(#wc-paint)">
        {propNode(p.kind)}
      </g>
    );
  };

  const floaty = FLOATY.has(page.setting);
  const back = page.props.filter((p) => p.y < 96);
  const front = page.props.filter((p) => p.y >= 96);

  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      role="img"
      aria-label={title ?? page.text}
      preserveAspectRatio="xMidYMid slice"
    >
      <Background setting={page.setting} time={page.time} weather={page.weather} />
      {back.map(renderProp)}
      {page.characters.map((c, i) => {
        const def = cast[c.id];
        if (!def) return null;
        const h = CHAR_H[c.size] ?? 98;
        const s = h / 200;
        const lifted = floaty || c.pose === "float";
        const feetY = lifted ? 236 : 270;
        const cx = (c.x / 100) * 400;
        return (
          <g key={`c${c.id}${i}`}>
            {!lifted && <ellipse cx={cx} cy={feetY - 2} rx={h * 0.32} ry={h * 0.05} fill="#6B5B7B" opacity="0.12" />}
            <g transform={`translate(${(cx - 100 * s).toFixed(1)} ${(feetY - 192 * s).toFixed(1)}) scale(${s.toFixed(3)})`}>
              <g className={lifted && animate ? "anim-float" : undefined}>
                <g transform={c.flip ? "translate(200 0) scale(-1 1)" : undefined}>
                  <CharacterBody def={def} expression={c.expression} pose={c.pose} animate={animate} />
                </g>
              </g>
            </g>
          </g>
        );
      })}
      {front.map(renderProp)}
      {page.sound && animate && (
        <g transform="translate(26 58) rotate(-8)">
          <g className={animate ? "anim-pop" : undefined}>
          <text
            x="0"
            y="0"
            fontFamily="'Fredoka', 'Baloo 2', 'Comic Sans MS', sans-serif"
            fontWeight="700"
            fontSize={page.sound.length > 8 ? 30 : 38}
            fill="#FFFFFF"
            stroke="#F48FA5"
            strokeWidth="9"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {page.sound}
          </text>
          </g>
        </g>
      )}
      <rect x="0" y="0" width="400" height="300" filter="url(#wc-paper)" style={{ mixBlendMode: "multiply" }} pointerEvents="none" />
    </svg>
  );
}

export const Scene = memo(SceneImpl);
