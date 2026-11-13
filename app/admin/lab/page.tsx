import { currentAdmin } from "@/server/entitlements";
import { redirect } from "next/navigation";
import { listCharacters } from "@/server/characters";
import { PRESETS, presetByKey, presetCharacter } from "@/lib/presets";
import type { CharacterDef } from "@/lib/types";
import { LabBench, type LabPage } from "./LabBench";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painting bench", robots: { index: false, follow: false } };

const WORLD = "a gentle English countryside in late summer, soft golden light, hedgerows and wild flowers";

/**
 * The painting bench (admin only): a fixed set of pages, each painted the
 * ordinary way and from reused pieces, side by side, with what each cost
 * and how long it took, read back from the activity log. The pages are the
 * hard cases: three characters, an action on a thing in the scenery, a
 * family's own character, a close-up, and three pages in one place.
 */
export default async function LabPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/");
  const preset = (key: string, id: string) => presetCharacter(presetByKey(key)!, undefined, id);
  // (the admin's own first made-up character, if there is one, stands in
  // for a family's)
  const mine = await listCharacters(admin.id).catch(() => []);
  const own = mine.find((c) => c.svg);
  // (for the admin's own test pages: every preset, and their own characters)
  const choices: CharacterDef[] = [
    ...mine.filter((c) => c.svg).map((c): CharacterDef => ({ id: `own-${c.id}`.slice(0, 40), name: c.name, look: c.look, preset: null, svg: c.svg })),
    ...PRESETS.map((p) => presetCharacter(p, undefined, p.key)),
  ];
  const custom: CharacterDef | null = own ? { id: "hero", name: own.name, look: own.look, preset: null, svg: own.svg } : null;
  const pip = preset("bunny", "hero");
  const miso = preset("kitty", "friend1");
  const pages: LabPage[] = [
    {
      key: "three",
      label: "Three characters",
      cast: [pip, preset("bear", "friend1"), preset("fox", "friend2")],
      page: {
        text: "Pip, Bobo and Fennel spread a checked blanket under the big oak and shared out the berries.",
        picture: "A mid shot at the edge of a summer meadow: Pip, Bobo and Fennel sit on a red checked blanket under a big oak on the left, Bobo holding up a bowl of berries, Pip laughing, Fennel reaching for a berry; wild flowers and grass, a fence on the right, a few clouds.",
        characters: ["hero", "friend1", "friend2"],
        action: { word: "shared", target: "friend1", sound: "pop", motion: "bounce" },
      },
      place: { id: "meadow-oak", about: "the edge of a summer meadow: a big oak on the left, a wooden fence on the right, wild flowers in the long grass", light: "day" },
      camera: "mid",
    },
    {
      key: "puddle",
      label: "Action on a thing in the scenery",
      cast: [pip],
      page: {
        text: "SPLASH! Pip jumped right into the middle of the muddy puddle.",
        picture: "A mid shot on a country lane after the rain has stopped: Pip mid-jump, landing in a big brown puddle that throws up a fan of splashes; hedges either side, a field gate behind, blue sky clearing.",
        characters: ["hero"],
        action: { word: "splash", target: "puddle", sound: "splash", motion: "wiggle" },
      },
      place: { id: "country-lane", about: "a country lane between two hedges, a wooden field gate behind, fields beyond", light: "day" },
      camera: "mid",
    },
    {
      key: "custom",
      label: custom ? `A family's own character (${custom.name})` : "A family's own character (none saved: Miso stands in)",
      cast: [custom ?? preset("kitty", "hero")],
      page: {
        text: `${custom?.name ?? "Miso"} waved from the garden gate, ready for an adventure.`,
        picture: `A mid shot by a cottage garden gate with climbing roses: ${custom?.name ?? "Miso"} waves hello with one hand on the gate; a path, flower beds, a cottage window behind.`,
        characters: ["hero"],
        action: null,
      },
      place: { id: "cottage-gate", about: "a cottage garden gate with climbing roses on the left, a path, flower beds, a cottage window behind on the right", light: "day" },
      camera: "mid",
    },
    {
      key: "closeup",
      label: "A close-up",
      cast: [preset("bear", "hero")],
      page: {
        text: "Bobo went cross-eyed: a ladybird had landed right on the tip of his nose.",
        picture: "A close-up of Bobo's face and shoulders, his eyes crossed looking at a tiny red ladybird on the tip of his nose, mouth in a surprised 'o'; a soft leafy background.",
        characters: ["hero"],
        action: { word: "ladybird", target: "hero", sound: "giggle", motion: "wiggle" },
      },
      place: { id: "leafy-hedge", about: "a sunny leafy hedge with a few wild flowers", light: "day" },
      camera: "close",
    },
    {
      key: "place1",
      label: "One place, page 1 of 3",
      cast: [pip, miso],
      page: {
        text: "Pip and Miso came to the old apple tree by the stream.",
        picture: "A wide shot: the old apple tree on the right bank of a little stream, a wooden footbridge on the left; Pip and Miso walk in along the grass, Miso pointing up at the apples. Golden afternoon light.",
        characters: ["hero", "friend1"],
        action: { word: "apple", target: "friend1", sound: "pop", motion: "bounce" },
      },
      place: { id: "apple-tree", about: "a little stream with the old apple tree on its right bank and a wooden footbridge on the left, grass and buttercups along the banks", light: "golden" },
      camera: "wide",
    },
    {
      key: "place2",
      label: "One place, page 2 of 3",
      cast: [pip, miso],
      previous: "A wide shot: the old apple tree on the right bank of a little stream, a wooden footbridge on the left; Pip and Miso walk in along the grass. Golden afternoon light.",
      page: {
        text: "Miso scrambled up the trunk while Pip held the basket.",
        picture: "A mid shot at the same apple tree by the stream (the tree on the right, the footbridge on the left): Miso clinging to the trunk halfway up, Pip below holding a wicker basket up high. Golden afternoon light.",
        characters: ["hero", "friend1"],
        action: { word: "scrambled", target: "friend1", sound: "boing", motion: "bounce" },
      },
      place: { id: "apple-tree", about: "a little stream with the old apple tree on its right bank and a wooden footbridge on the left, grass and buttercups along the banks", light: "golden" },
      camera: "mid",
    },
    {
      key: "place3",
      label: "One place, page 3 of 3",
      cast: [pip, miso],
      previous: "A mid shot at the same apple tree by the stream: Miso clinging to the trunk, Pip below holding a wicker basket up high. Golden afternoon light.",
      page: {
        text: "One, two, three red apples tumbled down into the basket.",
        picture: "A mid shot, the same spot: apples falling from the branches, Pip catching them in the basket and laughing; Miso on a low branch, tail curled. Golden afternoon light, the stream glinting.",
        characters: ["hero", "friend1"],
        action: { word: "tumbled", target: "hero", sound: "pop", motion: "bounce" },
      },
      place: { id: "apple-tree", about: "a little stream with the old apple tree on its right bank and a wooden footbridge on the left, grass and buttercups along the banks", light: "golden" },
      camera: "mid",
    },
  ];
  return <LabBench world={WORLD} pages={pages} choices={choices} />;
}
