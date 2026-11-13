/**
 * More standard pieces (see stamps.ts): buildings and landmarks, water and
 * land, flowers, the seaside, winter, rooms; the things characters hold
 * (props, drawn at the size they are in a character's hand on its own
 * 200x200 canvas); and the marks an action leaves (effects). Each drawn
 * from a seed, in the book's colours, so no two are the same.
 */
import type { Palette } from "./palette";
import type { Piece, StampKind } from "./stamps";

type R = () => number;
const f = (n: number) => (Math.round(n * 10) / 10).toString();
const between = (r: R, a: number, b: number) => a + (b - a) * r();
const pick = <T,>(r: R, xs: T[]) => xs[Math.floor(r() * xs.length)];
const P = (paint: string, ink = "", detail = ""): Piece => ({ paint, ink, detail });
const shade = (cx: number, cy: number, rx: number, ry: number, op = 0.22) => `<ellipse cx="${f(cx + rx * 0.25)}" cy="${f(cy + ry * 0.25)}" rx="${f(rx * 0.75)}" ry="${f(ry * 0.7)}" fill="#4A3020" opacity="${op}"/>`;
const ground = (w: number) => `<ellipse cx="4" cy="1" rx="${f(w)}" ry="${f(Math.max(2, w * 0.12))}" fill="#4A3020" opacity="0.15"/>`;

// ------------------------------------------------------------------ buildings and landmarks

function cottage(r: R, p: Palette): Piece {
  const w = between(r, 70, 90);
  const h = w * between(r, 0.55, 0.7);
  const roof = between(r, 30, 42);
  const wall = pick(r, [p.wall, "#E9D7B8", "#F1E6D0"]);
  const roofC = pick(r, [p.fabric1, p.woodDark, "#8C6A5A"]);
  const door = pick(r, [p.fabric2, p.woodDark, p.leafDark]);
  return P(
    `${ground(w * 0.6)}<rect x="${f(-w / 2)}" y="${f(-h)}" width="${f(w)}" height="${f(h)}" fill="${wall}"/><path d="M${f(-w / 2 - 8)} ${f(-h)}L0 ${f(-h - roof)}L${f(w / 2 + 8)} ${f(-h)}Z" fill="${roofC}"/><rect x="${f(w * 0.18)}" y="${f(-h - roof * 0.8)}" width="9" height="${f(roof * 0.6)}" fill="${p.woodDark}"/><rect x="-8" y="${f(-h * 0.62)}" width="16" height="${f(h * 0.62)}" rx="7" fill="${door}"/><rect x="${f(-w / 2 + 8)}" y="${f(-h * 0.75)}" width="15" height="13" fill="${p.glass}"/><rect x="${f(w / 2 - 23)}" y="${f(-h * 0.75)}" width="15" height="13" fill="${p.glass}"/>${shade(0, -h / 2, w / 2, h / 2, 0.12)}`,
    `<path d="M${f(-w / 2)} 0V${f(-h)}H${f(w / 2)}V0M${f(-w / 2 - 8)} ${f(-h)}L0 ${f(-h - roof)}L${f(w / 2 + 8)} ${f(-h)}"/><path d="M${f(-w / 2 + 8)} ${f(-h * 0.75 + 6.5)}h15M${f(w / 2 - 23)} ${f(-h * 0.75 + 6.5)}h15" stroke-width="0.8"/>`,
  );
}

function bridge(r: R, p: Palette): Piece {
  const w = between(r, 80, 100);
  const arch = between(r, 14, 22);
  return P(
    `<path d="M${f(-w / 2)} 0C${f(-w / 4)} ${f(-arch)} ${f(w / 4)} ${f(-arch)} ${f(w / 2)} 0L${f(w / 2)} -6C${f(w / 4)} ${f(-arch - 6)} ${f(-w / 4)} ${f(-arch - 6)} ${f(-w / 2)} -6Z" fill="${p.wood}"/>${Array.from({ length: 5 }, (_, i) => `<rect x="${f(-w / 2 + 6 + (i * (w - 12)) / 4)}" y="${f(-arch - 24 + Math.abs(i - 2) * 4)}" width="3" height="20" fill="${p.woodDark}"/>`).join("")}`,
    `<path d="M${f(-w / 2)} 0C${f(-w / 4)} ${f(-arch)} ${f(w / 4)} ${f(-arch)} ${f(w / 2)} 0M${f(-w / 2 + 6)} ${f(-arch - 14)}C${f(-w / 4)} ${f(-arch - 26)} ${f(w / 4)} ${f(-arch - 26)} ${f(w / 2 - 6)} ${f(-arch - 14)}"/>`,
  );
}

function well(r: R, p: Palette): Piece {
  return P(
    `${ground(26)}<path d="M-22 0L-22 -28C-22 -34 22 -34 22 -28L22 0Z" fill="${p.stone}"/><rect x="-24" y="-62" width="4" height="34" fill="${p.woodDark}"/><rect x="20" y="-62" width="4" height="34" fill="${p.woodDark}"/><path d="M-30 -60L0 -76L30 -60Z" fill="${pick(r, [p.fabric1, p.woodDark])}"/>${shade(0, -16, 22, 16)}`,
    `<path d="M-22 0V-28C-22 -34 22 -34 22 -28V0M-22 -16h44M-8 -28v12M8 -16v16"/><path d="M0 -60v18" stroke-width="0.8"/>`,
  );
}

function pond(r: R, p: Palette): Piece {
  const w = between(r, 50, 70);
  return P(
    `<ellipse cx="0" cy="0" rx="${f(w)}" ry="${f(w * 0.22)}" fill="${p.water}"/><ellipse cx="${f(-w * 0.2)}" cy="-2" rx="${f(w * 0.4)}" ry="2.5" fill="${p.waterLight}"/><ellipse cx="${f(w * 0.45)}" cy="2" rx="8" ry="3" fill="${p.leaf}"/>`,
    `<path d="M${f(-w)} 0q${f(w)} ${f(w * 0.3)} ${f(w * 2)} 0M${f(-w * 0.5)} -3q8 2 16 0M${f(w * 0.1)} 3q8 2 16 0" stroke-width="0.9"/>`,
  );
}

function hill(r: R, p: Palette): Piece {
  const w = between(r, 110, 160);
  const h = w * between(r, 0.25, 0.4);
  return P(`<path d="M${f(-w)} 0C${f(-w * 0.5)} ${f(-h)} ${f(w * 0.5)} ${f(-h)} ${f(w)} 0Z" fill="${pick(r, [p.grass, p.leafLight, p.grassDark])}" opacity="0.85"/>`, `<path d="M${f(-w * 0.8)} ${f(-h * 0.3)}C${f(-w * 0.4)} ${f(-h * 0.85)} ${f(w * 0.2)} ${f(-h * 0.9)} ${f(w * 0.55)} ${f(-h * 0.45)}" stroke-width="0.8"/>`);
}

function boulder(r: R, p: Palette): Piece {
  const w = between(r, 22, 34);
  return P(`${ground(w)}<path d="M${f(-w)} 0C${f(-w)} ${f(-w * 0.9)} ${f(w * 0.6)} ${f(-w * 1.1)} ${f(w)} 0Z" fill="${p.stone}"/>${shade(0, -w * 0.4, w * 0.8, w * 0.5, 0.28)}`, `<path d="M${f(-w)} 0C${f(-w)} ${f(-w * 0.9)} ${f(w * 0.6)} ${f(-w * 1.1)} ${f(w)} 0M${f(-w * 0.2)} ${f(-w * 0.6)}l${f(w * 0.2)} ${f(w * 0.3)}"/>`);
}

function log(r: R, p: Palette): Piece {
  const w = between(r, 30, 44);
  return P(`${ground(w)}<rect x="${f(-w)}" y="-14" width="${f(w * 2)}" height="14" rx="7" fill="${p.wood}"/><ellipse cx="${f(w)}" cy="-7" rx="5" ry="7" fill="${p.stem}"/>`, `<path d="M${f(-w)} -14h${f(w * 2)}M${f(-w)} 0h${f(w * 2)}"/><ellipse cx="${f(w)}" cy="-7" rx="2.5" ry="3.5" stroke-width="0.7"/>`);
}

function stump(r: R, p: Palette): Piece {
  const w = between(r, 12, 18);
  return P(`${ground(w)}<path d="M${f(-w)} 0L${f(-w * 0.85)} -20L${f(w * 0.85)} -20L${f(w)} 0Z" fill="${p.trunk}"/><ellipse cx="0" cy="-20" rx="${f(w * 0.85)}" ry="4" fill="${p.stem}"/>`, `<path d="M${f(-w)} 0L${f(-w * 0.85)} -20M${f(w)} 0L${f(w * 0.85)} -20"/><ellipse cx="0" cy="-20" rx="${f(w * 0.4)}" ry="1.6" stroke-width="0.6"/>`);
}

function hedge(r: R, p: Palette): Piece {
  const w = between(r, 60, 90);
  const h = between(r, 26, 36);
  let d = `M${f(-w / 2)} 0`;
  const n = 6;
  for (let i = 0; i <= n; i++) d += `Q${f(-w / 2 + (i - 0.5) * (w / n))} ${f(-h - between(r, 0, 8))} ${f(-w / 2 + i * (w / n))} ${f(-h + 4)}`;
  d += `L${f(w / 2)} 0Z`;
  return P(`${ground(w * 0.55)}<path d="${d}" fill="${p.leafDark}"/>${shade(0, -h / 2, w / 2, h / 2, 0.18)}`, `<path d="${d.slice(0, d.lastIndexOf("L"))}" stroke-width="0.9"/>`);
}

function gate(r: R, p: Palette): Piece {
  const w = between(r, 44, 54);
  const bars = Array.from({ length: 5 }, (_, i) => `M${f(-w / 2 + (i * w) / 4)} -2V-34`).join("");
  return P(`<rect x="${f(-w / 2 - 6)}" y="-44" width="6" height="44" fill="${p.woodDark}"/><rect x="${f(w / 2)}" y="-44" width="6" height="44" fill="${p.woodDark}"/>`, `<path d="${bars}M${f(-w / 2)} -32H${f(w / 2)}M${f(-w / 2)} -8H${f(w / 2)}M${f(-w / 2)} -8L${f(w / 2)} -32" stroke="${p.woodDark}" stroke-width="2.4"/>`);
}

function signpost(r: R, p: Palette): Piece {
  const flip = r() < 0.5 ? 1 : -1;
  return P(`<rect x="-2.5" y="-56" width="5" height="56" fill="${p.woodDark}"/><path d="M${-2 * flip} -52h${30 * flip}l${6 * flip} 6l${-6 * flip} 6h${-30 * flip}Z" fill="${p.wood}"/>`, `<path d="M${-2 * flip} -52h${30 * flip}l${6 * flip} 6l${-6 * flip} 6h${-30 * flip}M${4 * flip} -46h${18 * flip}" stroke-width="0.8"/>`);
}

function lamppost(_r: R, p: Palette): Piece {
  return P(`<ellipse cx="0" cy="-74" rx="22" ry="20" fill="${p.lampGlow}" opacity="0.25"/><rect x="-2" y="-66" width="4" height="66" fill="${p.trunkDark}"/><path d="M-8 -66L-6 -82L6 -82L8 -66Z" fill="${p.lampGlow}"/>`, `<path d="M-8 -66L-6 -82L6 -82L8 -66ZM-10 -84h20"/>`);
}

function bunting(r: R, p: Palette): Piece {
  const w = between(r, 90, 130);
  const n = 7;
  const flags = Array.from({ length: n }, (_, i) => {
    const x = -w / 2 + (i + 0.5) * (w / n);
    const y = 4 + Math.sin((i / (n - 1)) * Math.PI) * 10;
    return `<path d="M${f(x - 5)} ${f(y)}L${f(x + 5)} ${f(y)}L${f(x)} ${f(y + 11)}Z" fill="${[p.bloom1, p.bloom2, p.fabric2, p.bloom3][i % 4]}"/>`;
  }).join("");
  return P(flags, `<path d="M${f(-w / 2)} 0Q0 ${f(28)} ${f(w / 2)} 0" stroke-width="0.8"/>`);
}

// ------------------------------------------------------------------ flowers and plants

function tulips(r: R, p: Palette): Piece {
  const c = pick(r, [p.bloom1, p.bloom2, p.bloom3]);
  let paint = "";
  let ink = "";
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 7 + between(r, -2, 2);
    const h = between(r, 16, 24);
    ink += `<path d="M${f(x)} 0V${f(-h)}" stroke="${p.leafDark}"/>`;
    paint += `<path d="M${f(x - 4)} ${f(-h)}L${f(x - 4)} ${f(-h - 8)}L${f(x - 1)} ${f(-h - 5)}L${f(x + 1)} ${f(-h - 9)}L${f(x + 4)} ${f(-h - 8)}L${f(x + 4)} ${f(-h)}Q${f(x)} ${f(-h + 4)} ${f(x - 4)} ${f(-h)}Z" fill="${c}"/><path d="M${f(x)} -4q-6 -4 -6 -12q5 4 6 10" fill="${p.leaf}"/>`;
  }
  return P(paint, ink);
}

function daisies(r: R, p: Palette): Piece {
  let paint = "";
  let ink = "";
  for (let i = 0; i < 4; i++) {
    const x = between(r, -12, 12);
    const h = between(r, 8, 16);
    ink += `<path d="M${f(x * 0.5)} 0Q${f(x)} ${f(-h * 0.5)} ${f(x)} ${f(-h)}" stroke="${p.grassDark}"/>`;
    paint += `<circle cx="${f(x)}" cy="${f(-h)}" r="3.6" fill="#F7F3EA"/><circle cx="${f(x)}" cy="${f(-h)}" r="1.4" fill="${p.bloomCentre}"/>`;
  }
  return P(paint, ink);
}

function sunflower(r: R, p: Palette): Piece {
  const h = between(r, 50, 64);
  const petals = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return `<ellipse cx="${f(Math.cos(a) * 9)}" cy="${f(-h + Math.sin(a) * 9)}" rx="5" ry="2.6" transform="rotate(${f((a * 180) / Math.PI)} ${f(Math.cos(a) * 9)} ${f(-h + Math.sin(a) * 9)})" fill="#E3B84F"/>`;
  }).join("");
  return P(`${petals}<circle cx="0" cy="${f(-h)}" r="6" fill="#8C5E3C"/><path d="M0 ${f(-h * 0.5)}q-12 -6 -14 -14q10 2 14 10" fill="${p.leaf}"/>`, `<path d="M0 0Q2 ${f(-h * 0.5)} 0 ${f(-h + 6)}" stroke="${p.leafDark}" stroke-width="1.6"/>`);
}

function reeds(r: R, p: Palette): Piece {
  let ink = "";
  let paint = "";
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 4 + between(r, -1, 1);
    const h = between(r, 22, 36);
    ink += `<path d="M${f(x)} 0Q${f(x + between(r, -3, 3))} ${f(-h * 0.5)} ${f(x + between(r, -4, 4))} ${f(-h)}" stroke="${p.grassDark}"/>`;
    if (i % 2) paint += `<ellipse cx="${f(x)}" cy="${f(-h + 6)}" rx="2" ry="5" fill="${p.trunk}"/>`;
  }
  return P(paint, ink);
}

function flowerpot(r: R, p: Palette): Piece {
  return P(`<path d="M-10 0L-12 -18L12 -18L10 0Z" fill="${p.fabric1}"/><ellipse cx="0" cy="-28" rx="13" ry="11" fill="${p.leaf}"/><circle cx="${f(between(r, -5, 5))}" cy="-32" r="3" fill="${p.bloom2}"/><circle cx="5" cy="-26" r="2.6" fill="${p.bloom1}"/>`, `<path d="M-10 0L-12 -18H12L10 0M-13 -18h26"/>`);
}

// ------------------------------------------------------------------ seaside and winter

function shell(r: R, p: Palette): Piece {
  return P(`<path d="M-7 0C-8 -8 -2 -12 0 -12C2 -12 8 -8 7 0Z" fill="${pick(r, ["#F1D9C9", "#E9CBB5", p.stem])}"/>`, `<path d="M0 -12V0M-4 -10L-3 0M4 -10L3 0M-7 0H7" stroke-width="0.7"/>`);
}
function sandcastle(r: R, p: Palette): Piece {
  return P(`<path d="M-22 0V-18H-14V-24H-8V-18H8V-24H14V-18H22V0Z" fill="#E3CFA4"/><rect x="-6" y="-36" width="12" height="18" fill="#DCC394"/><path d="M0 -36v-12l8 4l-8 4" fill="${pick(r, [p.bloom1, p.fabric2])}"/>`, `<path d="M-22 0V-18H-14V-24H-8V-18H8V-24H14V-18H22V0M-6 -18V-36H6V-18M0 -48v12"/>`);
}
function boat(r: R, p: Palette): Piece {
  const c = pick(r, [p.fabric1, p.fabric2, "#E9DFC6"]);
  return P(`<path d="M-30 -10L30 -10L22 0L-22 0Z" fill="${c}"/><path d="M2 -12L2 -50L26 -14Z" fill="#F4EFE4"/>`, `<path d="M-30 -10L30 -10L22 0L-22 0ZM2 -10V-52"/>`);
}
function snowman(r: R, p: Palette): Piece {
  return P(`${ground(20)}<circle cx="0" cy="-16" r="17" fill="${p.snow}"/><circle cx="0" cy="-42" r="12" fill="${p.snow}"/><path d="M-11 -50h22l-2 -12h-18Z" fill="${pick(r, [p.woodDark, "#3A3A3A"])}"/><path d="M0 -40l9 2l-9 2Z" fill="#D99447"/><path d="M-10 -32h20" stroke="${p.fabric1}" stroke-width="4"/>`, `<circle cx="0" cy="-16" r="17"/><circle cx="0" cy="-42" r="12"/>`, `<circle cx="-4" cy="-45" r="1.4" fill="#2A1E15"/><circle cx="4" cy="-45" r="1.4" fill="#2A1E15"/>`);
}

// ------------------------------------------------------------------ rooms

function fireplace(_r: R, p: Palette): Piece {
  return P(`<rect x="-36" y="-70" width="72" height="70" fill="${p.stone}"/><rect x="-42" y="-76" width="84" height="8" fill="${p.wood}"/><path d="M-20 0V-36C-20 -48 20 -48 20 -36V0Z" fill="#3A2A20"/><path d="M-10 0C-12 -12 -2 -16 0 -26C4 -16 12 -12 10 0Z" fill="#E8A040"/><path d="M-5 0C-6 -8 0 -10 0 -16C3 -10 6 -8 5 0Z" fill="#F6DFA0"/>`, `<path d="M-36 0V-70H36V0M-20 0V-36C-20 -48 20 -48 20 -36V0"/>`);
}
function armchair(r: R, p: Palette): Piece {
  const c = pick(r, [p.fabric1, p.fabric2, p.leafDark]);
  return P(`<rect x="-30" y="-56" width="60" height="40" rx="12" fill="${c}"/><rect x="-36" y="-34" width="14" height="30" rx="6" fill="${c}"/><rect x="22" y="-34" width="14" height="30" rx="6" fill="${c}"/><rect x="-22" y="-26" width="44" height="14" rx="5" fill="${c}"/><rect x="-30" y="-6" width="5" height="6" fill="${p.woodDark}"/><rect x="25" y="-6" width="5" height="6" fill="${p.woodDark}"/>${shade(0, -30, 30, 24, 0.15)}`, `<rect x="-30" y="-56" width="60" height="40" rx="12"/><path d="M-36 -34v30h72v-30"/>`);
}
function cupboard(r: R, p: Palette): Piece {
  return P(`<rect x="-26" y="-80" width="52" height="80" fill="${p.wood}"/><rect x="-22" y="-74" width="20" height="68" fill="${p.woodDark}" opacity="0.4"/><rect x="2" y="-74" width="20" height="68" fill="${p.woodDark}" opacity="0.4"/>`, `<rect x="-26" y="-80" width="52" height="80"/><path d="M0 -76V-4"/>`, `<circle cx="-4" cy="-40" r="1.6" fill="${p.sun}"/><circle cx="4" cy="-40" r="1.6" fill="${p.sun}"/>`);
}
function toybox(r: R, p: Palette): Piece {
  return P(`<rect x="-24" y="-26" width="48" height="26" fill="${pick(r, [p.fabric2, p.fabric1, p.wood])}"/><circle cx="-10" cy="-30" r="7" fill="${p.bloom1}"/><rect x="2" y="-36" width="12" height="12" fill="${p.bloom2}"/>`, `<rect x="-24" y="-26" width="48" height="26"/><path d="M-24 -18h48" stroke-width="0.8"/>`);
}
function clock(_r: R, p: Palette): Piece {
  return P(`<circle cx="0" cy="-14" r="14" fill="#F4EFE4"/><rect x="-16" y="-2" width="32" height="4" fill="${p.wood}"/>`, `<circle cx="0" cy="-14" r="14"/><path d="M0 -14V-23M0 -14L6 -10"/>`);
}
function frame(r: R, p: Palette): Piece {
  return P(`<rect x="-18" y="-30" width="36" height="28" fill="${p.wood}"/><rect x="-14" y="-26" width="28" height="20" fill="${pick(r, [p.cloud, p.leafLight, p.glass])}"/><path d="M-14 -6L-4 -16L4 -10L14 -18V-6Z" fill="${p.leaf}"/>`, `<rect x="-18" y="-30" width="36" height="28"/>`);
}
function bookshelf(r: R, p: Palette): Piece {
  let books = "";
  for (let row = 0; row < 3; row++) {
    let x = -26;
    while (x < 22) {
      const bw = between(r, 4, 7);
      const bh = between(r, 14, 20);
      books += `<rect x="${f(x)}" y="${f(-6 - row * 26 - bh)}" width="${f(bw)}" height="${f(bh)}" fill="${pick(r, [p.fabric1, p.fabric2, p.bloom2, p.leaf, p.bloom3])}"/>`;
      x += bw + 1;
    }
  }
  return P(`<rect x="-30" y="-84" width="60" height="84" fill="${p.woodDark}"/>${books}`, `<rect x="-30" y="-84" width="60" height="84"/><path d="M-30 -32H30M-30 -58H30"/>`);
}

// ------------------------------------------------------------------ props: held in a character's hand (0,0 = the grip)

function basket(r: R, p: Palette): Piece {
  const fruit = pick(r, [p.bloom1, p.bloom2, "#B2443A"]);
  return P(`<circle cx="-6" cy="4" r="5" fill="${fruit}"/><circle cx="4" cy="3" r="5" fill="${fruit}"/><path d="M-16 6C-16 22 -10 30 0 30C10 30 16 22 16 6Z" fill="#B5814E"/>`, `<path d="M-16 6C-14 -12 14 -12 16 6M-16 6C-16 22 -10 30 0 30C10 30 16 22 16 6ZM-8 10v16M0 10v18M8 10v16" stroke-width="0.9"/>`);
}
function bowl(r: R, p: Palette): Piece {
  return P(`${Array.from({ length: 4 }, (_, i) => `<circle cx="${-8 + i * 5.5}" cy="-2" r="4" fill="${pick(r, [p.bloom1, p.bloom3, "#B2443A"])}"/>`).join("")}<path d="M-16 0C-16 10 -8 14 0 14C8 14 16 10 16 0Z" fill="${pick(r, [p.fabric2, "#E9DFC6"])}"/>`, `<path d="M-16 0H16C16 10 8 14 0 14C-8 14 -16 10 -16 0"/>`);
}
function balloon(r: R, p: Palette): Piece {
  const c = pick(r, [p.bloom1, p.fabric2, p.bloom2]);
  return P(`<ellipse cx="6" cy="-58" rx="14" ry="17" fill="${c}"/><ellipse cx="1" cy="-64" rx="4" ry="6" fill="#FFF8E8" opacity="0.4"/>`, `<path d="M0 0C4 -16 -2 -30 6 -41" stroke-width="0.8"/>`);
}
function book(r: R, p: Palette): Piece {
  return P(`<path d="M-14 -8L0 -4L14 -8L14 8L0 12L-14 8Z" fill="#F4EFE4"/><path d="M-15 -9L-15 9L0 13L15 9L15 -9L0 -5Z" fill="${pick(r, [p.fabric1, p.fabric2])}" opacity="0.5"/>`, `<path d="M0 -4V12M-14 -8L0 -4L14 -8M-10 -2h7M-10 2h7M4 -2h7" stroke-width="0.7"/>`);
}
function cup(r: R, p: Palette): Piece {
  return P(`<path d="M-7 -6H7L5 8H-5Z" fill="${pick(r, [p.fabric2, "#F2EEE4", p.fabric1])}"/>`, `<path d="M-7 -6H7L5 8H-5ZM7 -2c5 0 5 7 -1 7M-2 -10q2 -3 0 -6M2 -10q2 -3 0 -6" stroke-width="0.8"/>`);
}
function apple(_r: R, p: Palette): Piece {
  return P(`<circle cx="0" cy="0" r="7" fill="#B2443A"/><path d="M0 -7q4 -4 6 -2q-2 3 -6 2" fill="${p.leaf}"/>`, `<path d="M0 -6v-3" stroke-width="0.9"/>`, `<circle cx="-2.5" cy="-2.5" r="1.5" fill="#FFFFFF" opacity="0.5"/>`);
}
function ball(r: R, p: Palette): Piece {
  return P(`<circle cx="0" cy="0" r="10" fill="${pick(r, [p.bloom1, p.fabric2, p.bloom2])}"/><path d="M-10 0Q0 -6 10 0Q0 6 -10 0Z" fill="#F4EFE4" opacity="0.8"/>`, `<circle cx="0" cy="0" r="10"/>`);
}
function kite(r: R, p: Palette): Piece {
  return P(`<path d="M10 -90L26 -70L10 -50L-6 -70Z" fill="${pick(r, [p.bloom1, p.fabric2, p.bloom2])}"/>`, `<path d="M10 -90L26 -70L10 -50L-6 -70ZM10 -90V-50M-6 -70H26M0 0C2 -18 6 -34 10 -50M10 -50q-6 8 0 14q6 6 0 12" stroke-width="0.8"/>`);
}
function bouquet(r: R, p: Palette): Piece {
  return P(`${Array.from({ length: 5 }, (_, i) => `<circle cx="${-6 + i * 3}" cy="${-12 - (i % 2) * 4}" r="3.6" fill="${pick(r, [p.bloom1, p.bloom2, p.bloom3])}"/>`).join("")}<path d="M-6 -2L6 -2L2 10L-2 10Z" fill="#E9DFC6"/>`, `<path d="M-4 -6L-1 6M0 -8L0 6M4 -6L1 6" stroke="${p.leafDark}"/>`);
}
function teddy(_r: R, p: Palette): Piece {
  return P(`<circle cx="-6" cy="-16" r="3.5" fill="${p.wood}"/><circle cx="6" cy="-16" r="3.5" fill="${p.wood}"/><circle cx="0" cy="-10" r="8" fill="${p.wood}"/><ellipse cx="0" cy="6" rx="9" ry="11" fill="${p.wood}"/>`, `<circle cx="0" cy="-10" r="8"/>`, `<circle cx="-2.6" cy="-11" r="1.1" fill="#2A1E15"/><circle cx="2.6" cy="-11" r="1.1" fill="#2A1E15"/>`);
}
function lantern(_r: R, p: Palette): Piece {
  return P(`<ellipse cx="0" cy="14" rx="18" ry="16" fill="${p.lampGlow}" opacity="0.3"/><path d="M-7 6L-6 22L6 22L7 6Z" fill="${p.lampGlow}"/>`, `<path d="M0 0V6M-7 6L-6 22H6L7 6ZM-9 6H9M-8 22H8"/>`);
}
function umbrella(r: R, p: Palette): Piece {
  return P(`<path d="M-34 -70C-30 -96 30 -96 34 -70Q22 -76 11 -70Q0 -76 -11 -70Q-22 -76 -34 -70Z" fill="${pick(r, [p.bloom1, p.fabric2, p.bloom2])}"/>`, `<path d="M0 -90V0q0 6 -5 6" stroke-width="1.6"/>`);
}
function bucket(r: R, p: Palette): Piece {
  return P(`<path d="M-9 0L-11 -18H11L9 0Z" fill="${pick(r, [p.bloom1, p.fabric2, p.bloom2])}"/>`, `<path d="M-9 0L-11 -18H11L9 0ZM-11 -18C-10 -30 10 -30 11 -18" stroke-width="0.9"/>`);
}
function wand(_r: R, p: Palette): Piece {
  return P(`<path d="M18 -48l3 7l8 1l-6 5l2 8l-7 -4l-7 4l2 -8l-6 -5l8 -1Z" fill="${p.star}"/>`, `<path d="M0 0L16 -36" stroke-width="1.6"/>`);
}
function cake(r: R, p: Palette): Piece {
  return P(`<rect x="-14" y="-12" width="28" height="12" fill="#F1E2DA"/><rect x="-14" y="-15" width="28" height="4" fill="${pick(r, [p.bloom1, p.bloom3])}"/><rect x="-1" y="-24" width="2" height="9" fill="${p.fabric2}"/><ellipse cx="0" cy="-26" rx="2" ry="3" fill="#E8A040"/>`, `<rect x="-14" y="-15" width="28" height="15"/>`);
}
function letter(_r: R, p: Palette): Piece {
  return P(`<rect x="-12" y="-8" width="24" height="16" fill="#F4EFE4"/>`, `<rect x="-12" y="-8" width="24" height="16"/><path d="M-12 -8L0 2L12 -8"/>`, `<circle cx="7" cy="3" r="2" fill="${p.bloom1}"/>`);
}

// ------------------------------------------------------------------ effects: what an action leaves in the air

function splash(r: R, p: Palette): Piece {
  let paint = "";
  let ink = "";
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const d = between(r, 16, 30);
    paint += `<ellipse cx="${f(Math.cos(a) * d)}" cy="${f(Math.sin(a) * d * 0.9)}" rx="2.6" ry="3.6" fill="${p.water}"/>`;
    ink += `<path d="M${f(Math.cos(a) * 8)} ${f(Math.sin(a) * 6)}L${f(Math.cos(a) * (d - 5))} ${f(Math.sin(a) * (d - 5) * 0.9)}" stroke="${p.water}"/>`;
  }
  return P(`<ellipse cx="0" cy="0" rx="20" ry="4" fill="${p.water}"/>${paint}`, ink);
}
function sparkles(r: R, p: Palette): Piece {
  let detail = "";
  for (let i = 0; i < 4; i++) {
    const x = between(r, -18, 18);
    const y = between(r, -18, 18);
    const s = between(r, 3, 5);
    detail += `<path d="M${f(x)} ${f(y - s)}L${f(x + s * 0.3)} ${f(y - s * 0.3)}L${f(x + s)} ${f(y)}L${f(x + s * 0.3)} ${f(y + s * 0.3)}L${f(x)} ${f(y + s)}L${f(x - s * 0.3)} ${f(y + s * 0.3)}L${f(x - s)} ${f(y)}L${f(x - s * 0.3)} ${f(y - s * 0.3)}Z" fill="${p.star}"/>`;
  }
  return P("", "", detail);
}
function motion(r: R): Piece {
  const n = 3;
  return P("", Array.from({ length: n }, (_, i) => `<path d="M${-i * 4} ${f(-10 + i * 9)}h${f(-between(r, 12, 20))}" stroke-width="1.1"/>`).join(""));
}
function ticks(_r: R): Piece {
  return P("", `<path d="M-12 -10l-5 -5M0 -14l0 -7M12 -10l5 -5" stroke-width="1.2"/>`);
}
function dust(r: R, p: Palette): Piece {
  return P(Array.from({ length: 4 }, (_, i) => `<circle cx="${f(-14 + i * 9)}" cy="${f(-between(r, 2, 8))}" r="${f(between(r, 4, 7))}" fill="${p.stone}" opacity="0.5"/>`).join(""), "");
}
function hearts(r: R, p: Palette): Piece {
  return P(Array.from({ length: 3 }, (_, i) => {
    const x = (i - 1) * 12;
    const y = -i * 8 - between(r, 0, 4);
    return `<path d="M${x} ${y}c-4 -6 -10 -1 -4 4l4 4l4 -4c6 -5 0 -10 -4 -4Z" fill="${p.bloom1}"/>`;
  }).join(""));
}
function notes(_r: R, p: Palette): Piece {
  return P(`<ellipse cx="-6" cy="0" rx="3.4" ry="2.6" fill="${p.ink}"/><ellipse cx="8" cy="-8" rx="3.4" ry="2.6" fill="${p.ink}"/>`, `<path d="M-3 0V-16L11 -22V-8"/>`);
}
function zzz(_r: R, p: Palette): Piece {
  return P("", `<path d="M0 0h8l-8 8h8M10 -12h6l-6 6h6M18 -22h5l-5 5h5" stroke="${p.fabric2}" stroke-width="1.3"/>`);
}

const K = (about: string, size: string, base: StampKind["base"], dark: boolean, draw: StampKind["draw"]): StampKind => ({ about, size, base, dark, draw });

/** The extra pieces, by name. */
export const MORE_STAMPS: Record<string, StampKind> = {
  cottage: K("a little cottage with a door and two windows", "90x90", "ground", true, cottage),
  bridge: K("a wooden footbridge with a rail", "100x40", "ground", true, bridge),
  well: K("an old stone well with a little roof", "60x76", "ground", true, well),
  pond: K("a small pond with a lily pad", "130x30", "ground", false, pond),
  hill: K("a soft green hill (far away)", "280x50", "ground", false, hill),
  boulder: K("a big rounded rock", "56x34", "ground", true, boulder),
  log: K("a fallen log", "80x14", "ground", true, log),
  stump: K("a tree stump", "34x22", "ground", true, stump),
  hedge: K("a hedgerow", "80x36", "ground", true, hedge),
  gate: K("a wooden field gate between posts", "60x44", "ground", true, gate),
  signpost: K("a wooden signpost", "40x56", "ground", true, signpost),
  lamppost: K("an old street lamp, glowing", "20x84", "ground", true, lamppost),
  bunting: K("a string of party flags", "120x30", "middle", false, bunting),
  tulips: K("three tulips", "24x32", "ground", false, tulips),
  daisies: K("a clump of daisies", "26x18", "ground", false, daisies),
  sunflower: K("a tall sunflower", "30x70", "ground", false, sunflower),
  reeds: K("reeds and bulrushes at the water's edge", "24x36", "ground", false, reeds),
  flowerpot: K("a pot of flowers", "26x40", "ground", false, flowerpot),
  shell: K("a sea shell", "14x12", "ground", false, shell),
  sandcastle: K("a sandcastle with a flag", "44x48", "ground", false, sandcastle),
  boat: K("a little sailing boat", "60x52", "ground", true, boat),
  snowman: K("a snowman with a hat and scarf", "40x62", "ground", false, snowman),
  fireplace: K("a fireplace with a crackling fire (indoors)", "84x76", "ground", true, fireplace),
  armchair: K("a soft armchair (indoors)", "72x56", "ground", true, armchair),
  cupboard: K("a wooden cupboard (indoors)", "52x80", "ground", true, cupboard),
  toybox: K("a toy box with toys (indoors)", "48x36", "ground", false, toybox),
  clock: K("a mantel clock", "32x30", "ground", true, clock),
  frame: K("a framed picture on the wall", "36x30", "wall", true, frame),
  bookshelf: K("a tall bookshelf (indoors)", "60x84", "ground", true, bookshelf),
};

/** Things a character holds: placed at its hand (see poses). */
export const PROPS: Record<string, StampKind> = {
  basket: K("a basket of fruit", "32x36", "middle", false, basket),
  bowl: K("a bowl of berries", "32x18", "middle", false, bowl),
  balloon: K("a balloon on a string", "30x76", "middle", false, balloon),
  book: K("an open book", "30x22", "middle", false, book),
  cup: K("a cup of something warm", "18x24", "middle", false, cup),
  apple: K("an apple", "14x16", "middle", false, apple),
  ball: K("a ball", "20x20", "middle", false, ball),
  kite: K("a kite on its string, flying up", "34x92", "middle", false, kite),
  flowers: K("a little bunch of flowers", "16x26", "middle", false, bouquet),
  teddy: K("a teddy bear", "20x32", "middle", false, teddy),
  lantern: K("a lantern, glowing", "20x30", "middle", false, lantern),
  umbrella: K("an open umbrella", "70x96", "middle", false, umbrella),
  bucket: K("a seaside bucket", "22x26", "middle", false, bucket),
  wand: K("a star wand", "30x50", "middle", false, wand),
  cake: K("a little cake with a candle", "28x28", "middle", false, cake),
  letter: K("a letter", "24x16", "middle", false, letter),
};

/** What an action leaves in the air. */
export const EFFECTS: Record<string, StampKind> = {
  splash: K("a splash of water (x,y = where it lands)", "60x34", "middle", false, splash),
  sparkles: K("a few twinkling sparkles", "40x40", "middle", false, sparkles),
  motion: K("motion lines behind something moving (put them on the side it came from)", "30x24", "middle", false, motion),
  ticks: K("little 'look!' ticks round a hand or head", "34x20", "middle", false, ticks),
  dust: K("a puff of dust", "40x10", "ground", false, dust),
  hearts: K("floating hearts", "36x24", "middle", false, hearts),
  notes: K("music notes", "20x24", "middle", false, notes),
  zzz: K("sleepy Zzz", "26x30", "middle", false, zzz),
};
