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

export const ARM_POSES = ["down", "wave", "up", "hip", "point", "reach", "hold", "hug", "carry", "clap", "chin", "cover", "shrug"] as const;
export const LEG_POSES = ["stand", "walk", "run", "jump", "sit", "kick", "tiptoe", "crouch"] as const;
export const MOODS = ["happy", "laugh", "excited", "surprised", "worried", "scared", "sad", "shy", "sleepy", "cross", "determined", "wink", "calm", "talk"] as const;
/** What each arm word does, for the composer's brief. */
export const ARM_HINTS: Record<(typeof ARM_POSES)[number], string> = {
  down: "relaxed at the side (swings in step when walking or running)",
  wave: "raised, waving",
  up: "straight up (cheering, reaching high)",
  hip: "hand on hip",
  point: "pointing ahead",
  reach: "stretched out forward",
  hold: "hands together in front (holding something small)",
  hug: "arms round the front (a hug, or hugging something)",
  carry: "both arms round something big in front, at the chest",
  clap: "hands clapping together, high in front",
  chin: "hand to the chin, thinking",
  cover: "hand over the eyes (peeking, hiding, giggling)",
  shrug: "palms up and out (who knows?)",
};
/** Which way the eyes look (the face turns its pupils): for the composer. */
export const LOOKS = ["ahead", "left", "right", "up", "down"] as const;
export type Look = (typeof LOOKS)[number];
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
  /** thin pen-line limbs (food and object characters: a strawberry, a
   *  teapot), with small dark hands and boots, not full animal limbs */
  thin?: boolean;
}

/** A thin pen-line limb (see Build.thin): one curved dark line. */
function thinLimb(a: Pt, b: Pt, bendDir: Pt, bend: number, colour: string): Piece & { mid: Pt; dir: Pt } {
  const mid = add(lerp(a, b, 0.5), mul(unit(bendDir), bend));
  const c = sub(mul(mid, 2), mul(add(a, b), 0.5));
  return {
    paint: `<path d="M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}" fill="none" stroke="${colour}" stroke-width="2.4" stroke-linecap="round"/>`,
    ink: "",
    detail: "",
    mid,
    dir: unit(sub(b, c)),
  };
}
const THIN_INK = "#3B2A20";

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const len = (a: Pt) => Math.hypot(a[0], a[1]) || 1;
const unit = (a: Pt): Pt => mul(a, 1 / len(a));
const perp = (a: Pt): Pt => [-a[1], a[0]];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A limb from `a` through a bent joint to `b`: a filled, tapering shape
 *  (thick at the body, slimmer at the wrist or ankle), a darker glaze down
 *  its underside, and pen on both edges starting a little way from the
 *  body (no line across a joint). `bend` pushes the joint out along
 *  `bendDir`. */
function limb(a: Pt, b: Pt, bendDir: Pt, bend: number, w0: number, w1: number, colour: string): Piece & { mid: Pt; dir: Pt } {
  const mid = add(lerp(a, b, 0.5), mul(unit(bendDir), bend));
  // (the curve through `mid`: a quadratic whose control point is set so)
  const c = sub(mul(mid, 2), mul(add(a, b), 0.5));
  const at = (t: number): Pt => add(add(mul(a, (1 - t) * (1 - t)), mul(c, 2 * t * (1 - t))), mul(b, t * t));
  const tan = (t: number): Pt => unit(add(mul(sub(c, a), 2 * (1 - t)), mul(sub(b, c), 2 * t)));
  const N = 12;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = at(t);
    // (a touch fuller at the elbow or knee, as a real limb is)
    const w = (w0 + (w1 - w0) * t) * (1 + 0.08 * Math.sin(Math.PI * t));
    const n = mul(perp(tan(t)), w / 2);
    left.push(add(p, n));
    right.push(sub(p, n));
  }
  const pts = (list: Pt[]) => list.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("");
  const outline = `${pts(left)}${right
    .slice()
    .reverse()
    .map((p) => `L${f(p[0])} ${f(p[1])}`)
    .join("")}Z`;
  // (the underside: the side away from the light, which is upper left)
  const under = left[N >> 1][1] > right[N >> 1][1] ? left : right;
  const glaze = pts(under.slice(2).map((p, i) => lerp(p, at((i + 2) / N), 0.45)));
  return {
    paint: `<path d="${outline}" fill="${colour}"/><path d="${glaze}" fill="none" stroke="#4A3020" stroke-opacity="0.16" stroke-width="${f(Math.max(1.4, w1 * 0.35))}" stroke-linecap="round"/>`,
    ink: `<path d="${pts(left.slice(4))}" stroke-width="1.05"/><path d="${pts(right.slice(4))}" stroke-width="0.85"/>`,
    detail: "",
    mid,
    dir: tan(1),
  };
}

/** Where a hand ends up for a pose: x along "out" (front view: away from
 *  the body; three-quarter: forward), y down - in arm lengths; then how
 *  far the elbow bends out. */
const ARM_FRONT: Record<ArmPose, [number, number, number]> = {
  down: [0.3, 0.92, 0.14],
  wave: [0.66, -0.74, 0.26],
  up: [0.32, -1.0, 0.1],
  hip: [0.16, 0.66, 0.55],
  point: [1.0, -0.15, 0.06],
  reach: [0.88, 0.3, 0.16],
  hold: [-0.5, 0.6, 0.3],
  // (open and round, to go round whoever is in the hug: crossed over its
  // own chest it hugged itself - lesson 17)
  hug: [0.6, 0.18, 0.34],
  carry: [-0.3, 0.42, 0.42],
  clap: [-0.62, 0.05, 0.3],
  chin: [-0.5, -0.2, 0.4],
  cover: [-0.55, -0.55, 0.35],
  shrug: [0.75, 0.15, 0.4],
};
const ARM_THREE: Record<ArmPose, [number, number, number]> = {
  down: [0.06, 0.98, 0.12],
  wave: [0.42, -0.86, 0.22],
  up: [0.24, -1.0, 0.1],
  hip: [-0.25, 0.66, 0.48],
  point: [1.0, -0.12, 0.06],
  reach: [0.92, 0.25, 0.16],
  hold: [0.78, 0.55, 0.26],
  hug: [0.72, 0.3, 0.32],
  carry: [0.68, 0.4, 0.4],
  clap: [0.72, -0.05, 0.3],
  chin: [0.42, -0.25, 0.45],
  cover: [0.42, -0.6, 0.4],
  shrug: [0.35, 0.1, 0.45],
};

/** One arm: from a shoulder to where the pose puts the hand, with a hand
 *  (or paw) shaped for what it does - open and spread for a wave, a finger
 *  out for pointing, cupped for holding - turned along the forearm.
 *  `swing`: for walking and running, a relaxed arm swings (+1 forward,
 *  -1 back). */
export function arm(view: PartView, build: Build, side: "near" | "far", pose: ArmPose, three: boolean, swing = 0): Piece & { hand: Pt } {
  const a = view.anchors;
  const sh = side === "near" ? a.shoulderL : a.shoulderR;
  const sw = Math.max(26, Math.abs(a.shoulderR[0] - a.shoulderL[0]));
  // (from the shoulders' width, but never longer than a body's arm: a
  // broad figure - a shawl, a giant's tunic - had arms like poles reaching
  // across the room. About a third of the 170-tall figure at most.)
  const L = Math.min(62 * (build.arm ?? 1), Math.max(32, sw * (three ? 1.2 : 1.0) * (build.arm ?? 1)));
  const w0 = Math.max(8, sw * 0.32);
  const w1 = w0 * 0.72;
  const out = three ? 1 : side === "near" ? -1 : 1;
  let [ox, oy, bend] = (three ? ARM_THREE : ARM_FRONT)[pose];
  // (a relaxed arm swings with the stride)
  if (pose === "down" && swing) [ox, oy, bend] = three ? [0.5 * swing, 0.82, 0.18] : [ox + 0.12 * swing, 0.86, 0.16];
  let hand: Pt = add(sh, [ox * out * L, oy * L]);
  // (to the face: the hand goes to the chin, or over the near eye)
  if (pose === "chin") hand = add(a.mouth, [three ? 6 : side === "near" ? -8 : 8, w1 * 1.6]);
  if (pose === "cover") hand = add(side === "near" ? a.eyeL : a.eyeR, [0, 1]);
  const bendDir: Pt = three ? [-0.45, 1] : [out, 0.3];
  const colour = side === "far" && three ? build.limbFar : build.limb;
  const l = build.thin ? thinLimb(sh, hand, bendDir, bend * L, THIN_INK) : limb(sh, hand, bendDir, bend * L, w0, w1, colour);
  // (a little round hand on a thin limb, a paw on a full one)
  const r = build.thin ? 3.4 : w1 * 0.78;
  const ang = (Math.atan2(l.dir[1], l.dir[0]) * 180) / Math.PI;
  const tip = add(hand, mul(l.dir, r * 0.9));
  const handPaint = `<ellipse cx="${f(hand[0])}" cy="${f(hand[1])}" rx="${f(r * 1.12)}" ry="${f(r * 0.9)}" transform="rotate(${f(ang)} ${f(hand[0])} ${f(hand[1])})" fill="${build.thin ? THIN_INK : build.hand}"/>`;
  const fan = (n: number, spread: number) =>
    Array.from({ length: n }, (_, i) => {
      const t = ((i - (n - 1) / 2) * spread * Math.PI) / 180;
      const d: Pt = [l.dir[0] * Math.cos(t) - l.dir[1] * Math.sin(t), l.dir[0] * Math.sin(t) + l.dir[1] * Math.cos(t)];
      const s0 = add(hand, mul(d, r * 0.55));
      const s1 = add(hand, mul(d, r * 1.25));
      return `<path d="M${f(s0[0])} ${f(s0[1])}L${f(s1[0])} ${f(s1[1])}" stroke-width="0.8"/>`;
    }).join("");
  let extraPaint = "";
  let handInk = `<path d="M${f(hand[0] - r)} ${f(hand[1])}A${f(r)} ${f(r)} 0 0 0 ${f(hand[0] + r * 0.7)} ${f(hand[1] + r * 0.7)}" stroke-width="0.9"/>`;
  if (pose === "wave" || pose === "shrug" || pose === "up") handInk += fan(3, 22);
  else if (pose === "point") {
    // (one finger out, along the arm)
    const fEnd = add(tip, mul(l.dir, r * 0.9));
    extraPaint = `<path d="M${f(tip[0])} ${f(tip[1])}L${f(fEnd[0])} ${f(fEnd[1])}" stroke="${build.hand}" stroke-width="${f(r * 0.6)}" stroke-linecap="round"/>`;
    handInk += `<path d="M${f(tip[0])} ${f(tip[1])}L${f(fEnd[0])} ${f(fEnd[1])}" stroke-width="0.8"/>`;
  } else if (pose === "hold" || pose === "carry" || pose === "hug" || pose === "clap") {
    // (cupped: a thumb over the top)
    const th = add(hand, mul(perp(l.dir), -r * 0.7));
    handInk += `<path d="M${f(th[0] - r * 0.4)} ${f(th[1])}q${f(r * 0.4)} ${f(-r * 0.5)} ${f(r * 0.9)} 0" stroke-width="0.85"/>`;
  }
  return { paint: l.paint + handPaint + extraPaint, ink: l.ink + handInk, detail: "", hand };
}

/** How far a seated figure's hips come down from standing (canvas units):
 *  about half its leg, so it sits on its seat with its feet on the floor
 *  rather than standing on the seat with stubs dangling (part 2). The
 *  layout puts a sitter's feet this far below its seat's top less the
 *  thigh, see SIT_FEET. */
// (always so its hips land SIT_FEET above its feet: the layout seats
// everyone - on a chair, in a boat, in bed - by that one measure; long
// legs fold up more, knees high, as a child's do on a low seat)
const sitDrop = (view: PartView) => Math.max(0, Math.round(190 - (view.anchors.hipL[1] + view.anchors.hipR[1]) / 2 - SIT_FEET));
const legLength = (view: PartView) => Math.max(MIN_LEG, 190 - (view.anchors.hipL[1] + view.anchors.hipR[1]) / 2);
/** The least leg a figure shows. A round body that reaches the ground - a
 *  baby elephant, an owl, a penguin, a steamed bun - had its legs hidden
 *  under it and only flat feet showing, so it looked seated on every page
 *  (part 2): its body is lifted until this much leg shows. */
const MIN_LEG = 24;
const legRoom = (view: PartView) => Math.max(0, MIN_LEG - (190 - (view.anchors.hipL[1] + view.anchors.hipR[1]) / 2));
/** Where a sitter's feet are below the top of what it sits on, in canvas
 *  units at scale 1 (most figures: hips at ~165, a leg of ~25, so hips come
 *  down 11 and the shins hang ~14 below the seat). */
export const SIT_FEET = 14;

/** How a pose carries the whole figure, in its own coordinates: lifted off
 *  the ground (a jump), lower (a crouch, or sitting down on a seat),
 *  leaning into a run. */
export function bodyOf(pose: LegPose, view?: PartView, three = true): { lift: number; lean: number } {
  const room = view ? legRoom(view) : 0;
  if (pose === "jump") return { lift: 22 + room, lean: 0 };
  if (pose === "crouch") return { lift: room - (view ? Math.round(legLength(view) * 0.3) : 10), lean: 4 };
  if (pose === "sit") return { lift: view ? -sitDrop(view) : -11, lean: 0 };
  if (pose === "run") return { lift: 4 + room, lean: 9 };
  if (pose === "walk") return { lift: 1 + room, lean: 3 };
  if (pose === "tiptoe") return { lift: 1 + room, lean: -2 };
  return { lift: room, lean: 0 };
}

/** Both legs, for a pose: thigh and shin tapering to the ankle and a foot
 *  turned with the step (heel up behind a stride, toes down in a jump or
 *  on tiptoe). A leg that really bends - sitting, crouching, the tucked
 *  legs of a jump, a kick - is drawn in two pieces with a round knee
 *  between, not as one bowed tube (part 2: seated figures had rubber
 *  stubs). The figure is moved as a whole by bodyOf (lifted for a jump,
 *  lowered to sit or crouch), so the feet here are placed to land on the
 *  ground after that move. */
export function legs(view: PartView, build: Build, pose: LegPose, three: boolean): { far: Piece; near: Piece } {
  const a = view.anchors;
  const hipW = Math.max(18, Math.abs(a.hipR[0] - a.hipL[0]));
  const lw = build.thin ? 4 : Math.max(10, hipW * 0.6) * (build.leg ?? 1);
  const hipY = (a.hipL[1] + a.hipR[1]) / 2;
  const LL = legLength(view);
  // (thin legs end in small dark boots)
  const fw = build.thin ? 6.5 : lw * 0.9 * (build.foot_ ?? 1);
  const fwd = three ? 1 : 0;
  // (the ground in the figure's own coordinates, after bodyOf moves it)
  // (the figure is moved by translate(0, -lift): a foot at 189 + lift here
  // lands on the ground at 189)
  const ground = 189 + bodyOf(pose, view, three).lift;
  // each foot: [dx from its hip, y, the foot's tilt in degrees (toes down +), knee bend]
  type Foot = [number, number, number, number];
  // (the feet's ground with the body lifted to show its legs: see MIN_LEG)
  const G = 189 + legRoom(view);
  const feet: Partial<Record<LegPose, [Foot, Foot]>> = {
    stand: [[three ? 3 : -4, G, 0, 0.04], [three ? 5 : 4, G, 0, 0.04]],
    walk: [[fwd * 17 - (three ? 0 : 5), G, -8, 0.1], [-fwd * 13 + (three ? 0 : 6), G - 5, 24, 0.2]],
    run: [[fwd * 28 + (three ? 0 : -9), G - 8, -14, 0.24], [-fwd * 26 + (three ? 0 : 10), G - 20, 40, 0.42]],
    tiptoe: [[three ? 4 : -4, G - 3, 42, 0.02], [three ? 7 : 4, G - 4, 42, 0.02]],
  };
  // the bent legs: [knee dx, knee dy below the hip, ankle dx from the hip, ankle y, foot tilt]
  type Bent = [number, number, number, number, number];
  const side = (hip: Pt) => (hip[0] < 100 ? -1 : 1);
  const bent = (hip: Pt, near: boolean): Bent | null => {
    const o = side(hip);
    if (pose === "sit")
      // three-quarter: the thigh along the seat, the shin down to the
      // floor; from the front: the thighs come towards us (short), knees
      // a little apart, shins straight down, feet turned out
      return three
        ? [LL * (near ? 0.62 : 0.5), -LL * 0.04, LL * (near ? 0.72 : 0.6), ground, -6]
        : [o * hipW * 0.22, Math.max(2, (ground - hip[1]) * 0.35), o * 1, ground, 0];
    if (pose === "crouch")
      return three ? [LL * (near ? 0.55 : 0.45), LL * 0.2, LL * (near ? 0.12 : 0.02), ground, 0] : [o * 9, LL * 0.32, o * 5, ground, 0];
    if (pose === "jump")
      // (knees up and the feet tucked back under, toes pointed)
      return three ? [LL * (near ? 0.42 : 0.3), LL * 0.38, -LL * (near ? 0.12 : 0.2), hipY + LL * 0.72, 40] : [o * 7, LL * 0.42, o * 3, hipY + LL * 0.8, 30];
    if (pose === "kick")
      // (the near leg kicks out, the far one stands)
      return near ? (three ? [LL * 0.5, LL * 0.3, LL * 1.05, hipY + LL * 0.35, -28] : [o * 12, LL * 0.35, o * 26, hipY + LL * 0.45, -20]) : null;
    return null;
  };
  const footPiece = (ankle: Pt, tilt: number): { paint: string; ink: string } => {
    const fx = ankle[0] + (fwd ? fw * 0.35 : 0);
    const rot = `rotate(${f(three ? tilt : tilt * 0.3)} ${f(ankle[0])} ${f(ankle[1])})`;
    return {
      paint:
        `<ellipse cx="${f(fx)}" cy="${f(ankle[1] + (build.thin ? 2 : lw * 0.22))}" rx="${f(fw)}" ry="${f(build.thin ? 3.6 : lw * 0.4)}" transform="${rot}" fill="${build.thin ? THIN_INK : build.foot}"/>` +
        (build.footPad ? `<ellipse cx="${f(fx + (fwd ? fw * 0.25 : 0))}" cy="${f(ankle[1] + lw * 0.26)}" rx="${f(fw * 0.45)}" ry="${f(lw * 0.2)}" transform="${rot}" fill="${build.footPad}"/>` : ""),
      ink: `<path d="M${f(fx - fw)} ${f(ankle[1] + lw * 0.3)}C${f(fx - fw)} ${f(ankle[1] - lw * 0.2)} ${f(fx + fw)} ${f(ankle[1] - lw * 0.2)} ${f(fx + fw)} ${f(ankle[1] + lw * 0.3)}" transform="${rot}" stroke-width="0.9"/>`,
    };
  };
  const one = (hip: Pt, near: boolean, colour: string): Piece => {
    const b = bent(hip, near);
    if (b) {
      const [kdx, kdy, adx, ay, tilt] = b;
      const knee: Pt = [hip[0] + kdx, hip[1] + kdy];
      const ankle: Pt = [hip[0] + adx, ay - lw * 0.3];
      // (each piece bows a touch away from the bend, as flesh does)
      const out: Pt = three ? [0.2, -1] : [side(hip), 0];
      const thigh = build.thin ? thinLimb(hip, knee, out, 1, THIN_INK) : limb(hip, knee, out, 1, lw, lw * 0.86, colour);
      const shin = build.thin ? thinLimb(knee, ankle, three ? [1, 0] : out, 1, THIN_INK) : limb(knee, ankle, three ? [1, 0] : out, 1, lw * 0.86, lw * 0.74, colour);
      // (a round knee joins them, with a little pen on its outer curve)
      const kr = build.thin ? 1.6 : lw * 0.45;
      // (from the front, a seated knee faces us: a round cap catching the light)
      const cap = !three && pose === "sit" && !build.thin;
      const kneePaint = `<circle cx="${f(knee[0])}" cy="${f(knee[1])}" r="${f(cap ? kr * 1.2 : kr)}" fill="${build.thin ? THIN_INK : colour}"/>` + (cap ? `<ellipse cx="${f(knee[0] - kr * 0.25)}" cy="${f(knee[1] - kr * 0.3)}" rx="${f(kr * 0.55)}" ry="${f(kr * 0.4)}" fill="#FFF8E8" opacity="0.22"/>` : "");
      const kneeInk = build.thin ? "" : `<path d="M${f(knee[0] - kr * 0.7)} ${f(knee[1] - kr * 0.75)}A${f(kr)} ${f(kr)} 0 0 1 ${f(knee[0] + kr)} ${f(knee[1] + kr * 0.1)}" stroke-width="0.9"/>`;
      const ft = footPiece(ankle, tilt);
      // (thigh first, then the shin over it, the knee over both)
      return { paint: thigh.paint + shin.paint + kneePaint + ft.paint, ink: thigh.ink + shin.ink + kneeInk + ft.ink, detail: "" };
    }
    const [dx, y, tilt, kb] = feet[pose]![near ? 0 : 1];
    const ankle: Pt = [hip[0] + dx, y - lw * 0.3];
    // (knees bend forward on a three-quarter figure, outward from the front)
    const l = build.thin ? thinLimb(hip, ankle, three ? [1, 0.15] : [side(hip), 0.1], LL * kb, THIN_INK) : limb(hip, ankle, three ? [1, 0.15] : [side(hip), 0.1], LL * kb, lw, lw * 0.74, colour);
    const ft = footPiece(ankle, tilt);
    return { paint: l.paint + ft.paint, ink: l.ink + ft.ink, detail: "" };
  };
  // (kick: the far leg stands)
  const near = one(a.hipL, true, build.limb);
  const far = pose === "kick" ? standing(a.hipR) : one(a.hipR, false, three ? build.limbFar : build.limb);
  function standing(hip: Pt): Piece {
    const ankle: Pt = [hip[0] + (three ? -2 : 4), G - lw * 0.3];
    const l = build.thin ? thinLimb(hip, ankle, [1, 0], LL * 0.06, THIN_INK) : limb(hip, ankle, three ? [1, 0.15] : [side(hip), 0.1], LL * 0.06, lw, lw * 0.74, three ? build.limbFar : build.limb);
    const ft = footPiece(ankle, 0);
    return { paint: l.paint + ft.paint, ink: l.ink + ft.ink, detail: "" };
  }
  return { near, far };
}

/** A face, for a mood, on the head's eye and mouth points. */
export function face(view: PartView, build: Build, mood: Mood, lookAt: Look = "ahead"): Piece {
  const { eyeL, eyeR, mouth } = view.anchors;
  const d = Math.max(12, Math.hypot(eyeR[0] - eyeL[0], eyeR[1] - eyeL[1]));
  const r = Math.min(5.5, Math.max(2.4, d * 0.15));
  // (where the eyes look: the pupils move a little that way)
  const gaze: Pt = lookAt === "left" ? [-r * 0.45, 0] : lookAt === "right" ? [r * 0.45, 0] : lookAt === "up" ? [0, -r * 0.5] : lookAt === "down" ? [0, r * 0.45] : [0, 0];
  const open = (e: Pt, k = 1, look: Pt = gaze) =>
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
    case "excited":
      // (eyes wide and bright, brows high, a big open grin, rosy)
      return { paint: cheeks + cheeks, ink: brows(3.4, -0.6) + grin, detail: open(eyeL, 1.2) + open(eyeR, 1.2) + tongue };
    case "scared":
      // (eyes wide with small pupils, brows up and together, a wobbly mouth)
      return { paint: "", ink: brows(3.4, 2.6) + wobble, detail: open(eyeL, 0.8) + open(eyeR, 0.8) };
    case "shy":
      // (eyes down, a small smile, a deep blush)
      return { paint: cheeks + cheeks, ink: brows(2.6, 1.2) + `<path d="M${f(mx - mw * 0.5)} ${f(my)}Q${f(mx)} ${f(my + mw * 0.35)} ${f(mx + mw * 0.5)} ${f(my)}" stroke-width="1.2"/>`, detail: open(eyeL, 0.9, [gaze[0], r * 0.5]) + open(eyeR, 0.9, [gaze[0], r * 0.5]) };
    case "determined":
      // (brows down and set, a firm small smile)
      return { paint: "", ink: brows(2.0, -1.6) + `<path d="M${f(mx - mw * 0.7)} ${f(my)}Q${f(mx)} ${f(my + mw * 0.25)} ${f(mx + mw * 0.7)} ${f(my - 1)}" stroke-width="1.4"/>`, detail: open(eyeL, 0.95) + open(eyeR, 0.95) };
    case "talk":
      // (mid-word: a small open mouth, friendly eyes)
      return { paint: cheeks, ink: brows(2.9, 0), detail: open(eyeL) + open(eyeR) + `<ellipse cx="${f(mx)}" cy="${f(my + 2)}" rx="${f(mw * 0.45)}" ry="${f(mw * 0.32)}" fill="${build.mouth}"/>` };
    default:
      return { paint: cheeks, ink: brows(2.8, 0) + smile, detail: open(eyeL) + open(eyeR) };
  }
}
