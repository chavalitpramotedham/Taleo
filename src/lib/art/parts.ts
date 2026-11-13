/**
 * Characters as parts: the pieces of a character that stay the same from
 * page to page - the HEAD (skull, ears, muzzle and nose, markings, hair,
 * anything worn on the head) and the TORSO (body shape, clothing and the
 * markings on it) - painted once, in a few fixed views, and placed on each
 * page. The page painter draws only what moves: the face (eyes, brows,
 * mouth, cheeks), the arms and legs, the tail, what's held, and the action.
 *
 * Drawn on the character's own 200x200 reference canvas, feet on the
 * ground at y 190, in the same layers as everything else (paint, ink,
 * detail). Rules that keep a figure from looking pasted together:
 *  - the torso is whole beneath where the head and limbs overlap it (no
 *    holes), and its contour is open at the neck, shoulders and hips, so
 *    no outline runs across a joined limb;
 *  - base fills are opaque, with the shading glazes as separate shapes on
 *    top, so overlaps never darken twice;
 *  - the limbs are drawn by the painter in the exact colours given here.
 *
 * Views: "front", and "three" (three-quarter, turned to face the viewer's
 * right; mirrored, it faces left). Anchors say where the painter joins
 * limbs and draws the face, in the view's own coordinates.
 */
import type { Piece } from "./stamps";

export type View = "front" | "three";
export type Pt = [number, number];

export interface PartView {
  /** drawn turned to face the viewer's left (a three-quarter view made
   *  from a portrait that looks that way): mirrored when placed */
  facesLeft?: boolean;
  head: Piece;
  torso: Piece;
  anchors: {
    /** where the head turns (a tilt is a rotation about this point) */
    neck: Pt;
    /** near and far, as seen: for "three", left is the near side */
    shoulderL: Pt;
    shoulderR: Pt;
    hipL: Pt;
    hipR: Pt;
    eyeL: Pt;
    eyeR: Pt;
    mouth: Pt;
  };
}

export interface CharacterParts {
  /** the colours the painter draws limbs and the face in */
  colours: Record<string, string>;
  /** a few words on how its limbs and face are drawn */
  build: string;
  /** at least one view; a missing one is stood in for by the other */
  views: Partial<Record<View, PartView>>;
}

/** The view to use: the one asked for, else whichever there is. */
export const viewOf = (parts: CharacterParts, v: View): PartView | null => parts.views[v] ?? parts.views.front ?? parts.views.three ?? null;

const f = (n: number) => (Math.round(n * 10) / 10).toString();
/** form shading: a darker crescent lower right, a pale glaze upper left */
const shade = (cx: number, cy: number, rx: number, ry: number, op = 0.26) => {
  const c = Math.SQRT1_2;
  const p1 = [cx + rx * c, cy - ry * c];
  const p2 = [cx - rx * c, cy + ry * c];
  const t = 0.3;
  const q1 = [p1[0] - t * rx, p1[1] - t * ry];
  const q2 = [p2[0] - t * rx, p2[1] - t * ry];
  return `<path d="M${f(p1[0])} ${f(p1[1])}A${rx} ${ry} 0 0 1 ${f(p2[0])} ${f(p2[1])}L${f(q2[0])} ${f(q2[1])}A${rx} ${ry} 0 0 0 ${f(q1[0])} ${f(q1[1])}Z" fill="#4A3020" opacity="${op}"/>`;
};
const glow = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#FFF8E8" opacity="0.3"/>`;

// ------------------------------------------------------------------ Bobo, the bear cub

const BEAR = { fur: "#8E6A4C", paw: "#7A5A40", pale: "#C9AC88", nose: "#3A2A20" };

const bear: CharacterParts = {
  colours: { fur: BEAR.fur, "paws and feet": BEAR.paw, "paw pads, muzzle and tummy": BEAR.pale, mouth: "#6E3B32", tongue: "#C9786E", cheeks: "#E7A99A" },
  build:
    "a round cub: short thick arms (a rounded tube about 16 wide, ending in a darker round paw) and short legs (a fat oval each, with a darker foot and a pale pad); eyes are dark dots or happy arcs, brows short strokes above them",
  views: {
    front: {
      torso: {
        paint: `<path d="M64 150C60 122 74 104 84 96L84 84L116 84L116 96C126 104 140 122 136 150C134 170 118 178 100 178C82 178 66 170 64 150Z" fill="${BEAR.fur}"/><ellipse cx="100" cy="146" rx="24" ry="25" fill="${BEAR.pale}"/>${shade(100, 140, 37, 40)}`,
        ink: `<path d="M66 132C66 120 70 112 76 106M124 106C130 112 134 120 134 132M64 150C66 166 80 178 100 178C120 178 134 166 136 150"/><path d="M86 122q6 3 12 0M102 122q6 3 12 0M90 164q10 4 20 0" stroke="#A88D6A" stroke-width="1"/>`,
        detail: "",
      },
      head: {
        paint: `<ellipse cx="100" cy="104" rx="20" ry="4.5" fill="#4A3020" opacity="0.28"/><circle cx="74" cy="44" r="12" fill="${BEAR.fur}"/><circle cx="74" cy="44" r="6" fill="${BEAR.pale}"/><circle cx="126" cy="44" r="12" fill="${BEAR.fur}"/><circle cx="126" cy="44" r="6" fill="${BEAR.pale}"/><circle cx="100" cy="70" r="33" fill="${BEAR.fur}"/>${shade(100, 70, 33, 33)}${glow(88, 54, 10, 7)}<ellipse cx="100" cy="84" rx="17" ry="13" fill="${BEAR.pale}"/>`,
        ink: `<path d="M74 92C66 82 66 60 76 48C86 37 114 37 124 48C134 60 134 82 126 92"/><path d="M63 40C64 32 78 30 82 38M118 38C122 30 136 32 137 40"/><path d="M84 48l2 -4M114 46l2 -4" stroke-width="0.8"/>`,
        detail: `<ellipse cx="100" cy="79" rx="5.5" ry="3.8" fill="${BEAR.nose}"/><circle cx="98" cy="78" r="1.2" fill="#FFFFFF" opacity="0.6"/>`,
      },
      anchors: { neck: [100, 102], shoulderL: [72, 114], shoulderR: [128, 114], hipL: [84, 166], hipR: [116, 166], eyeL: [87, 66], eyeR: [113, 66], mouth: [100, 92] },
    },
    three: {
      torso: {
        paint: `<path d="M66 150C62 122 76 104 86 96L86 84L118 84L118 96C128 104 138 122 134 150C132 170 118 178 100 178C84 178 68 170 66 150Z" fill="${BEAR.fur}"/><ellipse cx="108" cy="146" rx="20" ry="25" fill="${BEAR.pale}"/>${shade(100, 140, 35, 40)}`,
        ink: `<path d="M68 132C68 120 72 112 78 106M126 106C131 112 133 120 133 132M66 150C68 166 82 178 100 178C120 178 132 166 134 150"/><path d="M96 122q6 3 12 0M110 122q5 3 10 0M98 164q9 4 18 0" stroke="#A88D6A" stroke-width="1"/>`,
        detail: "",
      },
      head: {
        paint: `<ellipse cx="104" cy="104" rx="18" ry="4.5" fill="#4A3020" opacity="0.28"/><circle cx="124" cy="40" r="11" fill="${BEAR.fur}"/><circle cx="124" cy="40" r="5" fill="${BEAR.pale}"/><circle cx="72" cy="46" r="12" fill="${BEAR.fur}"/><circle cx="72" cy="46" r="6" fill="${BEAR.pale}"/><circle cx="100" cy="70" r="33" fill="${BEAR.fur}"/>${shade(100, 70, 33, 33)}${glow(86, 54, 10, 7)}<ellipse cx="114" cy="85" rx="16" ry="12.5" fill="${BEAR.pale}"/>`,
        ink: `<path d="M74 92C66 82 66 60 76 48C86 37 114 37 124 48C134 60 134 82 126 92"/><path d="M61 42C62 34 76 32 80 40M118 32C122 26 134 30 134 38"/><path d="M82 48l2 -4M112 46l2 -4" stroke-width="0.8"/>`,
        detail: `<ellipse cx="117" cy="80" rx="5.2" ry="3.7" fill="${BEAR.nose}"/><circle cx="115" cy="79" r="1.2" fill="#FFFFFF" opacity="0.6"/>`,
      },
      anchors: { neck: [102, 102], shoulderL: [72, 116], shoulderR: [126, 112], hipL: [84, 166], hipR: [114, 166], eyeL: [96, 66], eyeR: [120, 64], mouth: [114, 93] },
    },
  },
};

// ------------------------------------------------------------------ Pip, the rabbit

const RAB = { fur: "#A98463", dark: "#9C7756", cream: "#E9DCC5", ear: "#D9B8A0", tail: "#F4EFE4", nose: "#B97E73" };

const bunny: CharacterParts = {
  colours: { fur: RAB.fur, "far limbs and feet": RAB.dark, "chest, muzzle and foot tops": RAB.cream, "inner ears": RAB.ear, nose: RAB.nose, mouth: "#6E3B32", tongue: "#C9786E", cheeks: "#E7A99A" },
  build:
    "a slim young rabbit: thin arms (a tube about 10 wide, a small rounded paw) and long back feet (an oval about 36 long on the ground, a short thigh above); eyes are dark ovals with a white highlight, brows short strokes",
  views: {
    front: {
      torso: {
        paint: `<path d="M72 166C66 140 76 112 88 104L88 88L112 88L112 104C124 112 134 140 128 166C120 178 80 178 72 166Z" fill="${RAB.fur}"/><path d="M88 164C84 144 88 122 100 116C112 122 116 144 112 164C106 170 94 170 88 164Z" fill="${RAB.cream}"/>${shade(100, 140, 30, 36)}`,
        ink: `<path d="M74 140C74 124 82 112 92 106M108 106C118 112 126 124 126 140M72 166C80 176 120 176 128 166"/><path d="M92 128l3 -3M104 120l3 -3" stroke-width="0.8"/>`,
        detail: "",
      },
      head: {
        paint: `<ellipse cx="100" cy="102" rx="16" ry="4" fill="#4A3020" opacity="0.28"/><path d="M84 56C76 32 76 10 84 7C93 5 98 30 98 54Z" fill="${RAB.dark}"/><path d="M87 50C82 32 82 17 86 14C90 15 93 32 94 50Z" fill="${RAB.ear}"/><path d="M102 54C102 30 107 5 116 7C124 10 124 32 116 56Z" fill="${RAB.fur}"/><path d="M106 50C107 32 110 15 114 14C118 17 118 32 113 50Z" fill="${RAB.ear}"/><ellipse cx="100" cy="76" rx="29" ry="25" fill="${RAB.fur}"/>${shade(100, 76, 29, 25)}${glow(89, 64, 9, 6)}<ellipse cx="100" cy="88" rx="13" ry="9" fill="${RAB.cream}"/>`,
        ink: `<path d="M76 92C70 84 70 66 78 58C86 51 114 51 122 58C130 66 130 84 124 92"/><path d="M84 56C76 32 76 10 84 7C93 5 98 30 98 54M102 54C102 30 107 5 116 7C124 10 124 32 116 56"/><path d="M116 88l14 -3M116 91l14 2M84 88l-14 -3M84 91l-14 2" stroke-width="0.7"/>`,
        detail: `<ellipse cx="100" cy="84" rx="3.2" ry="2.4" fill="${RAB.nose}"/>`,
      },
      anchors: { neck: [100, 100], shoulderL: [80, 118], shoulderR: [120, 118], hipL: [86, 164], hipR: [114, 164], eyeL: [90, 74], eyeR: [110, 74], mouth: [100, 93] },
    },
    three: {
      torso: {
        paint: `<circle cx="70" cy="158" r="10" fill="${RAB.tail}"/><path d="M74 166C68 140 78 112 90 104L90 88L116 88L116 104C126 112 132 140 126 166C118 178 82 178 74 166Z" fill="${RAB.fur}"/><path d="M96 164C92 144 98 122 110 116C120 124 122 146 118 164C112 170 102 170 96 164Z" fill="${RAB.cream}"/>${shade(100, 140, 28, 36)}`,
        ink: `<path d="M76 140C76 124 84 112 94 106M110 106C120 112 125 124 125 140M74 166C82 176 118 176 126 166"/><path d="M62 154q-4 4 -1 9M76 152q4 5 1 10" stroke-width="0.9"/>`,
        detail: "",
      },
      head: {
        paint: `<ellipse cx="106" cy="102" rx="15" ry="4" fill="#4A3020" opacity="0.28"/><path d="M110 54C112 30 120 6 128 9C135 13 130 36 120 58Z" fill="${RAB.dark}"/><path d="M88 56C80 32 80 10 88 7C97 5 101 30 101 54Z" fill="${RAB.fur}"/><path d="M91 50C86 32 86 17 90 14C94 15 97 32 97 50Z" fill="${RAB.ear}"/><ellipse cx="103" cy="76" rx="28" ry="24" fill="${RAB.fur}"/>${shade(103, 76, 28, 24)}${glow(92, 64, 9, 6)}<ellipse cx="116" cy="88" rx="12" ry="8.5" fill="${RAB.cream}"/>`,
        ink: `<path d="M80 92C73 84 73 66 81 59C89 52 117 52 125 59C133 66 133 84 127 92"/><path d="M88 56C80 32 80 10 88 7C97 5 101 30 101 54M120 58C130 36 135 13 128 9"/><path d="M128 87l14 -3M128 90l14 2M130 93l11 5" stroke-width="0.7"/>`,
        detail: `<ellipse cx="124" cy="84" rx="3" ry="2.3" fill="${RAB.nose}"/>`,
      },
      anchors: { neck: [104, 100], shoulderL: [82, 118], shoulderR: [120, 116], hipL: [88, 164], hipR: [116, 164], eyeL: [100, 72], eyeR: [120, 70], mouth: [118, 94] },
    },
  },
};

/** Parts for the preset characters, by preset key. */
export const PRESET_PARTS: Record<string, CharacterParts> = { bear, bunny };
