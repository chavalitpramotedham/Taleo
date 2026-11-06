"use client";
import { PRESETS, presetCharacter } from "@/lib/presets";
import { Scene } from "./art/Scene";

const p = (k: string) => PRESETS.find((x) => x.key === k)!;
const cast = {
  hero: presetCharacter(p("bunny")),
  berry: { ...presetCharacter(p("strawberry")), id: "berry" },
  tilly: { ...presetCharacter(p("teapot")), id: "tilly" },
};

export function HomeArt() {
  return (
    <Scene
      title="A bunny, a strawberry and a teapot having a picnic in a meadow"
      cast={cast}
      page={{
        text: "",
        sound: null,
        aside: null,
        setting: "meadow",
        time: "day",
        weather: "clear",
        characters: [
          { id: "hero", x: 24, expression: "laughing", pose: "jump", size: "large", flip: false },
          { id: "berry", x: 52, expression: "excited", pose: "dance", size: "medium", flip: false },
          { id: "tilly", x: 78, expression: "happy", pose: "stand", size: "medium", flip: true },
        ],
        props: [
          { kind: "sun", x: 84, y: 30, size: "medium" },
          { kind: "cloud", x: 22, y: 26, size: "medium" },
          { kind: "balloon", x: 60, y: 46, size: "small" },
          { kind: "tree", x: 94, y: 82, size: "large" },
          { kind: "butterfly", x: 40, y: 34, size: "small" },
          { kind: "flowers", x: 8, y: 96, size: "medium" },
          { kind: "cake", x: 64, y: 97, size: "small" },
        ],
      }}
    />
  );
}
