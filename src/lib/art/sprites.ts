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
  // (added 13 Nov: the moments the first ten couldn't show)
  laugh: "standing and laughing out loud, head thrown back, eyes squeezed shut in happy arcs, hands on the tummy",
  sad: "standing sadly, head and ears drooping, eyes looking down, a wobbly mouth, hands clasped in front",
  carry: "carrying something big in both arms against the chest (arms empty, curved as if round it), leaning back a little with the effort",
  peek: "peeking: leaning sideways from the waist with the head and one hand stuck out to the viewer's right, as if round the edge of something, curious",
  reach: "reaching up high on tiptoe, both arms stretched straight up as far as they go, looking up",
  hug: "arms opened wide for a hug, leaning forward, a warm smile",
} as const;
export type SpritePose = keyof typeof SPRITE_POSES;
export const SPRITE_POSE_IDS = Object.keys(SPRITE_POSES) as SpritePose[];

export interface Sprite {
  paint: string;
  ink: string;
  detail: string;
}
