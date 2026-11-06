// A simple painter used in demo mode (no API key) and as a fallback when an
// illustration can't be painted. It builds a landscape from keywords in the
// picture brief and places the characters' reference art with a little action.
// Real books are painted page-by-page by Claude (see server/illustrator.ts).
import type { CharacterDef, Page } from "../types";
import { characterArt } from "../presets";

const has = (text: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(text));

function landscape(brief: string): { svg: string; ground: number; indoor: boolean } {
  const night = has(brief, "night", "moon", "star", "dark", "bedtime", "sleep");
  const sky = night ? "#5B6283" : has(brief, "sunset", "evening", "dusk") ? "#E9C9A8" : "#E6E2CF";
  if (has(brief, "bedroom", "kitchen", "inside", "indoors", "house", "home", "bed\\b", "burrow")) {
    const win = night ? "#4E5574" : "#DCE3E1";
    return {
      indoor: true,
      ground: 262,
      svg: `<g class="wash"><rect x="-10" y="-10" width="420" height="320" fill="#EADFC8"/><rect x="-10" y="200" width="420" height="120" fill="#C8A57A"/><path d="M-10 214 L410 214" stroke="#B08A60" stroke-width="3"/></g>
<g class="paint"><rect x="240" y="44" width="100" height="90" rx="4" fill="${win}"/><path d="M226 36 C236 80 232 120 228 144 L244 144 C246 110 248 70 242 36Z M352 36 C342 80 346 120 350 144 L334 144 C332 110 330 70 336 36Z" fill="#B5653E" opacity="0.85"/><ellipse cx="200" cy="270" rx="150" ry="20" fill="#A99BB5" opacity="0.7"/></g>
<g class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.1"><rect x="240" y="44" width="100" height="90" rx="4"/><path d="M290 44 L290 134 M240 89 L340 89"/></g>`,
    };
  }
  const beach = has(brief, "beach", "sea", "seaside", "shore", "sand");
  const snow = has(brief, "snow", "winter", "ice", "frost");
  const water = has(brief, "pond", "puddle", "river", "stream", "lake", "splash");
  const woods = has(brief, "wood", "forest", "tree");
  const g1 = snow ? "#E8E9E4" : night ? "#56624F" : beach ? "#E3CFA4" : "#C9CCA4";
  const g2 = snow ? "#F3F2EE" : night ? "#4B5845" : beach ? "#DCC394" : "#AAB585";
  const g3 = snow ? "#FAF9F5" : night ? "#414D3C" : beach ? "#D3B987" : "#94A270";
  const parts: string[] = [];
  parts.push(`<g class="wash"><rect x="-10" y="-10" width="420" height="220" fill="${sky}"/>`);
  if (beach) parts.push(`<rect x="-10" y="150" width="420" height="60" fill="#9FB7BB"/>`);
  parts.push(
    `<path d="M-10 160 C60 136 140 148 210 140 C280 132 340 146 410 136 L410 320 L-10 320Z" fill="${g1}"/>`,
    `<path d="M-10 204 C90 188 200 200 300 190 C350 186 390 192 410 190 L410 320 L-10 320Z" fill="${g2}"/>`,
    `<path d="M-10 252 C120 240 260 248 410 238 L410 320 L-10 320Z" fill="${g3}"/></g>`,
  );
  const paint: string[] = [];
  const ink: string[] = [];
  if (night) {
    paint.push(`<circle cx="330" cy="58" r="20" fill="#F3E3B0"/>`);
    for (let i = 0; i < 14; i++) paint.push(`<circle cx="${(i * 83) % 390 + 6}" cy="${(i * 37) % 110 + 10}" r="1.6" fill="#F3E3B0"/>`);
  } else if (!snow) {
    paint.push(`<circle cx="338" cy="52" r="18" fill="#EBCB86" opacity="0.8"/>`);
  }
  if (woods) {
    for (const [x, s] of [[30, 1.2], [92, 0.9], [318, 1], [378, 1.3]] as const) {
      paint.push(`<g transform="translate(${x} 190) scale(${s})"><path d="M-5 0 L-4 -60 L4 -60 L5 0Z" fill="#7A6250"/><ellipse cx="0" cy="-78" rx="30" ry="36" fill="${night ? "#3F4B3A" : "#7F905E"}"/></g>`);
    }
  } else if (!beach) {
    paint.push(`<path d="M-10 176 C10 140 40 132 64 142 C80 120 112 120 126 138 C140 128 158 134 162 150 L-10 182Z" fill="${night ? "#3F4B3A" : snow ? "#B9C4BF" : "#7F905E"}"/>`);
  }
  if (water) {
    paint.push(`<ellipse cx="230" cy="262" rx="78" ry="12" fill="#AFC1C4"/><ellipse cx="250" cy="259" rx="24" ry="3" fill="#E5ECEA"/>`);
    ink.push(`<path d="M160 266 C190 276 270 276 304 264" stroke="#6F8C94"/>`);
  }
  if (snow) for (let i = 0; i < 30; i++) paint.push(`<circle cx="${(i * 61) % 400}" cy="${(i * 43) % 260}" r="2" fill="#FFFFFF"/>`);
  if (!night && !snow && !beach) {
    for (const [x, c] of [[40, "#B2443A"], [64, "#D3A24F"], [354, "#A99BB5"], [376, "#B2443A"]] as const)
      paint.push(`<circle cx="${x}" cy="${268 + (x % 7)}" r="3.4" fill="${c}"/>`);
  }
  ink.push(`<path d="M20 284 l3 -12 M26 286 l-2 -14 M370 280 l2 -12 M376 282 l-3 -12"/>`);
  return {
    indoor: false,
    ground: 262,
    svg: `${parts.join("")}<g class="paint">${paint.join("")}</g><g class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.1" stroke-linecap="round">${ink.join("")}</g>`,
  };
}

/** Compose a painting for a page from the brief and the characters' reference art. */
export function composePainting(page: Pick<Page, "picture" | "text" | "characters">, cast: CharacterDef[]): string {
  const brief = `${page.picture} ${page.text}`;
  const { svg, ground } = landscape(brief);
  const present = page.characters.map((id) => cast.find((c) => c.id === id)).filter(Boolean) as CharacterDef[];
  const n = present.length || 1;
  const leap = has(brief, "leap", "jump", "hop", "bounce", "fly", "flying", "float", "swing");
  const sleepy = has(brief, "sleep", "asleep", "snooze", "nap", "curl");
  const run = has(brief, "run", "race", "chase", "dash", "hurr");
  const figures = present
    .map((c, i) => {
      const x = n === 1 ? 200 : 90 + (220 * i) / (n - 1);
      const size = i === 0 ? 150 : 118;
      const s = size / 200;
      let y = ground - 190 * s;
      let rot = 0;
      if (i === 0 && leap) {
        y -= 46;
        rot = -14;
      } else if (i === 0 && run) rot = 9;
      if (sleepy) rot = i % 2 ? 8 : -8;
      const flip = n > 1 && i === n - 1 ? ` translate(200 0) scale(-1 1)` : "";
      return `<g transform="translate(${(x - 100 * s).toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)}) rotate(${rot} 100 190)${flip}">${characterArt(c)}</g>`;
    })
    .join("");
  const motion =
    leap && present.length
      ? `<g class="ink" fill="none" stroke="#4F3A2A" stroke-width="1" stroke-dasharray="3 5"><path d="M${n === 1 ? 120 : 30} 250 C${n === 1 ? 140 : 50} 210 ${n === 1 ? 160 : 70} 200 ${n === 1 ? 175 : 85} 196"/></g>`
      : "";
  return svg + motion + figures;
}
