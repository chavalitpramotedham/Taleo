/**
 * Poses and expressions made in code, for characters painted from parts
 * (see parts): arms, legs and faces drawn from a character's own anchors
 * and colours, so a figure can be put together with no painting at all -
 * "Pip, three-quarter, waving, walking, laughing, holding a basket".
 *
 * Arms and legs are soft tapered tubes in the character's limb colour,
 * ending in a hand or paw and a foot, with broken pen lines that start
 * clear of the body (no line across a joint). Faces are the house style's:
 * dark eyes with a white highlight or laughing arcs, short brows, a small
 * mouth, rosy cheeks. Everything is on the character's own 200x200 canvas.
 */
import type { PartView, Pt } from "./parts";
import type { Piece } from "./stamps";

export const ARM_POSES = ["down", "wave", "up", "hip", "point", "reach", "hold", "hug"] as const;
export const LEG_POSES = ["stand", "walk", "run", "jump", "sit", "kick"] as const;
export const MOODS = ["happy", "laugh", "surprised", "worried", "sad", "sleepy", "cross", "wink", "calm"] as const;
export type ArmPose = (typeof ARM_POSES)[number];
export type LegPose = (typeof LEG_POSES)[number];
export type Mood = (typeof MOODS)[number];

/** The colours and proportions a character's limbs and face are drawn with. */
export interface Build {
  limb: string;
  /** the far-side limbs, a shade darker */
  limbFar: string;
  hand: string;
  foot: string;
  /** a pale pad or the top of a foot (optional) */
  footPad?: string;
  eye: string;
  mouth: string;
  tongue: string;
  cheek: string;
  /** proportions against the default (1): long rabbit feet, short bear arms */
  arm?: number;
  leg?: number;
  foot_?: number;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const len = (a: Pt) => Math.hypot(a[0], a[1]) || 1;
const unit = (a: Pt): Pt => mul(a, 1 / len(a));
const perp = (a: Pt): Pt => [-a[1], a[0]];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A bent limb from `a` through `bend` to `b`: paint (a soft tube) and pen
 *  (both edges, starting a little way from the body). */
function limb(a: Pt, b: Pt, bendDir: Pt, bend: number, w: number, colour: string): Piece & { mid: Pt } {
  const mid = add(lerp(a, b, 0.5), mul(unit(bendDir), bend));
  // (the control point that makes the curve pass through `mid`)
  const c = sub(mul(mid, 2), mul(add(a, b), 0.5));
  const q = (p0: Pt, p1: Pt, p2: Pt) => `M${f(p0[0])} ${f(p0[1])}Q${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])}`;
  // (the curve from t = 0.3 on, for the pen: de Casteljau's split)
  const t = 0.3;
  const p01 = lerp(a, c, t);
  const p12 = lerp(c, b, t);
  const s = lerp(p01, p12, t);
  const edge = (side: number) => {
    const n0 = mul(unit(perp(sub(p12, s))), (side * w) / 2);
    const n1 = mul(unit(perp(sub(b, p12))), (side * w) / 2);
    const nm = mul(unit(add(n0, n1)), w / 2);
    return q(add(s, n0), add(p12, nm), add(b, n1));
  };
  return {
    paint: `<path d="${q(a, c, b)}" fill="none" stroke="${colour}" stroke-width="${f(w)}" stroke-linecap="round"/>`,
    ink: `<path d="${edge(1)}"/><path d="${edge(-1)}"/>`,
    detail: "",
    mid,
  };
}

/** Where a hand ends up for a pose: x along "out" (front view: away from
 *  the body; three-quarter: forward), y down - in arm lengths. */
const ARM_FRONT: Record<ArmPose, [number, number, number]> = {
  // [out, down, elbow bend outward]
  down: [0.28, 0.95, 0.12],
  wave: [0.62, -0.78, 0.22],
  up: [0.3, -1.0, 0.1],
  hip: [0.12, 0.72, 0.5],
  point: [1.0, -0.15, 0.06],
  reach: [0.95, 0.3, 0.08],
  hold: [-0.5, 0.62, 0.3],
  hug: [-0.8, 0.32, 0.3],
};
const ARM_THREE: Record<ArmPose, [number, number, number]> = {
  down: [0.06, 0.98, 0.1],
  wave: [0.38, -0.88, 0.2],
  up: [0.22, -1.0, 0.1],
  hip: [-0.25, 0.68, 0.45],
  point: [1.0, -0.12, 0.06],
  reach: [1.0, 0.25, 0.08],
  hold: [0.78, 0.55, 0.25],
  hug: [0.7, 0.32, 0.3],
};

/** One arm: from a shoulder, to where the pose puts the hand. */
export function arm(view: PartView, build: Build, side: "near" | "far", pose: ArmPose, three: boolean): Piece & { hand: Pt } {
  const a = view.anchors;
  const sh = side === "near" ? a.shoulderL : a.shoulderR;
  const sw = Math.max(26, Math.abs(a.shoulderR[0] - a.shoulderL[0]));
  const L = Math.max(30, sw * (three ? 1.15 : 0.95) * (build.arm ?? 1));
  const w = Math.max(7, sw * 0.27);
  // out: away from the body (front) or forward (three-quarter, facing right)
  const out = three ? 1 : side === "near" ? -1 : 1;
  const [ox, oy, bend] = (three ? ARM_THREE : ARM_FRONT)[pose];
  const hand: Pt = add(sh, [ox * out * L, oy * L]);
  // (elbows bend outward, or down and back on a three-quarter figure)
  const bendDir: Pt = three ? [-0.4, 1] : [out, 0.3];
  const colour = side === "far" && three ? build.limbFar : build.limb;
  const l = limb(sh, hand, bendDir, bend * L, w, colour);
  const r = w * 0.62;
  return {
    paint: l.paint + `<circle cx="${f(hand[0])}" cy="${f(hand[1])}" r="${f(r)}" fill="${build.hand}"/>`,
    ink: l.ink + `<path d="M${f(hand[0] - r)} ${f(hand[1])}A${f(r)} ${f(r)} 0 0 0 ${f(hand[0] + r * 0.7)} ${f(hand[1] + r * 0.7)}" stroke-width="0.9"/>`,
    detail: "",
    hand,
  };
}

/** Both legs, for a pose. */
export function legs(view: PartView, build: Build, pose: LegPose, three: boolean): { far: Piece; near: Piece } {
  const a = view.anchors;
  const hipW = Math.max(18, Math.abs(a.hipR[0] - a.hipL[0]));
  const lw = Math.max(9, hipW * 0.55) * (build.leg ?? 1);
  const LL = Math.max(16, 190 - (a.hipL[1] + a.hipR[1]) / 2);
  const fw = lw * 0.85 * (build.foot_ ?? 1);
  const fwd = three ? 1 : 0;
  // feet: [dx, y] from each hip, near and far
  const feet: Record<LegPose, [Pt, Pt]> = {
    stand: [[three ? 2 : -3, 188], [three ? 4 : 3, 188]],
    walk: [[fwd * 14 - (three ? 0 : 4), 188], [-fwd * 10 + (three ? 0 : 5), 185]],
    run: [[fwd * 24 + (three ? 0 : -8), 178], [-fwd * 22 + (three ? 0 : 9), 176]],
    jump: [[fwd * 6 - 3, a.hipL[1] + LL * 0.55], [fwd * 2 + 3, a.hipR[1] + LL * 0.5]],
    sit: [[fwd * 26 + (three ? 0 : -12), a.hipL[1] + LL * 0.75], [fwd * 22 + (three ? 0 : 12), a.hipR[1] + LL * 0.7]],
    kick: [[fwd * 26 + (three ? 0 : -16), a.hipL[1] + 4], [three ? -2 : 3, 188]],
  };
  const one = (hip: Pt, foot: [number, number], colour: string): Piece => {
    const end: Pt = [hip[0] + foot[0], foot[1]];
    const l = limb(hip, [end[0], end[1] - lw * 0.25], [fwd ? 1 : 0.1, 0.2], LL * 0.08, lw, colour);
    const fx = end[0] + (fwd ? fw * 0.35 : 0);
    return {
      paint: l.paint + `<ellipse cx="${f(fx)}" cy="${f(end[1])}" rx="${f(fw)}" ry="${f(lw * 0.36)}" fill="${build.foot}"/>` + (build.footPad ? `<ellipse cx="${f(fx + (fwd ? fw * 0.25 : 0))}" cy="${f(end[1])}" rx="${f(fw * 0.45)}" ry="${f(lw * 0.2)}" fill="${build.footPad}"/>` : ""),
      ink: l.ink + `<path d="M${f(fx - fw)} ${f(end[1])}C${f(fx - fw)} ${f(end[1] - lw * 0.45)} ${f(fx + fw)} ${f(end[1] - lw * 0.45)} ${f(fx + fw)} ${f(end[1])}" stroke-width="0.9"/>`,
      detail: "",
    };
  };
  const [n, fa] = feet[pose];
  return { near: one(a.hipL, n, build.limb), far: one(a.hipR, fa, three ? build.limbFar : build.limb) };
}

/** A face, for a mood, on the head's eye and mouth points. */
export function face(view: PartView, build: Build, mood: Mood): Piece {
  const { eyeL, eyeR, mouth } = view.anchors;
  const d = Math.max(12, Math.hypot(eyeR[0] - eyeL[0], eyeR[1] - eyeL[1]));
  const r = Math.min(5.5, Math.max(2.4, d * 0.15));
  const open = (e: Pt, k = 1, look: Pt = [0, 0]) =>
    `<ellipse cx="${f(e[0] + look[0])}" cy="${f(e[1] + look[1])}" rx="${f(r * k)}" ry="${f(r * 1.2 * k)}" fill="${build.eye}"/><circle cx="${f(e[0] + look[0] + r * 0.35 * k)}" cy="${f(e[1] + look[1] - r * 0.4 * k)}" r="${f(r * 0.38 * k)}" fill="#FFFFFF"/>`;
  const arc = (e: Pt) => `<path d="M${f(e[0] - r * 1.5)} ${f(e[1] + r * 0.4)}Q${f(e[0])} ${f(e[1] - r * 1.5)} ${f(e[0] + r * 1.5)} ${f(e[1] + r * 0.4)}" stroke-width="1.7"/>`;
  const lid = (e: Pt) => `<path d="M${f(e[0] - r * 1.3)} ${f(e[1])}Q${f(e[0])} ${f(e[1] + r * 0.9)} ${f(e[0] + r * 1.3)} ${f(e[1])}" stroke-width="1.6"/>`;
  // brows: k = how high, tilt = inner ends up (worry) or down (cross)
  const brow = (e: Pt, inner: number, k: number, tilt: number) => {
    const y = e[1] - r * k;
    const w = d * 0.18;
    const sgn = inner;
    return `<path d="M${f(e[0] - w)} ${f(y + (sgn < 0 ? -tilt : tilt))}Q${f(e[0])} ${f(y - 2)} ${f(e[0] + w)} ${f(y + (sgn < 0 ? tilt : -tilt))}" stroke-width="1.4"/>`;
  };
  // (which way is "inner" for each eye)
  const inL = eyeR[0] > eyeL[0] ? 1 : -1;
  const brows = (k: number, tilt: number) => brow(eyeL, inL, k, tilt) + brow(eyeR, -inL, k, tilt);
  const mw = d * 0.32;
  const [mx, my] = mouth;
  const smile = `<path d="M${f(mx - mw)} ${f(my - 1)}Q${f(mx)} ${f(my + mw * 0.7)} ${f(mx + mw)} ${f(my - 1)}" stroke-width="1.3"/>`;
  const grin = `<path d="M${f(mx - mw)} ${f(my - 2)}C${f(mx - mw * 0.7)} ${f(my + mw * 1.1)} ${f(mx + mw * 0.7)} ${f(my + mw * 1.1)} ${f(mx + mw)} ${f(my - 2)}Q${f(mx)} ${f(my + 1)} ${f(mx - mw)} ${f(my - 2)}Z" fill="${build.mouth}"/>`;
  const tongue = `<path d="M${f(mx - mw * 0.45)} ${f(my + mw * 0.5)}Q${f(mx)} ${f(my + mw * 0.85)} ${f(mx + mw * 0.45)} ${f(my + mw * 0.5)}Z" fill="${build.tongue}"/>`;
  const oh = `<ellipse cx="${f(mx)}" cy="${f(my + 2)}" rx="${f(mw * 0.35)}" ry="${f(mw * 0.5)}" fill="${build.mouth}"/>`;
  const flat = `<path d="M${f(mx - mw * 0.7)} ${f(my + 1)}L${f(mx + mw * 0.7)} ${f(my)}" stroke-width="1.3"/>`;
  const frown = `<path d="M${f(mx - mw * 0.8)} ${f(my + 3)}Q${f(mx)} ${f(my - mw * 0.4)} ${f(mx + mw * 0.8)} ${f(my + 3)}" stroke-width="1.3"/>`;
  const wobble = `<path d="M${f(mx - mw * 0.8)} ${f(my + 1)}q${f(mw * 0.4)} -3 ${f(mw * 0.8)} 0t${f(mw * 0.8)} 0" stroke-width="1.2"/>`;
  const cheeks = `<ellipse cx="${f(eyeL[0] - inL * r * 0.6)}" cy="${f(eyeL[1] + r * 2.6)}" rx="${f(r * 1.4)}" ry="${f(r * 0.75)}" fill="${build.cheek}" opacity="0.5"/><ellipse cx="${f(eyeR[0] + inL * r * 0.6)}" cy="${f(eyeR[1] + r * 2.6)}" rx="${f(r * 1.4)}" ry="${f(r * 0.75)}" fill="${build.cheek}" opacity="0.5"/>`;
  switch (mood) {
    case "laugh":
      return { paint: cheeks, ink: arc(eyeL) + arc(eyeR) + brows(3, 0) + grin, detail: tongue };
    case "surprised":
      return { paint: cheeks, ink: brows(3.6, 0) + oh, detail: open(eyeL, 1.25) + open(eyeR, 1.25) };
    case "worried":
      return { paint: "", ink: brows(2.6, 2.2) + wobble, detail: open(eyeL) + open(eyeR) };
    case "sad":
      return { paint: "", ink: brows(2.6, 2.6) + frown, detail: open(eyeL, 1, [0, r * 0.3]) + open(eyeR, 1, [0, r * 0.3]) };
    case "sleepy":
      return { paint: cheeks, ink: lid(eyeL) + lid(eyeR) + smile, detail: "" };
    case "cross":
      return { paint: "", ink: brows(2.2, -2.4) + flat, detail: open(eyeL, 0.9) + open(eyeR, 0.9) };
    case "wink":
      return { paint: cheeks, ink: arc(eyeL) + brows(2.8, 0) + grin, detail: open(eyeR) + tongue };
    case "calm":
      return { paint: cheeks, ink: brows(2.6, 0) + smile, detail: open(eyeL, 0.9) + open(eyeR, 0.9) };
    default:
      return { paint: cheeks, ink: brows(2.8, 0) + smile, detail: open(eyeL) + open(eyeR) };
  }
}
