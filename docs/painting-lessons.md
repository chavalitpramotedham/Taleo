# Painting lessons

What the painting bench's side-by-side comparisons have taught us, distilled
into rules, and where each rule now lives. Every lesson is applied to every
way it concerns (not only the one in the comparison), and each batch of
changes gives the affected ways new version codes (see
`src/lib/bench-ways.ts`), so results from before and after stay apart.

How to add one: note what was seen (page, ways, what was right or wrong),
the rule it comes down to, what changed and where, and the new codes.

## Standing rules (from earlier work)

- Characters read at a picture-book size: a grown character in a mid shot
  is about half the picture's height (`SIZES` in
  `src/server/paint/expand.ts`; the instructions quote it). Before:
  about a third, and ways 4-5 looked empty.
- The main action comes first: its doer and target placed first, in reach,
  facing each other, the target never hidden (composer rules in
  `src/server/prompts.ts`, the layout pass in `src/server/paint/layout.ts`).
- Nothing painted is thrown away; slips are mended, not restarted
  (`brushStrokes`, `inLayers`, `expandStream`).

## 13 Nov 2026 - "The squirrel's acorn stash" (c21)

Seen: way 3 ranked first (the user: "really good"; good on dimensions),
way 2 second, v0 third. Ways 2 and 3 left out the "hollow full of acorns"
the brief has the squirrel pointing into; v0 painted it. In way 3 the
squirrel came out larger than Pip, which the user was happy with.

**Lesson 1 - every character's size against the others is on its sheet.**
A character's kind decides it: tiny (a ladybird, a bee, a fairy) about a
tenth of a grown character; small (a squirrel, a mouse, a bird) about two
thirds; a little smaller (a goose, a puppy) about three quarters. Kept
gentle: picture-book characters needn't be to scale.
Where: `relativeSize` in `src/server/claude.ts`, added to every
character's sheet, for every way.

**Lesson 2 - the main action's object is always shown, at the action.**
If the main action is done to or with a thing (the hollow full of acorns,
the basket, the kite), it is the most important thing in the picture after
the characters.
Where: the character painter's brief (`LAYERED_CHARACTERS`), the moment's
own details (`MOMENT_DETAILS`), and both composers' main-action rule
(`src/server/prompts.ts`) - so v0 and ways 2-5.

New codes: 1-U1Y4, 2-Z9BY, 3-W16M, 4-5V0L, 5-252J (same cost estimates).

## 13 Nov 2026 - "The squirrel's acorn stash" again: way 3 lost the squirrel

Seen: on a repaint, way 3 (which had done best before) had no squirrel at
all. Ways 4 and 5 placed it; v0 and way 2 painted it.

Why: Nutkin has no portrait, so in way 3 the character painter must draw
him in full. It most likely wrote him as a <fig> (the form it uses for
characters made from parts) instead. Before "nothing painted is thrown
away", that made the whole page start again the ordinary way, which is
why the slip didn't show; afterwards, the mend for "a figure for someone
with no parts" was to leave it out - and the squirrel went with it.

**Lesson 3 - a mend must never drop a character.** If a character with
no parts is drawn inside a <fig>, that drawing is the character: it's kept
and placed where the figure says (in its own 200x200 coordinates, at the
figure's position and size), never left out. And, to make the slip rarer,
on a page where others are painted from parts, a character without parts
is marked "DRAWN IN FULL by you, the ordinary way: never as a <fig>" on
its sheet.
Where: the <fig> handling in `src/server/paint/expand.ts` (DRAWN_VIEW);
the sheet in `paintOnce` (`src/server/claude.ts`).

New codes: 2-HYLE, 3-VMVL (ways 4 and 5 unchanged: they place newcomers
separately).
