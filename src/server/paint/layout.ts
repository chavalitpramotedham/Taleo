import { STAMPS } from "@/lib/art/stamps";
import { EFFECTS, PROPS } from "@/lib/art/stamps-more";
import { SIT_FEET } from "@/lib/art/poses";

/**
 * The layout pass for a composed page (ways 4 and 5): the composer's tags
 * are read whole (they're short) and its placement of the characters
 * checked before anything is drawn, so that:
 * - nobody stands on top of anybody else: two characters overlapping more
 *   than a touch are eased apart (characters who are interacting - the
 *   main action's doer and its target, or anyone holding, hugging or
 *   reaching - may overlap a hand's width);
 * - the main action's target is never hidden: any character drawn over it
 *   is drawn before it instead;
 * - characters at either end of a group face into it, unless they're on
 *   the move (running, walking, flying, jumping);
 * - everybody stays inside the picture.
 * Each change is noted, for the activity log. Standard pieces and drawn
 * shapes are left exactly where the composer put them (a tree hiding a
 * character is meant to be in front of it).
 */

export interface LayoutOptions {
  /** the main action's target, if it's a character on the page */
  targetId?: string | null;
  /** the usual size of a grown character on this page (sizingFor().s) */
  usualS?: number;
  /** characters that are groups (three mice in one tag): wide, not giants */
  groups?: string[];
  /** the page's words, picture brief and place, for what belongs there */
  said?: string;
  /** who rides on whom, and where: [rider, carrier, shoulder|head|back] */
  perched?: [string, string, "shoulder" | "head" | "back"][];
  /** each character's size against a grown one (1; a squirrel 0.67; a
   *  ladybird 0.1): sizes on the page are kept to usualS times this */
  sizeOf?: Record<string, number>;
  /** the page's tap target when it's a thing, not a character ("kite",
   *  "the pumpkin"): made sure of (lesson 16) */
  targetThing?: string | null;
  /** who is in bed, from the brief ("tucked into bed"), if anyone */
  inBed?: string | null;
  /** who hugs whom, from the brief (two ids), if it says so */
  huggers?: [string, string] | null;
  /** the hero's id: never hidden behind anyone (lesson 17) */
  heroId?: string | null;
}

/** The biggest a character standing with its feet at y can be and keep its
 *  face in the picture (it stands about 170*s tall). */
const fitS = (y: number) => Math.max(0.3, (y - 18) / 170);

/** Each character once: the composer sometimes writes a character's tag
 *  two or three times (a giant drawn three times over). A group (the
 *  Sea-Larks) is one character too: its one tag draws all of them. */
function oncePerCharacter(markup: string, opts: LayoutOptions, notes: string[]): string {
  const seen = new Set<string>();

  const drop: { at: number; len: number; id: string }[] = [];
  for (const m of markup.matchAll(CHAR_TAG)) {
    if (!m[0].trim().endsWith("/>")) continue;
    const id = attr(m[0], "c") ?? attr(m[0], "id") ?? "";
    if (!id) continue;
    if (seen.has(id)) drop.push({ at: m.index!, len: m[0].length, id });
    seen.add(id);
  }
  CHAR_TAG.lastIndex = 0;
  let out = markup;
  for (const d of drop.sort((a, b) => b.at - a.at)) {
    // (and the target group it was wrapped in, if that's all it held)
    const before = out.slice(0, d.at);
    const after = out.slice(d.at + d.len);
    const wrapped = /<g\s+class="target"\s*>\s*$/.exec(before);
    if (wrapped && /^\s*<\/g>/.test(after)) out = before.slice(0, wrapped.index) + after.replace(/^\s*<\/g>/, "");
    else out = before + after;
  }
  if (drop.length) notes.push(`drawn once each: a second ${[...new Set(drop.map((d) => d.id))].join(", ")} left out`);
  return out;
}

/** Whether two characters stand at truly different depths: the further
 *  one is both higher up the page AND clearly smaller (perspective). Only
 *  then may they overlap; otherwise they're side by side and must not. */
export const apartInDepth = (a: { y: number; s: number }, b: { y: number; s: number }) => {
  const [far, near] = a.y < b.y ? [a, b] : [b, a];
  return near.y - far.y > 40 && far.s < near.s * 0.8;
};

interface Placed {
  /** where the tag sits in the markup */
  start: number;
  end: number;
  tag: string;
  id: string;
  x: number;
  y: number;
  s: number;
  flip: boolean;
  moving: boolean;
  touching: boolean;
  /** whether it can face either way (a front view can't) */
  turns: boolean;
}

const CHAR_TAG = /<\s*(sprite|fig|npc)\b[^>]*\/?>/gi;
const attr = (tag: string, k: string) => tag.match(new RegExp(`\\b${k}\\s*=\\s*"([^"]*)"`, "i"))?.[1];
const setAttr = (tag: string, k: string, v: string) =>
  new RegExp(`\\b${k}\\s*=\\s*"[^"]*"`, "i").test(tag) ? tag.replace(new RegExp(`\\b${k}\\s*=\\s*"[^"]*"`, "i"), `${k}="${v}"`) : tag.replace(/\s*\/?>$/, (end) => ` ${k}="${v}"${end}`);

/** A character's width on the page at scale s: most of a 200-wide canvas
 *  is air around it, so about 110 of it is body. */
const widthAt = (s: number) => 110 * s;

/** A piece's or drawing's extent on the page, roughly: from its shapes'
 *  own numbers (circles, ellipses, rects, polygons, absolute paths). */
function extentOf(markup: string): { x0: number; x1: number; y0: number; y1: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const num = (t: string, k: string) => {
    const v = Number(attr(t, k));
    return Number.isFinite(v) ? v : null;
  };
  for (const m of markup.matchAll(/<(circle|ellipse|rect|polygon|polyline|path|line)\b[^>]*>/gi)) {
    const t = m[0];
    if (/transform\s*=/.test(t)) continue;
    const kind = m[1].toLowerCase();
    if (kind === "circle" || kind === "ellipse") {
      const cx = num(t, "cx"), cy = num(t, "cy");
      const rx = num(t, kind === "circle" ? "r" : "rx") ?? 0, ry = num(t, kind === "circle" ? "r" : "ry") ?? 0;
      if (cx !== null && cy !== null) xs.push(cx - rx, cx + rx), ys.push(cy - ry, cy + ry);
    } else if (kind === "rect") {
      const x = num(t, "x"), y = num(t, "y"), w = num(t, "width") ?? 0, h = num(t, "height") ?? 0;
      if (x !== null && y !== null) xs.push(x, x + w), ys.push(y, y + h);
    } else if (kind === "line") {
      for (const [kx, ky] of [["x1", "y1"], ["x2", "y2"]]) {
        const x = num(t, kx), y = num(t, ky);
        if (x !== null && y !== null) xs.push(x), ys.push(y);
      }
    } else {
      const d = attr(t, kind === "path" ? "d" : "points") ?? "";
      // (only absolute paths: relative moves can't be read without walking)
      if (kind === "path" && /[a-y]/.test(d.replace(/e-?\d/gi, ""))) continue;
      const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      for (let i = 0; i + 1 < n.length; i += 2) xs.push(n[i]), ys.push(n[i + 1]);
    }
  }
  if (!xs.length) return null;
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** A piece's extent from its tag: its size in the library, where it stands
 *  (its base: the ground, its middle, or a wall) and its scale. */
function pieceExtent(tag: string): { x0: number; x1: number; y0: number; y1: number; small: boolean } | null {
  const k = (attr(tag, "k") ?? attr(tag, "kind") ?? "").toLowerCase();
  const kind = STAMPS[k];
  if (!kind) return null;
  const [w, h] = kind.size.split("x").map(Number);
  const sc = Number(attr(tag, "s")) || 1;
  const x = Number(attr(tag, "x")) || 200;
  const y = Number(attr(tag, "y")) || 240;
  const W = (w || 40) * sc;
  const H = (h || 40) * sc;
  const bottom = kind.base === "middle" ? y + H / 2 : y;
  // (small: something held or left about - a cup, a splash - not a thing
  // to stand beside)
  return { x0: x - W / 2, x1: x + W / 2, y0: bottom - H, y1: bottom, small: k in PROPS || k in EFFECTS || Math.max(W, H) < 46 };
}

/** One thing in the picture's order: a character (with the seat or tree
 *  it touches just before it and what it holds just after), or a thing - a
 *  big piece, or something the composer drew - with its own depth. */
interface Unit {
  text: string;
  /** its depth: a character's feet, a thing's bottom edge */
  y: number;
  s: number;
  id: string;
  thing: boolean;
  box?: { x0: number; x1: number; y0: number; y1: number };
}
type Item = { text: string; kind: "char" | "piece" | "drawn" | "other"; tag?: string };

/** The markup's top-level items, in order: character tags (with a target
 *  group around one), pieces, drawn groups, and anything else. */
export function itemsOf(markup: string): Item[] {
  const items: Item[] = [];
  let at = 0;
  const re = /<[^>]+>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    if (m.index > at) items.push({ text: markup.slice(at, m.index), kind: "other" });
    const t = m[0];
    if (/^<g[\s>]/.test(t) && !t.endsWith("/>")) {
      // (a whole group, to its own close)
      let depth = 1;
      const g = /<\/?g(?=[\s>/])[^>]*>/g;
      g.lastIndex = re.lastIndex;
      let end = markup.length;
      let n: RegExpExecArray | null;
      while ((n = g.exec(markup))) {
        if (n[0].startsWith("</")) depth--;
        else if (!n[0].endsWith("/>")) depth++;
        if (!depth) {
          end = n.index + n[0].length;
          break;
        }
      }
      const text = markup.slice(m.index, end);
      const char = text.match(CHAR_TAG);
      if (char && /class="target"/.test(t)) items.push({ text, kind: "char", tag: char[0] });
      else if (/class="target"/.test(t) && /^<g[^>]*>\s*<(stamp|scatter)\b[^>]*\/>\s*<\/g>$/i.test(text)) items.push({ text, kind: "piece", tag: text.match(/<(stamp|scatter)\b[^>]*\/>/i)![0] });
      else items.push({ text, kind: "drawn" });
      re.lastIndex = end;
      at = end;
      continue;
    }
    if (CHAR_TAG.test(t) && t.trim().endsWith("/>")) items.push({ text: t, kind: "char", tag: t });
    else if (/^<\s*(stamp|scatter)\b/i.test(t)) items.push({ text: t, kind: "piece", tag: t });
    else items.push({ text: t, kind: "other" });
    CHAR_TAG.lastIndex = 0;
    at = re.lastIndex;
  }
  if (at < markup.length) items.push({ text: markup.slice(at), kind: "other" });
  return items;
}

/** Back to front, with the things of the picture as well as its
 *  characters (lesson 10, and 14): further back first; at the same depth
 *  a thing before a character beside it (so paws on the pumpkin show),
 *  and a bigger character before a smaller one. A character standing
 *  inside a big thing is moved out to its nearer edge, just touching it.
 *  Seats and climbing trees (near="1" before a character) and covers
 *  (near="1" after one) keep the order the composer chose. */
function byDepth(markup: string, notes: string[]): string {
  const items = itemsOf(markup);
  const chars = items.filter((i) => i.kind === "char");
  if (!chars.length) return markup;
  const near = (i: Item) => i.kind === "piece" && (/\bnear\s*=\s*"(?:1|true)"/i.test(i.tag ?? "") || RIDDEN.test(attr(i.tag ?? "", "k") ?? ""));
  // Which items make up each unit, as index ranges; the rest stay put.
  const units: { from: number; to: number; unit: Unit }[] = [];
  const taken = new Set<number>();
  const charIdx = items.map((it, i) => (it.kind === "char" ? i : -1)).filter((i) => i >= 0);
  charIdx.forEach((ci, k) => {
    const tag = items[ci].tag!;
    let from = ci;
    while (from - 1 >= 0 && near(items[from - 1]) && !taken.has(from - 1)) from--;
    let to = ci;
    const nextChar = charIdx[k + 1];
    for (let j = ci + 1; j < items.length && j !== nextChar; j++) {
      const it = items[j];
      if (it.kind === "other" && !it.text.trim()) continue;
      // (a small thing drawn just after it - the feather in its hand - goes
      // with it, in front: lesson 17)
      if (it.kind === "drawn") {
        const e = extentOf(it.text);
        if (e && Math.max(e.x1 - e.x0, e.y1 - e.y0) < 70 * (Number(attr(tag, "s")) || 0.6) + 30) {
          to = j;
          continue;
        }
        break;
      }
      if (it.kind !== "piece") break;
      const ext = pieceExtent(it.tag!);
      // (a near piece closer to the next character is that one's seat)
      if (near(it) && nextChar !== undefined) {
        const px = Number(attr(it.tag!, "x"));
        if (Math.abs(px - (Number(attr(items[nextChar].tag!, "x")) || 200)) < Math.abs(px - (Number(attr(tag, "x")) || 200))) break;
      }
      // (only what it holds or leaves about, or a cover, goes with it)
      if (!near(it) && ext && !ext.small) break;
      to = j;
    }
    for (let j = from; j <= to; j++) taken.add(j);
    units.push({ from, to, unit: { text: "", y: Number(attr(tag, "y")) || 246, s: Number(attr(tag, "s")) || 0.6, id: attr(tag, "c") ?? attr(tag, "id") ?? "", thing: false } });
  });
  // things: big pieces not near anyone, and drawn shapes (runs of them)
  for (let i = 0; i < items.length; i++) {
    if (taken.has(i)) continue;
    const it = items[i];
    if (it.kind === "piece" && !near(it) && !/^<\s*scatter/i.test(it.tag ?? "")) {
      const ext = pieceExtent(it.tag!);
      if (!ext || ext.small) continue;
      taken.add(i);
      units.push({ from: i, to: i, unit: { text: "", y: ext.y1, s: 0, id: attr(it.tag!, "k") ?? "a piece", thing: true, box: ext } });
    } else if (it.kind === "drawn") {
      let to = i;
      while (to + 1 < items.length && !taken.has(to + 1) && (items[to + 1].kind === "drawn" || (items[to + 1].kind === "other" && !items[to + 1].text.trim()))) to++;
      const text = items.slice(i, to + 1).map((x) => x.text).join("");
      const ext = extentOf(text);
      for (let j = i; j <= to; j++) taken.add(j);
      // (something small drawn over a character's body - held, worn, shown -
      // is just in front of that character, wherever it was written)
      let depth = ext?.y1 ?? 0;
      if (ext) {
        const cx = (ext.x0 + ext.x1) / 2;
        const cy = (ext.y0 + ext.y1) / 2;
        const size = Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0);
        // (small against the one holding it: under 60% of its height)
        const holder = chars
          .map((c) => ({ x: Number(attr(c.tag!, "x")) || 200, y: Number(attr(c.tag!, "y")) || 246, s: Number(attr(c.tag!, "s")) || 0.6 }))
          // (at its hands: not anything over its body - a kite on the wall
          // behind a close-up was pulled in front of their faces)
          .filter((c) => size < 102 * c.s && size < 120 && Math.abs(cx - c.x) < 70 * c.s && cy < c.y - 30 * c.s && cy > c.y - 140 * c.s)
          .sort((a, b) => b.y - a.y)[0];
        if (holder) depth = holder.y + 16;
      }
      // (something drawn as big as a third of the picture or more - a snow
      // den's doorway, a wall, a sky of snow - is the setting, not a thing
      // in front: drawn behind everyone. In front, a pale one washed the
      // whole page out - part 3)
      if (ext && (Math.min(440, ext.x1) - Math.max(-40, ext.x0)) * (Math.min(330, ext.y1) - Math.max(-30, ext.y0)) > 40_000) depth = -999;
      if (ext) units.push({ from: i, to, unit: { text: "", y: depth, s: 0, id: "something drawn", thing: true, box: ext } });
      i = to;
    }
  }
  units.sort((a, b) => a.from - b.from);
  // (each unit's own text, characters moved out of big things first)
  // (only the library's big pieces push a character out: a drawn shape is
  // as often a wave, a tangle of wool or a cheese they stand at or on -
  // lesson 17: Ody was pushed out of her boat by a drawn wave)
  const things = units.filter((u) => u.unit.thing && u.unit.box && u.unit.id !== "something drawn");
  for (const u of units) {
    let text = items.slice(u.from, u.to + 1).map((x) => x.text).join("");
    if (!u.unit.thing) {
      const tag = items.find((x, j) => j >= u.from && j <= u.to && x.kind === "char")!.tag!;
      const x = Number(attr(tag, "x")) || 200;
      const half = (110 * u.unit.s) / 2;
      for (const t of things) {
        const b = t.unit.box!;
        // (standing inside a big thing at its depth: moved to its nearer
        // edge, overlapping it by a quarter of the character - touching)
        // (flat things - a rug, a puddle - are stood on, not stood beside)
        if (b.x1 - b.x0 < 60 || b.y1 - b.y0 < 30 || FLAT.test(t.unit.id) || t.unit.id in FURNITURE || u.unit.y < b.y0 + (b.y1 - b.y0) * 0.5 || u.unit.y > b.y1 + 25) continue;
        if (x <= b.x0 - half * 0.5 || x >= b.x1 + half * 0.5) continue;
        const nx = x - b.x0 < b.x1 - x ? b.x0 - half * 0.5 : b.x1 + half * 0.5;
        text = text.replace(tag, setAttr(tag, "x", String(Math.round(Math.max(20 + half, Math.min(380 - half, nx))))));
        notes.push(`${u.unit.id} was inside ${t.unit.id}: moved to its edge`);
        break;
      }
    }
    u.unit.text = text;
  }
  // the order: by depth; at the same depth (within 15) a thing first, then
  // the bigger character
  const want = [...units].sort((a, b) => {
    const dy = a.unit.y - b.unit.y;
    if (Math.abs(dy) > 15) return dy;
    if (a.unit.thing !== b.unit.thing) return a.unit.thing ? -1 : 1;
    return b.unit.s - a.unit.s || dy;
  });
  const moved = want.some((u, i) => u !== units[i]);
  const edited = units.some((u) => u.unit.text !== items.slice(u.from, u.to + 1).map((x) => x.text).join(""));
  if (!moved && !edited) return markup;
  // the k-th unit's place in the markup gets the k-th by depth
  let out = "";
  let next = 0;
  units.forEach((u, k) => {
    out += items.slice(next, u.from).map((x) => x.text).join("") + want[k].unit.text;
    next = u.to + 1;
  });
  out += items.slice(next).map((x) => x.text).join("");
  if (moved) notes.push(`drawn back to front: ${want.map((u) => u.unit.id).join(", ")}`);
  return out;
}

/** Where the main action's target is across the picture: the target
 *  character's x, or the middle of the thing in the target group. */
function targetX(markup: string, targetId: string | null | undefined, placed: { id: string; x: number }[]): number | null {
  if (targetId) {
    const p = placed.find((q) => q.id === targetId);
    if (p) return p.x;
  }
  const g = markup.match(/<g\s+class="target"\s*>([\s\S]*?)<\/g>\s*(?:<\/g>)?/);
  if (!g || CHAR_TAG.test(g[0])) {
    CHAR_TAG.lastIndex = 0;
    return null;
  }
  CHAR_TAG.lastIndex = 0;
  const piece = g[0].match(/<stamp\b[^>]*\/>/i);
  const ext = piece ? pieceExtent(piece[0]) : extentOf(g[0]);
  return ext ? (ext.x0 + ext.x1) / 2 : null;
}

/** The page's tap target is always there and marked (lesson 16): a
 *  target character's tag wrapped in the target group if the composer
 *  didn't; a target thing that's missing added from the library (between
 *  the characters, on the ground) and marked; one there but unmarked,
 *  marked. */
function ensureTarget(markup: string, opts: LayoutOptions, notes: string[]): string {
  if (/<g\s+class="target"/.test(markup)) return markup;
  if (opts.targetId) {
    const m = [...markup.matchAll(CHAR_TAG)].find((t) => (attr(t[0], "c") ?? attr(t[0], "id")) === opts.targetId && t[0].trim().endsWith("/>"));
    if (m) {
      notes.push(`${opts.targetId} marked as the tap target`);
      return markup.slice(0, m.index!) + `<g class="target">${m[0]}</g>` + markup.slice(m.index! + m[0].length);
    }
    return markup;
  }
  const word = (opts.targetThing ?? "").toLowerCase().replace(/^(the|a|an)\s+/, "").trim();
  if (!word) return markup;
  const key = stampFor(word);
  if (!key) return markup;
  const there = [...markup.matchAll(/<stamp\b[^>]*\/>/gi)].find((t) => (attr(t[0], "k") ?? "").toLowerCase() === key);
  if (there) {
    notes.push(`the ${key} marked as the tap target`);
    return markup.slice(0, there.index!) + `<g class="target">${there[0]}</g>` + markup.slice(there.index! + there[0].length);
  }
  // (not there at all: added where the characters are, on the ground)
  const xs = [...markup.matchAll(CHAR_TAG)].map((t) => Number(attr(t[0], "x"))).filter(Number.isFinite);
  const x = xs.length ? Math.round(xs.reduce((t, v) => t + v, 0) / xs.length) : 200;
  notes.push(`the ${key}, the tap target, was missing: added`);
  // (a piece that stands goes on the ground; one placed by its middle - a
  // kite, a balloon, a butterfly - up in the air, above the characters)
  const y = STAMPS[key].base === "ground" ? 248 : 120;
  return `${markup}<g class="target"><stamp k="${key}" x="${x}" y="${y}"/></g>`;
}

/** Just the size changes written in (a page with one character). */
function writeSizes(markup: string, placed: { start: number; end: number; tag: string }[]): string {
  let out = markup;
  for (const p of [...placed].sort((a, b) => b.start - a.start)) out = out.slice(0, p.start) + p.tag + out.slice(p.end);
  return out;
}

/** Furniture the characters use, and how big it is against a character
 *  at the page's usual size: a table's top at a child's waist, a bed as
 *  long as a grown-up (lesson 17 - a table at its library size was knee
 *  high and lost behind the dog). */
const FURNITURE: Record<string, number> = { table: 1.45, bed: 1.5, chair: 1.15, armchair: 1.2, cupboard: 1.2, bookshelf: 1.25, fireplace: 1.3, toybox: 1.1, door: 1.15, loom: 1.4 };
function furnitureToScale(markup: string, opts: LayoutOptions, notes: string[]): string {
  if (!opts.usualS) return markup;
  return markup.replace(/<stamp\b[^>]*\/>/gi, (tag) => {
    const k = (attr(tag, "k") ?? "").toLowerCase();
    const want = FURNITURE[k];
    if (!want) return tag;
    const s = Number(attr(tag, "s")) || 1;
    const floor = Math.round(opts.usualS! * want * 100) / 100;
    if (s >= floor * 0.85) return tag;
    notes.push(`the ${k} made to the characters' scale (s ${s} to ${floor})`);
    return setAttr(tag, "s", String(floor));
  });
}

/** Tucked in (lesson 17): a sitting character with a bed written just
 *  after it is lowered so the quilt comes up to its chest - in the bed,
 *  not standing behind it - and a second bed at the same spot (the
 *  composer sometimes writes one before and one after) is left out. */
function tuckedIn(markup: string, notes: string[]): string {
  let out = markup;
  // (the same piece of furniture twice at one spot: the later one kept)
  const pieces = [...out.matchAll(/<stamp\b[^>]*\/>/gi)].map((m) => ({ tag: m[0], k: (attr(m[0], "k") ?? "").toLowerCase(), x: Number(attr(m[0], "x")) || 0, y: Number(attr(m[0], "y")) || 0 }));
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if (a.k !== b.k || !(a.k in FURNITURE) || Math.abs(a.x - b.x) > 40 || Math.abs(a.y - b.y) > 25) continue;
      out = out.replace(a.tag, "");
      notes.push(`a second ${a.k} at the same spot left out`);
      break;
    }
  for (const m of [...out.matchAll(/(<\s*fig\b[^>]*\/>)(\s*(?:<\/g>)?\s*)(<stamp\b[^>]*\bk\s*=\s*"bed"[^>]*\/>)/gi)]) {
    const fig = m[1];
    const bed = m[3];
    if (!/\bsit\b/i.test(`${attr(fig, "legs") ?? ""} ${attr(fig, "pose") ?? ""}`)) continue;
    const bx = Number(attr(bed, "x")) || 200;
    const by = Number(attr(bed, "y")) || 250;
    const bs = Number(attr(bed, "s")) || 1;
    const s = Number(attr(fig, "s")) || 0.6;
    if (Math.abs((Number(attr(fig, "x")) || 200) - bx) > 60 * bs) continue;
    // (the quilt's top is about 40*bs above the bed's feet; a sitting
    // character's chest about 0.4 of its sitting height above its seat)
    // (seated, its hips SIT_FEET above its feet - see poses - so its
    // shoulders meet the quilt's top and its head is on the pillow)
    const y = Math.round(by - 40 * bs + 44 * s);
    out = out.replace(fig, setAttr(setAttr(fig, "y", String(y)), "bed", "1"));
    notes.push(`${attr(fig, "c") ?? "someone"} tucked into the bed`);
  }
  return out;
}

/** The last word on spacing (lesson 17): after everything else has moved
 *  people about, anyone still overlapping more than a touch is eased
 *  apart once more, and every tag is marked as laid out, so the drawing
 *  stage keeps these places rather than spacing them its own way (two
 *  spacers disagreeing had Gran pushed in front of the supper table). */
function finalSpacing(markup: string, opts: LayoutOptions, notes: string[]): string {
  type P = { tag: string; id: string; x: number; y: number; s: number; touching: boolean; ride: boolean };
  const ps: P[] = [];
  for (const m of markup.matchAll(CHAR_TAG)) {
    if (!m[0].trim().endsWith("/>")) continue;
    const t = m[0];
    const arms = `${attr(t, "arms") ?? ""} ${attr(t, "pose") ?? ""}`.toLowerCase();
    ps.push({ tag: t, id: attr(t, "c") ?? attr(t, "id") ?? "", x: Number(attr(t, "x")) || 200, y: Number(attr(t, "y")) || 246, s: Number(attr(t, "s")) || opts.usualS || 0.6, touching: /\b(hold|hug|reach|point)\b/.test(arms) || Boolean(attr(t, "hold")), ride: attr(t, "ride") === "1" });
  }
  CHAR_TAG.lastIndex = 0;
  const origTags = ps.map((p) => p.tag);
  const free = ps.filter((p) => !p.ride).sort((a, b) => a.x - b.x);
  let moved = false;
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i + 1 < free.length; i++) {
      const a = free[i], b = free[i + 1];
      // (the hero is never hidden: whoever stands next to it, unless
      // hugging it, stays clear of its body - lesson 17 - even nearer
      // the viewer, where others may cross)
      const hugging = /\bhug\b/.test(`${attr(a.tag, "arms") ?? ""} ${attr(b.tag, "arms") ?? ""}`);
      const hero = (a.id === opts.heroId || b.id === opts.heroId) && !hugging;
      // (apart in depth they may cross - but nobody is more than half hidden
      // behind another: Argos vanished behind Gran - lesson 17)
      const depth = apartInDepth(a, b) && !hero;
      if (depth && (widthAt(a.s) + widthAt(b.s)) / 2 - (b.x - a.x) < Math.min(widthAt(a.s), widthAt(b.s)) * 0.5) continue;
      const bothHug = /\bhug\b/.test(attr(a.tag, "arms") ?? "") && /\bhug\b/.test(attr(b.tag, "arms") ?? "");
      const allowed = bothHug ? 0.6 : depth ? 0.5 : hero ? 0 : a.touching || b.touching || a.id === opts.targetId || b.id === opts.targetId ? 0.28 : 0.08;
      const need = (widthAt(a.s) + widthAt(b.s)) / 2 - Math.min(widthAt(a.s), widthAt(b.s)) * allowed;
      if (b.x - a.x >= need) continue;
      const push = (need - (b.x - a.x)) / 2;
      a.x -= push;
      b.x += push;
      moved = true;
    }
  if (free.length) {
    const lo = Math.min(...free.map((p) => p.x - widthAt(p.s) / 2));
    const hi = Math.max(...free.map((p) => p.x + widthAt(p.s) / 2));
    const shift = lo < 10 ? 10 - lo : hi > 390 ? 390 - hi : 0;
    if (shift && hi - lo < 380) for (const p of free) p.x += shift;
  }
  if (moved) notes.push("spaced once more, finally");
  // (two hugging face each other, whatever moved them)
  const huggers = free.filter((p) => /\bhug\b/.test(attr(p.tag, "arms") ?? ""));
  if (huggers.length === 2) {
    const [l, r] = [...huggers].sort((a, b) => a.x - b.x);
    l.tag = setAttr(l.tag, "flip", "0");
    r.tag = setAttr(r.tag, "flip", "1");
    const gap = (widthAt(l.s) + widthAt(r.s)) / 2 * 0.44;
    if (r.x - l.x > gap + 4) {
      const mid = (l.x + r.x) / 2;
      l.x = mid - gap / 2;
      r.x = mid + gap / 2;
    }
    // (nobody caught inside the hug: Argos sat between Gran and Ody and hid
    // her - whoever overlaps the pair goes out past its nearer side)
    const left = l.x - widthAt(l.s) / 2;
    const right = r.x + widthAt(r.s) / 2;
    const mid = (l.x + r.x) / 2;
    for (const o of free) {
      if (o === l || o === r) continue;
      const w = widthAt(o.s) / 2;
      if (o.x + w * 0.6 < left || o.x - w * 0.6 > right) continue;
      o.x = o.x < mid ? left - w * 0.8 : right + w * 0.8;
      // (kept in the picture: if it can't be, the far side)
      if (o.x - w < 0) o.x = right + w * 0.8;
      else if (o.x + w > 400) o.x = left - w * 0.8;
      notes.push(`${o.id} moved out of the hug`);
    }
  }
  let out = markup;
  ps.forEach((p, i) => (out = out.replace(origTags[i], setAttr(setAttr(p.tag, "x", String(Math.round(p.x))), "laid", "1"))));
  return out;
}

/** At the table (lesson 17): whoever sits at a table, across it, is drawn
 *  behind it - the table over their laps - so the table and what's on it
 *  show, and their faces above it (sitting in front of it, a bear hid the
 *  cake). The table goes just after the last of them. */
function atTheTable(markup: string, notes: string[]): string {
  const table = /<stamp\b[^>]*\bk\s*=\s*"table"[^>]*\/>/i.exec(markup);
  if (!table) return markup;
  const tx = Number(attr(table[0], "x")) || 200;
  const ty = Number(attr(table[0], "y")) || 246;
  const ts = Number(attr(table[0], "s")) || 1;
  const half = 45 * ts;
  let out = markup.replace(table[0], "");
  let last = -1;
  const at: string[] = [];
  for (const m of out.matchAll(CHAR_TAG)) {
    if (!m[0].trim().endsWith("/>")) continue;
    const x = Number(attr(m[0], "x")) || 200;
    const y = Number(attr(m[0], "y")) || 246;
    const sit = /\bsit\b/i.test(`${attr(m[0], "legs") ?? ""} ${attr(m[0], "pose") ?? ""}`);
    if (!sit || Math.abs(x - tx) > half + 20 || Math.abs(y - ty) > 30) continue;
    let end = m.index! + m[0].length;
    const after = /^\s*<\/g>/.exec(out.slice(end));
    if (after && /<g\s+class="target"\s*>\s*$/.test(out.slice(0, m.index!))) end += after[0].length;
    last = Math.max(last, end);
    at.push(attr(m[0], "c") ?? "someone");
  }
  CHAR_TAG.lastIndex = 0;
  const t = setAttr(table[0], "near", "1");
  if (last < 0) return out.slice(0, table.index) + table[0] + out.slice(table.index);
  notes.push(`${at.join(", ")} sat behind the table`);
  out = out.slice(0, last) + t + out.slice(last);
  // (what's on the table - the cake, the cheese - stays on top of it)
  const top = ty - 56 * ts;
  const items = itemsOf(out);
  const ti = items.findIndex((i) => i.kind === "piece" && i.tag === t);
  const onTop: number[] = [];
  items.forEach((it, i) => {
    if (i >= ti || (it.kind !== "piece" && it.kind !== "drawn")) return;
    const e = it.kind === "piece" ? pieceExtent(it.tag!) : extentOf(it.text);
    if (!e || Math.abs((e.x0 + e.x1) / 2 - tx) > half || e.y1 < top - 20 || e.y1 > top + 25) return;
    onTop.push(i);
  });
  if (!onTop.length) return out;
  const moved = onTop.map((i) => items[i].text).join("");
  return items.map((it, i) => (onTop.includes(i) ? "" : i === ti ? it.text + moved : it.text)).join("");
}

/** Things in the picture (lesson 17): a prop or a story thing - a kite, an
 *  umbrella - wholly inside the frame (a kite "high in the sky" was put
 *  above it); and nothing but what a character holds, or what an action
 *  leaves in the air, drawn over a character's face (a kite meant for the
 *  wall covered a bunny's face) - such a piece goes behind them. */
function propsSeen(markup: string, notes: string[]): string {
  let out = markup;
  for (const m of [...out.matchAll(/<stamp\b[^>]*\/>/gi)]) {
    const k = (attr(m[0], "k") ?? "").toLowerCase();
    if (!(k in PROPS)) continue;
    const e = pieceExtent(m[0]);
    if (!e) continue;
    let dx = 0, dy = 0;
    if (e.y0 < 8) dy = 8 - e.y0;
    if (e.x0 < 6) dx = 6 - e.x0;
    else if (e.x1 > 394) dx = 394 - e.x1;
    if (!dx && !dy) continue;
    const t = setAttr(setAttr(m[0], "x", String(Math.round((Number(attr(m[0], "x")) || 200) + dx))), "y", String(Math.round((Number(attr(m[0], "y")) || 240) + dy)));
    out = out.replace(m[0], t);
    notes.push(`the ${k} brought into the picture`);
  }
  // faces: [x, top, bottom, half-width] of each character's head
  const faces = [...out.matchAll(CHAR_TAG)]
    .filter((m) => m[0].trim().endsWith("/>"))
    .map((m) => ({ tag: m[0], at: m.index!, x: Number(attr(m[0], "x")) || 200, y: Number(attr(m[0], "y")) || 246, s: Number(attr(m[0], "s")) || 0.6 }));
  CHAR_TAG.lastIndex = 0;
  for (const m of [...out.matchAll(/<stamp\b[^>]*\/>/gi)]) {
    const k = (attr(m[0], "k") ?? "").toLowerCase();
    // (an umbrella is held up over heads: that's its place)
    if (k in EFFECTS || k === "umbrella" || /\bnear\s*=\s*"(?:1|true)"/i.test(m[0])) continue;
    const e = pieceExtent(m[0]);
    if (!e) continue;
    const at = out.indexOf(m[0]);
    const covered = faces.find((f) => f.at < at && e.x1 > f.x - 30 * f.s && e.x0 < f.x + 30 * f.s && e.y1 > f.y - 165 * f.s && e.y0 < f.y - 105 * f.s);
    if (!covered) continue;
    const ci = out.indexOf(covered.tag);
    if (ci < 0) continue;
    out = out.replace(m[0], "");
    out = out.slice(0, ci) + m[0] + out.slice(ci);
    notes.push(`the ${k} put behind ${attr(covered.tag, "c") ?? "someone"}, off their face`);
  }
  return out;
}

/** Things on the ground that are stood on, not beside. */
const FLAT = /^(rug|puddle|pond|dust|path|shadow|footprint|carpet|mat)$/i;

/** What characters ride in: never something they're moved out of. */
const RIDDEN = /^(boat|hull)$/i;

/** Riders in a boat (lesson 17): everyone standing on the boat - over its
 *  deck, near its waterline - is put IN it: feet just inside the gunwale,
 *  the boat drawn before them and its near side ("hull") after them, so
 *  the hull hides their legs. A boat given riders but no hull gets one. */
function inTheBoat(markup: string, notes: string[]): string {
  const boatTag = /<stamp\b[^>]*\bk\s*=\s*"boat"[^>]*\/>/i.exec(markup);
  if (!boatTag) return markup;
  const bx = Number(attr(boatTag[0], "x")) || 200;
  const by = Number(attr(boatTag[0], "y")) || 246;
  let bs = Number(attr(boatTag[0], "s")) || 1;
  let out = markup.replace(boatTag[0], "").replace(/<stamp\b[^>]*\bk\s*=\s*"hull"[^>]*\/>/gi, "");
  // (one boat: another written at about the same spot is the same boat)
  out = out.replace(/<stamp\b[^>]*\bk\s*=\s*"boat"[^>]*\/>/gi, (t) => (Math.abs((Number(attr(t, "x")) || 0) - bx) < 80 ? "" : t));
  // each character's span: its tag, with the target group round it if any
  type Span = { from: number; to: number; tag: string };
  const spans: Span[] = [];
  for (const m of out.matchAll(CHAR_TAG)) {
    if (!m[0].trim().endsWith("/>")) continue;
    let from = m.index!;
    let to = from + m[0].length;
    const before = /<g\s+class="target"\s*>\s*$/.exec(out.slice(0, from));
    const after = /^\s*<\/g>/.exec(out.slice(to));
    if (before && after) (from = before.index), (to += after[0].length);
    spans.push({ from, to, tag: m[0] });
  }
  CHAR_TAG.lastIndex = 0;
  const near = (tag: string, h: number) => {
    const x = Number(attr(tag, "x"));
    const y = Number(attr(tag, "y"));
    return Math.abs(x - bx) < h + 30 && y > by - 50 * bs && y < by + 40;
  };
  const riders = spans.filter((sp) => near(sp.tag, 62 * bs));
  // (big enough for its riders: a close-up's child doesn't dwarf the boat)
  const biggest = Math.max(0, ...riders.map((r) => Number(attr(r.tag, "s")) || 0.6));
  if (riders.length && bs < biggest * 1.5) {
    notes.push(`the boat made big enough for its riders (s ${bs} to ${(biggest * 1.5).toFixed(2)})`);
    bs = Math.min(3, Math.round(biggest * 150) / 100);
  }
  const half = 62 * bs;
  const boat = `<stamp k="boat" x="${bx}" y="${by}" s="${bs}" near="1"/>`;
  // (a seated rider's feet are set higher, inside the hull: see below)
  const aboard = (y: number) => y > by - 20 * bs - 40 && y <= by + 2;
  if (!riders.length) return out.slice(0, spans[0]?.from ?? out.length) + boat + out.slice(spans[0]?.from ?? out.length);
  // (feet just inside the gunwale, inside its length)
  for (const r of [...riders].reverse()) {
    const sit = /\bsit\b/i.test(`${attr(r.tag, "legs") ?? ""} ${attr(r.tag, "pose") ?? ""}`);
    const x = Math.max(bx - half + 14, Math.min(bx + half - 14, Number(attr(r.tag, "x"))));
    // (feet below the gunwale: the hull hides the legs, so they're IN it)
    const tag = setAttr(setAttr(setAttr(r.tag, "y", String(Math.round(by - (sit ? 8 * bs + 26 * (Number(attr(r.tag, "s")) || 0.6) : 2 * bs)))), "x", String(Math.round(x))), "ride", "1");
    const text = out.slice(r.from, r.to).replace(r.tag, tag);
    // (last first, so the earlier spans stay where they were)
    out = out.slice(0, r.from) + text + out.slice(r.to);
  }
  // (recomputed after the edits: the first and last rider's spans)
  const fresh = (): Span[] => {
    const list: Span[] = [];
    for (const m of out.matchAll(CHAR_TAG)) {
      if (!m[0].trim().endsWith("/>")) continue;
      const x = Number(attr(m[0], "x"));
      const y = Number(attr(m[0], "y"));
      if (!(attr(m[0], "ride") === "1" && Math.abs(x - bx) < half && aboard(y))) continue;
      let from = m.index!;
      let to = from + m[0].length;
      const before = /<g\s+class="target"\s*>\s*$/.exec(out.slice(0, from));
      const after = /^\s*<\/g>/.exec(out.slice(to));
      if (before && after) (from = before.index), (to += after[0].length);
      list.push({ from, to, tag: m[0] });
    }
    CHAR_TAG.lastIndex = 0;
    return list;
  };
  const rs = fresh();
  if (!rs.length) return out.slice(0, spans[0]?.from ?? out.length) + boat + out.slice(spans[0]?.from ?? out.length);
  const first = rs[0];
  const last = rs[rs.length - 1];
  const hull = `<stamp k="hull" x="${bx}" y="${by}" s="${bs}" near="1"/>`;
  out = out.slice(0, last.to) + hull + out.slice(last.to);
  out = out.slice(0, first.from) + boat + out.slice(first.from);
  notes.push(`${rs.map((r) => attr(r.tag, "c") ?? attr(r.tag, "id")).join(", ")} put in the boat`);
  return out;
}

/** Only the tags a composer may write (lesson 17): a stray "<boat>" opened
 *  around a whole page made everything in it vanish. */
const ALLOWED = /^(stamp|scatter|fig|sprite|npc|who|g|path|ellipse|circle|rect|polygon|polyline|line)$/i;
function onlyKnownTags(markup: string, notes: string[]): string {
  const dropped = new Set<string>();
  // (a composer that corrects itself - "Wait, the tap target must be
  // wrapped. Final output:" - writes everything twice: the corrected copy,
  // after its last such word, is the one meant; the first kept each
  // character's uncorrected tag - part 2)
  const redo = [...markup.matchAll(/\b(?:final (?:output|answer|version|tags)|corrected (?:output|version|tags)|here(?: is|'s) the (?:final|corrected)[^<:]*)\s*:?/gi)].pop();
  if (redo && /<\s*(?:fig|stamp|sprite)\b/i.test(markup.slice(redo.index! + redo[0].length))) {
    markup = markup.slice(redo.index! + redo[0].length);
    notes.push("the composer's corrected copy kept, its first draft left out");
  }
  // (a tag with nothing in it is the composer's prose talking about tags -
  // "<fig> and <stamp> tags only" - not a tag: read as one, a bare <fig>
  // opened a figure that swallowed the rest of the page, which came out
  // empty - part 2)
  let bare = 0;
  markup = markup.replace(/<\s*(?:fig|stamp|sprite|who|scatter)\s*\/?\s*>/gi, () => (bare++, ""));
  if (bare) notes.push(`${bare} empty tag${bare > 1 ? "s" : ""} in the composer's notes left out`);
  const out = markup.replace(/<\/?\s*([a-zA-Z][\w-]*)\b[^>]*>/g, (t, name: string) => {
    if (ALLOWED.test(name)) return t;
    dropped.add(name);
    return "";
  });
  if (dropped.size) notes.push(`unknown tags left out: ${[...dropped].join(", ")}`);
  // (the sky is the backdrop's and the page layer's: a composer's own moon
  // made two moons)
  let sky = 0;
  // (a cloud someone sits on - near="1" - is theirs, not the sky's)
  const clear = out.replace(/<(?:stamp|scatter)\b[^>]*\bk\s*=\s*"(moon|sun|cloud|hill|stars|rainbow)"[^>]*\/>/gi, (t) => (/\bnear\s*=\s*"(?:1|true)"/i.test(t) ? t : (sky++, "")));
  if (sky) notes.push(`${sky} sky piece${sky > 1 ? "s" : ""} left to the backdrop`);
  return clear;
}

/** On someone's shoulder, head or back (part 2): the rider sits there -
 *  its seat on the carrier's shoulder line, the top of its head or its
 *  back - drawn just after the carrier so it's in front, and no bigger
 *  than about half of it. Two riders on one carrier take a side each. */
function perched(markup: string, opts: LayoutOptions, notes: string[]): string {
  let out = markup;
  const sides = new Map<string, number>();
  for (const [rid, cid, where] of opts.perched ?? []) {
    const find = (id: string) => [...out.matchAll(CHAR_TAG)].find((m) => (attr(m[0], "c") ?? attr(m[0], "id")) === id && m[0].trim().endsWith("/>"));
    const c = find(cid);
    CHAR_TAG.lastIndex = 0;
    const r = find(rid);
    CHAR_TAG.lastIndex = 0;
    if (!c || !r) continue;
    const cx = Number(attr(c[0], "x")) || 200;
    const cy = Number(attr(c[0], "y")) || 246;
    const cs = Number(attr(c[0], "s")) || opts.usualS || 0.6;
    const dir = /^(1|true)$/i.test(attr(c[0], "flip") ?? "") ? -1 : 1;
    const n = sides.get(cid) ?? 0;
    sides.set(cid, n + 1);
    const side = n % 2 === 0 ? 1 : -1;
    const rs = Math.min(Number(attr(r[0], "s")) || cs * 0.5, cs * 0.55);
    const H = 170 * cs;
    // (where its seat goes on the carrier, then its feet below that seat)
    const seatY = where === "head" ? cy - 0.93 * H : where === "back" ? cy - 0.5 * H : cy - 0.58 * H;
    const seatX = where === "head" ? cx : where === "back" ? cx - dir * 0.14 * 110 * cs + side * 8 * cs : cx + side * 0.24 * 110 * cs;
    let tag = r[0];
    tag = setAttr(tag, "x", String(Math.round(seatX)));
    tag = setAttr(tag, "y", String(Math.round(seatY + SIT_FEET * rs)));
    tag = setAttr(tag, "s", rs.toFixed(2));
    tag = setAttr(setAttr(tag, "legs", "sit"), "ride", "1");
    // (out of its own place, in just after the carrier)
    let rest = out.slice(0, r.index) + out.slice(r.index! + r[0].length);
    const c2 = [...rest.matchAll(CHAR_TAG)].find((m) => (attr(m[0], "c") ?? attr(m[0], "id")) === cid && m[0].trim().endsWith("/>"));
    CHAR_TAG.lastIndex = 0;
    if (!c2) continue;
    let end = c2.index! + c2[0].length;
    const after = /^\s*<\/g>/.exec(rest.slice(end));
    if (after && /<g\s+class="target"\s*>\s*$/.test(rest.slice(0, c2.index!))) end += after[0].length;
    rest = rest.slice(0, end) + tag + rest.slice(end);
    out = rest;
    notes.push(`${rid} sat on ${cid}'s ${where}, as the brief says`);
  }
  return out;
}

/** Furniture and buildings come only when the page or its place speaks
 *  of them (part 3: a bed out on a snowy mountain ledge, a cottage on
 *  Everest, both added by the composer unasked). The rest of the library -
 *  trees, stones, grass, sparkles - is ordinary scenery and stays. */
const BELONGS: Record<string, RegExp> = {
  bed: /\b(bed|beds|bedtime|cot|crib|bunk|quilt|duvet|pillow)\b/i,
  table: /\b(table|desk|counter|picnic)\b/i,
  chair: /\b(chair|stool|bench|seat|throne)\b/i,
  armchair: /\b(armchair|chair|sofa|settee)\b/i,
  cupboard: /\b(cupboard|dresser|wardrobe|cabinet|kitchen)\b/i,
  bookshelf: /\b(book|books|bookshelf|shelf|shelves|library)\b/i,
  shelf: /\b(shelf|shelves|dresser|pantry)\b/i,
  fireplace: /\b(fire|fireplace|hearth|stove)\b/i,
  toybox: /\b(toy|toys|toybox|nursery|playroom)\b/i,
  door: /\b(door|doorway|front step|entrance)\b/i,
  window: /\b(window|windows|porthole|windowsill)\b/i,
  cottage: /\b(cottage|house|home|cabin|hut|village|farmhouse|town)\b/i,
  lamppost: /\b(lamppost|street|lamp post|lamp-post|town|village)\b/i,
  signpost: /\b(sign|signpost|crossroads|path)\b/i,
  well: /\b(well)\b/i,
  bridge: /\b(bridge)\b/i,
  snowman: /\b(snowman|snowmen)\b/i,
  gate: /\b(gate|garden|fence)\b/i,
  clock: /\b(clock|time|o'clock|midnight)\b/i,
};
function onlyWhatBelongs(markup: string, opts: LayoutOptions, notes: string[]): string {
  const said = opts.said ?? "";
  if (!said) return markup;
  const dropped: string[] = [];
  const out = markup.replace(/<stamp\b[^>]*\/>/gi, (t) => {
    const k = (attr(t, "k") ?? "").toLowerCase();
    const re = BELONGS[k];
    if (!re || re.test(said)) return t;
    dropped.push(k);
    return "";
  });
  if (dropped.length) notes.push(`not in this page or place, left out: ${[...new Set(dropped)].join(", ")}`);
  return out;
}

/** The standard piece a thing's name asks for, if there is one: the
 *  whole name ("treasure chest"), else its last word or any word in it as
 *  a whole word ("the golden key" - key; never "monkey" - key), plurals
 *  too. */
export function stampFor(name: string): string | null {
  const norm = (k: string) => k.toLowerCase().replace(/[\s_-]+/g, "");
  const said = name.toLowerCase().replace(/^(the|a|an)\s+/, "").trim();
  const keys = Object.keys(STAMPS);
  const whole = keys.find((k) => norm(k) === norm(said) || norm(k) === norm(said).replace(/s$/, ""));
  if (whole) return whole;
  const words = said.split(/[^a-z]+/).filter(Boolean).reverse();
  for (const w of words) {
    const k = keys.find((k) => k === w || `${k}s` === w || `${k}es` === w);
    if (k) return k;
  }
  return null;
}

export function layoutComposed(markup: string, opts: LayoutOptions = {}): { markup: string; notes: string[] } {
  const notes: string[] = [];
  markup = onlyKnownTags(markup, notes);
  markup = onlyWhatBelongs(markup, opts, notes);
  markup = oncePerCharacter(markup, opts, notes);
  markup = furnitureToScale(markup, opts, notes);
  // (the brief puts them in bed: they sit up in it, the bed in front - so
  // the tuck below holds whatever the composer wrote)
  if (opts.inBed) {
    const bed = /<stamp\b[^>]*\bk\s*=\s*"bed"[^>]*\/>/i.exec(markup);
    const who = [...markup.matchAll(CHAR_TAG)].find((m) => (attr(m[0], "c") ?? attr(m[0], "id")) === opts.inBed && m[0].trim().endsWith("/>"));
    CHAR_TAG.lastIndex = 0;
    if (who) {
      const bx = bed ? Number(attr(bed[0], "x")) || 200 : Number(attr(who[0], "x")) || 200;
      const by = bed ? Number(attr(bed[0], "y")) || 250 : 252;
      const bs = bed ? Number(attr(bed[0], "s")) || 1.2 : 1.4;
      let out = bed ? markup.replace(/<stamp\b[^>]*\bk\s*=\s*"bed"[^>]*\/>/gi, "") : markup;
      const fig = setAttr(setAttr(setAttr(setAttr(who[0], "legs", "sit"), "x", String(Math.round(bx + 10 * bs))), "mood", attr(who[0], "mood") ?? "sleepy"), "bed", "1");
      out = out.replace(who[0], `${fig}<stamp k="bed" x="${bx}" y="${by}" s="${bs}" near="1"/>`);
      notes.push(`${opts.inBed} in bed, as the brief says`);
      markup = out;
    }
  }
  markup = tuckedIn(markup, notes);
  // (the brief says they hug: they do - lesson 17)
  if (opts.huggers)
    for (const id of opts.huggers) {
      const t = [...markup.matchAll(CHAR_TAG)].find((m) => (attr(m[0], "c") ?? attr(m[0], "id")) === id && m[0].trim().endsWith("/>"));
      CHAR_TAG.lastIndex = 0;
      if (t && !/\bhug\b/.test(attr(t[0], "arms") ?? "")) {
        markup = markup.replace(t[0], setAttr(t[0], "arms", "hug,hug"));
        notes.push(`${id} hugging, as the brief says`);
      }
    }
  const placed: Placed[] = [];
  for (const m of markup.matchAll(CHAR_TAG)) {
    const tag = m[0];
    // (a figure with drawn parts inside isn't a one-tag placement: left as is)
    if (/^<\s*fig\b/i.test(tag) && !tag.trim().endsWith("/>")) continue;
    const id = attr(tag, "c") ?? attr(tag, "id") ?? "";
    const x = Number(attr(tag, "x"));
    const y = Number(attr(tag, "y"));
    if (!id || !Number.isFinite(x)) continue;
    const s = Number(attr(tag, "s")) || opts.usualS || 0.6;
    const pose = `${attr(tag, "pose") ?? ""} ${attr(tag, "legs") ?? ""}`.toLowerCase();
    const arms = `${attr(tag, "arms") ?? ""} ${attr(tag, "pose") ?? ""}`.toLowerCase();
    placed.push({
      start: m.index!,
      end: m.index! + tag.length,
      tag,
      id,
      x,
      y: Number.isFinite(y) ? y : 246,
      s,
      flip: /^(1|true)$/i.test(attr(tag, "flip") ?? ""),
      moving: /\b(run|walk|jump|fly|kick)\b/.test(pose),
      touching: /\b(hold|hug|reach|point)\b/.test(arms) || Boolean(attr(tag, "hold")),
      turns: !/^<\s*fig\b/i.test(tag) || (attr(tag, "v") ?? attr(tag, "view") ?? "front").toLowerCase() === "three",
    });
  }
  if (!placed.length) return { markup, notes };

  // 0. Sizes kept true to each other (lesson 12): each character is kept
  // within 20% of the page's usual size times its own (a squirrel smaller,
  // an avocado as big as a strawberry) - the composer's choice stands
  // within that, so a nearer one can still be a little bigger.
  if (opts.usualS)
    for (const p of placed) {
      const share = opts.sizeOf?.[p.id] ?? 1;
      // (a big one - a giant - as big as the picture allows, face in it)
      const giant = share > 1 && !opts.groups?.includes(p.id);
      const cap = share > 1 ? fitS(p.y) : Infinity;
      const want = Math.min(cap, opts.usualS * share);
      const kept = giant ? Math.min(cap, Math.max(want * 0.9, p.s)) : Math.min(want * 1.2, Math.max(want * 0.8, p.s));
      if (Math.abs(kept - p.s) > 0.01) {
        notes.push(`${p.id} resized from ${p.s.toFixed(2)} to ${kept.toFixed(2)}, true to the others`);
        p.s = kept;
        p.tag = setAttr(p.tag, "s", kept.toFixed(2));
      }
    }
  // 0b. A giant the frame can't hold at its stated size (ten times the
  // hero's height) shows its size by everyone else being smaller instead:
  // they shrink to keep the ratio, to no less than about half their usual
  // size (part 2: a cat "ten times Bao's height" came out twice her size,
  // a dragon six times Nell's twice hers). Not in a close-up, which is
  // about a face.
  if (opts.usualS && opts.usualS < 1.2 && placed.length > 1) {
    let k = 1;
    for (const p of placed) {
      const share = opts.sizeOf?.[p.id] ?? 1;
      if (share > 1.5 && !opts.groups?.includes(p.id)) k = Math.min(k, p.s / (opts.usualS * share));
    }
    // (not below about 60% - 70% in a wide shot, where everyone is small
    // already: beside a yak four times his height a baby came out a speck
    // on a wide page - part 3)
    k = Math.max(opts.usualS < 0.7 ? 0.7 : 0.6, k);
    if (k < 0.92)
      for (const p of placed) {
        if ((opts.sizeOf?.[p.id] ?? 1) > 1.5 && !opts.groups?.includes(p.id)) continue;
        // (the story's own - the hero, and whoever the child taps - are
        // never dwarfed: shrunk by no more than 15%, the giant standing
        // further back says the rest. At 60% a hero beside a dragon was a
        // speck the child had to look for - 15 Nov)
        const own = p.id === opts.heroId || p.id === opts.targetId;
        const kk = own ? Math.max(0.85, k) : k;
        if (kk >= 0.98) continue;
        const s2 = Math.max(0.24, Math.round(p.s * kk * 100) / 100);
        notes.push(`${p.id} made smaller (${p.s.toFixed(2)} to ${s2.toFixed(2)}) beside the giant`);
        p.s = s2;
        p.tag = setAttr(p.tag, "s", s2.toFixed(2));
      }
  }
  // 0c. A giant stands a little further back than the others (its feet
  // higher up the page - more than the 14 that lines up the standing, so it's drawn behind them and, by the picture's
  // perspective, needn't fill the whole frame), and they stand forward:
  // the giant still towers, the hero in front still reads as the star.
  // Not in a close-up.
  if (opts.usualS && opts.usualS < 1.2 && placed.length > 1) {
    const giants = placed.filter((p) => (opts.sizeOf?.[p.id] ?? 1) > 1.5 && !opts.groups?.includes(p.id));
    if (giants.length && giants.length < placed.length) {
      for (const g of giants)
        if (g.y > 228) {
          g.y = 228;
          g.tag = setAttr(g.tag, "y", "228");
          const cap = fitS(228);
          if (g.s > cap) {
            g.s = cap;
            g.tag = setAttr(g.tag, "s", cap.toFixed(2));
          }
          notes.push(`${g.id}, the giant, stood a little further back`);
        }
      for (const p of placed) {
        // (only those standing on the ground: not a flyer, nor one up a tree)
        if (giants.includes(p) || p.y >= 246 || p.y < 236) continue;
        p.y = 246;
        p.tag = setAttr(p.tag, "y", "246");
      }
    }
  }
  // (one character alone still gets its seat, its target and its size)

  // 1. Ease apart anyone overlapping more than a touch, left to right,
  // keeping their order across the picture.
  const byX = [...placed].sort((a, b) => a.x - b.x);
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i + 1 < byX.length; i++) {
      const a = byX[i];
      const b = byX[i + 1];
      // (well apart in depth - one higher up AND clearly smaller - they may
      // cross; higher up alone isn't depth, it's a clump: lesson 11)
      if (apartInDepth(a, b)) continue;
      const interacting = a.touching || b.touching || a.id === opts.targetId || b.id === opts.targetId;
      // how close their middles may be: half of each body, less the
      // overlap allowed (a hand's width when they interact, a whisker else)
      const allowed = interacting ? 0.28 : 0.08;
      const need = (widthAt(a.s) + widthAt(b.s)) / 2 - Math.min(widthAt(a.s), widthAt(b.s)) * allowed;
      const gap = b.x - a.x;
      if (gap >= need) continue;
      const push = (need - gap) / 2;
      a.x -= push;
      b.x += push;
      if (pass === 0) notes.push(`${a.id} and ${b.id} overlapped: eased apart`);
    }
  // (and kept in the picture: the whole row slides back in if it ran out)
  const lo = Math.min(...byX.map((p) => p.x - widthAt(p.s) / 2));
  const hi = Math.max(...byX.map((p) => p.x + widthAt(p.s) / 2));
  const shift = lo < 20 ? 20 - lo : hi > 380 ? 380 - hi : 0;
  if (shift) for (const p of byX) p.x += shift;

  // 2. The ends of a group face into it (unless on the move).
  const mid = (byX[0].x + byX[byX.length - 1].x) / 2;
  for (const p of [byX[0], byX[byX.length - 1]]) {
    if (!p.turns || p.moving) continue;
    const facesRight = !p.flip;
    const shouldFaceRight = p.x < mid;
    if (Math.abs(p.x - mid) > 30 && facesRight !== shouldFaceRight) {
      p.flip = !shouldFaceRight;
      notes.push(`${p.id} turned to face the others`);
    }
  }

  // 2a. Lesson 16 - the action made to read:
  // - two characters both hugging are drawn close (touching) and facing;
  // - the target character is kept comfortably in frame (x 90-310): the
  //   whole group shifts with it, spacing kept;
  const hugging = placed.filter((p) => /\bhug\b/.test((attr(p.tag, "arms") ?? "") + (attr(p.tag, "pose") ?? "")));
  if (hugging.length >= 2) {
    const [a, b] = [...hugging].sort((p, q) => p.x - q.x);
    const mid = (a.x + b.x) / 2;
    // (close enough that their bodies overlap and their arms go round each
    // other, turned to face: two front views side by side only stood near
    // each other - lesson 17)
    // (but not so close one's head covers the other's face)
    // (from both their widths: a bunny hugging a bear isn't buried in it)
    const half = ((110 * a.s + 110 * b.s) / 2) * 0.44 / 2;
    for (const p of [a, b]) if (/^<\s*fig\b/i.test(p.tag)) p.tag = setAttr(p.tag, "v", "three");
    if (Math.abs(b.x - a.x) > half * 2 + 4) notes.push(`${a.id} and ${b.id} brought together for the hug`);
    a.x = mid - half;
    b.x = mid + half;
    a.flip = false;
    b.flip = true;
    a.turns = b.turns = false;
    // (the smaller one in front, so both faces show)
    const [small, big] = a.s <= b.s ? [a, b] : [b, a];
    if (small.y <= big.y) {
      small.y = big.y + 4;
      small.tag = setAttr(small.tag, "y", String(Math.round(small.y)));
    }
  }
  const doer = opts.targetId ? placed.find((p) => p.id === opts.targetId) : null;
  if (doer && (doer.x < 90 || doer.x > 310)) {
    const shift = doer.x < 90 ? 90 - doer.x : 310 - doer.x;
    const lo = Math.min(...placed.map((p) => p.x - 55 * p.s));
    const hi = Math.max(...placed.map((p) => p.x + 55 * p.s));
    // (as far as the group can go and stay in the picture)
    const d = shift > 0 ? Math.min(shift, 380 - hi) : Math.max(shift, 20 - lo);
    if (Math.abs(d) > 2) {
      for (const p of placed) p.x += d;
      notes.push(`the group moved ${Math.round(d)} so ${doer.id}, the main action, is well in frame`);
    }
  }
  // - a sitting character beside its seat (a near="1" piece just before
  //   it, within its width) sits on the seat's top.
  for (const m of markup.matchAll(/<stamp\b[^>]*\bnear\s*=\s*"(?:1|true)"[^>]*\/>\s*(<\s*(?:sprite|fig)\b[^>]*\/>)/gi)) {
    const seat = pieceExtent(m[0].slice(0, m[0].indexOf(m[1])));
    const p = placed.find((q) => q.tag === m[1]);
    if (!seat || !p || !/\bsit\b/i.test(`${attr(p.tag, "pose") ?? ""} ${attr(p.tag, "legs") ?? ""}`)) continue;
    if (p.x < seat.x0 - 10 || p.x > seat.x1 + 10) continue;
    // (its hips on the seat's top, its feet hanging below: see SIT_FEET)
    const top = Math.round(seat.y0 + (seat.y1 - seat.y0) * 0.22 + SIT_FEET * p.s);
    if (Math.abs(top - p.y) > 3) {
      p.y = top;
      p.tag = setAttr(p.tag, "y", String(top));
      notes.push(`${p.id} set on its seat`);
    }
  }

  // 2b. Turned towards the main action (lesson 15): everyone else faces,
  // and looks at, its target - a character, or the thing the child taps -
  // unless running or flying away. Feet on one ground line: characters
  // standing at about the same depth share it (sitting ones keep their
  // seat's height).
  const tx = targetX(markup, opts.targetId, placed);
  if (tx !== null)
    for (const p of placed) {
      if (p.id === opts.targetId || !p.turns) continue;
      const pose = `${attr(p.tag, "pose") ?? ""} ${attr(p.tag, "legs") ?? ""}`.toLowerCase();
      if (/\b(run|fly)\b/.test(pose) || Math.abs(tx - p.x) < 20) continue;
      const faceRight = tx > p.x;
      if (p.flip === faceRight) {
        p.flip = !faceRight;
        notes.push(`${p.id} turned towards the main action`);
      }
      if (!attr(p.tag, "look") && /<\s*fig\b/i.test(p.tag)) p.tag = setAttr(p.tag, "look", faceRight ? "right" : "left");
    }
  const standing = placed.filter((p) => !/\bsit\b/i.test(`${attr(p.tag, "pose") ?? ""} ${attr(p.tag, "legs") ?? ""}`));
  for (const p of standing) {
    const group = standing.filter((q) => Math.abs(q.y - p.y) <= 14);
    if (group.length < 2) continue;
    const line = Math.round(group.reduce((t, q) => t + q.y, 0) / group.length);
    for (const q of group)
      if (q.y !== line) {
        q.y = line;
        q.tag = setAttr(q.tag, "y", String(line));
      }
  }

  // Write the changes into the tags.
  let out = markup;
  const edits = placed
    .map((p) => ({ p, tag: setAttr(setAttr(p.tag, "x", String(Math.round(p.x))), "flip", p.flip ? "1" : "0") }))
    .sort((a, b) => b.p.start - a.p.start);
  for (const { p, tag } of edits) out = out.slice(0, p.start) + tag + out.slice(p.end);

  // 3. Back to front: further back first (higher up the page, a smaller
  // y), then, at the same depth, bigger before smaller - so whoever is
  // nearer, or smaller beside a bigger one, is drawn in front. Each
  // character moves with what belongs to it: the seat or tree it touches
  // (near="1" pieces just before it) and what it holds or hides behind
  // (the pieces just after it). Everything else stays where it was.
  out = byDepth(out, notes);
  out = ensureTarget(out, opts, notes);

  // 4. The target is never hidden: a character written after it (so drawn
  // over it) that overlaps it is moved to just before it.
  const target = opts.targetId;
  if (target) {
    const tags = [...out.matchAll(CHAR_TAG)].filter((m) => !(/^<\s*fig\b/i.test(m[0]) && !m[0].trim().endsWith("/>")));
    const ti = tags.findIndex((m) => (attr(m[0], "c") ?? attr(m[0], "id")) === target);
    if (ti >= 0) {
      const t = tags[ti];
      const tx = Number(attr(t[0], "x"));
      const ts = Number(attr(t[0], "s")) || opts.usualS || 0.6;
      const hugs = (t: string) => /\bhug\b/.test(attr(t, "arms") ?? "");
      const over = tags.slice(ti + 1).filter((m) => {
        // (a hug's partner stays in front: it's the hug, not a hiding)
        if (hugs(m[0]) && hugs(t[0])) return false;
        const x = Number(attr(m[0], "x"));
        const s = Number(attr(m[0], "s")) || opts.usualS || 0.6;
        return Math.abs(x - tx) < (widthAt(s) + widthAt(ts)) / 2 - Math.min(widthAt(s), widthAt(ts)) * 0.15;
      });
      if (over.length) {
        // (moved before the target, inside whatever wraps the target too)
        const inTarget = (m: RegExpMatchArray) => out.lastIndexOf('class="target"', m.index!) > out.lastIndexOf("</g>", m.index!);
        const moving = over.filter((m) => !inTarget(m));
        for (const m of [...moving].sort((a, b) => b.index! - a.index!)) out = out.slice(0, m.index!) + out.slice(m.index! + m[0].length);
        // (the target's own tag, or the target group that holds it)
        const tIndex = out.indexOf(t[0]);
        const groupAt = out.lastIndexOf("<g", tIndex);
        const at = groupAt >= 0 && /class="target"/.test(out.slice(groupAt, out.indexOf(">", groupAt))) ? groupAt : tIndex;
        if (moving.length) {
          out = out.slice(0, at) + moving.map((m) => m[0]).join("") + out.slice(at);
          notes.push(`${moving.map((m) => attr(m[0], "c") ?? attr(m[0], "id")).join(", ")} drawn behind ${target}, the main action's target`);
        }
      }
    }
  }
  out = inTheBoat(out, notes);
  out = atTheTable(out, notes);
  out = finalSpacing(out, opts, notes);
  out = propsSeen(out, notes);
  out = perched(out, opts, notes);
  return { markup: out, notes };
}
