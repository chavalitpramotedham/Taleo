import type { ReactNode } from "react";

/** Painted body art for preset characters, in a 200x200 box (feet at y≈190). */
export interface PresetArt {
  face: { x: number; y: number; size: number };
  body: ReactNode;
}

const st = (fill: string, line: string, width = 3) => ({
  fill,
  stroke: line,
  strokeWidth: width,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
});

function starPoints(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export const PRESET_ART: Record<string, PresetArt> = {
  bunny: {
    face: { x: 100, y: 112, size: 58 },
    body: (
      <g>
        <ellipse cx="74" cy="48" rx="15" ry="40" transform="rotate(-12 74 48)" {...st("#FFF6EC", "#D9B8A8")} />
        <ellipse cx="74" cy="52" rx="7" ry="28" transform="rotate(-12 74 52)" fill="#F9C6D3" />
        <ellipse cx="128" cy="48" rx="15" ry="40" transform="rotate(14 128 48)" {...st("#FFF6EC", "#D9B8A8")} />
        <ellipse cx="128" cy="52" rx="7" ry="28" transform="rotate(14 128 52)" fill="#F9C6D3" />
        <circle cx="140" cy="168" r="13" {...st("#FFFFFF", "#D9B8A8")} />
        <ellipse cx="100" cy="164" rx="38" ry="28" {...st("#FFF6EC", "#D9B8A8")} />
        <ellipse cx="100" cy="168" rx="20" ry="16" fill="#FDEFF2" />
        <ellipse cx="78" cy="186" rx="15" ry="8" {...st("#FFF6EC", "#D9B8A8")} />
        <ellipse cx="122" cy="186" rx="15" ry="8" {...st("#FFF6EC", "#D9B8A8")} />
        <circle cx="100" cy="108" r="48" {...st("#FFF6EC", "#D9B8A8")} />
        <ellipse cx="68" cy="160" rx="8" ry="12" transform="rotate(20 68 160)" {...st("#FFF6EC", "#D9B8A8")} />
        <ellipse cx="132" cy="160" rx="8" ry="12" transform="rotate(-20 132 160)" {...st("#FFF6EC", "#D9B8A8")} />
        <ellipse cx="100" cy="117" rx="4" ry="3" fill="#F7A9B8" />
      </g>
    ),
  },
  bear: {
    face: { x: 100, y: 102, size: 58 },
    body: (
      <g>
        <circle cx="60" cy="62" r="19" {...st("#D9B99B", "#A9805F")} />
        <circle cx="60" cy="62" r="9" fill="#F4E1D2" />
        <circle cx="140" cy="62" r="19" {...st("#D9B99B", "#A9805F")} />
        <circle cx="140" cy="62" r="9" fill="#F4E1D2" />
        <ellipse cx="100" cy="162" rx="42" ry="30" {...st("#D9B99B", "#A9805F")} />
        <ellipse cx="100" cy="168" rx="24" ry="18" fill="#F4E1D2" />
        <ellipse cx="76" cy="186" rx="16" ry="9" {...st("#D9B99B", "#A9805F")} />
        <ellipse cx="124" cy="186" rx="16" ry="9" {...st("#D9B99B", "#A9805F")} />
        <circle cx="100" cy="102" r="50" {...st("#D9B99B", "#A9805F")} />
        <ellipse cx="100" cy="119" rx="21" ry="14" fill="#F4E1D2" />
        <ellipse cx="100" cy="109" rx="6" ry="4" fill="#6B4E45" />
        <ellipse cx="62" cy="158" rx="10" ry="14" transform="rotate(25 62 158)" {...st("#D9B99B", "#A9805F")} />
        <ellipse cx="138" cy="158" rx="10" ry="14" transform="rotate(-25 138 158)" {...st("#D9B99B", "#A9805F")} />
      </g>
    ),
  },
  kitty: {
    face: { x: 100, y: 112, size: 58 },
    body: (
      <g>
        <path d="M150 170 C185 160 182 120 165 118 C152 116 156 135 165 132" fill="none" stroke="#E0A66A" strokeWidth="12" strokeLinecap="round" />
        <path d="M150 170 C185 160 182 120 165 118 C152 116 156 135 165 132" fill="none" stroke="#FFD6A5" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="100" cy="164" rx="38" ry="28" {...st("#FFD6A5", "#E0A66A")} />
        <ellipse cx="100" cy="170" rx="20" ry="15" fill="#FFF1DE" />
        <ellipse cx="80" cy="186" rx="14" ry="8" {...st("#FFD6A5", "#E0A66A")} />
        <ellipse cx="120" cy="186" rx="14" ry="8" {...st("#FFD6A5", "#E0A66A")} />
        <path d="M54 80 L58 38 L88 64 Z" {...st("#FFD6A5", "#E0A66A")} />
        <path d="M146 80 L142 38 L112 64 Z" {...st("#FFD6A5", "#E0A66A")} />
        <path d="M62 70 L64 50 L78 63 Z" fill="#F9C6D3" />
        <path d="M138 70 L136 50 L122 63 Z" fill="#F9C6D3" />
        <ellipse cx="100" cy="108" rx="54" ry="45" {...st("#FFD6A5", "#E0A66A")} />
        <g stroke="#E8A877" strokeWidth="4" strokeLinecap="round">
          <path d="M100 66 L100 78" />
          <path d="M88 68 L90 78" />
          <path d="M112 68 L110 78" />
          <path d="M48 104 L60 106" />
          <path d="M50 116 L61 115" />
          <path d="M152 104 L140 106" />
          <path d="M150 116 L139 115" />
        </g>
        <path d="M96 116 L104 116 L100 120 Z" fill="#F48FA5" />
      </g>
    ),
  },
  fox: {
    face: { x: 100, y: 108, size: 56 },
    body: (
      <g>
        <path d="M140 178 C190 175 192 120 168 102 C160 130 150 150 132 160 Z" {...st("#FFC2A8", "#E08E6E")} />
        <path d="M168 102 C182 112 186 128 182 140 C170 132 166 118 168 102 Z" fill="#FFFFFF" stroke="#E08E6E" strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="100" cy="164" rx="36" ry="28" {...st("#FFC2A8", "#E08E6E")} />
        <ellipse cx="100" cy="170" rx="18" ry="16" fill="#FFF6EC" />
        <ellipse cx="80" cy="186" rx="13" ry="8" {...st("#B98272", "#8E5E50")} />
        <ellipse cx="120" cy="186" rx="13" ry="8" {...st("#B98272", "#8E5E50")} />
        <path d="M50 86 L56 30 L90 64 Z" {...st("#FFC2A8", "#E08E6E")} />
        <path d="M150 86 L144 30 L110 64 Z" {...st("#FFC2A8", "#E08E6E")} />
        <path d="M60 70 L62 46 L78 62 Z" fill="#FFF6EC" />
        <path d="M140 70 L138 46 L122 62 Z" fill="#FFF6EC" />
        <path d="M100 62 C140 62 160 82 158 104 C156 130 128 146 100 146 C72 146 44 130 42 104 C40 82 60 62 100 62 Z" {...st("#FFC2A8", "#E08E6E")} />
        <path d="M44 110 C60 120 80 116 100 126 C120 116 140 120 156 110 C150 134 126 146 100 146 C74 146 50 134 44 110 Z" fill="#FFF6EC" />
        <ellipse cx="100" cy="118" rx="5" ry="3.5" fill="#6B4E45" />
      </g>
    ),
  },
  owl: {
    face: { x: 100, y: 96, size: 56 },
    body: (
      <g>
        <path d="M58 52 L64 30 L80 50 Z" {...st("#CDEAC0", "#93BE83")} />
        <path d="M142 52 L136 30 L120 50 Z" {...st("#CDEAC0", "#93BE83")} />
        <ellipse cx="44" cy="130" rx="16" ry="34" transform="rotate(14 44 130)" {...st("#A8D8B9", "#74AE88")} />
        <ellipse cx="156" cy="130" rx="16" ry="34" transform="rotate(-14 156 130)" {...st("#A8D8B9", "#74AE88")} />
        <ellipse cx="100" cy="116" rx="60" ry="72" {...st("#CDEAC0", "#93BE83")} />
        <ellipse cx="100" cy="146" rx="36" ry="36" fill="#FFF4C9" />
        <g fill="none" stroke="#E5CF8E" strokeWidth="2.5" strokeLinecap="round">
          <path d="M84 134 q6 6 12 0" />
          <path d="M104 134 q6 6 12 0" />
          <path d="M92 150 q6 6 12 0" />
          <path d="M80 162 q6 6 12 0" />
          <path d="M108 162 q6 6 12 0" />
        </g>
        <circle cx="86" cy="96" r="17" fill="#FFFFFF" stroke="#93BE83" strokeWidth="2.5" />
        <circle cx="114" cy="96" r="17" fill="#FFFFFF" stroke="#93BE83" strokeWidth="2.5" />
        <ellipse cx="84" cy="188" rx="9" ry="5" {...st("#FFD6A5", "#E0A66A")} />
        <ellipse cx="116" cy="188" rx="9" ry="5" {...st("#FFD6A5", "#E0A66A")} />
      </g>
    ),
  },
  elephant: {
    face: { x: 94, y: 98, size: 54 },
    body: (
      <g>
        <ellipse cx="100" cy="164" rx="42" ry="28" {...st("#A9CBEF", "#7FA6CF")} />
        <rect x="68" y="166" width="22" height="24" rx="10" {...st("#A9CBEF", "#7FA6CF")} />
        <rect x="110" y="166" width="22" height="24" rx="10" {...st("#A9CBEF", "#7FA6CF")} />
        <ellipse cx="46" cy="98" rx="32" ry="38" {...st("#A9CBEF", "#7FA6CF")} />
        <ellipse cx="48" cy="98" rx="20" ry="26" fill="#F9C6D3" />
        <ellipse cx="154" cy="98" rx="32" ry="38" {...st("#A9CBEF", "#7FA6CF")} />
        <ellipse cx="152" cy="98" rx="20" ry="26" fill="#F9C6D3" />
        <circle cx="100" cy="100" r="46" {...st("#A9CBEF", "#7FA6CF")} />
        <path d="M110 112 C116 132 128 146 146 140 C156 136 154 124 146 124" fill="none" stroke="#7FA6CF" strokeWidth="19" strokeLinecap="round" />
        <path d="M110 112 C116 132 128 146 146 140 C156 136 154 124 146 124" fill="none" stroke="#A9CBEF" strokeWidth="13" strokeLinecap="round" />
        <path d="M74 64 Q80 56 88 62" fill="none" stroke="#7FA6CF" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    ),
  },
  penguin: {
    face: { x: 100, y: 96, size: 54 },
    body: (
      <g>
        <ellipse cx="80" cy="186" rx="16" ry="7" {...st("#FFC48A", "#E09A5A")} />
        <ellipse cx="120" cy="186" rx="16" ry="7" {...st("#FFC48A", "#E09A5A")} />
        <ellipse cx="46" cy="132" rx="12" ry="30" transform="rotate(22 46 132)" {...st("#8A9CC9", "#6878A6")} />
        <ellipse cx="154" cy="132" rx="12" ry="30" transform="rotate(-22 154 132)" {...st("#8A9CC9", "#6878A6")} />
        <ellipse cx="100" cy="118" rx="54" ry="68" {...st("#8A9CC9", "#6878A6")} />
        <path d="M100 74 C82 60 58 72 60 96 C60 112 66 120 66 136 C66 162 80 180 100 180 C120 180 134 162 134 136 C134 120 140 112 140 96 C142 72 118 60 100 74 Z" fill="#FFFFFF" />
        <path d="M94 104 L106 104 L100 111 Z" {...st("#FFC48A", "#E09A5A", 2)} />
      </g>
    ),
  },
  dino: {
    face: { x: 116, y: 90, size: 54 },
    body: (
      <g>
        <path d="M70 150 C40 160 20 170 12 182 C40 186 64 182 82 174 Z" {...st("#A8D8B9", "#74AE88")} />
        <g {...st("#F9C6D3", "#D98BA0")}>
          <path d="M84 52 L90 34 L100 48 Z" />
          <path d="M70 72 L66 54 L82 62 Z" />
          <path d="M60 100 L48 88 L64 86 Z" />
          <path d="M54 130 L40 124 L54 116 Z" />
          <path d="M42 160 L28 160 L38 150 Z" />
        </g>
        <ellipse cx="96" cy="150" rx="46" ry="36" {...st("#A8D8B9", "#74AE88")} />
        <ellipse cx="104" cy="158" rx="26" ry="22" fill="#E4F2C4" />
        <rect x="70" y="170" width="22" height="20" rx="9" {...st("#A8D8B9", "#74AE88")} />
        <rect x="108" y="170" width="22" height="20" rx="9" {...st("#A8D8B9", "#74AE88")} />
        <ellipse cx="112" cy="90" rx="48" ry="42" {...st("#A8D8B9", "#74AE88")} />
        <ellipse cx="140" cy="146" rx="9" ry="12" transform="rotate(-30 140 146)" {...st("#A8D8B9", "#74AE88")} />
        <g fill="#74AE88" opacity="0.7">
          <circle cx="84" cy="80" r="2.5" />
          <circle cx="78" cy="88" r="2" />
          <circle cx="88" cy="90" r="2" />
        </g>
      </g>
    ),
  },
  strawberry: {
    face: { x: 100, y: 112, size: 54 },
    body: (
      <g>
        <ellipse cx="84" cy="188" rx="11" ry="6" {...st("#F7A9B8", "#D9788F")} />
        <ellipse cx="116" cy="188" rx="11" ry="6" {...st("#F7A9B8", "#D9788F")} />
        <path d="M100 186 C52 172 30 122 38 88 C46 58 154 58 162 88 C170 122 148 172 100 186 Z" {...st("#F7A9B8", "#D9788F")} />
        <g fill="#FFF4C9">
          <ellipse cx="62" cy="96" rx="2.5" ry="4" />
          <ellipse cx="140" cy="96" rx="2.5" ry="4" />
          <ellipse cx="56" cy="124" rx="2.5" ry="4" />
          <ellipse cx="146" cy="126" rx="2.5" ry="4" />
          <ellipse cx="72" cy="150" rx="2.5" ry="4" />
          <ellipse cx="128" cy="152" rx="2.5" ry="4" />
          <ellipse cx="100" cy="164" rx="2.5" ry="4" />
          <ellipse cx="86" cy="84" rx="2.5" ry="4" />
          <ellipse cx="116" cy="84" rx="2.5" ry="4" />
        </g>
        <g {...st("#A8D8B9", "#74AE88")}>
          <path d="M100 70 C84 76 64 74 56 66 C70 58 86 60 100 66 Z" />
          <path d="M100 70 C116 76 136 74 144 66 C130 58 114 60 100 66 Z" />
          <path d="M100 68 C92 58 88 48 92 42 C100 48 104 56 100 68 Z" />
          <path d="M100 68 C110 60 120 56 126 58 C120 66 110 70 100 68 Z" />
        </g>
        <path d="M100 50 C100 40 104 32 110 28" fill="none" stroke="#74AE88" strokeWidth="5" strokeLinecap="round" />
      </g>
    ),
  },
  cupcake: {
    face: { x: 100, y: 150, size: 50 },
    body: (
      <g>
        <path d="M44 120 L156 120 L140 186 L60 186 Z" {...st("#B5E3E8", "#7FB9C2")} />
        <g stroke="#7FB9C2" strokeWidth="2.5" strokeLinecap="round" opacity="0.8">
          <path d="M62 124 L72 182" />
          <path d="M138 124 L128 182" />
        </g>
        <path d="M40 122 C26 120 30 98 48 98 C44 80 66 70 78 80 C80 62 120 62 122 80 C134 70 156 80 152 98 C170 98 174 120 160 122 C150 130 50 130 40 122 Z" {...st("#F9C6D3", "#D98BA0")} />
        <path d="M70 82 C80 70 120 70 130 84 C120 92 80 92 70 82 Z" fill="#FDE2EA" />
        <g strokeWidth="4" strokeLinecap="round">
          <path d="M60 104 l6 -4" stroke="#A9CBEF" />
          <path d="M86 92 l7 2" stroke="#FDE9A9" />
          <path d="M112 102 l5 5" stroke="#A8D8B9" />
          <path d="M136 106 l6 -3" stroke="#C9C0F0" />
          <path d="M100 82 l-4 -5" stroke="#FFD6A5" />
          <path d="M74 112 l7 1" stroke="#C9C0F0" />
          <path d="M126 88 l4 5" stroke="#A9CBEF" />
        </g>
        <path d="M104 52 C106 40 112 34 120 30" fill="none" stroke="#93BE83" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="102" cy="60" r="13" {...st("#F48FA5", "#C9637A")} />
        <circle cx="97" cy="56" r="3.5" fill="#FFFFFF" opacity="0.7" />
      </g>
    ),
  },
  avocado: {
    face: { x: 100, y: 102, size: 50 },
    body: (
      <g>
        <ellipse cx="82" cy="188" rx="11" ry="6" {...st("#93BE83", "#6E9C60")} />
        <ellipse cx="118" cy="188" rx="11" ry="6" {...st("#93BE83", "#6E9C60")} />
        <path d="M100 22 C130 22 140 56 148 84 C158 110 170 130 164 156 C156 182 130 190 100 190 C70 190 44 182 36 156 C30 130 42 110 52 84 C60 56 70 22 100 22 Z" {...st("#93BE83", "#6E9C60")} />
        <path d="M100 36 C122 36 130 62 136 86 C144 110 156 128 150 152 C144 172 124 178 100 178 C76 178 56 172 50 152 C44 128 56 110 64 86 C70 62 78 36 100 36 Z" fill="#E4F2C4" stroke="#C5DDA0" strokeWidth="2" />
        <circle cx="100" cy="146" r="26" {...st("#D9B99B", "#A9805F")} />
        <ellipse cx="92" cy="138" rx="7" ry="5" fill="#F4E1D2" opacity="0.7" />
      </g>
    ),
  },
  dumpling: {
    face: { x: 100, y: 136, size: 56 },
    body: (
      <g>
        <path d="M28 176 C22 118 62 74 100 72 C138 74 178 118 172 176 C150 192 50 192 28 176 Z" {...st("#FFFDF7", "#D9C8B8")} />
        <g fill="none" stroke="#E2D3C3" strokeWidth="2.5" strokeLinecap="round">
          <path d="M100 76 C86 84 70 96 62 108" />
          <path d="M100 76 C92 88 86 100 84 110" />
          <path d="M100 76 C108 88 114 100 116 110" />
          <path d="M100 76 C114 84 130 96 138 108" />
        </g>
        <path d="M92 74 C94 64 106 64 108 74 C104 78 96 78 92 74 Z" {...st("#FFFDF7", "#D9C8B8")} />
        <ellipse cx="62" cy="174" rx="6" ry="3" fill="#F4E1D2" />
      </g>
    ),
  },
  cloud: {
    face: { x: 100, y: 124, size: 54 },
    body: (
      <g>
        <path d="M46 168 C22 168 18 132 42 126 C36 98 70 84 86 100 C92 70 136 66 146 98 C172 92 188 122 168 138 C186 150 176 172 154 168 Z" {...st("#FFFFFF", "#A9CBEF")} />
        <path d="M54 160 C80 166 130 166 152 158" fill="none" stroke="#DCEBFA" strokeWidth="8" strokeLinecap="round" />
        <g fill="#A9CBEF">
          <path d="M72 180 q-4 7 0 9 q4 -2 0 -9 Z" />
          <path d="M100 184 q-4 7 0 9 q4 -2 0 -9 Z" />
          <path d="M128 180 q-4 7 0 9 q4 -2 0 -9 Z" />
        </g>
      </g>
    ),
  },
  star: {
    face: { x: 100, y: 118, size: 52 },
    body: (
      <g>
        <polygon points={starPoints(100, 112, 80, 40)} fill="#E8C766" stroke="#E8C766" strokeWidth="24" strokeLinejoin="round" />
        <polygon points={starPoints(100, 112, 80, 40)} fill="#FDE9A9" stroke="#FDE9A9" strokeWidth="18" strokeLinejoin="round" />
        <ellipse cx="78" cy="84" rx="8" ry="5" fill="#FFF8DC" transform="rotate(-30 78 84)" />
      </g>
    ),
  },
  teapot: {
    face: { x: 96, y: 136, size: 52 },
    body: (
      <g>
        <path d="M44 128 C20 120 18 158 42 160" fill="none" stroke="#93BE83" strokeWidth="13" strokeLinecap="round" />
        <path d="M44 128 C20 120 18 158 42 160" fill="none" stroke="#CDEAC0" strokeWidth="7" strokeLinecap="round" />
        <path d="M148 146 C164 140 168 118 182 108 C186 112 182 120 178 124 C172 140 166 160 146 166 Z" {...st("#CDEAC0", "#93BE83")} />
        <ellipse cx="74" cy="186" rx="12" ry="6" {...st("#CDEAC0", "#93BE83")} />
        <ellipse cx="122" cy="186" rx="12" ry="6" {...st("#CDEAC0", "#93BE83")} />
        <ellipse cx="98" cy="138" rx="58" ry="48" {...st("#CDEAC0", "#93BE83")} />
        <path d="M50 120 C70 128 126 128 146 120" fill="none" stroke="#F9C6D3" strokeWidth="6" strokeLinecap="round" />
        <path d="M58 98 C62 74 134 74 138 98 C120 104 76 104 58 98 Z" {...st("#F9C6D3", "#D98BA0")} />
        <circle cx="98" cy="72" r="9" {...st("#F9C6D3", "#D98BA0")} />
      </g>
    ),
  },
  robot: {
    face: { x: 100, y: 92, size: 48 },
    body: (
      <g>
        <path d="M100 52 L100 32" stroke="#9A8FCC" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="28" r="8" {...st("#F9C6D3", "#D98BA0")} />
        <rect x="76" y="168" width="18" height="22" rx="6" {...st("#C9C0F0", "#9A8FCC")} />
        <rect x="106" y="168" width="18" height="22" rx="6" {...st("#C9C0F0", "#9A8FCC")} />
        <rect x="44" y="132" width="16" height="34" rx="8" {...st("#C9C0F0", "#9A8FCC")} />
        <rect x="140" y="132" width="16" height="34" rx="8" {...st("#C9C0F0", "#9A8FCC")} />
        <rect x="58" y="124" width="84" height="52" rx="16" {...st("#C9C0F0", "#9A8FCC")} />
        <path d="M100 160 C88 150 88 140 95 140 C98 140 100 143 100 145 C100 143 102 140 105 140 C112 140 112 150 100 160 Z" fill="#F48FA5" />
        <circle cx="46" cy="92" r="10" {...st("#B5E3E8", "#7FB9C2")} />
        <circle cx="154" cy="92" r="10" {...st("#B5E3E8", "#7FB9C2")} />
        <rect x="52" y="52" width="96" height="76" rx="22" {...st("#C9C0F0", "#9A8FCC")} />
        <rect x="64" y="64" width="72" height="54" rx="14" fill="#F4F1FF" stroke="#B3A9E0" strokeWidth="2" />
      </g>
    ),
  },
};
