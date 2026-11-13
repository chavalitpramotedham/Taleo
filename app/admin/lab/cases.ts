import type { CharacterDef } from "@/lib/types";
import type { LabPage } from "./LabBench";

/**
 * Twenty harder test pages for the painting bench, written by hand: close-
 * ups, crowds, unusual places and light, and actions that are hard to get
 * right (climbing, hiding, carrying, swimming, dancing, flying). Built from
 * the ready-made characters. Listed newest first among the bench's own.
 */
type Spec = {
  key: string;
  label: string;
  cast: string[];
  text: string;
  picture: string;
  place: { id: string; about: string; light: "day" | "golden" | "dusk" | "night" | "rain" };
  camera: "close" | "mid" | "wide";
  /** target: a cast index, or a thing in the picture */
  action?: { word: string; target: number | string; sound: string; motion: string };
};

const SPECS: Spec[] = [
  {
    key: "c01-lighthouse",
    label: "Lighthouse in a storm",
    cast: ["penguin", "owl"],
    text: "Pebble and Hoot climbed the winding stairs as the storm whooshed round the lighthouse.",
    picture: "A wide shot at night in a storm: a tall striped lighthouse on rocks on the right, its beam sweeping out over a wild grey sea; Pebble and Hoot tiny in the lit window at the top, peering out; rain slanting, waves crashing white on the rocks, a little boat bobbing far off on the left.",
    place: { id: "lighthouse", about: "a red-and-white striped lighthouse on dark rocks on the right, the open sea to the left", light: "rain" },
    camera: "wide",
    action: { word: "whooshed", target: "the waves", sound: "whoosh", motion: "dash" },
  },
  {
    key: "c02-closeup-tear",
    label: "Close-up: a sad face",
    cast: ["kitty"],
    text: "Miso's lip wobbled. Her balloon had floated away.",
    picture: "A close-up of Miso's face and shoulders, filling the picture: eyes brimming, one tear rolling down her cheek, ears drooping, paws clutching an empty balloon string; behind her, soft and blurred, a red balloon tiny high in a pale sky.",
    place: { id: "park-sky", about: "an open park under a wide pale sky, trees soft and far away", light: "day" },
    camera: "close",
    action: { word: "floated", target: "the balloon", sound: "pop", motion: "float" },
  },
  {
    key: "c03-birthday-crowd",
    label: "Birthday party, six friends",
    cast: ["bear", "bunny", "kitty", "fox", "elephant", "cupcake"],
    text: "Everyone cheered as Bobo blew out all five candles at once!",
    picture: "A mid shot of a crowded birthday table indoors: Bobo in the middle blowing hard at a cake with five candles, cheeks puffed; Pip and Miso clapping on the left, Fennel throwing confetti, Ellie trumpeting with her trunk raised on the right, Sprinkles bouncing on the table beside the cake; bunting across the wall, balloons, presents piled at the front.",
    place: { id: "party-room", about: "a cosy sitting room decorated for a party: bunting along the back wall, a window on the left, a long table in the middle", light: "golden" },
    camera: "mid",
    action: { word: "blew", target: 0, sound: "whoosh", motion: "shake" },
  },
  {
    key: "c04-underwater",
    label: "Under the sea",
    cast: ["penguin", "dino"],
    text: "Pebble dived down, down, down to show Dot the shiny shells.",
    picture: "A mid shot underwater: Pebble swimming head-first down through blue-green water with a trail of bubbles, Dot below on the sandy sea floor pointing at a cluster of pink shells; swaying seaweed on the left, a rock arch on the right, light rippling down from the surface, little fish darting.",
    place: { id: "sea-floor", about: "a sandy sea floor with seaweed on the left and a rock arch on the right, the bright surface far above", light: "day" },
    camera: "mid",
    action: { word: "dived", target: 0, sound: "splash", motion: "dive" },
  },
  {
    key: "c05-market",
    label: "Busy market morning",
    cast: ["avocado", "strawberry", "dumpling", "teapot"],
    text: "At the market, Avo, Berry and Bao helped Tilly carry her heavy basket home.",
    picture: "A mid shot of a sunny village market: striped stall awnings left and right piled with fruit and loaves; in the middle Avo, Berry and Bao hold up the handles of a big wicker basket full of apples, struggling and laughing, while Tilly the teapot steams happily beside them; bunting, a cobbled square, a church tower behind.",
    place: { id: "market-square", about: "a cobbled village square with striped market stalls on both sides and a church tower behind", light: "day" },
    camera: "mid",
    action: { word: "carry", target: 1, sound: "giggle", motion: "bounce" },
  },
  {
    key: "c06-treehouse-rain",
    label: "Treehouse in the rain",
    cast: ["bunny", "fox"],
    text: "Drip, drip, drip went the rain on the treehouse roof, but Pip and Fennel were snug inside.",
    picture: "A mid shot inside a little wooden treehouse while it rains: Pip and Fennel wrapped in one blanket on a cushion, sharing a mug of cocoa, a lantern glowing; through the round window on the right rain streaks down and branches sway; a rope ladder hole in the floor, drawings pinned to the plank wall.",
    place: { id: "treehouse", about: "the inside of a small plank treehouse: a round window on the right, a hatch in the floor, a lantern hanging from the roof", light: "rain" },
    camera: "mid",
    action: { word: "drip", target: "the window", sound: "drip", motion: "wiggle" },
  },
  {
    key: "c07-climb-tree",
    label: "Climbing the apple tree",
    cast: ["kitty", "bear"],
    text: "Miso climbed higher and higher to reach the reddest apple of all.",
    picture: "A mid shot of an apple tree in an orchard: Miso clinging to a branch high in the tree, stretching one paw for a red apple; Bobo at the foot of the trunk holding up a basket and looking up anxiously; apples in the grass, a ladder leaning on the next tree on the right.",
    place: { id: "orchard", about: "an orchard of apple trees, a big one in the middle and more in rows behind, long grass", light: "golden" },
    camera: "mid",
    action: { word: "climbed", target: 0, sound: "rustle", motion: "hop" },
  },
  {
    key: "c08-hide-seek",
    label: "Hide and seek",
    cast: ["fox", "bunny", "elephant"],
    text: "\"Ready or not, here I come!\" called Fennel. But where was Ellie hiding?",
    picture: "A mid shot in a garden: Fennel on the left with paws over his eyes, counting against a tree; Pip peeking out from behind a flower pot; Ellie trying to hide behind a far-too-small bush in the middle, her ears, bottom and trunk sticking out on every side; a garden shed on the right.",
    place: { id: "garden", about: "a cottage garden: a tree on the left, flower beds and pots, a little green shed on the right", light: "day" },
    camera: "mid",
    action: { word: "hiding", target: 2, sound: "giggle", motion: "wiggle" },
  },
  {
    key: "c09-train",
    label: "Steam train journey",
    cast: ["robot", "owl", "bunny"],
    text: "Toot toot! The little train puffed over the bridge and into the hills.",
    picture: "A wide shot of rolling green hills: a little red steam train with three carriages crossing a stone viaduct over a river; Bolt waving from the engine, Hoot and Pip leaning out of a carriage window; puffs of steam, sheep in the fields, a village far off.",
    place: { id: "viaduct", about: "rolling green hills with a stone railway viaduct across the middle over a river, a village far off on the right", light: "day" },
    camera: "wide",
    action: { word: "puffed", target: "the train", sound: "whoosh", motion: "dash" },
  },
  {
    key: "c10-snowy-night",
    label: "First snow at night",
    cast: ["penguin", "kitty", "star"],
    text: "Snowflakes fell softly while Twinkle lit the way home.",
    picture: "A mid shot of a snowy lane at night: Pebble sliding on his tummy down a little slope, Miso catching snowflakes on her tongue, Twinkle the little star glowing and floating above them lighting the snow gold; cottages with lit windows on the right, snowy fir trees on the left, big flakes falling.",
    place: { id: "snowy-lane", about: "a snowy village lane: fir trees on the left, cottages with lit windows on the right, a gentle slope down the middle", light: "night" },
    camera: "mid",
    action: { word: "lit", target: 2, sound: "twinkle", motion: "grow" },
  },
  {
    key: "c11-closeup-whisper",
    label: "Close-up: a secret",
    cast: ["bear", "bunny"],
    text: "Pip leaned close and whispered the secret into Bobo's ear.",
    picture: "A close-up of two faces side by side: Pip on the left cupping a paw round her mouth, whispering into Bobo's big round ear; Bobo's eyes wide with delight, a paw over his mouth to keep from giggling; warm lamplight, a bookshelf soft behind.",
    place: { id: "bedroom", about: "a child's bedroom: a bookshelf on the left, a lamp, a window with curtains on the right", light: "dusk" },
    camera: "close",
    action: { word: "whispered", target: 0, sound: "giggle", motion: "nod" },
  },
  {
    key: "c12-kite-hill",
    label: "Kites on a windy hill",
    cast: ["dino", "fox", "cloud"],
    text: "Whoosh! The wind lifted Dot's kite right up to the clouds.",
    picture: "A wide shot of a grassy hilltop on a windy day: Dot running up the slope holding a kite string, the kite high above; Fennel's tail streaming as he chases behind; Puff the little cloud puffing out his cheeks and blowing the kite higher; long grass bending, leaves flying.",
    place: { id: "windy-hill", about: "a high grassy hilltop with a lone bent tree on the left and the sky wide open", light: "day" },
    camera: "wide",
    action: { word: "lifted", target: "the kite", sound: "whoosh", motion: "fly" },
  },
  {
    key: "c13-bath-bubbles",
    label: "Bubble bath",
    cast: ["elephant"],
    text: "Ellie filled her trunk and sprayed bubbles all over the bathroom!",
    picture: "A mid shot of a bathroom: Ellie sitting in a claw-footed tub overflowing with bubbles, trunk raised and spraying a fountain of water and bubbles into the air; bubbles floating everywhere, a rubber duck on her head, towels on a rail on the left, a puddle on the tiled floor.",
    place: { id: "bathroom", about: "an old-fashioned bathroom: a claw-footed tub in the middle, a towel rail on the left, tiles, a little window", light: "day" },
    camera: "mid",
    action: { word: "sprayed", target: 0, sound: "splash", motion: "burst" },
  },
  {
    key: "c14-dance",
    label: "Dancing in the kitchen",
    cast: ["teapot", "cupcake", "strawberry", "avocado", "dumpling"],
    text: "The music started, and the whole kitchen began to dance!",
    picture: "A mid shot of a cosy kitchen: Tilly the teapot twirling on the table spilling a little steam, Sprinkles and Berry dancing a jig together, Avo spinning on one foot, Bao bouncing to the beat; a radio on the shelf with music notes floating out, pots and pans hanging, a window on the right.",
    place: { id: "kitchen", about: "a cosy farmhouse kitchen: a dresser with plates on the left, a big table in the middle, a window on the right", light: "golden" },
    camera: "mid",
    action: { word: "dance", target: 0, sound: "ding", motion: "spin" },
  },
  {
    key: "c15-bridge-river",
    label: "Crossing the stepping stones",
    cast: ["bunny", "bear", "penguin"],
    text: "One by one, they hopped across the stepping stones. Wobble, wobble!",
    picture: "A mid shot of a shallow river: Pip mid-hop between two stepping stones, Bobo wobbling on one stone with his arms out for balance, Pebble already on the far bank cheering; reeds and a willow on the left, a wooden footbridge further down on the right, water sparkling.",
    place: { id: "river-stones", about: "a shallow river with a row of stepping stones across the middle, a willow and reeds on the left bank, a footbridge downstream on the right", light: "day" },
    camera: "mid",
    action: { word: "hopped", target: 0, sound: "boing", motion: "hop" },
  },
  {
    key: "c16-space",
    label: "A trip to the moon",
    cast: ["robot", "star"],
    text: "Bolt's rocket landed with a bump on the moon, and Twinkle came to say hello.",
    picture: "A wide shot on the grey surface of the moon: a little red-and-silver rocket landed on the left with smoke puffing; Bolt stepping down the ladder waving; Twinkle floating down to meet him; craters, the Earth blue and white in the black starry sky on the right.",
    place: { id: "moon", about: "the grey cratered surface of the moon, the black sky full of stars, the Earth hanging on the right", light: "night" },
    camera: "wide",
    action: { word: "landed", target: "the rocket", sound: "thud", motion: "tumble" },
  },
  {
    key: "c17-closeup-feet",
    label: "Close-up: a ladybird",
    cast: ["dino"],
    text: "Dot held very still as a ladybird walked across her nose.",
    picture: "A close-up of Dot's face, cross-eyed with delight, looking down at a tiny red ladybird walking along the end of her nose; her claws held up very still; soft blurred meadow flowers behind.",
    place: { id: "flower-meadow", about: "a meadow full of tall flowers, soft and close", light: "day" },
    camera: "close",
    action: { word: "walked", target: "the ladybird", sound: "buzz", motion: "wiggle" },
  },
  {
    key: "c18-picnic-crowd",
    label: "Picnic in the rain",
    cast: ["fox", "kitty", "owl", "dumpling"],
    text: "Plop! A big raindrop landed right in the jam. Everyone ran for the big umbrella.",
    picture: "A mid shot of a meadow as a sudden shower starts: a picnic blanket with jam, sandwiches and a teapot; Fennel holding a huge striped umbrella in the middle, Miso and Bao scampering under it, Hoot flapping in with a sandwich in his beak; raindrops bouncing, a dark cloud overhead, sunshine still bright on the far hills.",
    place: { id: "picnic-meadow", about: "an open meadow with a hedge behind, a big oak on the far left, hills beyond", light: "rain" },
    camera: "mid",
    action: { word: "ran", target: 1, sound: "drip", motion: "dash" },
  },
  {
    key: "c19-library-night",
    label: "Library after dark",
    cast: ["owl", "bunny"],
    text: "By the light of one candle, Hoot read Pip the oldest book in the library.",
    picture: "A mid shot of a grand old library at night: towering bookshelves on both sides with a rolling ladder; Hoot perched on a pile of books, holding open a huge dusty book; Pip sitting close, eyes wide, holding a candle in a holder; moonlight through a tall arched window behind, dust motes glowing.",
    place: { id: "old-library", about: "a grand old library: tall bookshelves left and right with a rolling ladder, a tall arched window at the back", light: "night" },
    camera: "mid",
    action: { word: "read", target: 0, sound: "rustle", motion: "nod" },
  },
  {
    key: "c20-beach-sandcastle",
    label: "Sandcastle and the wave",
    cast: ["elephant", "penguin", "strawberry"],
    text: "\"Quick! Here comes the wave!\" shouted Berry, as the sea rushed up the beach.",
    picture: "A wide shot of a sunny beach: a big sandcastle with flags in the middle; Ellie and Pebble patting the walls with buckets and spades; Berry on top of a little rock on the right shouting and pointing at a frothy wave rushing towards them; a striped beach hut, gulls, the sea sparkling.",
    place: { id: "beach", about: "a sandy beach: the sea along the back, a striped beach hut on the left, rocks on the right", light: "golden" },
    camera: "wide",
    action: { word: "rushed", target: "the wave", sound: "splash", motion: "dash" },
  },
];

/** The twenty as bench pages, each with its cast (the first is the hero). */
export function harderCases(preset: (key: string, id: string) => CharacterDef): LabPage[] {
  // (all added together, just after the bench's first pages: newest first,
  // in the order above)
  const at = Date.parse("2026-11-13T12:00:00Z");
  return SPECS.map((s, i) => {
    const cast = s.cast.map((k, j) => preset(k, j === 0 ? "hero" : `friend${j}`));
    const target = s.action ? (typeof s.action.target === "number" ? cast[s.action.target].id : s.action.target) : null;
    return {
      key: s.key,
      label: s.label,
      createdAt: at + (SPECS.length - i),
      cast,
      page: {
        text: s.text,
        picture: s.picture,
        characters: cast.map((c) => c.id),
        action: s.action && target ? { word: s.action.word, target, sound: s.action.sound as never, motion: s.action.motion as never } : null,
      },
      place: s.place,
      camera: s.camera,
    };
  });
}
