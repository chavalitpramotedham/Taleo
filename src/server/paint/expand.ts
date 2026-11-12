import { hashOf, seeded, SCATTER, STAMPS, type Piece } from "@/lib/art/stamps";
import type { Palette } from "@/lib/art/palette";

/**
 * The expander: sits between a painter's stream and the reader, and turns
 * the painter's short placeholders into ordinary painted SVG before
 * anything leaves the server.
 *
 *   <stamp k="oak" x="60" y="242" s="1.1" flip="1" v="2"/>   a standard piece
 *   <scatter k="grass" x="0" y="250" w="400" h="40" n="16"/>   repeated marks
 *   <g class="ink">                                            the standard pen
 *
 * It works on the stream as it comes: it holds back only an unfinished tag,
 * and never changes what it has already sent, so the picture still paints
 * itself in on the reader's page and the "what's being painted" caption
 * still reads the layers. Everything it makes is the same whitelisted
 * markup a painter writes, so what's stored is a plain painting.
 *
 * Deterministic: a piece's look comes from a seed made from the book, the
 * page and where the piece is in the page's markup, so a picture is the
 * same every time it's expanded.
 *
 * Anything it can't do - a piece it doesn't know, a number it can't read -
 * throws ReuseFailed: the page is then painted again the ordinary way.
 */

export class ReuseFailed extends Error {
  constructor(why: string) {
    super(`Reuse failed: ${why}`);
    this.name = "ReuseFailed";
  }
}

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ExpandContext {
  /** The book (or page) the pieces belong to: `v` pieces are the same
   *  everywhere in it. */
  bookSeed: number;
  /** This page: unnumbered pieces vary from page to page. */
  pageSeed: number;
  palette: Palette;
  /** Whether stamps and scatter may be used at all. */
  stamps: boolean;
  /** The characters' space, for the scenery painter: nothing dark is
   *  placed in it (see stageFor). */
  stage?: Box | null;
}

export interface ExpandStats {
  stamps: number;
  scatter: number;
  /** pieces moved out of the characters' space */
  moved: number;
  bareInk: number;
  kinds: Record<string, number>;
}

export const newStats = (): ExpandStats => ({ stamps: 0, scatter: 0, moved: 0, bareInk: 0, kinds: {} });

const INK_ATTRS = `fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"`;
const f = (n: number) => (Math.round(n * 100) / 100).toString();

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:-]+)\s*=\s*"([^"]*)"/g)) out[m[1].toLowerCase()] = m[2];
  return out;
}
function num(a: Record<string, string>, key: string, dflt: number | null, lo: number, hi: number): number {
  const raw = a[key];
  if (raw === undefined || raw === "") {
    if (dflt === null) throw new ReuseFailed(`"${key}" is missing`);
    return dflt;
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) throw new ReuseFailed(`"${key}" isn't a number ("${raw.slice(0, 12)}")`);
  return Math.max(lo, Math.min(hi, v));
}

/** Pen widths inside a piece drawn at scale s: divided by s, so after the
 *  scale they're the page's own line weight. */
const unscaleStrokes = (ink: string, s: number) => ink.replace(/stroke-width="([\d.]+)"/g, (_m, w) => `stroke-width="${f(Number(w) / s)}"`);

/** A piece, laid into the three layers at x, y. The layer class sits on
 *  an outer group with no transform (so the watercolour filters work at
 *  the picture's own scale), the placement on an inner one. */
function layered(p: Piece, x: number, y: number, s: number, flip: boolean): string {
  const t = `translate(${f(x)} ${f(y)}) scale(${f(flip ? -s : s)} ${f(s)})`;
  let out = "";
  if (p.paint) out += `<g class="paint"><g transform="${t}">${p.paint}</g></g>`;
  if (p.ink) out += `<g class="ink" fill="none" stroke="#4F3A2A" stroke-width="${f(1.2 / s)}" stroke-linecap="round" stroke-linejoin="round"><g transform="${t}">${unscaleStrokes(p.ink, s)}</g></g>`;
  if (p.detail) out += `<g class="detail"><g transform="${t}">${p.detail}</g></g>`;
  return out;
}
/** Marks already in page coordinates (scatter). */
function flat(p: Piece): string {
  let out = "";
  if (p.paint) out += `<g class="paint">${p.paint}</g>`;
  if (p.ink) out += `<g class="ink" ${INK_ATTRS}>${p.ink}</g>`;
  if (p.detail) out += `<g class="detail">${p.detail}</g>`;
  return out;
}

function stamp(tag: string, ctx: ExpandContext, stats: ExpandStats, index: number): string {
  const a = attrsOf(tag);
  const k = (a.k ?? a.kind ?? "").toLowerCase();
  const kind = STAMPS[k];
  if (!kind) throw new ReuseFailed(`no piece called "${k}"`);
  let x = num(a, "x", null, -100, 500);
  const y = num(a, "y", null, -100, 400);
  const s = num(a, "s", 1, 0.2, 3);
  const flip = a.flip === "1" || a.flip === "true";
  // (a numbered piece is the same wherever it's used in the book; an
  // unnumbered one is this page's own)
  const v = a.v !== undefined && a.v !== "" ? Math.floor(num(a, "v", 0, 0, 999)) : null;
  const seed = v !== null ? hashOf(`${ctx.bookSeed}:${k}:${v}`) : hashOf(`${ctx.pageSeed}:${k}:${index}`);
  // Nothing dark in the characters' space: a tree or a fence planted
  // there is moved out to the nearer side.
  const st = ctx.stage;
  if (st && kind.dark && kind.base !== "middle" && x > st.x0 && x < st.x1 && y > st.y0 && y < st.y1 + 12) {
    const half = (Number(kind.size.split("x")[0]) / 2) * s;
    x = x - st.x0 < st.x1 - x ? st.x0 - half * 0.6 : st.x1 + half * 0.6;
    stats.moved++;
  }
  stats.stamps++;
  stats.kinds[k] = (stats.kinds[k] ?? 0) + 1;
  return layered(kind.draw(seeded(seed), ctx.palette), x, y, s, flip);
}

function scatter(tag: string, ctx: ExpandContext, stats: ExpandStats, index: number): string {
  const a = attrsOf(tag);
  const k = (a.k ?? a.kind ?? "").toLowerCase();
  const kind = SCATTER[k];
  if (!kind) throw new ReuseFailed(`no scatter called "${k}"`);
  const box = { x: num(a, "x", 0, -50, 450), y: num(a, "y", 0, -50, 350), w: num(a, "w", 400, 1, 500), h: num(a, "h", 40, 1, 400) };
  const n = Math.round(num(a, "n", 12, 1, 60));
  const r = seeded(hashOf(`${ctx.pageSeed}:scatter:${k}:${index}`));
  stats.scatter++;
  stats.kinds[`scatter:${k}`] = (stats.kinds[`scatter:${k}`] ?? 0) + 1;
  // Pen marks (grass, hatching) keep out of the characters' space above
  // their feet: the box is cut round it, the marks shared by area.
  const st = ctx.stage;
  if (st && (k === "grass" || k === "hatch")) {
    const parts: { x: number; y: number; w: number; h: number }[] = [];
    const top = box.y;
    const bottom = box.y + box.h;
    const right = box.x + box.w;
    const cutBottom = Math.min(bottom, st.y1 + 2);
    if (cutBottom > top && st.x0 < right && st.x1 > box.x) {
      if (st.x0 > box.x) parts.push({ x: box.x, y: top, w: st.x0 - box.x, h: cutBottom - top });
      if (st.x1 < right) parts.push({ x: st.x1, y: top, w: right - st.x1, h: cutBottom - top });
      if (bottom > cutBottom) parts.push({ x: box.x, y: cutBottom, w: box.w, h: bottom - cutBottom });
    } else parts.push(box);
    const area = parts.reduce((t, p) => t + p.w * p.h, 0) || 1;
    return parts
      .map((p) => {
        const share = Math.round((n * p.w * p.h) / area);
        return share > 0 ? flat(kind.draw(r, ctx.palette, p, share)) : "";
      })
      .join("");
  }
  return flat(kind.draw(r, ctx.palette, box, n));
}

/**
 * Expands one painter's stream. `stats` is filled in as it goes.
 */
export async function* expandStream(src: AsyncIterable<string>, ctx: ExpandContext, stats: ExpandStats): AsyncGenerator<string> {
  let buf = "";
  // open groups, as written, so a piece placed inside one can be laid
  // outside it and the groups opened again after
  const open: string[] = [];
  let pieces = 0;
  const handle = (text: string): string => {
    let out = "";
    let at = 0;
    for (const m of text.matchAll(/<[^>]*>/g)) {
      out += text.slice(at, m.index);
      at = m.index! + m[0].length;
      const tag = m[0];
      if (/^<\s*(stamp|scatter)\b/i.test(tag)) {
        if (!ctx.stamps) throw new ReuseFailed("a placeholder on a page painted the ordinary way");
        const made = /^<\s*stamp/i.test(tag) ? stamp(tag, ctx, stats, pieces++) : scatter(tag, ctx, stats, pieces++);
        // (laid outside any layer group it was written in - but inside the
        // tap target's group, if it's part of the target)
        let keep = 0;
        for (let i = open.length - 1; i >= 0; i--)
          if (/class="[^"]*\btarget\b/.test(open[i])) {
            keep = i + 1;
            break;
          }
        const closing = open.slice(keep);
        out += "</g>".repeat(closing.length) + made + closing.join("");
        continue;
      }
      if (/^<\s*\/\s*(stamp|scatter)\s*>$/i.test(tag)) continue;
      if (/^<g\s+class="ink"\s*>$/.test(tag)) {
        const full = `<g class="ink" ${INK_ATTRS}>`;
        stats.bareInk++;
        open.push(full);
        out += full;
        continue;
      }
      if (/^<g[\s>]/.test(tag) && !tag.endsWith("/>")) open.push(tag);
      else if (/^<\/g\s*>$/.test(tag)) open.pop();
      out += tag;
    }
    return out + text.slice(at);
  };
  for await (const chunk of src) {
    buf += chunk;
    // (only whole tags: an unfinished one waits for the rest)
    const lt = buf.lastIndexOf("<");
    const cut = lt >= 0 && buf.indexOf(">", lt) < 0 ? lt : buf.length;
    if (!cut) continue;
    const ready = buf.slice(0, cut);
    buf = buf.slice(cut);
    const out = handle(ready);
    if (out) yield out;
  }
  if (buf) {
    const out = handle(buf);
    if (out) yield out;
  }
}
