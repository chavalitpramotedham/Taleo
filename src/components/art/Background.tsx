import type { ReactNode } from "react";
import type { Setting, TimeOfDay, Weather } from "@/lib/vocab";

// Scene canvas is 400x300. Ground-standing characters have their feet near y=268.

const SKY: Record<TimeOfDay, [string, string]> = {
  day: ["#CFE8F7", "#FDF3E7"],
  sunset: ["#F6C1D0", "#FFE6C7"],
  night: ["#7473AE", "#BCAEDB"],
};

const INDOOR: Setting[] = ["kitchen", "bedroom", "cave"];
const NO_SKY: Setting[] = ["underwater", "kitchen", "bedroom", "cave", "space"];

const hills = (back: string, mid: string, front: string) => (
  <g>
    <path d="M-20 190 C40 150 120 150 180 176 C240 150 330 140 420 178 L420 320 L-20 320 Z" fill={back} />
    <path d="M-20 214 C60 186 150 192 220 210 C290 192 360 190 420 206 L420 320 L-20 320 Z" fill={mid} />
    <path d="M-20 246 C80 228 200 232 260 240 C330 230 380 234 420 240 L420 320 L-20 320 Z" fill={front} />
  </g>
);

const blobTree = (x: number, y: number, s: number, fill: string) => (
  <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-4" y="0" width="8" height="26" fill="#C9A27E" opacity="0.8" />
    <ellipse cx="0" cy="-8" rx="22" ry="26" fill={fill} />
  </g>
);

const window_ = (x: number, y: number, time: TimeOfDay) => (
  <g>
    <rect x={x} y={y} width="96" height="82" rx="8" fill={SKY[time][0]} stroke="#E2CFC0" strokeWidth="6" />
    <path d={`M${x + 48} ${y} L${x + 48} ${y + 82} M${x} ${y + 41} L${x + 96} ${y + 41}`} stroke="#E2CFC0" strokeWidth="5" />
    {time === "night" ? (
      <g fill="#FFF4C9">
        <circle cx={x + 24} cy={y + 18} r="2" />
        <circle cx={x + 70} cy={y + 26} r="2.5" />
        <path d={`M${x + 78} ${y + 52} a10 10 0 1 1 -8 -12 a8 8 0 0 0 8 12`} />
      </g>
    ) : (
      <g fill="#FFFFFF" opacity="0.9">
        <ellipse cx={x + 28} cy={y + 24} rx="14" ry="6" />
        <ellipse cx={x + 70} cy={y + 60} rx="12" ry="5" />
      </g>
    )}
  </g>
);

function settingLayer(setting: Setting, time: TimeOfDay): ReactNode {
  switch (setting) {
    case "meadow":
      return hills("#DCEFCF", "#C6E5B4", "#B2D9A0");
    case "garden":
      return (
        <g>
          {hills("#DCEFCF", "#C6E5B4", "#B2D9A0")}
          <g fill="#FFFFFF" stroke="#E6DCE8" strokeWidth="2">
            {Array.from({ length: 14 }, (_, i) => (
              <path key={i} d={`M${i * 30 - 4} 236 L${i * 30 - 4} 204 L${i * 30 + 4} 196 L${i * 30 + 12} 204 L${i * 30 + 12} 236 Z`} />
            ))}
            <rect x="-20" y="212" width="440" height="7" />
          </g>
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={i} cx={i * 27 + 8} cy={252 + (i % 3) * 8} r="4" fill={["#F9C6D3", "#FDE9A9", "#C9C0F0"][i % 3]} />
          ))}
        </g>
      );
    case "forest":
      return (
        <g>
          {hills("#CFE6C9", "#B9DDB0", "#A6D19B")}
          {[20, 70, 120, 290, 340, 390].map((x, i) => blobTree(x, 168 + (i % 2) * 10, 1.4, i % 2 ? "#9FCDA0" : "#B3D9AE"))}
          {[0, 50, 330, 380].map((x, i) => blobTree(x, 210, 2, i % 2 ? "#8EC291" : "#A0CCA0"))}
        </g>
      );
    case "jungle":
      return (
        <g>
          {hills("#C3E3BF", "#AED8A8", "#9BCF97")}
          <g fill="#8EC291" opacity="0.9">
            <path d="M-20 0 C40 30 60 80 30 140 C10 100 -10 60 -20 40 Z" />
            <path d="M420 0 C360 40 350 90 380 140 C400 100 420 70 420 40 Z" />
            <path d="M-10 300 C10 220 60 200 90 210 C70 240 40 270 -10 300 Z" />
            <path d="M410 300 C390 230 340 210 310 220 C330 250 360 280 410 300 Z" />
          </g>
          <path d="M120 -5 C126 40 118 70 128 100" fill="none" stroke="#93BE83" strokeWidth="4" />
          <path d="M280 -5 C276 30 286 60 278 90" fill="none" stroke="#93BE83" strokeWidth="4" />
          <g fill="#F9C6D3">
            <circle cx="128" cy="100" r="7" />
            <circle cx="278" cy="90" r="7" />
          </g>
        </g>
      );
    case "beach":
      return (
        <g>
          <rect x="-20" y="168" width="440" height="60" fill="#B5E3E8" />
          <path d="M-20 180 Q20 174 60 180 T140 180 T220 180 T300 180 T380 180 T460 180" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity="0.8" />
          <path d="M-20 222 C60 210 140 222 200 216 C270 210 340 222 420 214 L420 320 L-20 320 Z" fill="#FBE3B6" />
          <path d="M-20 222 C60 210 140 222 200 216 C270 210 340 222 420 214" fill="none" stroke="#FFFFFF" strokeWidth="5" opacity="0.8" />
        </g>
      );
    case "pond":
      return (
        <g>
          {hills("#DCEFCF", "#C6E5B4", "#B2D9A0")}
          <ellipse cx="250" cy="262" rx="150" ry="30" fill="#B5E3E8" />
          <ellipse cx="250" cy="262" rx="150" ry="30" fill="none" stroke="#9AD0D8" strokeWidth="3" />
          <g fill="#A8D8B9">
            <path d="M190 262 a14 7 0 1 0 1 -1 l-10 -2 Z" />
            <path d="M310 268 a12 6 0 1 0 1 -1 l-9 -2 Z" />
          </g>
          <circle cx="196" cy="258" r="4" fill="#F9C6D3" />
          <g stroke="#93BE83" strokeWidth="3" strokeLinecap="round">
            <path d="M100 250 L96 210" />
            <path d="M108 252 L110 214" />
            <path d="M380 250 L384 214" />
          </g>
          <g fill="#C9A27E">
            <ellipse cx="96" cy="210" rx="4" ry="10" />
            <ellipse cx="110" cy="214" rx="4" ry="10" />
            <ellipse cx="384" cy="214" rx="4" ry="10" />
          </g>
        </g>
      );
    case "snow":
      return (
        <g>
          {hills("#EEF3FA", "#E3ECF7", "#F7FAFE")}
          <path d="M-20 246 C80 228 200 232 260 240 C330 230 380 234 420 240" fill="none" stroke="#D3E0F0" strokeWidth="4" />
          {[40, 340].map((x) => (
            <g key={x} transform={`translate(${x} 190)`}>
              <path d="M0 -50 L22 0 L-22 0 Z" fill="#B9DDC4" />
              <path d="M0 -50 L10 -28 L-10 -28 Z" fill="#FFFFFF" />
              <rect x="-3" y="0" width="6" height="10" fill="#C9A27E" />
            </g>
          ))}
        </g>
      );
    case "mountain":
      return (
        <g>
          <path d="M-20 200 L70 90 L140 170 L220 70 L320 180 L360 130 L420 190 L420 320 L-20 320 Z" fill="#C9C0E8" />
          <path d="M70 90 L52 112 L64 108 L74 116 L86 108 Z M220 70 L198 98 L212 92 L224 100 L240 92 Z" fill="#FFFFFF" />
          {hills("#CFE6C9", "#BCDDB1", "#ABD3A0")}
        </g>
      );
    case "farm":
      return (
        <g>
          {hills("#E4F0CF", "#D2E8B8", "#C0DDA3")}
          <g transform="translate(280 128)">
            <rect x="0" y="34" width="96" height="66" fill="#F7A9B8" />
            <path d="M-8 38 L48 0 L104 38 Z" fill="#E98E9F" />
            <rect x="34" y="60" width="28" height="40" fill="#FFFFFF" />
            <path d="M34 60 L62 100 M62 60 L34 100" stroke="#F7A9B8" strokeWidth="4" />
          </g>
          <g stroke="#E2CFC0" strokeWidth="5" strokeLinecap="round">
            <path d="M-10 226 L250 220" />
            <path d="M-10 242 L250 236" />
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M${i * 30 + 6} 214 L${i * 30 + 6} 250`} />
            ))}
          </g>
        </g>
      );
    case "playground":
      return (
        <g>
          {hills("#DCEFCF", "#C6E5B4", "#B2D9A0")}
          <g transform="translate(290 120)">
            <path d="M0 110 L20 0 M60 110 L40 0 M10 0 L90 0" stroke="#A9CBEF" strokeWidth="6" strokeLinecap="round" />
            <path d="M80 0 L80 110" stroke="#A9CBEF" strokeWidth="6" />
            <path d="M30 0 L30 60 M50 0 L50 60" stroke="#C9BFCF" strokeWidth="2" />
            <rect x="24" y="58" width="32" height="7" rx="3" fill="#F9C6D3" />
          </g>
          <g transform="translate(30 140)">
            <path d="M0 90 L0 0 L20 0 L20 90" fill="none" stroke="#FFD6A5" strokeWidth="6" />
            <path d="M20 4 C60 10 70 60 110 88" fill="none" stroke="#F7A9B8" strokeWidth="12" strokeLinecap="round" />
          </g>
        </g>
      );
    case "town":
      return (
        <g>
          {[
            [10, 130, "#F9C6D3"],
            [80, 110, "#FDE9A9"],
            [150, 140, "#B5E3E8"],
            [220, 120, "#C9C0F0"],
            [290, 135, "#FFD6A5"],
            [350, 115, "#CDEAC0"],
          ].map(([x, y, c]) => (
            <g key={String(x)}>
              <rect x={Number(x)} y={Number(y)} width="62" height={230 - Number(y)} fill={String(c)} />
              <path d={`M${Number(x) - 6} ${Number(y)} L${Number(x) + 31} ${Number(y) - 30} L${Number(x) + 68} ${Number(y)} Z`} fill={String(c)} opacity="0.85" />
              <rect x={Number(x) + 12} y={Number(y) + 20} width="14" height="16" rx="3" fill="#FFFFFF" opacity="0.8" />
              <rect x={Number(x) + 36} y={Number(y) + 20} width="14" height="16" rx="3" fill="#FFFFFF" opacity="0.8" />
            </g>
          ))}
          <rect x="-20" y="226" width="440" height="20" fill="#E8E1EC" />
          <rect x="-20" y="244" width="440" height="80" fill="#D8D2DF" />
          <path d="M-20 280 L420 280" stroke="#FFFFFF" strokeWidth="4" strokeDasharray="22 18" />
        </g>
      );
    case "castle":
      return (
        <g>
          <g transform="translate(240 70)" fill="#E9DDF5">
            <rect x="20" y="50" width="100" height="100" />
            <rect x="0" y="20" width="30" height="130" />
            <rect x="110" y="20" width="30" height="130" />
            <path d="M-4 22 L15 -16 L34 22 Z M106 22 L125 -16 L144 22 Z" fill="#F7A9B8" />
            <path d="M54 150 L54 112 C54 96 86 96 86 112 L86 150 Z" fill="#C9C0F0" />
            <path d="M15 -16 L15 -30 L28 -24 L15 -20" fill="#FDE9A9" />
          </g>
          {hills("#DCEFCF", "#C6E5B4", "#B2D9A0")}
        </g>
      );
    case "candyland":
      return (
        <g>
          {hills("#FBD9E4", "#F9C6D3", "#FDE2EA")}
          {[
            [50, 150, "#C9C0F0"],
            [350, 140, "#FDE9A9"],
            [300, 170, "#B5E3E8"],
          ].map(([x, y, c]) => (
            <g key={String(x)}>
              <path d={`M${x} ${y} L${x} ${Number(y) + 70}`} stroke="#FFFFFF" strokeWidth="5" />
              <circle cx={Number(x)} cy={Number(y)} r="22" fill={String(c)} />
              <path d={`M${Number(x) - 12} ${Number(y)} a12 12 0 0 1 24 0 a8 8 0 0 1 -16 0`} fill="none" stroke="#FFFFFF" strokeWidth="3" />
            </g>
          ))}
          <path d="M140 230 L140 170 C140 150 170 150 170 170" fill="none" stroke="#F48FA5" strokeWidth="9" strokeLinecap="round" />
          <path d="M140 230 L140 170 C140 150 170 150 170 170" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeDasharray="8 8" strokeLinecap="round" />
        </g>
      );
    case "underwater":
      return (
        <g>
          <rect x="-20" y="-20" width="440" height="340" fill="#B5E3E8" />
          <rect x="-20" y="-20" width="440" height="140" fill="#CDEFF2" opacity="0.7" />
          <g fill="#FFFFFF" opacity="0.25">
            <path d="M60 -20 L110 -20 L60 220 L30 220 Z" />
            <path d="M220 -20 L260 -20 L230 220 L200 220 Z" />
          </g>
          <path d="M-20 252 C60 236 160 248 220 242 C300 236 360 248 420 240 L420 320 L-20 320 Z" fill="#FBE3B6" />
          {[30, 120, 330, 380].map((x, i) => (
            <path key={x} d={`M${x} 252 C${x - 14} 220 ${x + 14} 200 ${x} ${170 - i * 6} C${x + 18} 196 ${x - 6} 220 ${x + 8} 250`} fill="#A8D8B9" />
          ))}
          <g fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.8">
            <circle cx="160" cy="80" r="6" />
            <circle cx="170" cy="56" r="4" />
            <circle cx="300" cy="120" r="5" />
            <circle cx="310" cy="96" r="3" />
          </g>
        </g>
      );
    case "sky":
      return (
        <g>
          {[
            [40, 230, 1.6],
            [160, 250, 2],
            [300, 236, 1.8],
            [400, 256, 1.6],
            [90, 70, 0.8],
            [330, 60, 0.9],
          ].map(([x, y, s]) => (
            <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFFFF" opacity="0.95">
              <ellipse cx="0" cy="0" rx="40" ry="18" />
              <ellipse cx="-18" cy="-10" rx="18" ry="14" />
              <ellipse cx="14" cy="-14" rx="22" ry="16" />
            </g>
          ))}
        </g>
      );
    case "space":
      return (
        <g>
          <rect x="-20" y="-20" width="440" height="340" fill="#5E5A93" />
          <rect x="-20" y="-20" width="440" height="200" fill="#4D4A82" opacity="0.7" />
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} cx={(i * 97) % 410} cy={(i * 53) % 220} r={i % 4 === 0 ? 2.2 : 1.2} fill="#FFF4C9" opacity="0.9" />
          ))}
          <circle cx="330" cy="60" r="26" fill="#F9C6D3" opacity="0.9" />
          <ellipse cx="330" cy="62" rx="42" ry="8" fill="none" stroke="#FDE9A9" strokeWidth="4" transform="rotate(-14 330 62)" />
          <path d="M-20 244 C80 226 200 238 260 232 C330 226 380 236 420 230 L420 320 L-20 320 Z" fill="#DCD6E4" />
          <g fill="#C9C0D6">
            <ellipse cx="80" cy="262" rx="18" ry="5" />
            <ellipse cx="300" cy="272" rx="24" ry="6" />
          </g>
        </g>
      );
    case "kitchen":
      return (
        <g>
          <rect x="-20" y="-20" width="440" height="340" fill="#FFF4E8" />
          {window_(152, 40, time)}
          <rect x="-20" y="168" width="440" height="60" fill="#B5E3E8" />
          <rect x="-20" y="160" width="440" height="12" fill="#FFFFFF" stroke="#E2CFC0" strokeWidth="2" />
          {[30, 100, 290, 360].map((x) => (
            <rect key={x} x={x - 26} y="180" width="52" height="40" rx="5" fill="#CDEFF2" stroke="#9AD0D8" strokeWidth="2" />
          ))}
          <g fill="#F9C6D3">
            <rect x="40" y="60" width="70" height="8" rx="3" fill="#E2CFC0" />
            <rect x="48" y="38" width="16" height="22" rx="4" />
            <rect x="70" y="42" width="14" height="18" rx="4" fill="#FDE9A9" />
            <rect x="88" y="36" width="16" height="24" rx="4" fill="#C9C0F0" />
          </g>
          <rect x="-20" y="228" width="440" height="100" fill="#F4E1D2" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={i * 40 - 20 + ((i % 2) * 0)} y={i % 2 ? 228 : 266} width="40" height="38" fill="#FBEDE2" />
          ))}
        </g>
      );
    case "bedroom":
      return (
        <g>
          <rect x="-20" y="-20" width="440" height="340" fill="#EFE6F7" />
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={i * 46 + 10} cy={(i % 2) * 30 + 30} r="3" fill="#FFFFFF" opacity="0.8" />
          ))}
          {window_(250, 46, time)}
          <path d="M238 38 C250 80 244 120 240 140 L254 140 C256 110 258 70 252 38 Z M358 38 C346 80 352 120 356 140 L342 140 C340 110 338 70 344 38 Z" fill="#F9C6D3" />
          <rect x="-20" y="214" width="440" height="110" fill="#E8D3C0" />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M-20 ${222 + i * 18} L420 ${222 + i * 18}`} stroke="#DCC3AD" strokeWidth="2" />
          ))}
          <ellipse cx="200" cy="270" rx="150" ry="22" fill="#C9C0F0" opacity="0.7" />
          <ellipse cx="200" cy="270" rx="120" ry="15" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeDasharray="6 8" />
        </g>
      );
    case "cave":
      return (
        <g>
          <rect x="-20" y="-20" width="440" height="340" fill="#8E86B5" />
          <path d="M-20 -20 L420 -20 L420 320 L360 320 C380 200 340 80 200 70 C60 80 20 200 40 320 L-20 320 Z" fill="#6F6899" />
          <path d="M-20 246 C80 236 200 244 260 240 C330 236 380 244 420 238 L420 320 L-20 320 Z" fill="#A79FC9" />
          {[
            [90, 240, "#B5E3E8"],
            [320, 236, "#F9C6D3"],
            [340, 244, "#C9C0F0"],
          ].map(([x, y, c]) => (
            <path key={`${x}`} d={`M${x} ${y} L${Number(x) - 10} ${Number(y) - 8} L${x} ${Number(y) - 34} L${Number(x) + 10} ${Number(y) - 8} Z`} fill={String(c)} />
          ))}
          <circle cx="200" cy="160" r="90" fill="url(#wc-glow)" opacity="0.35" />
        </g>
      );
  }
}

function weatherLayer(weather: Weather, setting: Setting) {
  if (INDOOR.includes(setting) || setting === "underwater" || setting === "space") return null;
  switch (weather) {
    case "rain":
      return (
        <g stroke="#8FB6D9" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" className="anim-rain">
          {Array.from({ length: 34 }, (_, i) => {
            const x = (i * 53) % 420;
            const y = (i * 37) % 260;
            return <path key={i} d={`M${x} ${y} l-4 12`} />;
          })}
        </g>
      );
    case "snow":
      return (
        <g fill="#FFFFFF" className="anim-snow">
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} cx={(i * 61) % 410} cy={(i * 43) % 280} r={i % 3 === 0 ? 3.5 : 2.2} opacity="0.95" />
          ))}
        </g>
      );
    case "windy":
      return (
        <g fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.85">
          <path d="M30 70 C90 60 130 80 180 66 C200 60 200 44 186 46" />
          <path d="M220 120 C270 110 320 128 370 112 C390 106 388 90 374 94" />
          <path d="M60 150 C100 144 130 154 160 146" />
        </g>
      );
    case "rainbow":
      return (
        <g fill="none" strokeLinecap="round" opacity="0.55">
          {["#F9C6D3", "#FFD6A5", "#FDE9A9", "#CDEAC0", "#A9CBEF", "#C9C0F0"].map((c, i) => (
            <path key={c} d={`M${10 + i * 10} 230 A${190 - i * 10} ${170 - i * 10} 0 0 1 ${390 - i * 10} 230`} stroke={c} strokeWidth="10" />
          ))}
        </g>
      );
    default:
      return null;
  }
}

export function Background({ setting, time, weather }: { setting: Setting; time: TimeOfDay; weather: Weather }) {
  const [top, bottom] = SKY[time];
  const gid = `sky-${time}`;
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      {!NO_SKY.includes(setting) && <rect x="-20" y="-20" width="440" height="340" fill={`url(#${gid})`} />}
      {time === "night" && !NO_SKY.includes(setting) && (
        <g fill="#FFF4C9">
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={(i * 89) % 400} cy={(i * 29) % 120 + 8} r={i % 3 === 0 ? 2.2 : 1.3} />
          ))}
        </g>
      )}
      <g filter="url(#wc-wash)">
        {weather === "rainbow" && weatherLayer(weather, setting)}
        {settingLayer(setting, time)}
      </g>
      {weather !== "rainbow" && weatherLayer(weather, setting)}
      {time === "night" && <rect x="-20" y="-20" width="440" height="340" fill="#4B4380" opacity={INDOOR.includes(setting) ? 0.18 : 0.12} />}
      {time === "sunset" && <rect x="-20" y="-20" width="440" height="340" fill="#F7A9B8" opacity="0.08" />}
    </g>
  );
}
