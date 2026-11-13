/**
 * Pre-painted poses ("sprites"): each character painted once in each of
 * these poses, from its own portrait, and kept. A page then places them -
 * which pose, where, how big - instead of painting the characters at all.
 * Each is on its own 200x200 canvas, feet on the ground at about (100,
 * 190), facing three-quarters to the viewer's right (mirrored to face
 * left).
 */
export const SPRITE_POSES = {
  stand: "standing, relaxed and smiling, arms loosely at the sides",
  walk: "walking along, mid-stride, arms swinging, cheerful",
  run: "running fast, leaning forward, legs stretched mid-stride, ears and tail streaming back",
  jump: "jumping for joy, both feet off the ground, arms flung up, laughing",
  sit: "sitting on the ground, legs out in front, hands in the lap, content",
  wave: "standing and waving hello with the near arm raised high, a big smile",
  point: "standing and pointing ahead with the near arm, curious and excited",
  hold: "standing and holding both arms out in front at chest height, as if carrying or offering something (hands empty)",
  sleep: "curled up asleep on the ground, eyes closed, peaceful",
  surprised: "standing, startled: eyes wide, mouth open in an O, hands up by the face",
} as const;
export type SpritePose = keyof typeof SPRITE_POSES;
export const SPRITE_POSE_IDS = Object.keys(SPRITE_POSES) as SpritePose[];

export interface Sprite {
  paint: string;
  ink: string;
  detail: string;
}
