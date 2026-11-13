import { hashOf, seeded, SCATTER, STAMPS, type Piece } from "@/lib/art/stamps";
import type { Palette } from "@/lib/art/palette";
import { rolesOf, viewOf, type CharacterParts, type PartView, type View } from "@/lib/art/parts";
import type { Sprite } from "@/lib/art/sprites";
import { arm, ARM_POSES, face, legs, LEG_POSES, MOODS, type ArmPose, type LegPose, type Mood } from "@/lib/art/poses";
import { PROPS } from "@/lib/art/stamps-more";

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
 * It never gives up on a picture. A painter's slip is mended where it
 * stands, and nothing already painted is thrown away:
 * - a piece name it doesn't know becomes the nearest piece it does (plural,
 *   spacing, a near spelling), or, if none is near, is left out;
 * - a number it can't read takes a sensible default;
 * - a character named rather than given by id is found by name;
 * - a pose for a character without poses is made from its parts, and a
 *   figure for one without parts is placed from its poses;
 * - a piece written inside a figure is laid just after it;
 * - on a composed page, a character the composer forgot is placed in code.
 * Each mend is noted in stats.fixes, for the activity log.
 * (ReuseFailed is kept for anything that calls it, but nothing here throws
 * it any more.)
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
  /** Characters painted from parts, by their id on the page. */
  figures?: Record<string, CharacterParts>;
  /** Characters' pre-painted poses, by their id on the page. */
  sprites?: Record<string, Partial<Record<string, Sprite>>>;
  /** The page's characters by name as well as id (lower case), so a tag
   *  that names one still finds it. */
  ids?: Record<string, string>;
  /** On a composed page, the characters the tags must place: any left out
   *  is placed in code at the end. */
  mustPlace?: string[];
  /** Newcomers (characters with no portrait) being painted for this page,
   *  by id: an <npc/> tag (or a <sprite>/<fig> for one) says where each
   *  goes, and it is laid there once painted. */
  newcomers?: Record<string, Promise<Sprite | null>>;
  /** How big a placed character may be, and where its feet may stand,
   *  for this page's camera (see sizingFor): what the model asks for is
   *  kept within it, so nobody comes out huge or tiny. */
  sizing?: Sizing;
}
export interface Sizing {
  /** the usual size for this camera */
  s: number;
  /** the band around it, as multiples of s */
  lo: number;
  hi: number;
  /** where feet may stand */
  yLo: number;
  yHi: number;
}
/** A page's sizing, from its camera (or, without one, its brief). */
export function sizingFor(camera: string | null | undefined, picture: string, characters: number): Sizing {
  const cam = camera ?? (/close[- ]?up|close shot/i.test(picture) ? "close" : /wide shot|far away|in the distance|tiny in|small in the/i.test(picture) ? "wide" : "mid");
  const crowd = characters >= 3 ? 0.9 : 1;
  if (cam === "close") return { s: 1.45 * crowd, lo: 0.8, hi: 1.15, yLo: 240, yHi: 330 };
  if (cam === "wide") return { s: 0.42 * crowd, lo: 0.8, hi: 1.2, yLo: 230, yHi: 262 };
  return { s: 0.62 * crowd, lo: 0.82, hi: 1.18, yLo: 234, yHi: 262 };
}
const sized = (ctx: ExpandContext, sc: number, y: number, small = false) => {
  const z = ctx.sizing;
  if (!z) return { sc, y };
  // (small: a newcomer may be a squirrel or a bird, far smaller than the
  // grown characters the band is for - only its upper bound holds)
  return { sc: Math.min(z.s * z.hi, Math.max(z.s * (small ? 0.3 : z.lo), sc)), y: Math.min(z.yHi, Math.max(z.yLo, y)) };
};

export interface ExpandStats {
  stamps: number;
  scatter: number;
  /** pieces moved out of the characters' space */
  moved: number;
  bareInk: number;
  kinds: Record<string, number>;
  /** figures placed from parts, and the parts put in */
  figs: number;
  torsos: number;
  heads: number;
  /** which characters were placed as figures */
  figIds: string[];
  /** figures put together entirely in code (poses, face, prop) */
  posed: number;
  /** a painter's slips mended on the way (see above) */
  fixes: string[];
}

export const newStats = (): ExpandStats => ({ stamps: 0, scatter: 0, moved: 0, bareInk: 0, kinds: {}, figs: 0, torsos: 0, heads: 0, figIds: [], posed: 0, fixes: [] });
const fixed = (stats: ExpandStats, what: string) => {
  if (stats.fixes.length < 40) stats.fixes.push(what);
};

/** The name in a table nearest to what was asked for: the same once case,
 *  spacing and a plural are set aside; else one that starts with it or it
 *  starts with; else the closest spelling (two letters off at most). Null
 *  if nothing is near enough. */
export function nearestKey(asked: string, table: Record<string, unknown>): string | null {
  const keys = Object.keys(table);
  const norm = (k: string) => k.toLowerCase().replace(/[\s_-]+/g, "");
  const a = norm(asked);
  if (!a) return null;
  const byNorm = new Map(keys.map((k) => [norm(k), k]));
  for (const c of [a, a.replace(/ies$/, "y"), a.replace(/es$/, ""), a.replace(/s$/, ""), `${a}s`]) if (byNorm.has(c)) return byNorm.get(c)!;
  const starts = keys.filter((k) => norm(k).startsWith(a) || a.startsWith(norm(k)));
  if (starts.length === 1) return starts[0];
  let best: string | null = null;
  let bestD = 3;
  for (const k of keys) {
    const d = editDistance(a, norm(k));
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return bestD <= (a.length <= 4 ? 1 : 2) ? best : null;
}
function editDistance(x: string, y: string): number {
  if (Math.abs(x.length - y.length) > 2) return 9;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
}

type Layer = "paint" | "ink" | "detail";
const LAYER_OF = (tag: string): Layer | "wash" | null => (tag.match(/class="(wash|paint|ink|detail)"/)?.[1] as Layer | "wash" | undefined) ?? null;

const INK_ATTRS = `fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"`;
const f = (n: number) => (Math.round(n * 100) / 100).toString();

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:-]+)\s*=\s*"([^"]*)"/g)) out[m[1].toLowerCase()] = m[2];
  return out;
}
/** A number from a tag, kept within lo-hi. Missing or unreadable, it takes
 *  the default (for a position with none given: the middle of the page
 *  across, the ground line down), and the mend is noted. */
function num(a: Record<string, string>, key: string, dflt: number | null, lo: number, hi: number, stats?: ExpandStats): number {
  const raw = a[key];
  const fallback = dflt ?? (key === "y" ? 244 : 200);
  if (raw === undefined || raw === "") {
    if (dflt === null && stats) fixed(stats, `"${key}" missing: ${fallback} used`);
    return fallback;
  }
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) {
    if (stats) fixed(stats, `"${key}" unreadable ("${raw.slice(0, 12)}"): ${fallback} used`);
    return fallback;
  }
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
  const asked = (a.k ?? a.kind ?? a.name ?? "").toLowerCase();
  const k = STAMPS[asked] ? asked : nearestKey(asked, STAMPS);
  if (!k) {
    fixed(stats, `no piece called "${asked}": left out`);
    return "";
  }
  if (k !== asked) fixed(stats, `piece "${asked}" read as "${k}"`);
  const kind = STAMPS[k];
  let x = num(a, "x", null, -100, 500, stats);
  const y = num(a, "y", null, -100, 400, stats);
  const s = num(a, "s", 1, 0.2, 3);
  const flip = a.flip === "1" || a.flip === "true";
  // (a numbered piece is the same wherever it's used in the book; an
  // unnumbered one is this page's own)
  const v = a.v !== undefined && a.v !== "" ? Math.floor(num(a, "v", 0, 0, 999)) : null;
  const seed = v !== null ? hashOf(`${ctx.bookSeed}:${k}:${v}`) : hashOf(`${ctx.pageSeed}:${k}:${index}`);
  // Nothing dark in the characters' space: a tree or a fence planted
  // there is moved out to the nearer side.
  const st = ctx.stage;
  // (unless it's marked as something the characters touch - the tree one
  // climbs, the log one sits on: near="1" keeps it where it was put)
  const near = a.near === "1" || a.near === "true";
  if (st && !near && kind.dark && kind.base !== "middle" && x > st.x0 && x < st.x1 && y > st.y0 && y < st.y1 + 12) {
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
  const asked = (a.k ?? a.kind ?? a.name ?? "").toLowerCase();
  const k = SCATTER[asked] ? asked : nearestKey(asked, SCATTER);
  if (!k) {
    fixed(stats, `no scatter called "${asked}": left out`);
    return "";
  }
  if (k !== asked) fixed(stats, `scatter "${asked}" read as "${k}"`);
  const kind = SCATTER[k];
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

/** A whole figure from a pose: far limbs, legs, body, near arm, what it
 *  holds, head and face - in the three layers, placed. */
function posedFigure(fig: { id: string; t: string; s: number; tilt: number; view: PartView }, parts: CharacterParts, a: Record<string, string>, three: boolean, ctx: ExpandContext, stats: ExpandStats): string {
  const roles = rolesOf(parts);
  const [nearPose, farPose] = (a.arms ?? "down,down").split(",").map((p) => p.trim().toLowerCase());
  // (a pose word not in the library: the nearest one that is)
  const pick = <T extends string>(list: readonly T[], p: string | undefined, d: T): T => {
    const w = (p ?? "").toLowerCase();
    if (!w) return d;
    if ((list as readonly string[]).includes(w)) return w as T;
    return (nearestKey(w, Object.fromEntries(list.map((x) => [x, 1]))) as T | null) ?? d;
  };
  const armPose = (p: string | undefined, d: ArmPose): ArmPose => pick(ARM_POSES, p, d);
  const legPose: LegPose = pick(LEG_POSES, a.legs, "stand");
  const mood: Mood = pick(MOODS, a.mood, "happy");
  const view = fig.view;
  const near = arm(view, roles, "near", armPose(nearPose, "down"), three);
  const far = arm(view, roles, "far", armPose(farPose ?? nearPose, "down"), three);
  const lg = legs(view, roles, legPose, three);
  const fc = face(view, roles, mood);
  // what it holds, at the near hand (or both hands, when they hold it together)
  const asked = (a.hold ?? "").toLowerCase();
  const holdKey = !asked || PROPS[asked] ? asked : (nearestKey(asked, PROPS) ?? "");
  if (asked && holdKey !== asked) fixed(stats, holdKey ? `held "${asked}" read as "${holdKey}"` : `nothing to hold called "${asked}": hands left empty`);
  const prop = PROPS[holdKey];
  let held: Piece = { paint: "", ink: "", detail: "" };
  if (prop) {
    const at = nearPose === "hug" || nearPose === "hold" ? [(near.hand[0] + far.hand[0]) / 2, (near.hand[1] + far.hand[1]) / 2] : near.hand;
    const pc = prop.draw(seeded(hashOf(`${ctx.bookSeed}:${fig.id}:${holdKey}`)), ctx.palette);
    const tr = (s: string) => (s ? `<g transform="translate(${f(at[0])} ${f(at[1])})">${s}</g>` : "");
    held = { paint: tr(pc.paint), ink: tr(pc.ink), detail: tr(pc.detail) };
    stats.kinds[`hold:${holdKey}`] = (stats.kinds[`hold:${holdKey}`] ?? 0) + 1;
  }
  const head = `<g transform="rotate(${f(fig.tilt)} ${view.anchors.neck[0]} ${view.anchors.neck[1]})">`;
  // stacking: the far arm behind the body on a three-quarter figure; legs
  // under the body; the near arm and what's held in front; the head last
  const paint = (three ? far.paint : "") + lg.far.paint + lg.near.paint + view.torso.paint + (three ? "" : far.paint) + near.paint + held.paint + head + view.head.paint + fc.paint + "</g>";
  const ink = (three ? far.ink : "") + lg.far.ink + lg.near.ink + view.torso.ink + (three ? "" : far.ink) + near.ink + held.ink + head + view.head.ink + fc.ink + "</g>";
  const detail = view.torso.detail + held.detail + head + view.head.detail + fc.detail + "</g>";
  stats.posed++;
  stats.torsos++;
  stats.heads++;
  return `<g class="paint"><g transform="${fig.t}">${paint}</g></g><g class="ink" fill="none" stroke="#4F3A2A" stroke-width="${f(1.2 / fig.s)}" stroke-linecap="round" stroke-linejoin="round"><g transform="${fig.t}">${unscaleStrokes(ink, fig.s)}</g></g><g class="detail"><g transform="${fig.t}">${detail}</g></g>`;
}

/**
 * Expands one painter's stream. `stats` is filled in as it goes.
 */
export async function* expandStream(src: AsyncIterable<string>, ctx: ExpandContext, stats: ExpandStats): AsyncGenerator<string> {
  let buf = "";
  // open groups, as written, each with what closes it (a figure's layer
  // group closes its placement too), so a piece placed inside one can be
  // laid outside it and the groups opened again after
  const open: { tag: string; close: string; layer?: string }[] = [];
  let pieces = 0;
  // A figure being placed from parts: where, how big, its view, and which
  // parts have been put in which layer.
  let fig: { id: string; t: string; s: number; tilt: number; view: PartView; put: Set<string> } | null = null;
  const layerNow = () => [...open].reverse().find((o) => o.layer)?.layer as Layer | "wash" | undefined;
  const inkAttrs = (sc: number) => `fill="none" stroke="#4F3A2A" stroke-width="${f(1.2 / sc)}" stroke-linecap="round" stroke-linejoin="round"`;
  const part = (which: "torso" | "head", layer: Layer) => {
    const shapes = fig!.view[which][layer];
    fig!.put.add(`${which}:${layer}`);
    return layer === "ink" ? unscaleStrokes(shapes, fig!.s) : shapes;
  };
  const headOpen = () => `<g transform="rotate(${f(fig!.tilt)} ${fig!.view.anchors.neck[0]} ${fig!.view.anchors.neck[1]})">`;
  /** Ends a figure: any part the painter didn't put in some layer is laid
   *  in after, so no nose or contour goes missing. */
  const endFig = (): string => {
    let out = "";
    for (const which of ["torso", "head"] as const)
      for (const layer of ["paint", "ink", "detail"] as Layer[]) {
        if (!fig!.view[which][layer] || fig!.put.has(`${which}:${layer}`)) continue;
        const open_ = layer === "ink" ? `<g class="ink" ${inkAttrs(fig!.s)}>` : `<g class="${layer}">`;
        out += `${open_}<g transform="${fig!.t}">${which === "head" ? headOpen() : ""}${part(which, layer)}${which === "head" ? "</g>" : ""}</g></g>`;
      }
    fig = null;
    return out;
  };
  /** A character's id from a tag's c= (or id=, or its name). */
  const idOf = (a: Record<string, string>): string => {
    const raw = (a.c ?? a.id ?? a.name ?? "").trim();
    const known = { ...(ctx.figures ?? {}), ...(ctx.sprites ?? {}), ...(ctx.newcomers ?? {}) };
    if (raw in known) return raw;
    const byName = ctx.ids?.[raw.toLowerCase()];
    if (byName) {
      if (byName !== raw) fixed(stats, `character "${raw}" found by name`);
      return byName;
    }
    return raw;
  };
  /** A character placed from its pre-painted poses. */
  const spriteOf = (id: string, poses: Partial<Record<string, Sprite>>, a: Record<string, string>, small = false): string => {
    const want = (a.pose ?? "stand").toLowerCase();
    // (a pose not painted for it: the nearest it has, standing first)
    const sp = poses[want] ?? poses[nearestKey(want, poses) ?? ""] ?? poses.stand ?? Object.values(poses)[0];
    if (!sp) return "";
    const x = num(a, "x", null, -100, 500, stats);
    // (size and footing kept to this page's camera)
    const { sc, y } = sized(ctx, num(a, "s", ctx.sizing?.s ?? 0.6, 0.15, 2.5), num(a, "y", null, -100, 400, stats), small);
    const flip = a.flip === "1" || a.flip === "true";
    const lean = num(a, "lean", 0, -30, 30);
    const t = `translate(${f(x)} ${f(y)}) rotate(${f(lean)}) scale(${f(flip ? -sc : sc)} ${f(sc)}) translate(-100 -190)`;
    stats.figs++;
    stats.posed++;
    if (!stats.figIds.includes(id)) stats.figIds.push(id);
    return `<g class="paint"><g transform="${t}">${sp.paint}</g></g><g class="ink" ${inkAttrs(sc)}><g transform="${t}">${unscaleStrokes(sp.ink, sc)}</g></g><g class="detail"><g transform="${t}">${sp.detail}</g></g>`;
  };
  /** A character put together whole from its parts, in a pose. */
  const posedOf = (id: string, parts: CharacterParts, a: Record<string, string>): string => {
    const v = ((a.v ?? a.view ?? "three").toLowerCase() === "front" ? "front" : "three") as View;
    const view = viewOf(parts, v);
    if (!view) return "";
    const x = num(a, "x", null, -100, 500, stats);
    const fit = sized(ctx, num(a, "s", ctx.sizing?.s ?? 0.6, 0.15, 2.5), num(a, "y", null, -100, 400, stats));
    const flip = (a.flip === "1" || a.flip === "true") !== Boolean(view.facesLeft);
    const lean = num(a, "lean", 0, -45, 45);
    // (a sprite's pose word, turned into arms, legs and mood)
    const pose = (a.pose ?? "").toLowerCase();
    const extra: Record<string, string> = { wave: "wave,down", point: "point,down", hold: "hold,hold", carry: "hold,hold", surprised: "up,up", reach: "up,up", hug: "hug,hug", peek: "reach,down", laugh: "hip,hip" };
    const moodOf: Record<string, string> = { sleep: "sleepy", surprised: "surprised", laugh: "laugh", sad: "sad" };
    const b = { ...a, arms: a.arms ?? extra[pose] ?? "down,down", legs: a.legs ?? (["walk", "run", "jump", "sit"].includes(pose) ? pose : "stand"), mood: a.mood ?? moodOf[pose] ?? "happy" };
    stats.figs++;
    if (!stats.figIds.includes(id)) stats.figIds.push(id);
    const sc = fit.sc;
    const t = `translate(${f(x)} ${f(fit.y)}) rotate(${f(lean)}) scale(${f(flip ? -sc : sc)} ${f(sc)}) translate(-100 -190)`;
    return posedFigure({ id, t, s: sc, tilt: num(a, "tilt", 0, -40, 40), view }, parts, b, view === parts.views.three, ctx, stats);
  };
  /** Any way of placing a character that it has: its poses, else its
   *  parts. Empty if it has neither. */
  const placeAny = (id: string, a: Record<string, string>): string => {
    const poses = ctx.sprites?.[id];
    if (poses && Object.keys(poses).length) return spriteOf(id, poses, a);
    const parts = ctx.figures?.[id];
    if (parts) return posedOf(id, parts, a);
    return "";
  };
  // newcomers' places, as the composer gave them: laid once they're painted
  const newcomerAt = new Map<string, Record<string, string>>();
  const isNewcomer = (id: string) => Boolean(ctx.newcomers && id in ctx.newcomers);
  // a figure for a character that can't be placed: everything up to its
  // </fig> is left out (it would be drawn in the figure's own coordinates
  // with nowhere to put them)
  let skipping = false;
  // pieces written inside a figure: laid just after it
  let afterFig = "";
  const handle = (text: string): string => {
    let out = "";
    let at = 0;
    for (const m of text.matchAll(/<[^>]*>/g)) {
      out += text.slice(at, m.index);
      at = m.index! + m[0].length;
      let tag = m[0];
      if (skipping) {
        if (/^<\s*\/\s*fig\s*>$/i.test(tag)) skipping = false;
        continue;
      }
      // ---- newcomers: where each goes (it's laid there once painted)
      if (/^<\s*(npc|sprite|fig)\b/i.test(tag)) {
        const a = attrsOf(tag);
        const id = idOf(a);
        if (isNewcomer(id)) {
          if (fig) out += endFig() + afterFig, (afterFig = "");
          if (!/^<\s*npc\b/i.test(tag)) fixed(stats, `"${id}" is new: placed as a newcomer`);
          // (inside the tap target: laid inside a target group of its own)
          const target = open.find((o) => /class="[^"]*\btarget\b/.test(o.tag));
          newcomerAt.set(id, target ? { ...a, __target: target.tag } : a);
          if (!stats.figIds.includes(id)) stats.figIds.push(id);
          if (/^<\s*fig\b/i.test(tag) && !tag.trim().endsWith("/>")) skipping = true;
          continue;
        }
        if (/^<\s*npc\b/i.test(tag)) {
          // (an <npc/> for someone who isn't new: placed as they can be)
          const made = placeAny(id, a);
          fixed(stats, made ? `"${id}" isn't new: placed from what it has` : `nobody called "${id}" to place: left out`);
          out += made;
          continue;
        }
      }
      if (/^<\s*\/\s*npc\s*>$/i.test(tag)) continue;
      // ---- characters from their pre-painted poses
      if (/^<\s*sprite\b/i.test(tag)) {
        // (a pose written inside a figure: the figure is ended first)
        if (fig) out += endFig() + afterFig, (afterFig = "");
        const a = attrsOf(tag);
        const id = idOf(a);
        const poses = ctx.sprites?.[id];
        if (poses && Object.keys(poses).length) out += spriteOf(id, poses, a);
        else {
          // (no poses for it: made from its parts instead, if it has them)
          const made = placeAny(id, a);
          fixed(stats, made ? `no poses for "${id}": put together from its parts` : `nobody called "${id}" to place: left out`);
          out += made;
        }
        continue;
      }
      // ---- figures from parts
      if (/^<\s*fig\b/i.test(tag)) {
        if (fig) out += endFig() + afterFig, (afterFig = "");
        const a = attrsOf(tag);
        const id = idOf(a);
        const parts = ctx.figures?.[id];
        const v = ((a.v ?? a.view ?? "front").toLowerCase() === "three" ? "three" : "front") as View;
        const view = parts ? viewOf(parts, v) : null;
        if (!parts || !view) {
          // (no parts for it: placed from its poses if it has them; what the
          // painter drew inside the figure is left out either way)
          const made = placeAny(id, a);
          fixed(stats, made ? `no parts for "${id}": placed from its poses` : `no parts for "${id}": left out`);
          out += made;
          if (!tag.trim().endsWith("/>")) skipping = true;
          continue;
        }
        const x = num(a, "x", null, -100, 500, stats);
        // (size and footing kept to this page's camera - except sitting,
        // whose y is the seat's)
        const seated = (a.legs ?? "").toLowerCase() === "sit";
        const fit = sized(ctx, num(a, "s", ctx.sizing?.s ?? 0.6, 0.15, 2.5), num(a, "y", null, -100, 400, stats));
        const sc = fit.sc;
        const y = seated ? num(a, "y", null, -100, 400, stats) : fit.y;
        // (a view drawn facing left is mirrored to face right first)
        const flip = (a.flip === "1" || a.flip === "true") !== Boolean(view.facesLeft);
        const lean = num(a, "lean", 0, -45, 45);
        fig = {
          id,
          s: sc,
          tilt: num(a, "tilt", 0, -40, 40),
          view,
          put: new Set(),
          // (feet at 100,190 on its own canvas: placed at x,y, leaned about the feet)
          t: `translate(${f(x)} ${f(y)}) rotate(${f(lean)}) scale(${f(flip ? -sc : sc)} ${f(sc)}) translate(-100 -190)`,
        };
        stats.figs++;
        if (!stats.figIds.includes(id)) stats.figIds.push(id);
        // A figure given as a pose (arms, legs, mood, what it holds) is put
        // together here, whole: nothing of it is painted.
        if (a.arms !== undefined || a.legs !== undefined || a.mood !== undefined || tag.trim().endsWith("/>")) {
          out += posedFigure(fig, parts!, a, view === parts!.views.three, ctx, stats);
          fig = null;
        }
        continue;
      }
      if (/^<\s*\/\s*fig\s*>$/i.test(tag)) {
        if (fig) out += endFig();
        out += afterFig;
        afterFig = "";
        continue;
      }
      if (fig && /^<\s*(torso|head)\b/i.test(tag)) {
        const which = /^<\s*torso/i.test(tag) ? "torso" : "head";
        const layer = layerNow();
        // (outside a paint, ink or detail group: left for the figure's end,
        // which lays in any part not yet put)
        if (!layer || layer === "wash") {
          fixed(stats, `a ${which} outside a layer group: laid in at the figure's end`);
          continue;
        }
        stats[which === "torso" ? "torsos" : "heads"]++;
        if (which === "torso") out += part("torso", layer);
        else {
          out += headOpen() + part("head", layer);
          // (the painter's face goes inside the head, and turns with it)
          if (!tag.endsWith("/>")) open.push({ tag: "<head>", close: "</g>" });
          else out += "</g>";
        }
        continue;
      }
      if (/^<\s*\/\s*(torso|head)\s*>$/i.test(tag)) {
        if (/head/i.test(tag) && open.length && open[open.length - 1].tag === "<head>") out += open.pop()!.close;
        continue;
      }
      // ---- standard pieces
      if (/^<\s*(stamp|scatter)\b/i.test(tag)) {
        if (!ctx.stamps) {
          fixed(stats, "a piece where pieces aren't offered: left out");
          continue;
        }
        const made = /^<\s*stamp/i.test(tag) ? stamp(tag, ctx, stats, pieces++) : scatter(tag, ctx, stats, pieces++);
        // (written inside a figure, which is in its own coordinates: laid
        // just after the figure, at the page's)
        if (fig) {
          afterFig += made;
          continue;
        }
        // (laid outside any layer group it was written in - but inside the
        // tap target's group, if it's part of the target)
        let keep = 0;
        for (let i = open.length - 1; i >= 0; i--)
          if (/class="[^"]*\btarget\b/.test(open[i].tag)) {
            keep = i + 1;
            break;
          }
        const closing = open.slice(keep);
        out += closing.map((o) => o.close).join("") + made + closing.map((o) => o.tag).join("");
        continue;
      }
      if (/^<\s*\/\s*(stamp|scatter)\s*>$/i.test(tag)) continue;
      // ---- ordinary markup
      if (/^<g\s+class="ink"\s*>$/.test(tag)) {
        tag = `<g class="ink" ${fig ? inkAttrs(fig.s) : INK_ATTRS}>`;
        stats.bareInk++;
      } else if (fig && /stroke-width="/.test(tag)) {
        // (inside a figure everything is scaled: pen widths are divided by
        // the scale, so the line weight matches the rest of the picture)
        tag = unscaleStrokes(tag, fig.s);
      }
      if (/^<g[\s>]/.test(tag) && !tag.endsWith("/>")) {
        const layer = LAYER_OF(tag);
        // (a layer group inside a figure carries the figure's placement)
        if (fig && layer && !layerNow()) {
          open.push({ tag, close: "</g></g>", layer });
          out += `${tag}<g transform="${fig.t}">`;
          continue;
        }
        open.push({ tag, close: "</g>", layer: layer ?? undefined });
        out += tag;
        continue;
      }
      if (/^<\/g\s*>$/.test(tag)) {
        out += open.pop()?.close ?? "</g>";
        continue;
      }
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
  let tail = buf ? handle(buf) : "";
  if (fig) tail += endFig();
  tail += afterFig;
  // (an unclosed group left by a painter cut short: closed, so the
  // picture's markup is whole)
  while (open.length) tail += open.pop()!.close;
  // On a composed page every character is placed by a tag: one the
  // composer left out is placed here, spread along the ground, so nobody
  // is missing from the picture.
  const missing = (ctx.mustPlace ?? []).filter((id) => !stats.figIds.includes(id));
  // (a newcomer the composer left out: given a place like anyone else)
  for (const id of missing.filter(isNewcomer)) {
    newcomerAt.set(id, { x: String(200 + 90 * (newcomerAt.size % 2 ? -1 : 1)), y: String(ctx.sizing ? Math.round((ctx.sizing.yLo + ctx.sizing.yHi) / 2) : 246), s: String((ctx.sizing?.s ?? 0.6) * 0.8) });
    fixed(stats, `newcomer "${id}" wasn't placed: placed in code`);
  }
  // Newcomers, laid where the composer put them once they're painted (they
  // come last: in front of the rest). One that couldn't be painted is noted.
  if (newcomerAt.size) {
    if (tail) yield tail;
    tail = "";
    for (const [id, a] of newcomerAt) {
      const sp = await ctx.newcomers![id].catch(() => null);
      if (!sp) {
        fixed(stats, `newcomer "${id}" couldn't be painted: left out`);
        continue;
      }
      const made = spriteOf(id, { stand: sp }, { ...a, pose: "stand" }, true);
      tail += a.__target ? `${a.__target}${made}</g>` : made;
    }
  }
  missing.filter((id) => !isNewcomer(id)).forEach((id, i) => {
    const x = Math.round(200 + (i - (missing.length - 1) / 2) * 70);
    const made = placeAny(id, { x: String(x), y: String(ctx.sizing ? Math.round((ctx.sizing.yLo + ctx.sizing.yHi) / 2) : 246), pose: "stand", v: "three" });
    if (made) {
      fixed(stats, `"${id}" wasn't placed: placed in code`);
      tail += made;
    }
  });
  if (tail) yield tail;
}

/** The size line the composers and painters are given (see sizingFor). */
export const sizeLine = (z: Sizing) =>
  `SIZE ON THIS PAGE: a grown character is about s="${z.s.toFixed(2)}" (kept between ${(z.s * z.lo).toFixed(2)} and ${(z.s * z.hi).toFixed(2)}); smaller ones (a baby, a mouse) toward the low end. Feet stand between y ${z.yLo} and ${z.yHi}.`;
