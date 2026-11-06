import type { ReactNode } from "react";
import type { PropKind } from "@/lib/vocab";

// Each prop is painted in a 100x100 box, centred at x=50 and resting on y≈98.

const st = (fill: string, line: string, width = 2.5) => ({
  fill,
  stroke: line,
  strokeWidth: width,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
});

const PINK = st("#F9C6D3", "#D98BA0");
const GREEN = st("#A8D8B9", "#74AE88");
const LEAF = st("#CDEAC0", "#93BE83");
const BROWN = st("#D9B99B", "#A9805F");
const YELLOW = st("#FDE9A9", "#E0C46A");
const BLUE = st("#A9CBEF", "#7FA6CF");
const AQUA = st("#B5E3E8", "#7FB9C2");
const LILAC = st("#C9C0F0", "#9A8FCC");
const PEACH = st("#FFD6A5", "#E0A66A");
const WHITE = st("#FFFFFF", "#C9BFCF");
const CORAL = st("#F7A9B8", "#D9788F");

const star = (cx: number, cy: number, R: number) => {
  const r = R * 0.48;
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r : R;
    return `${(cx + d * Math.cos(a)).toFixed(1)},${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
};

export const PROP_ART: Record<PropKind, ReactNode> = {
  tree: (
    <g>
      <path d="M44 98 L46 60 L54 60 L56 98 Z" {...BROWN} />
      <path d="M50 8 C72 8 86 24 84 40 C94 48 90 70 72 70 C64 78 36 78 28 70 C10 70 6 48 16 40 C14 24 28 8 50 8 Z" {...GREEN} />
      <circle cx="36" cy="40" r="4" fill="#F7A9B8" />
      <circle cx="62" cy="30" r="4" fill="#F7A9B8" />
      <circle cx="66" cy="56" r="4" fill="#F7A9B8" />
    </g>
  ),
  pine: (
    <g>
      <rect x="45" y="80" width="10" height="18" rx="2" {...BROWN} />
      <path d="M50 4 L72 36 L62 36 L80 60 L66 60 L86 84 L14 84 L34 60 L20 60 L38 36 L28 36 Z" {...st("#A8D8B9", "#6E9C60")} />
    </g>
  ),
  flower: (
    <g>
      <path d="M50 98 C50 80 48 66 50 52" fill="none" stroke="#74AE88" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 80 C40 70 30 74 30 74 C34 84 44 84 50 80 Z" {...LEAF} />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="50" cy="32" rx="9" ry="14" transform={`rotate(${a} 50 46)`} {...PINK} />
      ))}
      <circle cx="50" cy="46" r="8" {...YELLOW} />
    </g>
  ),
  flowers: (
    <g>
      <path d="M8 98 C14 84 30 80 50 82 C70 80 86 84 92 98 Z" {...LEAF} />
      {[
        [22, 76, "#F9C6D3", "#D98BA0"],
        [50, 66, "#C9C0F0", "#9A8FCC"],
        [78, 76, "#FDE9A9", "#E0C46A"],
        [36, 84, "#A9CBEF", "#7FA6CF"],
        [64, 84, "#FFD6A5", "#E0A66A"],
      ].map(([x, y, f, l]) => (
        <g key={`${x}`}>
          {[0, 90, 180, 270].map((a) => (
            <circle key={a} cx={Number(x)} cy={Number(y) - 7} r="6" transform={`rotate(${a} ${x} ${y})`} {...st(String(f), String(l), 2)} />
          ))}
          <circle cx={Number(x)} cy={Number(y)} r="4" fill="#FFF4C9" />
        </g>
      ))}
    </g>
  ),
  mushroom: (
    <g>
      <path d="M38 98 C38 80 40 66 42 60 L58 60 C60 66 62 80 62 98 Z" {...st("#FFF4E8", "#D9C8B8")} />
      <path d="M10 62 C10 30 90 30 90 62 C70 70 30 70 10 62 Z" {...CORAL} />
      <circle cx="32" cy="48" r="6" fill="#FFFFFF" />
      <circle cx="58" cy="40" r="7" fill="#FFFFFF" />
      <circle cx="74" cy="54" r="4" fill="#FFFFFF" />
    </g>
  ),
  bush: (
    <g>
      <path d="M6 98 C0 76 14 60 30 64 C32 44 62 40 68 58 C86 52 100 74 94 98 Z" {...GREEN} />
      <circle cx="30" cy="80" r="4" fill="#F9C6D3" />
      <circle cx="56" cy="70" r="4" fill="#FDE9A9" />
      <circle cx="74" cy="84" r="4" fill="#F9C6D3" />
    </g>
  ),
  rock: (
    <g>
      <path d="M12 98 C8 76 26 60 46 62 C64 54 90 70 90 98 Z" {...st("#DCD6E4", "#A99FB6")} />
      <path d="M30 76 C38 70 48 70 54 72" fill="none" stroke="#F4F1F7" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  sun: (
    <g>
      <circle cx="50" cy="50" r="46" fill="url(#wc-glow)" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d="M50 8 L50 18" stroke="#F2C76B" strokeWidth="5" strokeLinecap="round" transform={`rotate(${i * 36} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="24" {...st("#FDE9A9", "#F2C76B", 3)} />
    </g>
  ),
  moon: (
    <g>
      <circle cx="50" cy="50" r="46" fill="url(#wc-glow)" />
      <path d="M62 14 C40 18 28 38 34 58 C40 78 62 88 80 80 C60 98 22 88 16 58 C10 30 36 8 62 14 Z" {...st("#FFF4C9", "#E8CF7E", 3)} />
    </g>
  ),
  star: <polygon points={star(50, 54, 40)} {...st("#FDE9A9", "#E8C766", 3)} />,
  cloud: (
    <path d="M18 80 C4 80 2 60 16 56 C14 40 34 32 44 42 C50 24 78 24 82 44 C96 44 100 62 90 70 C96 80 86 86 78 82 Z" {...st("#FFFFFF", "#C8DDF2")} />
  ),
  rainbow: (
    <g fill="none" strokeLinecap="round" opacity="0.9">
      <path d="M6 96 A44 44 0 0 1 94 96" stroke="#F9C6D3" strokeWidth="8" />
      <path d="M14 96 A36 36 0 0 1 86 96" stroke="#FFD6A5" strokeWidth="8" />
      <path d="M22 96 A28 28 0 0 1 78 96" stroke="#FDE9A9" strokeWidth="8" />
      <path d="M30 96 A20 20 0 0 1 70 96" stroke="#CDEAC0" strokeWidth="8" />
      <path d="M38 96 A12 12 0 0 1 62 96" stroke="#A9CBEF" strokeWidth="8" />
    </g>
  ),
  house: (
    <g>
      <rect x="16" y="46" width="68" height="52" {...st("#FFF4E8", "#D9B8A8")} />
      <path d="M6 50 L50 12 L94 50 Z" {...CORAL} />
      <rect x="40" y="66" width="20" height="32" rx="8" {...BROWN} />
      <rect x="22" y="58" width="14" height="14" rx="3" {...AQUA} />
      <rect x="64" y="58" width="14" height="14" rx="3" {...AQUA} />
      <rect x="66" y="18" width="10" height="20" {...BROWN} />
    </g>
  ),
  boat: (
    <g>
      <path d="M50 14 L50 66" stroke="#A9805F" strokeWidth="3" />
      <path d="M53 18 L82 60 L53 60 Z" {...WHITE} />
      <path d="M47 26 L24 60 L47 60 Z" {...PINK} />
      <path d="M8 68 L92 68 C86 88 70 94 50 94 C30 94 14 88 8 68 Z" {...BLUE} />
      <path d="M2 96 Q14 90 26 96 T50 96 T74 96 T98 96" fill="none" stroke="#A9CBEF" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  balloon: (
    <g>
      <path d="M50 64 C46 74 56 82 50 98" fill="none" stroke="#B9A9C9" strokeWidth="2" />
      <path d="M50 4 C70 4 80 20 78 34 C76 50 60 62 50 64 C40 62 24 50 22 34 C20 20 30 4 50 4 Z" {...CORAL} />
      <path d="M46 64 L54 64 L50 58 Z" {...CORAL} />
      <ellipse cx="38" cy="22" rx="5" ry="8" fill="#FFFFFF" opacity="0.6" transform="rotate(20 38 22)" />
    </g>
  ),
  kite: (
    <g>
      <path d="M50 70 C40 80 60 86 48 98" fill="none" stroke="#B9A9C9" strokeWidth="2" />
      <path d="M50 4 L80 36 L50 70 L20 36 Z" {...AQUA} />
      <path d="M50 4 L50 70 M20 36 L80 36" stroke="#7FB9C2" strokeWidth="2" />
      <path d="M50 4 L80 36 L50 36 Z" fill="#F9C6D3" opacity="0.8" />
      <path d="M50 70 L20 36 L50 36 Z" fill="#FDE9A9" opacity="0.8" />
    </g>
  ),
  ball: (
    <g>
      <circle cx="50" cy="66" r="31" {...st("#FFFFFF", "#D98BA0")} />
      <path d="M22 54 C40 64 60 64 78 54 L80 66 C60 76 40 76 20 66 Z" fill="#F9C6D3" />
      <path d="M26 84 C40 90 60 90 74 84" fill="none" stroke="#A9CBEF" strokeWidth="6" />
    </g>
  ),
  gift: (
    <g>
      <rect x="18" y="46" width="64" height="52" rx="4" {...AQUA} />
      <rect x="12" y="34" width="76" height="16" rx="4" {...AQUA} />
      <rect x="44" y="34" width="12" height="64" fill="#F9C6D3" />
      <path d="M50 34 C36 14 22 26 34 34 Z M50 34 C64 14 78 26 66 34 Z" {...PINK} />
    </g>
  ),
  cake: (
    <g>
      <rect x="14" y="54" width="72" height="42" rx="8" {...st("#FFF4E8", "#D9B8A8")} />
      <path d="M14 62 C24 72 30 60 38 70 C46 60 54 72 62 62 C70 72 78 60 86 66 L86 60 C86 54 14 54 14 60 Z" {...PINK} />
      <rect x="47" y="34" width="6" height="20" rx="2" {...LILAC} />
      <path d="M50 22 C56 28 54 34 50 34 C46 34 44 28 50 22 Z" fill="#FFD6A5" />
      <rect x="8" y="94" width="84" height="5" rx="2.5" fill="#E9DDEB" />
    </g>
  ),
  cupcake: (
    <g>
      <path d="M26 64 L74 64 L66 98 L34 98 Z" {...AQUA} />
      <path d="M22 66 C12 58 22 44 32 46 C34 30 66 30 68 46 C78 44 88 58 78 66 Z" {...PINK} />
      <circle cx="50" cy="30" r="7" {...st("#F48FA5", "#C9637A")} />
    </g>
  ),
  apple: (
    <g>
      <path d="M50 34 C30 22 10 38 14 62 C18 86 36 98 50 92 C64 98 82 86 86 62 C90 38 70 22 50 34 Z" {...CORAL} />
      <path d="M50 34 C50 24 52 18 56 14" fill="none" stroke="#A9805F" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M54 24 C62 12 76 14 76 14 C72 26 62 28 54 24 Z" {...LEAF} />
      <ellipse cx="32" cy="50" rx="5" ry="8" fill="#FFFFFF" opacity="0.5" />
    </g>
  ),
  carrot: (
    <g>
      <path d="M50 30 C40 14 30 12 30 12 M50 30 C50 14 54 6 54 6 M50 30 C60 16 70 14 70 14" fill="none" stroke="#74AE88" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 34 C36 26 64 26 68 34 C66 54 56 82 50 98 C44 82 34 54 32 34 Z" {...PEACH} />
      <path d="M40 46 L48 46 M44 60 L54 60 M46 74 L52 74" stroke="#E0A66A" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  cookie: (
    <g>
      <circle cx="50" cy="66" r="30" {...st("#F4E1D2", "#C9A27E")} />
      <g fill="#A9805F">
        <circle cx="38" cy="56" r="4" />
        <circle cx="60" cy="52" r="3.5" />
        <circle cx="64" cy="74" r="4" />
        <circle cx="42" cy="80" r="3.5" />
        <circle cx="52" cy="66" r="3" />
      </g>
    </g>
  ),
  honeypot: (
    <g>
      <path d="M22 50 C10 70 20 98 50 98 C80 98 90 70 78 50 Z" {...PEACH} />
      <rect x="20" y="38" width="60" height="14" rx="7" {...PEACH} />
      <path d="M26 52 C34 62 40 56 44 66 C48 74 52 60 58 58 C66 56 70 62 74 52 Z" fill="#FDE9A9" stroke="#E0C46A" strokeWidth="2" />
      <path d="M40 30 C50 20 60 30 50 40" fill="none" stroke="#A9805F" strokeWidth="3" />
    </g>
  ),
  book: (
    <g>
      <path d="M8 46 C26 40 40 42 50 50 C60 42 74 40 92 46 L92 92 C74 86 60 88 50 96 C40 88 26 86 8 92 Z" {...st("#FFFFFF", "#C9BFCF")} />
      <path d="M50 50 L50 96" stroke="#C9BFCF" strokeWidth="2" />
      <path d="M16 56 L40 54 M16 64 L40 62 M60 54 L84 56 M60 62 L84 64" stroke="#C9C0F0" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 92 C26 86 40 88 50 98 C60 88 74 86 96 92" fill="none" stroke="#F7A9B8" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  bed: (
    <g>
      <rect x="6" y="40" width="10" height="58" rx="4" {...BROWN} />
      <rect x="84" y="56" width="10" height="42" rx="4" {...BROWN} />
      <rect x="10" y="66" width="80" height="20" rx="6" {...st("#FFFFFF", "#C9BFCF")} />
      <path d="M30 60 C40 54 90 56 90 66 L90 82 L30 82 Z" {...LILAC} />
      <ellipse cx="24" cy="62" rx="12" ry="7" {...st("#FFFFFF", "#C9BFCF")} />
    </g>
  ),
  map: (
    <g>
      <path d="M8 40 L36 32 L64 40 L92 32 L92 90 L64 98 L36 90 L8 98 Z" {...st("#FFF4C9", "#D9C08A")} />
      <path d="M36 32 L36 90 M64 40 L64 98" stroke="#E5D3A3" strokeWidth="2" />
      <path d="M18 80 C30 70 40 76 50 64 C58 56 66 62 74 52" fill="none" stroke="#D98BA0" strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
      <path d="M72 46 L82 56 M82 46 L72 56" stroke="#D9788F" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  treasure: (
    <g>
      <path d="M12 56 C12 30 88 30 88 56 Z" {...BROWN} />
      <rect x="12" y="54" width="76" height="42" rx="4" {...BROWN} />
      <rect x="12" y="52" width="76" height="8" fill="#FDE9A9" stroke="#E0C46A" strokeWidth="2" />
      <rect x="42" y="56" width="16" height="16" rx="3" {...YELLOW} />
      <circle cx="30" cy="34" r="4" fill="#FDE9A9" />
      <circle cx="68" cy="30" r="3" fill="#FDE9A9" />
    </g>
  ),
  key: (
    <g transform="rotate(-30 50 60)">
      <circle cx="30" cy="60" r="16" {...YELLOW} />
      <circle cx="30" cy="60" r="6" fill="#FFFFFF" />
      <rect x="44" y="56" width="44" height="8" rx="3" {...YELLOW} />
      <rect x="72" y="62" width="6" height="12" rx="2" {...YELLOW} />
      <rect x="82" y="62" width="6" height="9" rx="2" {...YELLOW} />
    </g>
  ),
  butterfly: (
    <g>
      <ellipse cx="34" cy="44" rx="18" ry="22" transform="rotate(-20 34 44)" {...LILAC} />
      <ellipse cx="66" cy="44" rx="18" ry="22" transform="rotate(20 66 44)" {...LILAC} />
      <ellipse cx="36" cy="72" rx="12" ry="14" {...PINK} />
      <ellipse cx="64" cy="72" rx="12" ry="14" {...PINK} />
      <ellipse cx="50" cy="58" rx="5" ry="22" fill="#6B5B7B" />
      <path d="M48 36 C44 26 38 22 36 22 M52 36 C56 26 62 22 64 22" fill="none" stroke="#6B5B7B" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  bee: (
    <g>
      <ellipse cx="40" cy="42" rx="14" ry="18" transform="rotate(-30 40 42)" fill="#FFFFFF" stroke="#C8DDF2" strokeWidth="2" opacity="0.9" />
      <ellipse cx="58" cy="40" rx="14" ry="18" transform="rotate(30 58 40)" fill="#FFFFFF" stroke="#C8DDF2" strokeWidth="2" opacity="0.9" />
      <ellipse cx="50" cy="66" rx="26" ry="20" {...YELLOW} />
      <path d="M40 48 C36 60 36 74 40 84 M56 47 C52 60 52 74 56 86" stroke="#6B5B7B" strokeWidth="6" fill="none" />
      <circle cx="70" cy="62" r="3" fill="#4A3B47" />
    </g>
  ),
  bird: (
    <g>
      <path d="M20 60 C20 40 40 30 56 36 C64 26 80 28 82 40 C82 54 72 72 50 74 C34 76 20 72 20 60 Z" {...AQUA} />
      <path d="M36 52 C44 44 56 50 52 60 C46 66 38 62 36 52 Z" fill="#E7F6F8" stroke="#7FB9C2" strokeWidth="2" />
      <path d="M82 40 L94 44 L82 48 Z" {...PEACH} />
      <circle cx="72" cy="38" r="3" fill="#4A3B47" />
      <path d="M20 58 L6 50 L10 64 Z" {...AQUA} />
    </g>
  ),
  fish: (
    <g>
      <path d="M78 60 L96 44 L96 80 Z" {...PEACH} />
      <ellipse cx="48" cy="62" rx="34" ry="22" {...PEACH} />
      <path d="M40 46 C46 56 46 68 40 78" fill="none" stroke="#E0A66A" strokeWidth="2.5" />
      <circle cx="26" cy="56" r="4" fill="#4A3B47" />
      <path d="M18 68 Q22 72 28 70" fill="none" stroke="#4A3B47" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  shell: (
    <g>
      <path d="M50 96 L14 56 C14 30 86 30 86 56 Z" {...st("#FDE2EA", "#D98BA0")} />
      <path d="M50 96 L30 40 M50 96 L50 34 M50 96 L70 40" stroke="#D98BA0" strokeWidth="2" fill="none" />
    </g>
  ),
  starfish: <polygon points={star(50, 62, 36)} {...st("#FFC2A8", "#E08E6E", 3)} />,
  snowman: (
    <g>
      <circle cx="50" cy="74" r="24" {...st("#FFFFFF", "#B7CBE0")} />
      <circle cx="50" cy="36" r="17" {...st("#FFFFFF", "#B7CBE0")} />
      <path d="M50 38 L64 42 L50 44 Z" fill="#FFC48A" />
      <circle cx="44" cy="32" r="2.5" fill="#4A3B47" />
      <circle cx="56" cy="32" r="2.5" fill="#4A3B47" />
      <path d="M34 50 C44 56 56 56 66 50 L68 58 C56 62 44 62 32 58 Z" {...CORAL} />
      <circle cx="50" cy="70" r="3" fill="#A9CBEF" />
      <circle cx="50" cy="82" r="3" fill="#A9CBEF" />
    </g>
  ),
  umbrella: (
    <g>
      <path d="M50 46 L50 90 C50 98 38 98 38 90" fill="none" stroke="#A9805F" strokeWidth="4" strokeLinecap="round" />
      <path d="M6 48 C10 16 90 16 94 48 C86 42 78 42 72 48 C66 42 56 42 50 48 C44 42 34 42 28 48 C22 42 12 42 6 48 Z" {...CORAL} />
      <path d="M50 22 C40 30 36 40 28 48 M50 22 C60 30 64 40 72 48" fill="none" stroke="#D9788F" strokeWidth="2" />
    </g>
  ),
  puddle: (
    <g>
      <ellipse cx="50" cy="88" rx="46" ry="10" {...st("#B5E3E8", "#8FC6CF")} />
      <path d="M26 86 C34 84 42 84 48 86" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  leaf: (
    <g>
      <path d="M14 90 C10 50 40 18 88 14 C86 60 58 90 14 90 Z" {...st("#FFD6A5", "#E0A66A")} />
      <path d="M14 90 C40 64 60 44 80 22" fill="none" stroke="#E0A66A" strokeWidth="2.5" />
    </g>
  ),
  heart: (
    <path d="M50 92 C20 70 6 54 10 34 C14 16 40 12 50 32 C60 12 86 16 90 34 C94 54 80 70 50 92 Z" {...CORAL} />
  ),
  sparkles: (
    <g fill="#FDE9A9" stroke="#E8C766" strokeWidth="2" strokeLinejoin="round">
      <path d="M50 10 C53 34 58 39 80 42 C58 45 53 50 50 74 C47 50 42 45 20 42 C42 39 47 34 50 10 Z" />
      <path d="M80 62 C81 72 84 74 92 75 C84 76 81 78 80 88 C79 78 76 76 68 75 C76 74 79 72 80 62 Z" />
      <path d="M20 70 C21 78 23 80 30 81 C23 82 21 84 20 92 C19 84 17 82 10 81 C17 80 19 78 20 70 Z" />
    </g>
  ),
  rocket: (
    <g>
      <path d="M50 4 C70 18 74 46 68 72 L32 72 C26 46 30 18 50 4 Z" {...st("#FFFFFF", "#C9BFCF")} />
      <circle cx="50" cy="38" r="9" {...AQUA} />
      <path d="M32 54 L16 76 L32 72 Z M68 54 L84 76 L68 72 Z" {...CORAL} />
      <path d="M38 72 C40 86 50 98 50 98 C50 98 60 86 62 72 Z" fill="#FFD6A5" stroke="#F2B36B" strokeWidth="2" />
    </g>
  ),
  planet: (
    <g>
      <circle cx="50" cy="56" r="28" {...LILAC} />
      <ellipse cx="50" cy="58" rx="46" ry="11" fill="none" stroke="#F9C6D3" strokeWidth="6" transform="rotate(-12 50 58)" />
      <circle cx="40" cy="46" r="5" fill="#E3DDF8" />
    </g>
  ),
  car: (
    <g>
      <path d="M8 80 L8 62 C8 56 14 54 20 54 L30 36 C32 32 36 30 40 30 L64 30 C68 30 72 32 74 36 L82 54 C90 54 94 58 94 64 L94 80 Z" {...CORAL} />
      <path d="M34 52 L40 38 L50 38 L50 52 Z M56 52 L56 38 L66 38 L72 52 Z" {...AQUA} />
      <circle cx="28" cy="84" r="11" {...st("#6B5B7B", "#4A3B47")} />
      <circle cx="74" cy="84" r="11" {...st("#6B5B7B", "#4A3B47")} />
      <circle cx="28" cy="84" r="4" fill="#DCD6E4" />
      <circle cx="74" cy="84" r="4" fill="#DCD6E4" />
    </g>
  ),
  bucket: (
    <g>
      <path d="M26 30 C26 4 74 4 74 30" fill="none" stroke="#9A8FCC" strokeWidth="3" />
      <path d="M20 40 L80 40 L72 96 L28 96 Z" {...AQUA} />
      <rect x="16" y="34" width="68" height="10" rx="5" {...AQUA} />
      <circle cx="50" cy="66" r="9" fill="#FDE9A9" />
    </g>
  ),
  sandcastle: (
    <g>
      <rect x="18" y="56" width="64" height="42" {...st("#FBE3B6", "#D9B98A")} />
      <rect x="34" y="30" width="32" height="28" {...st("#FBE3B6", "#D9B98A")} />
      <path d="M18 56 L18 48 L26 48 L26 56 M74 56 L74 48 L82 48 L82 56 M34 30 L34 22 L42 22 L42 30 M58 30 L58 22 L66 22 L66 30" {...st("#FBE3B6", "#D9B98A")} />
      <path d="M44 98 L44 80 C44 74 56 74 56 80 L56 98 Z" fill="#E8C99A" />
      <path d="M50 22 L50 6 L62 11 L50 15" {...st("#F9C6D3", "#D98BA0", 2)} />
    </g>
  ),
  teddy: (
    <g>
      <circle cx="32" cy="22" r="10" {...BROWN} />
      <circle cx="68" cy="22" r="10" {...BROWN} />
      <ellipse cx="50" cy="76" rx="26" ry="22" {...BROWN} />
      <circle cx="50" cy="38" r="22" {...BROWN} />
      <ellipse cx="50" cy="46" rx="9" ry="6" fill="#F4E1D2" />
      <circle cx="42" cy="34" r="2.6" fill="#4A3B47" />
      <circle cx="58" cy="34" r="2.6" fill="#4A3B47" />
      <ellipse cx="50" cy="44" rx="3" ry="2" fill="#4A3B47" />
      <path d="M38 60 L50 66 L62 60 L62 70 L50 66 L38 70 Z" fill="#A9CBEF" />
    </g>
  ),
  crown: (
    <g>
      <path d="M12 86 L8 34 L30 58 L50 22 L70 58 L92 34 L88 86 Z" {...YELLOW} />
      <circle cx="50" cy="68" r="6" fill="#F7A9B8" />
      <circle cx="28" cy="72" r="4" fill="#A9CBEF" />
      <circle cx="72" cy="72" r="4" fill="#CDEAC0" />
    </g>
  ),
  wand: (
    <g>
      <path d="M22 96 L58 40" stroke="#C9C0F0" strokeWidth="6" strokeLinecap="round" />
      <polygon points={star(64, 30, 22)} {...st("#FDE9A9", "#E8C766", 2.5)} />
      <circle cx="88" cy="14" r="3" fill="#F9C6D3" />
      <circle cx="86" cy="50" r="2.5" fill="#A9CBEF" />
    </g>
  ),
  basket: (
    <g>
      <path d="M22 50 C22 14 78 14 78 50" fill="none" stroke="#C9A27E" strokeWidth="5" />
      <path d="M12 50 L88 50 L78 96 L22 96 Z" {...st("#F4E1D2", "#C9A27E")} />
      <path d="M16 64 L84 64 M19 78 L81 78" stroke="#C9A27E" strokeWidth="2" />
      <circle cx="36" cy="46" r="8" {...CORAL} />
      <circle cx="56" cy="44" r="9" {...LEAF} />
    </g>
  ),
  door: (
    <g>
      <path d="M18 98 L18 36 C18 10 82 10 82 36 L82 98 Z" {...BROWN} />
      <path d="M26 98 L26 38 C26 20 74 20 74 38 L74 98" fill="none" stroke="#A9805F" strokeWidth="2" />
      <circle cx="66" cy="64" r="4" fill="#FDE9A9" />
      <circle cx="50" cy="36" r="8" {...AQUA} />
    </g>
  ),
  letter: (
    <g>
      <rect x="8" y="34" width="84" height="56" rx="5" {...st("#FFFFFF", "#C9BFCF")} />
      <path d="M8 38 L50 68 L92 38" fill="none" stroke="#C9BFCF" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 76 C42 70 40 64 44 62 C47 60 50 63 50 64 C50 63 53 60 56 62 C60 64 58 70 50 76 Z" fill="#F48FA5" />
    </g>
  ),
  bubbles: (
    <g fill="#E7F6FB" stroke="#A9CBEF" strokeWidth="2" opacity="0.9">
      <circle cx="40" cy="64" r="20" />
      <circle cx="72" cy="40" r="13" />
      <circle cx="64" cy="82" r="8" />
      <circle cx="26" cy="26" r="9" />
      <path d="M32 54 Q36 48 42 48" fill="none" stroke="#FFFFFF" strokeWidth="3" />
    </g>
  ),
  tent: (
    <g>
      <path d="M50 10 L94 96 L6 96 Z" {...st("#FFD6A5", "#E0A66A")} />
      <path d="M50 10 L50 96 L34 96 Z" fill="#FFF1DE" stroke="#E0A66A" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 10 L48 2" stroke="#A9805F" strokeWidth="3" />
      <path d="M48 2 L60 6 L48 10" fill="#F9C6D3" />
    </g>
  ),
  campfire: (
    <g>
      <circle cx="50" cy="66" r="40" fill="url(#wc-glow)" />
      <path d="M22 96 L78 82 M22 82 L78 96" stroke="#A9805F" strokeWidth="8" strokeLinecap="round" />
      <path d="M50 30 C62 46 70 56 66 72 C62 86 38 86 34 72 C30 58 44 50 50 30 Z" fill="#FFC48A" stroke="#F29E6B" strokeWidth="2.5" />
      <path d="M50 54 C56 62 58 68 56 76 C52 82 46 82 44 76 C42 68 48 64 50 54 Z" fill="#FDE9A9" />
    </g>
  ),
  music: (
    <g fill="#C9C0F0" stroke="#9A8FCC" strokeWidth="2">
      <ellipse cx="26" cy="78" rx="12" ry="9" />
      <ellipse cx="70" cy="70" rx="12" ry="9" />
      <path d="M36 76 L36 26 L80 16 L80 68" fill="none" strokeWidth="5" strokeLinecap="round" stroke="#9A8FCC" />
      <path d="M36 34 L80 24" strokeWidth="6" stroke="#9A8FCC" />
    </g>
  ),
  lantern: (
    <g>
      <circle cx="50" cy="58" r="40" fill="url(#wc-glow)" />
      <path d="M50 4 L50 18" stroke="#A9805F" strokeWidth="3" />
      <rect x="34" y="16" width="32" height="10" rx="3" {...LILAC} />
      <path d="M32 26 C26 50 26 70 34 84 L66 84 C74 70 74 50 68 26 Z" {...st("#FFF4C9", "#E8CF7E")} />
      <rect x="34" y="84" width="32" height="10" rx="3" {...LILAC} />
    </g>
  ),
  bridge: (
    <g>
      <path d="M2 70 C30 40 70 40 98 70 L98 80 C70 52 30 52 2 80 Z" {...BROWN} />
      {[14, 30, 50, 70, 86].map((x) => (
        <path key={x} d={`M${x} ${x === 50 ? 46 : x === 30 || x === 70 ? 50 : 60} L${x} 30`} stroke="#A9805F" strokeWidth="3" />
      ))}
      <path d="M14 30 C30 20 70 20 86 30" fill="none" stroke="#A9805F" strokeWidth="3" />
    </g>
  ),
};
