/**
 * The standard scenery pieces: trees, bushes, clouds, birds, stones,
 * flowers, fences, the moon, the common pieces of a room... painted in the
 * house style (watercolour fills, a crescent of shade on the lower right, a
 * pale glaze on the upper left, broken sepia line) and placed on a page by
 * name rather than drawn afresh by the painter each time.
 *
 * Every piece is drawn here, in code, from a seed: the same seed always
 * gives the same piece, and different seeds give different trees of the
 * same kind (a lump more in the crown, a branch to the other side), so a
 * row of them never looks stamped. Colours are named slots (see palette),
 * so the book's season and the page's light decide them.
 *
 * A piece is drawn in its own little space with its base - where it
 * touches the ground, or the middle of a thing that floats - at 0,0, at
 * its natural size (see STAMPS: `size`). The page places it with x, y,
 * a scale and a mirror (see server/paint/expand).
 */
import type { Palette } from "./palette";

export interface Piece {
  paint: string;
  ink: string;
  detail: string;
}

/** A seeded random source (mulberry32): the same seed, the same numbers. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number from a string (the same string, the same number). */
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();
type R = () => number;
const between = (r: R, a: number, b: number) => a + (b - a) * r();

/** A soft, lumpy closed outline round an ellipse (a tree's crown, a bush,
 *  a cloud), as smooth curves through `n` points. */
function lumpy(r: R, cx: number, cy: number, rx: number, ry: number, n: number, wobble: number, flatBottom = false): { d: string; pts: [number, number][] } {
  const pts: [number, number][] = [];
  const turn = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.35) * wobble;
    let y = cy + Math.sin(a) * ry * k;
    if (flatBottom && y > cy + ry * 0.55) y = cy + ry * 0.55 + (y - cy - ry * 0.55) * 0.25;
    pts.push([cx + Math.cos(a) * rx * k, y]);
  }
  // (through the midpoints, each point a control: always smooth, never a corner)
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  let d = `M${f(m0[0])} ${f(m0[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return { d: d + "Z", pts };
}

/** Part of an outline as a broken pen line: the run from point `from`
 *  for `len` points (pen contours are never fully closed). */
function brokenLine(pts: [number, number][], from: number, len: number): string {
  const n = pts.length;
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const at = (i: number) => pts[((i % n) + n) % n];
  const m0 = mid(at(from - 1), at(from));
  let d = `M${f(m0[0])} ${f(m0[1])}`;
  for (let i = from; i < from + len; i++) {
    const m = mid(at(i), at(i + 1));
    d += `Q${f(at(i)[0])} ${f(at(i)[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `<path d="${d}"/>`;
}

/** The form shading the house style gives every rounded thing: a darker
 *  crescent on the lower right, a pale glaze on the upper left. */
function shading(cx: number, cy: number, rx: number, ry: number, P: Palette, dark = 0.24): string {
  const c = Math.SQRT1_2;
  const p1 = [cx + rx * c, cy - ry * c];
  const p2 = [cx - rx * c, cy + ry * c];
  const t = 0.3;
  const q1 = [p1[0] - t * rx, p1[1] - t * ry];
  const q2 = [p2[0] - t * rx, p2[1] - t * ry];
  return (
    `<path d="M${f(p1[0])} ${f(p1[1])}A${f(rx)} ${f(ry)} 0 0 1 ${f(p2[0])} ${f(p2[1])}L${f(q2[0])} ${f(q2[1])}A${f(rx)} ${f(ry)} 0 0 0 ${f(q1[0])} ${f(q1[1])}Z" fill="${P.shadow}" opacity="${dark}"/>` +
    `<ellipse cx="${f(cx - rx * 0.35)}" cy="${f(cy - ry * 0.4)}" rx="${f(rx * 0.32)}" ry="${f(ry * 0.22)}" fill="#FFF8E8" opacity="0.3"/>`
  );
}

const groundShadow = (w: number, P: Palette, dx = 6) => `<ellipse cx="${f(dx)}" cy="1" rx="${f(w)}" ry="${f(Math.max(2, w * 0.12))}" fill="${P.shadow}" opacity="0.16"/>`;
/** n short parallel pen strokes, for shade under things. */
const hatch = (x: number, y: number, n: number, gap: number, dx: number, dy: number) => `<path d="${Array.from({ length: n }, (_, i) => `M${f(x + i * gap)} ${f(y)}l${dx} ${dy}`).join("")}" stroke-width="0.8"/>`;

// ------------------------------------------------------------------ trees

function tree(r: R, P: Palette, kind: "oak" | "apple" | "birch"): Piece {
  const h = kind === "birch" ? between(r, 130, 160) : kind === "apple" ? between(r, 100, 125) : between(r, 125, 150);
  const crownR = kind === "birch" ? h * 0.24 : kind === "apple" ? h * 0.36 : h * 0.34;
  const crownY = -h + crownR * (kind === "birch" ? 1.3 : 1.05);
  const lean = between(r, -6, 6);
  const tw = kind === "birch" ? between(r, 5, 7) : between(r, 8, 12);
  const trunkTop = crownY + crownR * 0.4;
  const trunk = `M${f(-tw)} 0C${f(-tw * 0.6)} ${f(trunkTop * 0.5)} ${f(lean - tw * 0.5)} ${f(trunkTop * 0.8)} ${f(lean - tw * 0.4)} ${f(trunkTop)}L${f(lean + tw * 0.4)} ${f(trunkTop)}C${f(lean + tw * 0.5)} ${f(trunkTop * 0.8)} ${f(tw * 0.6)} ${f(trunkTop * 0.5)} ${f(tw)} 0Z`;
  const trunkFill = kind === "birch" ? P.stem : P.trunk;
  const crown = lumpy(r, lean, crownY, crownR * between(r, 0.95, 1.12), crownR * (kind === "birch" ? 1.5 : between(r, 0.85, 1)), kind === "birch" ? 9 : 11, 0.28);
  const inner = lumpy(r, lean - crownR * 0.25, crownY - crownR * 0.2, crownR * 0.55, crownR * 0.45, 8, 0.3);
  const branch = r() < 0.5 ? -1 : 1;
  const paint = [
    groundShadow(crownR * 0.9, P),
    `<path d="${trunk}" fill="${trunkFill}"/>`,
    `<path d="M${f(lean)} ${f(trunkTop * 0.7)}Q${f(lean + branch * crownR * 0.35)} ${f(trunkTop * 0.9)} ${f(lean + branch * crownR * 0.55)} ${f(crownY + crownR * 0.3)}" stroke="${trunkFill}" stroke-width="${f(tw * 0.5)}" fill="none"/>`,
    `<path d="${crown.d}" fill="${P.leaf}"/>`,
    `<path d="${inner.d}" fill="${P.leafLight}" opacity="0.55"/>`,
    shading(lean, crownY, crownR, crownR * (kind === "birch" ? 1.4 : 0.95), P),
  ];
  if (kind === "apple") {
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * crownR * 0.75;
      paint.push(`<circle cx="${f(lean + Math.cos(a) * d)}" cy="${f(crownY + Math.sin(a) * d * 0.8)}" r="${f(between(r, 2.6, 3.6))}" fill="${P.bloom1}"/>`);
    }
  }
  const ink = [
    brokenLine(crown.pts, Math.floor(r() * 3), Math.floor(crown.pts.length * 0.55)),
    brokenLine(crown.pts, Math.floor(crown.pts.length * 0.7), 2),
    `<path d="M${f(-tw)} 0C${f(-tw * 0.6)} ${f(trunkTop * 0.5)} ${f(lean - tw * 0.5)} ${f(trunkTop * 0.8)} ${f(lean - tw * 0.4)} ${f(trunkTop)}"/>`,
    `<path d="M${f(tw)} 0C${f(tw * 0.6)} ${f(trunkTop * 0.5)} ${f(lean + tw * 0.5)} ${f(trunkTop * 0.8)} ${f(lean + tw * 0.4)} ${f(trunkTop * 0.9)}"/>`,
    kind === "birch"
      ? Array.from({ length: 4 }, (_, i) => `<path d="M${f(-tw * 0.7)} ${f(-18 - i * 17)}l${f(tw * 0.8)} -2" stroke-width="1.6"/>`).join("")
      : `<path d="M${f(-2)} ${f(-14)}c2 -6 1 -12 -1 -18M${f(3)} ${f(-30)}c-1 -4 0 -8 2 -10" stroke-width="0.8"/>`,
    hatch(tw + 2, -2, 5, 3.5, 3, -5),
  ];
  return { paint: paint.join(""), ink: ink.join(""), detail: "" };
}

function pine(r: R, P: Palette): Piece {
  const h = between(r, 120, 160);
  const w = h * between(r, 0.3, 0.36);
  const tiers = 4;
  const paint = [groundShadow(w * 0.7, P), `<path d="M-4 0L-3 ${f(-h * 0.2)}L3 ${f(-h * 0.2)}L4 0Z" fill="${P.trunk}"/>`];
  const ink: string[] = [];
  for (let i = 0; i < tiers; i++) {
    const top = -h + (i * h * 0.75) / tiers;
    const bot = top + h * 0.38;
    const tw = w * (0.45 + (i / tiers) * 0.6) * between(r, 0.92, 1.08);
    const d = `M0 ${f(top)}C${f(-tw * 0.3)} ${f(top + (bot - top) * 0.5)} ${f(-tw * 0.8)} ${f(bot - 4)} ${f(-tw)} ${f(bot)}Q0 ${f(bot - 6)} ${f(tw)} ${f(bot)}C${f(tw * 0.8)} ${f(bot - 4)} ${f(tw * 0.3)} ${f(top + (bot - top) * 0.5)} 0 ${f(top)}Z`;
    paint.push(`<path d="${d}" fill="${i % 2 ? P.leafDark : P.leaf}"/>`);
    paint.push(`<path d="M0 ${f(top + 4)}C${f(tw * 0.25)} ${f(top + (bot - top) * 0.5)} ${f(tw * 0.65)} ${f(bot - 4)} ${f(tw)} ${f(bot)}Q${f(tw * 0.4)} ${f(bot - 4)} 0 ${f(bot - 2)}Z" fill="${P.shadow}" opacity="0.2"/>`);
    ink.push(`<path d="M${f(-tw)} ${f(bot)}Q0 ${f(bot - 6)} ${f(tw * 0.7)} ${f(bot - 1)}"/>`);
  }
  ink.push(`<path d="M0 ${f(-h)}C${f(-w * 0.15)} ${f(-h * 0.85)} ${f(-w * 0.4)} ${f(-h * 0.65)} ${f(-w * 0.55)} ${f(-h * 0.55)}"/>`, hatch(5, -2, 4, 3.5, 3, -5));
  return { paint: paint.join(""), ink: ink.join(""), detail: "" };
}

function bush(r: R, P: Palette): Piece {
  const w = between(r, 26, 38);
  const h = w * between(r, 0.6, 0.8);
  const body = lumpy(r, 0, -h * 0.6, w, h * 0.65, 9, 0.3, true);
  const paint = [groundShadow(w * 0.9, P), `<path d="${body.d}" fill="${P.leaf}"/>`, shading(0, -h * 0.6, w, h * 0.6, P)];
  const flowers = r() < 0.5;
  if (flowers) for (let i = 0; i < 5; i++) paint.push(`<circle cx="${f(between(r, -w * 0.7, w * 0.7))}" cy="${f(between(r, -h * 1.1, -h * 0.25))}" r="2.2" fill="${r() < 0.5 ? P.bloom1 : P.bloom2}"/>`);
  return { paint: paint.join(""), ink: brokenLine(body.pts, Math.floor(r() * 3), 5) + hatch(w * 0.3, -2, 4, 3, 3, -4), detail: "" };
}

// ------------------------------------------------------------------ small things on the ground

function tuft(r: R, P: Palette): Piece {
  const n = 4 + Math.floor(r() * 3);
  const blades: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - n / 2) * between(r, 2.5, 3.5);
    const lean = between(r, -6, 6);
    const tall = between(r, 8, 15);
    blades.push(`M${f(x)} 0q${f(lean * 0.3)} ${f(-tall * 0.6)} ${f(lean)} ${f(-tall)}`);
  }
  return { paint: `<ellipse cx="0" cy="-2" rx="${f(n * 2)}" ry="3" fill="${P.grass}" opacity="0.7"/>`, ink: `<path d="${blades.join("")}" stroke="${P.grassDark}"/>`, detail: "" };
}

function flowers(r: R, P: Palette): Piece {
  const n = 3 + Math.floor(r() * 3);
  const paint: string[] = [];
  const ink: string[] = [];
  const colour = [P.bloom1, P.bloom2, P.bloom3][Math.floor(r() * 3)];
  for (let i = 0; i < n; i++) {
    const x = between(r, -9, 9);
    const top = -between(r, 9, 17);
    ink.push(`<path d="M${f(x * 0.4)} 0Q${f(x * 0.6)} ${f(top * 0.5)} ${f(x)} ${f(top)}" stroke="${P.grassDark}"/>`);
    paint.push(`<circle cx="${f(x)}" cy="${f(top)}" r="${f(between(r, 2.4, 3.4))}" fill="${colour}"/>`, `<circle cx="${f(x)}" cy="${f(top)}" r="1" fill="${P.bloomCentre}"/>`);
  }
  return { paint: paint.join(""), ink: ink.join(""), detail: "" };
}

function stone(r: R, P: Palette): Piece {
  const w = between(r, 8, 16);
  const body = lumpy(r, 0, -w * 0.4, w, w * 0.5, 7, 0.22, true);
  return {
    paint: groundShadow(w, P, 3) + `<path d="${body.d}" fill="${P.stone}"/>` + shading(0, -w * 0.4, w, w * 0.45, P, 0.3),
    ink: brokenLine(body.pts, Math.floor(r() * 3), 4) + `<path d="M${f(-w * 0.2)} ${f(-w * 0.6)}l${f(w * 0.25)} ${f(w * 0.25)}" stroke-width="0.8"/>`,
    detail: "",
  };
}

function mushroom(r: R, P: Palette): Piece {
  const s = between(r, 0.85, 1.2);
  const cap = `M${f(-9 * s)} ${f(-9 * s)}C${f(-9 * s)} ${f(-19 * s)} ${f(9 * s)} ${f(-19 * s)} ${f(9 * s)} ${f(-9 * s)}Z`;
  return {
    paint: `<path d="M${f(-2.5 * s)} 0L${f(-2 * s)} ${f(-9 * s)}L${f(2 * s)} ${f(-9 * s)}L${f(2.5 * s)} 0Z" fill="${P.stem}"/><path d="${cap}" fill="${P.cap}"/><circle cx="${f(-3 * s)}" cy="${f(-13 * s)}" r="${f(1.4 * s)}" fill="#F4EFE4"/><circle cx="${f(3 * s)}" cy="${f(-12 * s)}" r="${f(1.1 * s)}" fill="#F4EFE4"/>`,
    ink: `<path d="${cap.slice(0, -1)}"/><path d="M${f(-2.5 * s)} 0L${f(-2 * s)} ${f(-9 * s)}" stroke-width="0.9"/>`,
    detail: "",
  };
}

function fence(r: R, P: Palette): Piece {
  const posts = 3 + Math.floor(r() * 2);
  const gap = between(r, 18, 22);
  const w = gap * (posts - 1);
  const paint: string[] = [`<rect x="${f(-w / 2)}" y="-30" width="${f(w)}" height="4" fill="${P.wood}"/>`, `<rect x="${f(-w / 2)}" y="-16" width="${f(w)}" height="4" fill="${P.wood}"/>`];
  const ink: string[] = [`<path d="M${f(-w / 2)} -30h${f(w)}M${f(-w / 2)} -16h${f(w)}"/>`];
  for (let i = 0; i < posts; i++) {
    const x = -w / 2 + i * gap + between(r, -1.5, 1.5);
    const top = -between(r, 36, 42);
    paint.push(`<path d="M${f(x - 3)} 0L${f(x - 3)} ${f(top + 3)}L${f(x)} ${f(top)}L${f(x + 3)} ${f(top + 3)}L${f(x + 3)} 0Z" fill="${P.woodDark}"/>`);
    ink.push(`<path d="M${f(x - 3)} 0L${f(x - 3)} ${f(top + 3)}L${f(x)} ${f(top)}L${f(x + 3)} ${f(top + 3)}"/>`);
  }
  return { paint: paint.join(""), ink: ink.join(""), detail: "" };
}

function puddle(r: R, P: Palette): Piece {
  const w = between(r, 28, 40);
  const body = lumpy(r, 0, 0, w, w * 0.18, 8, 0.2);
  return {
    paint: `<path d="${body.d}" fill="${P.water}"/><ellipse cx="${f(w * 0.2)}" cy="-1" rx="${f(w * 0.35)}" ry="1.6" fill="${P.waterLight}"/>`,
    ink: `<path d="M${f(-w * 0.6)} ${f(w * 0.12)}q${f(w * 0.3)} 3 ${f(w * 0.6)} 0" stroke-width="0.9"/>`,
    detail: "",
  };
}

function leaf(r: R, P: Palette): Piece {
  const a = between(r, -60, 60);
  const c = [P.leaf, P.leafDark, P.leafLight, P.bloom2][Math.floor(r() * 4)];
  return { paint: `<ellipse cx="0" cy="-3" rx="5" ry="2.4" transform="rotate(${f(a)} 0 -3)" fill="${c}"/>`, ink: `<path d="M-4 -3l8 0" transform="rotate(${f(a)} 0 -3)" stroke-width="0.6"/>`, detail: "" };
}

function butterfly(r: R, P: Palette): Piece {
  const c = r() < 0.5 ? P.wing1 : P.wing2;
  const tilt = between(r, -20, 20);
  return {
    paint: `<g transform="rotate(${f(tilt)})"><ellipse cx="-4" cy="-3" rx="4.5" ry="3.4" fill="${c}"/><ellipse cx="4" cy="-3" rx="4.5" ry="3.4" fill="${c}"/><ellipse cx="-3" cy="2" rx="3" ry="2.4" fill="${c}" opacity="0.8"/><ellipse cx="3" cy="2" rx="3" ry="2.4" fill="${c}" opacity="0.8"/></g>`,
    ink: `<path d="M0 -5l0 9M0 -5l-2 -3M0 -5l2 -3" transform="rotate(${f(tilt)})" stroke-width="0.8"/>`,
    detail: "",
  };
}

// ------------------------------------------------------------------ the sky

function cloud(r: R, P: Palette): Piece {
  const w = between(r, 34, 52);
  const h = w * between(r, 0.35, 0.48);
  const body = lumpy(r, 0, 0, w, h, 10, 0.32, true);
  return {
    paint: `<path d="${body.d}" fill="${P.cloud}"/><ellipse cx="${f(w * 0.1)}" cy="${f(h * 0.35)}" rx="${f(w * 0.75)}" ry="${f(h * 0.3)}" fill="${P.cloudShade}" opacity="0.6"/>`,
    ink: brokenLine(body.pts, Math.floor(r() * 3), 4),
    detail: "",
  };
}

function bird(r: R): Piece {
  const w = between(r, 4, 7);
  return { paint: "", ink: `<path d="M${f(-w)} 0q${f(w * 0.5)} ${f(-w * 0.6)} ${f(w)} 0q${f(w * 0.5)} ${f(-w * 0.6)} ${f(w)} 0" stroke-width="1"/>`, detail: "" };
}

function sun(_r: R, P: Palette): Piece {
  return { paint: `<circle r="20" fill="${P.sun}" opacity="0.85"/><circle r="30" fill="${P.sun}" opacity="0.18"/>`, ink: "", detail: "" };
}

function moon(r: R, P: Palette): Piece {
  const crescent = r() < 0.5;
  return {
    paint: crescent ? `<path d="M3 -18A18 18 0 0 0 3 18A11 18 0 0 1 3 -18Z" fill="${P.moon}"/>` : `<circle r="17" fill="${P.moon}"/><circle cx="-5" cy="-4" r="3" fill="${P.shadow}" opacity="0.08"/><circle cx="5" cy="5" r="2" fill="${P.shadow}" opacity="0.08"/>`,
    ink: "",
    detail: `<circle r="28" fill="${P.moon}" opacity="0.12"/>`,
  };
}

// ------------------------------------------------------------------ indoors

function windowPiece(r: R, P: Palette): Piece {
  const w = between(r, 70, 90);
  const h = w * between(r, 0.95, 1.15);
  const curtains = r() < 0.7;
  const c = r() < 0.5 ? P.fabric1 : P.fabric2;
  const paint = [`<rect x="${f(-w / 2)}" y="${f(-h)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${P.glass}"/>`, `<rect x="${f(-w / 2 - 6)}" y="-4" width="${f(w + 12)}" height="6" fill="${P.wood}"/>`];
  if (curtains)
    paint.push(
      `<path d="M${f(-w / 2 - 12)} ${f(-h - 8)}C${f(-w / 2 - 2)} ${f(-h * 0.5)} ${f(-w / 2 - 6)} ${f(-h * 0.2)} ${f(-w / 2 - 10)} 0L${f(-w / 2 + 6)} 0C${f(-w / 2 + 8)} ${f(-h * 0.3)} ${f(-w / 2 + 10)} ${f(-h * 0.7)} ${f(-w / 2 + 4)} ${f(-h - 8)}Z" fill="${c}" opacity="0.85"/>`,
      `<path d="M${f(w / 2 + 12)} ${f(-h - 8)}C${f(w / 2 + 2)} ${f(-h * 0.5)} ${f(w / 2 + 6)} ${f(-h * 0.2)} ${f(w / 2 + 10)} 0L${f(w / 2 - 6)} 0C${f(w / 2 - 8)} ${f(-h * 0.3)} ${f(w / 2 - 10)} ${f(-h * 0.7)} ${f(w / 2 - 4)} ${f(-h - 8)}Z" fill="${c}" opacity="0.85"/>`,
    );
  return {
    paint: paint.join(""),
    ink: `<rect x="${f(-w / 2)}" y="${f(-h)}" width="${f(w)}" height="${f(h)}" rx="3"/><path d="M0 ${f(-h)}V0M${f(-w / 2)} ${f(-h / 2)}H${f(w / 2)}"/>`,
    detail: "",
  };
}

function door(r: R, P: Palette): Piece {
  const w = between(r, 48, 58);
  const h = w * 2.3;
  const c = [P.fabric2, P.woodDark, P.fabric1][Math.floor(r() * 3)];
  return {
    paint: `<path d="M${f(-w / 2)} 0V${f(-h + w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(w / 2)} ${f(-h + w / 2)}V0Z" fill="${c}"/>${shading(0, -h / 2, w / 2, h / 2, P, 0.18)}`,
    ink: `<path d="M${f(-w / 2)} 0V${f(-h + w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(w / 2)} ${f(-h + w / 2)}V0"/><path d="M${f(-w / 2 + 8)} ${f(-h * 0.15)}V${f(-h * 0.45)}M${f(w / 2 - 8)} ${f(-h * 0.15)}V${f(-h * 0.45)}" stroke-width="0.8"/>`,
    detail: `<circle cx="${f(w / 2 - 9)}" cy="${f(-h * 0.45)}" r="2.6" fill="${P.sun}"/>`,
  };
}

function rug(r: R, P: Palette): Piece {
  const w = between(r, 60, 80);
  const c = r() < 0.5 ? P.fabric1 : P.fabric2;
  return {
    paint: `<ellipse cx="0" cy="0" rx="${f(w)}" ry="${f(w * 0.16)}" fill="${c}" opacity="0.8"/><ellipse cx="0" cy="0" rx="${f(w * 0.7)}" ry="${f(w * 0.1)}" fill="${P.wall}" opacity="0.45"/>`,
    ink: `<path d="M${f(-w)} 0q0 ${f(w * 0.16)} ${f(w)} ${f(w * 0.16)}"/>`,
    detail: "",
  };
}

function lamp(r: R, P: Palette): Piece {
  const h = between(r, 60, 80);
  return {
    paint: `<ellipse cx="0" cy="${f(-h + 14)}" rx="34" ry="30" fill="${P.lampGlow}" opacity="0.22"/><path d="M-3 0L-2 ${f(-h + 20)}L2 ${f(-h + 20)}L3 0Z" fill="${P.woodDark}"/><ellipse cx="0" cy="0" rx="10" ry="3" fill="${P.woodDark}"/><path d="M-14 ${f(-h + 22)}L-9 ${f(-h)}L9 ${f(-h)}L14 ${f(-h + 22)}Z" fill="${P.fabric1}"/>`,
    ink: `<path d="M-14 ${f(-h + 22)}L-9 ${f(-h)}L9 ${f(-h)}L14 ${f(-h + 22)}Z"/><path d="M-2 0L-2 ${f(-h + 22)}" stroke-width="0.8"/>`,
    detail: "",
  };
}

function shelf(r: R, P: Palette): Piece {
  const w = between(r, 50, 70);
  const books: string[] = [];
  let x = -w / 2 + 3;
  while (x < w / 2 - 8) {
    const bw = between(r, 4, 7);
    const bh = between(r, 12, 18);
    books.push(`<rect x="${f(x)}" y="${f(-bh - 4)}" width="${f(bw)}" height="${f(bh)}" fill="${[P.fabric1, P.fabric2, P.bloom2, P.leaf][Math.floor(r() * 4)]}"/>`);
    x += bw + 1;
  }
  return { paint: books.join("") + `<rect x="${f(-w / 2)}" y="-4" width="${f(w)}" height="4" fill="${P.wood}"/>`, ink: `<path d="M${f(-w / 2)} 0h${f(w)}M${f(-w / 2)} -4h${f(w)}"/>`, detail: "" };
}

function bed(r: R, P: Palette): Piece {
  const w = between(r, 110, 130);
  const c = r() < 0.5 ? P.fabric2 : P.fabric1;
  return {
    paint: `<rect x="${f(-w / 2)}" y="-46" width="8" height="46" fill="${P.woodDark}"/><rect x="${f(w / 2 - 8)}" y="-34" width="8" height="34" fill="${P.woodDark}"/><rect x="${f(-w / 2 + 6)}" y="-30" width="${f(w - 12)}" height="18" fill="${P.wood}"/><path d="M${f(-w / 2 + 6)} -30C${f(-w / 4)} -44 ${f(w / 4)} -42 ${f(w / 2 - 6)} -32L${f(w / 2 - 6)} -14L${f(-w / 2 + 6)} -14Z" fill="${c}"/><ellipse cx="${f(-w / 2 + 24)}" cy="-36" rx="16" ry="8" fill="#F4EFE4"/>`,
    ink: `<path d="M${f(-w / 2 + 6)} -30C${f(-w / 4)} -44 ${f(w / 4)} -42 ${f(w / 2 - 6)} -32M${f(-w / 2)} -46V0M${f(w / 2)} -34V0"/>`,
    detail: "",
  };
}

function table(r: R, P: Palette): Piece {
  const w = between(r, 80, 100);
  const cloth = r() < 0.5;
  return {
    paint: `<rect x="${f(-w / 2 + 6)}" y="-50" width="6" height="50" fill="${P.woodDark}"/><rect x="${f(w / 2 - 12)}" y="-50" width="6" height="50" fill="${P.woodDark}"/><rect x="${f(-w / 2)}" y="-56" width="${f(w)}" height="7" fill="${P.wood}"/>${cloth ? `<path d="M${f(-w / 2 - 2)} -56H${f(w / 2 + 2)}L${f(w / 2 - 2)} -38H${f(-w / 2 + 2)}Z" fill="${P.fabric2}" opacity="0.6"/>` : ""}`,
    ink: `<path d="M${f(-w / 2)} -56H${f(w / 2)}M${f(-w / 2 + 9)} -49V0M${f(w / 2 - 9)} -49V0"/>`,
    detail: "",
  };
}

function chair(r: R, P: Palette): Piece {
  const back = r() < 0.5 ? -1 : 1;
  return {
    paint: `<rect x="-15" y="-34" width="30" height="5" fill="${P.wood}"/><rect x="${back < 0 ? -15 : 11}" y="-70" width="4" height="70" fill="${P.woodDark}"/><rect x="${back < 0 ? 11 : -15}" y="-34" width="4" height="34" fill="${P.woodDark}"/><rect x="-15" y="-66" width="30" height="5" fill="${P.wood}"/>`,
    ink: `<path d="M-15 -34H15M${back < 0 ? -13 : 13} -70V0M${back < 0 ? 13 : -13} -34V0"/>`,
    detail: "",
  };
}

// ------------------------------------------------------------------ the list

export interface StampKind {
  /** what it is, for the painter's list */
  about: string;
  /** about how big it is at scale 1 (w x h), for the painter's list */
  size: string;
  /** where its 0,0 is */
  base: "ground" | "middle" | "wall";
  /** It has dark pen line or a dark shape: never inside the characters' space. */
  dark: boolean;
  draw: (r: R, P: Palette) => Piece;
}

export const STAMPS: Record<string, StampKind> = {
  oak: { about: "a broad leafy tree", size: "90x140", base: "ground", dark: true, draw: (r, P) => tree(r, P, "oak") },
  apple: { about: "a small apple tree with red apples", size: "85x115", base: "ground", dark: true, draw: (r, P) => tree(r, P, "apple") },
  birch: { about: "a slim pale-trunked tree", size: "70x150", base: "ground", dark: true, draw: (r, P) => tree(r, P, "birch") },
  pine: { about: "a tall pointed fir", size: "100x140", base: "ground", dark: true, draw: pine },
  bush: { about: "a round bush, sometimes flowering", size: "64x30", base: "ground", dark: true, draw: bush },
  tuft: { about: "a little tuft of grass", size: "16x14", base: "ground", dark: false, draw: tuft },
  flowers: { about: "a few wild flowers on stalks", size: "20x16", base: "ground", dark: false, draw: flowers },
  stone: { about: "a rounded stone", size: "24x10", base: "ground", dark: true, draw: stone },
  mushroom: { about: "a red-capped toadstool", size: "18x16", base: "ground", dark: false, draw: mushroom },
  fence: { about: "a short run of wooden fence", size: "60x40", base: "ground", dark: true, draw: fence },
  puddle: { about: "a shallow puddle", size: "70x12", base: "ground", dark: false, draw: puddle },
  leaf: { about: "one fallen or drifting leaf", size: "10x6", base: "middle", dark: false, draw: leaf },
  butterfly: { about: "a small butterfly", size: "18x14", base: "middle", dark: false, draw: butterfly },
  cloud: { about: "a soft cloud", size: "90x36", base: "middle", dark: false, draw: cloud },
  bird: { about: "a distant bird (a tiny 'v')", size: "12x4", base: "middle", dark: false, draw: (r) => bird(r) },
  sun: { about: "the sun, with a soft halo", size: "60x60", base: "middle", dark: false, draw: sun },
  moon: { about: "the moon, full or crescent", size: "36x36", base: "middle", dark: false, draw: moon },
  window: { about: "a window with curtains (indoors)", size: "90x90", base: "wall", dark: true, draw: windowPiece },
  door: { about: "a round-topped door", size: "55x125", base: "ground", dark: true, draw: door },
  rug: { about: "an oval rug on the floor", size: "140x22", base: "ground", dark: false, draw: rug },
  lamp: { about: "a standing lamp with a warm glow", size: "30x70", base: "ground", dark: true, draw: lamp },
  shelf: { about: "a wall shelf of books", size: "60x22", base: "wall", dark: true, draw: shelf },
  bed: { about: "a little bed with a quilt", size: "120x46", base: "ground", dark: true, draw: bed },
  table: { about: "a wooden table", size: "90x56", base: "ground", dark: true, draw: table },
  chair: { about: "a wooden chair", size: "30x70", base: "ground", dark: true, draw: chair },
};

// ------------------------------------------------------------------ scatter

export interface ScatterKind {
  about: string;
  /** which layer each mark goes in */
  draw: (r: R, P: Palette, box: { x: number; y: number; w: number; h: number }, n: number) => Piece;
}

const inBox = (r: R, b: { x: number; y: number; w: number; h: number }) => [b.x + r() * b.w, b.y + r() * b.h] as const;

export const SCATTER: Record<string, ScatterKind> = {
  grass: {
    about: "grass tufts across a stretch of ground",
    draw: (r, P, b, n) => {
      let ink = "";
      let paint = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        const t = tuft(r, P);
        paint += `<g transform="translate(${f(x)} ${f(y)})">${t.paint}</g>`;
        ink += `<g transform="translate(${f(x)} ${f(y)})">${t.ink}</g>`;
      }
      return { paint, ink, detail: "" };
    },
  },
  flowers: {
    about: "wild flowers dotted over a meadow",
    draw: (r, P, b, n) => {
      let paint = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        paint += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(between(r, 2, 3.2))}" fill="${[P.bloom1, P.bloom2, P.bloom3][Math.floor(r() * 3)]}"/>`;
      }
      return { paint, ink: "", detail: "" };
    },
  },
  leaves: {
    about: "fallen or drifting leaves",
    draw: (r, P, b, n) => {
      let paint = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        paint += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.5" ry="2.2" transform="rotate(${f(between(r, -70, 70))} ${f(x)} ${f(y)})" fill="${[P.leaf, P.leafDark, P.leafLight, P.bloom2][Math.floor(r() * 4)]}"/>`;
      }
      return { paint, ink: "", detail: "" };
    },
  },
  pebbles: {
    about: "small stones on a path or shore",
    draw: (r, P, b, n) => {
      let paint = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        paint += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(between(r, 2, 4.5))}" ry="${f(between(r, 1.4, 2.4))}" fill="${r() < 0.5 ? P.stone : P.stoneDark}"/>`;
      }
      return { paint, ink: "", detail: "" };
    },
  },
  rain: {
    about: "falling rain",
    draw: (r, P, b, n) => {
      let d = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        d += `M${f(x)} ${f(y)}l-3 ${f(between(r, 8, 13))}`;
      }
      return { paint: "", ink: `<path d="${d}" stroke="${P.water}" stroke-width="0.9"/>`, detail: "" };
    },
  },
  snow: {
    about: "falling snowflakes",
    draw: (r, P, b, n) => {
      let paint = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        paint += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(between(r, 1.2, 2.6))}" fill="${P.snow}"/>`;
      }
      return { paint, ink: "", detail: "" };
    },
  },
  stars: {
    about: "stars in a night sky",
    draw: (r, P, b, n) => {
      let detail = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        detail += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(between(r, 0.8, 1.9))}" fill="${P.star}"/>`;
      }
      return { paint: "", ink: "", detail };
    },
  },
  hatch: {
    about: "short pen hatching for shade (under trees and furniture)",
    draw: (r, P, b, n) => {
      let ink = "";
      for (let i = 0; i < n; i++) {
        const [x, y] = inBox(r, b);
        ink += hatch(x, y, 4 + Math.floor(r() * 3), 3.5, 3, -5);
      }
      return { paint: "", ink, detail: "" };
    },
  },
};

/** The list the painters are given: what can be placed, by name. */
export function stampCatalogue(): string {
  const s = Object.entries(STAMPS)
    .map(([k, v]) => `${k} (${v.about}; about ${v.size} at s="1"; ${v.base === "ground" ? "x,y = where it stands" : v.base === "wall" ? "x,y = the middle of its bottom edge" : "x,y = its middle"})`)
    .join("\n  ");
  const c = Object.entries(SCATTER)
    .map(([k, v]) => `${k} (${v.about})`)
    .join(", ");
  return `  ${s}\nSCATTER kinds: ${c}`;
}
