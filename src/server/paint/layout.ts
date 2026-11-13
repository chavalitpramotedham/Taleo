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
}

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

export function layoutComposed(markup: string, opts: LayoutOptions = {}): { markup: string; notes: string[] } {
  const notes: string[] = [];
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
  if (placed.length < 2) return { markup, notes };

  // 1. Ease apart anyone overlapping more than a touch, left to right,
  // keeping their order across the picture.
  const byX = [...placed].sort((a, b) => a.x - b.x);
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i + 1 < byX.length; i++) {
      const a = byX[i];
      const b = byX[i + 1];
      // (well apart in depth - one far behind, much smaller - they may cross)
      if (Math.abs(a.y - b.y) > 40 || Math.max(a.s, b.s) / Math.min(a.s, b.s) > 1.8) continue;
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

  // Write the changes into the tags.
  let out = markup;
  const edits = placed
    .map((p) => ({ p, tag: setAttr(setAttr(p.tag, "x", String(Math.round(p.x))), "flip", p.flip ? "1" : "0") }))
    .filter(({ p, tag }) => tag !== p.tag)
    .sort((a, b) => b.p.start - a.p.start);
  for (const { p, tag } of edits) out = out.slice(0, p.start) + tag + out.slice(p.end);

  // 3. The target is never hidden: a character written after it (so drawn
  // over it) that overlaps it is moved to just before it.
  const target = opts.targetId;
  if (target) {
    const tags = [...out.matchAll(CHAR_TAG)].filter((m) => !(/^<\s*fig\b/i.test(m[0]) && !m[0].trim().endsWith("/>")));
    const ti = tags.findIndex((m) => (attr(m[0], "c") ?? attr(m[0], "id")) === target);
    if (ti >= 0) {
      const t = tags[ti];
      const tx = Number(attr(t[0], "x"));
      const ts = Number(attr(t[0], "s")) || opts.usualS || 0.6;
      const over = tags.slice(ti + 1).filter((m) => {
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
  return { markup: out, notes };
}
