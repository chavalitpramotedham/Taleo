// Demo-mode storyteller used when no ANTHROPIC_API_KEY is configured, so the
// whole app can be explored offline. Stories are templated, and pictures are
// composed from the reference art rather than painted by Claude.
import { ageById } from "@/lib/ages";
import type { CharacterRequest, CharacterResponse, Page, SegmentResponse, StoryRequest } from "@/lib/types";

const DUCKLING = `<g class="paint"><ellipse cx="100" cy="191" rx="50" ry="6" fill="#CFC6AC" opacity="0.6"/>
<ellipse cx="86" cy="186" rx="13" ry="5" fill="#D99447"/><ellipse cx="114" cy="187" rx="13" ry="5" fill="#D99447"/>
<path d="M56 150 C50 118 76 100 104 104 C132 108 150 126 146 154 C142 178 118 186 96 184 C74 182 60 170 56 150Z" fill="#E8C766"/>
<path d="M44 132 C34 126 30 118 36 112 C46 116 54 124 58 132Z" fill="#E8C766"/>
<path d="M118 132 C134 128 146 140 140 156 C130 160 118 150 114 140Z" fill="#D9B456"/>
<path d="M82 92 C80 66 100 52 120 56 C140 60 148 80 140 98 C132 112 112 116 98 112 C88 108 83 100 82 92Z" fill="#E8C766"/>
<path d="M138 84 C150 82 162 86 166 92 C160 98 148 98 138 96Z" fill="#D99447"/></g>
<g class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M56 150 C50 118 76 100 98 104 M140 112 C148 128 146 160 128 176 C116 184 90 186 72 176"/>
<path d="M82 92 C80 66 100 52 120 56 C140 60 148 80 140 98"/>
<path d="M138 84 C150 82 162 86 166 92 C160 98 148 98 138 96 M140 90 L162 91"/>
<path d="M112 56 C110 48 114 44 118 42 M116 56 C118 50 124 48 128 50" stroke-width="1"/>
<path d="M118 132 C134 128 146 140 140 156"/></g>
<g class="detail"><circle cx="122" cy="80" r="3.2" fill="#2A1E15"/><circle cx="123" cy="79" r="1" fill="#fff"/></g>`;

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const page = (text: string, picture: string, characters: string[], aside: string | null = null): Page => ({
  text,
  picture,
  characters,
  aside,
  svg: null,
});

export function mockSegment(req: StoryRequest): SegmentResponse {
  const isStart = req.kind === "start";
  const ageId = isStart ? req.age : req.story.age;
  const age = ageById(ageId);
  const hero = isStart ? req.hero : req.story.hero;
  const theme = isStart ? req.theme : req.story.theme;
  const segs = isStart ? [] : req.story.segments;
  const n = hero.name;
  const small = ageId === "1.5-2" || ageId === "2-3";
  const s = (t: string, o: string) => (small ? t : o);
  const seed = hash(theme + n);
  const options = (a: string[]) => a.slice(0, age.optionCount).map((label) => ({ label }));

  if (isStart) {
    return {
      title: `${n} and the ${pick(["Windy", "Wonderful", "Wobbly", "Sunny"], seed)} ${pick(["Morning", "Surprise", "Puddle", "Hill"], seed + 1)}`,
      world: "a gentle English meadow and hedgerow in late summer, soft golden morning light, cream skies and sage greens",
      newCharacters: [
        { id: "duckling", name: "Dilly", look: "a small fluffy duckling with soft yellow down (#E8C766), an orange beak and feet (#D99447), about half the hero's height; talkative and forgetful", preset: null, svg: DUCKLING },
      ],
      ending: false,
      segment: {
        chosen: null,
        pages: [
          page(
            s(`Up, up, up! ${n} is awake.`, `One bright morning, ${n} woke with a wiggle and a giggle. "Today feels like a wonderful kind of day!"`),
            `Close-up inside a cosy burrow bedroom: ${n} bounces out of a little bed mid-stretch, arms flung up, eyes squeezed shut in a huge yawn-giggle, blanket tumbling off. Morning light through a round window.`,
            ["hero"],
          ),
          page(
            s(`${n} runs outside. Hop, hop, hop!`, `${n} hopped out into the meadow, where the flowers nodded hello and a bumblebee hummed a very silly song.`),
            `Wide shot of a sunny meadow: ${n} leaps through tall grass mid-hop, body stretched, ears streaming back, looking up delightedly at a bumblebee looping overhead. Poppies and daisies in the foreground.`,
            ["hero"],
          ),
          page(
            s(`Quack! Who is that?`, `Behind a bush, someone sneezed. "A-CHOO! Oh, excuse me," said a small duckling. "I'm Dilly. I'm looking for something wonderful, but I've forgotten what it is!"`),
            `Mid shot by a hedge: a duckling (Dilly) tumbles out of the bush backwards with a big sneeze, feathers flying; ${n} jumps back in surprise, eyes wide, one paw raised.`,
            ["hero", "duckling"],
          ),
          page(
            s(`Where shall we look?`, `${n} tapped a chin and thought very hard. "Something wonderful could be anywhere," said ${n}. "Where shall we look first?"`),
            `Low-angle shot from the grass: ${n} crouches thoughtfully with a paw on chin, Dilly perched on a mushroom copying the pose exactly; a winding path leads off to a pond and a tall tree in the distance.`,
            ["hero", "duckling"],
          ),
        ],
        choice: { prompt: `Where should ${n} and Dilly look?`, options: options(["The splashy pond", "The tall oak tree", "Under the rainbow"]) },
      },
    };
  }

  const last = segs[segs.length - 1]?.chosen;
  const choiceText = last?.text ?? "explore";
  const custom = Boolean(last?.custom);
  const total = age.choices + 1;
  const isLast = segs.length + 1 >= total;
  const pond = /pond|splash|water|swim/i.test(choiceText);
  const place = pond ? "pond" : /tree|oak|climb/i.test(choiceText) ? "wood" : "meadow";
  const first = page(
    s(`Off they go! Wheee!`, `"Let's go!" cheered ${n}. Off they went, ${pond ? "splish-splashing down to the pond" : `skipping all the way to the ${place}`}, with Dilly flapping happily behind.`),
    `Wide shot: ${n} leaps ahead along a path toward the ${place}, legs stretched mid-bound, Dilly scurrying behind with wings flapping; dandelion seeds swirl in their wake.`,
    ["hero", "duckling"],
    custom ? `Ooh, you want ${n} to ${choiceText.replace(/^to /i, "")}? What a fun idea! Let's see what happens…` : null,
  );

  if (isLast) {
    return {
      newCharacters: [],
      ending: true,
      segment: {
        chosen: null,
        choice: null,
        pages: [
          first,
          page(
            s(`Look! A little present!`, `And there, tucked under a dock leaf, was a little parcel tied with string. "THAT'S IT!" quacked Dilly. "The wonderful thing was a present… for my new friend!"`),
            `Close-up: ${n} kneels and lifts a dock leaf to discover a small parcel tied with string, face lit with surprise; Dilly hops up and down beside it, wings wide.`,
            ["hero", "duckling"],
          ),
          page(
            s(`Big hug. Night night, ${n}.`, `${n} gave Dilly the biggest, squishiest hug. As the stars came out, the two friends yawned together. "Same time tomorrow?" "Same time tomorrow." The End.`),
            `Night-time in the meadow under a big moon: ${n} and Dilly curl up asleep together in the long grass, Dilly tucked under ${n}'s arm, the opened parcel beside them; fireflies and stars.`,
            ["hero", "duckling"],
          ),
        ],
      },
    };
  }

  return {
    newCharacters: [],
    ending: false,
    segment: {
      chosen: null,
      pages: [
        first,
        page(
          s(`Uh-oh! Splash!`, `Uh-oh! Dilly slipped on a wet leaf and landed (PLOP!) right on ${n}'s head. "Is it a hat?" giggled ${n}. "I'm a very fancy hat," said Dilly.`),
          `Mid shot by a puddle in light rain: Dilly lands on ${n}'s head with a splash, feet in the air; ${n} staggers, laughing with eyes squeezed shut, water droplets flying.`,
          ["hero", "duckling"],
        ),
        page(
          s(`The rain stops. Look up!`, `The rain stopped and the sun peeped out. Far away, beyond the hill, something glittered. "Is that the wonderful thing?" whispered ${n}.`),
          `Wide shot from behind: ${n} and Dilly stand on a hilltop, ${n} pointing into the distance, Dilly on tiptoe; a soft rainbow over the fields and a glint of light far away.`,
          ["hero", "duckling"],
        ),
      ],
      choice: { prompt: `How should they get there?`, options: options(["Race down the hill", "Float on a dandelion clock", "Follow the butterflies"]) },
    },
  };
}

export function mockCharacter(req: CharacterRequest): CharacterResponse {
  const seed = hash(req.description);
  const [fill, dark] = pick(
    [
      ["#A99BB5", "#8C7E9A"],
      ["#8FA7B5", "#6F8FAF"],
      ["#AAB585", "#7F905E"],
      ["#D3A24F", "#B08436"],
      ["#C98F6E", "#A8704F"],
    ],
    seed,
  );
  const svg = `<g class="paint"><ellipse cx="100" cy="191" rx="60" ry="6" fill="#CFC6AC" opacity="0.6"/>
<ellipse cx="74" cy="184" rx="16" ry="8" fill="${dark}"/><ellipse cx="126" cy="184" rx="16" ry="8" fill="${dark}"/>
<path d="M100 40 C146 40 166 84 164 124 C162 162 136 186 100 186 C64 186 38 162 36 124 C34 84 54 40 100 40Z" fill="${fill}"/>
<ellipse cx="100" cy="148" rx="34" ry="28" fill="#F3E6D0"/>
<ellipse cx="66" cy="44" rx="10" ry="18" transform="rotate(-20 66 44)" fill="${dark}"/><ellipse cx="134" cy="44" rx="10" ry="18" transform="rotate(20 134 44)" fill="${dark}"/></g>
<g class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round"><path d="M100 40 C146 40 166 84 164 124 C162 162 136 186 100 186 C64 186 38 162 36 124 C34 84 54 40 100 40Z"/><path d="M92 112 Q100 118 108 112"/></g>
<g class="detail"><circle cx="86" cy="96" r="3.4" fill="#2A1E15"/><circle cx="114" cy="96" r="3.4" fill="#2A1E15"/></g>`;
  const name = req.name?.trim() || req.description.split(/\s+/).slice(-1)[0].replace(/^\w/, (c) => c.toUpperCase()).slice(0, 20) || "Buddy";
  return {
    demo: true,
    character: { id: "hero", name, look: `${req.description}: a round, soft little creature in ${fill}`, preset: null, svg },
  };
}
