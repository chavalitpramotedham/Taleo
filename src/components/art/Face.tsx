import type { Expression } from "@/lib/vocab";

const INK = "#4A3B47";
const BLUSH = "#F59AAE";

/**
 * Expressive face drawn at (x, y) with width `size`. Shared by preset and
 * custom characters so every character can laugh, sleep, gasp, etc.
 */
export function Face({
  x,
  y,
  size,
  expression = "happy",
  sleeping = false,
}: {
  x: number;
  y: number;
  size: number;
  expression?: Expression;
  sleeping?: boolean;
}) {
  const s = size / 60; // designed at size 60
  const expr: Expression = sleeping ? "sleepy" : expression;
  const eye = (cx: number, side: -1 | 1) => {
    switch (expr) {
      case "laughing":
        return <path key={side} d={`M${cx - 6} 2 Q${cx} -6 ${cx + 6} 2`} fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />;
      case "sleepy":
        return <path key={side} d={`M${cx - 6} 0 Q${cx} 5 ${cx + 6} 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
      case "silly":
        return side === 1 ? (
          <path key={side} d={`M${cx - 6} 0 L${cx + 5} -3 M${cx - 6} 0 L${cx + 5} 4`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        ) : (
          <g key={side}>
            <ellipse cx={cx} cy={0} rx="5" ry="6" fill={INK} />
            <circle cx={cx + 1.8} cy={-2} r="1.8" fill="#fff" />
          </g>
        );
      case "surprised":
        return (
          <g key={side}>
            <ellipse cx={cx} cy={-1} rx="5.5" ry="7.5" fill={INK} />
            <circle cx={cx + 2} cy={-4} r="2.2" fill="#fff" />
          </g>
        );
      case "excited":
        return (
          <g key={side}>
            <ellipse cx={cx} cy={0} rx="6" ry="7" fill={INK} />
            <circle cx={cx + 2} cy={-2.5} r="2.6" fill="#fff" />
            <circle cx={cx - 2} cy={2.5} r="1.2" fill="#fff" />
          </g>
        );
      case "thinking":
        return (
          <g key={side}>
            <ellipse cx={cx} cy={0} rx="4.5" ry="5.5" fill={INK} />
            <circle cx={cx + 1} cy={-3} r="1.8" fill="#fff" />
          </g>
        );
      default:
        return (
          <g key={side}>
            <ellipse cx={cx} cy={0} rx="4.8" ry="5.8" fill={INK} />
            <circle cx={cx + 1.6} cy={-2} r="1.8" fill="#fff" />
          </g>
        );
    }
  };

  const brows = () => {
    if (expr === "sad" || expr === "worried")
      return (
        <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M-21 -13 L-11 -16" />
          <path d="M21 -13 L11 -16" />
        </g>
      );
    if (expr === "proud")
      return (
        <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M-21 -15 L-11 -12" />
          <path d="M21 -15 L11 -12" />
        </g>
      );
    if (expr === "thinking") return <path d="M10 -15 Q16 -19 22 -15" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />;
    return null;
  };

  const mouth = () => {
    switch (expr) {
      case "laughing":
      case "excited":
        return (
          <g>
            <path d="M-8 9 Q0 9 8 9 Q7 21 0 21 Q-7 21 -8 9 Z" fill="#B5495F" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M-4 17 Q0 14 4 17 Q2 20 0 20 Q-2 20 -4 17Z" fill="#F7A9B8" />
          </g>
        );
      case "surprised":
        return <ellipse cx="0" cy="13" rx="4.5" ry="5.5" fill="#B5495F" stroke={INK} strokeWidth="2" />;
      case "sad":
        return <path d="M-6 15 Q0 9 6 15" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
      case "worried":
        return <path d="M-7 13 Q-3.5 10 0 13 Q3.5 16 7 13" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />;
      case "sleepy":
        return <ellipse cx="0" cy="12" rx="2.6" ry="2" fill={INK} />;
      case "silly":
        return (
          <g>
            <path d="M-7 9 Q0 15 7 9" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M-1 12 Q-1 20 3 20 Q7 20 6 12" fill="#F7A9B8" stroke={INK} strokeWidth="1.8" />
          </g>
        );
      case "thinking":
        return <path d="M-5 13 Q0 11 5 13" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />;
      case "proud":
        return <path d="M-7 10 Q1 17 8 8" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
      default:
        return <path d="M-6 9 Q0 15 6 9" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
    }
  };

  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="-21" cy="9" rx="7" ry="4.5" fill={BLUSH} opacity="0.55" />
      <ellipse cx="21" cy="9" rx="7" ry="4.5" fill={BLUSH} opacity="0.55" />
      {eye(-14, -1)}
      {eye(14, 1)}
      {brows()}
      {mouth()}
      {expr === "sad" && <path d="M-17 5 Q-19 11 -17 13 Q-15 11 -17 5Z" fill="#A9CBEF" />}
      {expr === "worried" && <path d="M27 -18 Q25 -12 27 -10 Q29 -12 27 -18Z" fill="#A9CBEF" />}
    </g>
  );
}
