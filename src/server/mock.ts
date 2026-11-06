// Demo-mode storyteller used when no ANTHROPIC_API_KEY is configured, so the
// whole app can be explored offline. Stories are templated, not AI-written.
import { ageById } from "@/lib/ages";
import type { CharacterRequest, CharacterResponse, Page, SegmentResponse, StoryRequest } from "@/lib/types";
import type { Setting } from "@/lib/vocab";

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

function page(p: Partial<Page> & { text: string }): Page {
  return {
    sound: null,
    aside: null,
    setting: "meadow",
    time: "day",
    weather: "clear",
    characters: [{ id: "hero", x: 40, expression: "happy", pose: "stand", size: "large", flip: false }],
    props: [],
    ...p,
  };
}

const short = (age: string, toddler: string, older: string) =>
  age === "1.5-2" || age === "2-3" ? toddler : older;

export function mockSegment(req: StoryRequest): SegmentResponse {
  const isStart = req.kind === "start";
  const ageId = isStart ? req.age : req.story.age;
  const age = ageById(ageId);
  const hero = isStart ? req.hero : req.story.hero;
  const theme = isStart ? req.theme : req.story.theme;
  const segs = isStart ? [] : req.story.segments;
  const n = hero.name;
  const total = age.choices + 1;
  const index = segs.length + 1;
  const seed = hash(theme + n);
  const place: Setting = pick(["meadow", "forest", "garden", "beach"] as Setting[], seed);
  const s = (t: string, o: string) => short(ageId, t, o);

  if (isStart) {
    return {
      title: `${n} and the ${pick(["Giggly", "Sparkly", "Wobbly", "Sunny"], seed)} ${pick(["Day", "Surprise", "Puddle", "Balloon"], seed + 1)}`,
      newCharacters: [
        { id: "duck", name: "Dilly", description: "a cheerful duckling friend", preset: "penguin", svg: null, face: null },
      ],
      newProps: [],
      ending: false,
      segment: {
        chosen: null,
        pages: [
          page({
            text: s(`Look! It's ${n}. Hello, ${n}!`, `One sunny morning, ${n} woke up with a wiggle and a giggle. "Today feels like a wonderful kind of day!" said ${n}.`),
            setting: "bedroom",
            props: [{ kind: "bed", x: 75, y: 90, size: "large" }, { kind: "teddy", x: 18, y: 90, size: "small" }, { kind: "lantern", x: 88, y: 40, size: "small" }],
            characters: [{ id: "hero", x: 42, expression: "excited", pose: "jump", size: "large", flip: false }],
            sound: "BOING!",
          }),
          page({
            text: s(`${n} goes outside. Hop, hop, hop!`, `${n} hopped outside, where the flowers were nodding hello and a bumblebee was humming a very silly song. "Bzzz-bzz-BOOP!"`),
            setting: place,
            props: [{ kind: "flowers", x: 15, y: 90, size: "medium" }, { kind: "bee", x: 70, y: 35, size: "small" }, { kind: "sun", x: 85, y: 22, size: "medium" }, { kind: "tree", x: 88, y: 88, size: "large" }],
            characters: [{ id: "hero", x: 40, expression: "laughing", pose: "run", size: "large", flip: false }],
          }),
          page({
            text: s(`Quack! Who is that? It's Dilly!`, `Behind a bush, someone sneezed. "A-CHOO! Oh, excuse me," said a small duckling. "I'm Dilly. I'm looking for something wonderful, but I forgot what it was!"`),
            setting: place,
            props: [{ kind: "bush", x: 70, y: 90, size: "large" }, { kind: "butterfly", x: 50, y: 30, size: "small" }, { kind: "cloud", x: 20, y: 20, size: "medium" }],
            characters: [
              { id: "hero", x: 28, expression: "surprised", pose: "stand", size: "large", flip: false },
              { id: "duck", x: 68, expression: "silly", pose: "wave", size: "medium", flip: true },
            ],
            sound: "A-CHOO!",
          }),
          page({
            text: s(`Where should we go?`, `${n} tapped a chin and thought very hard. "Hmm! Something wonderful could be anywhere," said ${n}. "Where should we look first?"`),
            setting: place,
            props: [{ kind: "map", x: 50, y: 88, size: "medium" }, { kind: "mushroom", x: 12, y: 90, size: "small" }, { kind: "flower", x: 90, y: 90, size: "small" }],
            characters: [
              { id: "hero", x: 30, expression: "thinking", pose: "stand", size: "large", flip: false },
              { id: "duck", x: 72, expression: "happy", pose: "stand", size: "medium", flip: true },
            ],
          }),
        ],
        choice: {
          prompt: `Where should ${n} and Dilly look?`,
          options:
            age.optionCount === 2
              ? [{ label: "The splashy pond", emoji: "💦" }, { label: "The tall tree", emoji: "🌳" }]
              : [{ label: "The splashy pond", emoji: "💦" }, { label: "The tall tree", emoji: "🌳" }, { label: "Under the rainbow", emoji: "🌈" }],
        },
      },
    };
  }

  const last = segs[segs.length - 1]?.chosen;
  const choiceText = last?.text ?? "explore";
  const custom = Boolean(last?.custom);
  const isLast = index >= total;
  const pond = /pond|splash|water|swim/i.test(choiceText);
  const setting: Setting = pond ? "pond" : /rainbow|sky/i.test(choiceText) ? "sky" : "forest";

  const first = page({
    text: s(`${n} and Dilly go to the ${setting}. Wheee!`, `"Let's go!" cheered ${n}. Off they went, ${pond ? "splish-splashing to the pond" : `skipping all the way to the ${setting}`}, with Dilly flapping happily behind.`),
    aside: custom ? `Ooh, you want ${n} to ${choiceText.replace(/^to /i, "")}? What a fun idea! Let's see what happens…` : null,
    setting,
    props: pond
      ? [{ kind: "fish", x: 70, y: 85, size: "small" }, { kind: "boat", x: 85, y: 80, size: "medium" }, { kind: "flower", x: 10, y: 90, size: "small" }]
      : [{ kind: "tree", x: 80, y: 88, size: "large" }, { kind: "mushroom", x: 15, y: 90, size: "small" }, { kind: "bird", x: 60, y: 25, size: "small" }],
    characters: [
      { id: "hero", x: 35, expression: "excited", pose: "run", size: "large", flip: false },
      { id: "duck", x: 65, expression: "laughing", pose: "jump", size: "medium", flip: false },
    ],
    sound: pond ? "SPLASH!" : "WHEE!",
  });

  if (isLast) {
    return {
      newCharacters: [],
      newProps: [],
      ending: true,
      segment: {
        chosen: null,
        choice: null,
        pages: [
          first,
          page({
            text: s(`Look! A big shiny gift!`, `And there, tucked behind a leaf, was a little gift tied with a pink bow. "THAT'S IT!" quacked Dilly. "The wonderful thing was a present… for my new friend!"`),
            setting,
            props: [{ kind: "gift", x: 50, y: 88, size: "medium" }, { kind: "sparkles", x: 50, y: 60, size: "medium" }, { kind: "heart", x: 80, y: 30, size: "small" }],
            characters: [
              { id: "hero", x: 25, expression: "surprised", pose: "stand", size: "large", flip: false },
              { id: "duck", x: 78, expression: "excited", pose: "jump", size: "medium", flip: true },
            ],
          }),
          page({
            text: s(`Hug! Night night, ${n}.`, `${n} gave Dilly the biggest, squishiest hug. As the stars came out, the two friends yawned together. "Same time tomorrow?" "Same time tomorrow." The End.`),
            setting: "meadow",
            time: "night",
            props: [{ kind: "moon", x: 80, y: 25, size: "medium" }, { kind: "star", x: 20, y: 18, size: "small" }, { kind: "star", x: 50, y: 12, size: "small" }, { kind: "flowers", x: 10, y: 92, size: "small" }],
            characters: [
              { id: "hero", x: 40, expression: "sleepy", pose: "stand", size: "large", flip: false },
              { id: "duck", x: 62, expression: "sleepy", pose: "sleep", size: "medium", flip: true },
            ],
          }),
        ],
      },
    };
  }

  return {
    newCharacters: [],
    newProps: [],
    ending: false,
    segment: {
      chosen: null,
      pages: [
        first,
        page({
          text: s(`Uh-oh! A puddle. Plop!`, `Uh-oh! Dilly slipped on a slippery leaf and landed — PLOP! — right on ${n}'s head. "Is it a hat?" giggled ${n}. "I'm a very fancy hat," said Dilly.`),
          setting,
          weather: "rain",
          props: [{ kind: "puddle", x: 55, y: 92, size: "large" }, { kind: "umbrella", x: 85, y: 85, size: "medium" }, { kind: "leaf", x: 20, y: 60, size: "small" }],
          characters: [
            { id: "hero", x: 40, expression: "silly", pose: "stand", size: "large", flip: false },
            { id: "duck", x: 60, expression: "laughing", pose: "float", size: "small", flip: true },
          ],
          sound: "PLOP!",
        }),
        page({
          text: s(`The rain stops. A rainbow!`, `The rain stopped and a rainbow stretched across the sky. Far away, something glittered. "Is that the wonderful thing?" whispered ${n}.`),
          setting: "meadow",
          weather: "rainbow",
          props: [{ kind: "sparkles", x: 80, y: 70, size: "small" }, { kind: "flowers", x: 15, y: 92, size: "medium" }, { kind: "cloud", x: 30, y: 20, size: "small" }],
          characters: [
            { id: "hero", x: 35, expression: "surprised", pose: "stand", size: "large", flip: false },
            { id: "duck", x: 60, expression: "thinking", pose: "stand", size: "medium", flip: false },
          ],
        }),
      ],
      choice: {
        prompt: `How should they get there?`,
        options:
          age.optionCount === 2
            ? [{ label: "Hop like bunnies", emoji: "🐰" }, { label: "Ride a balloon", emoji: "🎈" }]
            : [{ label: "Hop like bunnies", emoji: "🐰" }, { label: "Ride a balloon", emoji: "🎈" }, { label: "Sing a path-finding song", emoji: "🎵" }],
      },
    },
  };
}

export function mockCharacter(req: CharacterRequest): CharacterResponse {
  const seed = hash(req.description);
  const fills = [
    ["#F9C6D3", "#D98BA0"],
    ["#B5E3E8", "#7FB9C2"],
    ["#CDEAC0", "#93BE83"],
    ["#E3C6F2", "#B593CC"],
    ["#FFD6A5", "#E0A66A"],
  ];
  const [fill, line] = pick(fills, seed);
  const svg = `<g stroke="${line}" stroke-width="3" stroke-linejoin="round"><ellipse cx="70" cy="183" rx="18" ry="10" fill="${fill}"/><ellipse cx="130" cy="183" rx="18" ry="10" fill="${fill}"/><path d="M100 30 C150 30 172 75 170 120 C168 165 140 186 100 186 C60 186 32 165 30 120 C28 75 50 30 100 30 Z" fill="${fill}"/><ellipse cx="100" cy="150" rx="38" ry="28" fill="#FFF4C9"/><circle cx="62" cy="38" r="12" fill="${fill}"/><circle cx="138" cy="38" r="12" fill="${fill}"/></g>`;
  const name = req.name?.trim() || req.description.split(/\s+/).slice(-1)[0].replace(/^\w/, (c) => c.toUpperCase()).slice(0, 20) || "Buddy";
  return {
    demo: true,
    character: {
      id: "hero",
      name,
      description: `${req.description} (a round, cuddly friend)`,
      preset: null,
      svg,
      face: { x: 100, y: 95, size: 64 },
    },
  };
}
