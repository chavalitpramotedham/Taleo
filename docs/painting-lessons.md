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

## 13 Nov 2026 - an audit after the missing squirrel, and the autumn colours

Seen: after way 3 lost the squirrel, the whole pipeline was gone through
for every way a character or a required element can go missing. And in
"The squirrel's acorn stash", only v0 had the warm autumn colours the
place ("an autumn wood of copper beeches") calls for; ways 2-5 came out in
summer greens.

The audit, path by path:
- composed pages (ways 4-5): a character the composer leaves out is placed
  in code; one with no parts or poses is painted for the page - covered;
- the translator's mends: lesson 3 fixed the one that dropped a character;
  the others only skip a piece or fill in a number;
- one of two painters failing: the other's work is kept and the failure
  reported - covered;
- **a painter (v0, ways 2-3) that simply forgets a character: nothing
  checked** - lesson 4;
- **a newcomer whose painting comes out empty: quietly left out** -
  lesson 4.

**Lesson 4 - every character on the page is checked for.** Painters mark
each character they paint with <who c="id"/> (taken out before the page is
sent); figures and poses count too. When the painter finishes, anyone on
the page it left out is asked for: it carries on, shown what it painted,
to paint ONLY them. Nothing extra unless someone is missing; a painter
that marked no one at all isn't second-guessed (that could paint everyone
twice). A newcomer whose painting comes out empty is painted once more.
Where: `everyone()` and `paintNewcomer` in `src/server/claude.ts`; the
marker in `LAYERED_CHARACTERS` and the character painter's instruction.

**Lesson 5 - the place's own season wins over the book's.** The bench's
books say "late summer", and the reuse ways took their season (the
colours of code-made trees and leaves, and the backdrop painter's brief)
from the book alone. Now a season named or plainly implied by the place
("an autumn wood") or the page ("orange and gold leaves falling", "a
snowman", "blossom") decides the colours, and the backdrop painter is told
the season and its colours outright. Prepared places are kept by their own
season (new keys), so autumn places are painted again in autumn.
Where: `seasonFor` and `SEASON_LOOK` in `src/server/claude.ts`.

Checked with a stand-in that "forgot" two of three characters: v0 and
ways 2-3 each asked for exactly those two again.

New codes: 1-TNN3, 2-HKAD, 3-A92J, 4-71XO, 5-2JDK.

## 13 Nov 2026 - "Baking day" (c24): legs, crowding, the cupcake's arms

Seen (v0 paused): way 2's bear had no legs; way 3 was messy; way 4's
cupcake had thick dark mismatched arms; way 5 was hard to read. In all of
them Bobo, Sprinkles and Tilly were crowded into one overlapping clump.

**Lesson 6 - legs are always drawn; what's in front is a piece.** Way 2's
bear stood "at the table" and its painter left the legs out as if the
table hid them - but with a reused backdrop the table lies behind every
character, so the bear floated. The scenery is always behind the
characters: every character is drawn whole, legs and feet included, and
a table, counter or fence a character should be behind is placed AFTER it
as a piece with near="1", in front.
Where: `LAYERED_CHARACTERS`, `PARTS_SECTION`, both composers' rules
(`src/server/prompts.ts`).

**Lesson 7 - characters are eased apart as they're placed.** The layout
pass only ran on composed pages, after the composer finished; the
painters of ways 2-3 placed figures on top of each other. Now every
character placed as a figure or a pose, in any way, is checked against
those already placed: one overlapping another by more than a hand's width
(a quarter of the narrower body) is eased sideways, and kept in the
picture. Characters far apart in depth may still cross. The composers
are also told to spread three or more across the stage.
Where: `spaceOut` in `expandStream` (`src/server/paint/expand.ts`);
"SPACE" in the composers' rules.

**Lesson 8 - code-made limbs follow the character's build.** The new
tapering limbs suit animals, but food and object characters (a cupcake, a
strawberry, a teapot) move with thin pen-line arms and legs, little round
hands and small dark boots - as their portraits and the house style draw
them. A character whose parts' build mentions ink-line, stick or thin
pen limbs now gets exactly that.
Where: `Build.thin` and `thinLimb` in `src/lib/art/poses.ts`; detected in
`posedFigure` (`src/server/paint/expand.ts`).

Checked: three figures written at x 190, 200 and 215 came out side by
side; a figure whose build says "thin ink-line arms and legs" got pen-line
limbs with dark boots.

New codes: 1-UUK6, 2-IR7G, 3-ANDK, 4-6NMN, 5-2XOL.

## 13 Nov 2026 - way 4: characters fine, context and named things missing

Seen (the user): way 4's characters look fine, but its pictures lack the
moment's context and often leave out things the prompt names.

**Lesson 9 - composers check the brief thing by thing; way 4 thinks
harder.** Both composers now end with a checklist step: go through every
concrete thing the picture brief and the text name (objects, what the
place has in it for this moment, what the weather or action leaves) and
make sure each is in the picture, where the brief puts it - a standard
piece where one fits, else a few simple drawn shapes - before finishing.
Way 4's composer moves from Sonnet at low effort to medium (about twice
the thinking, ~6 cents a page against ~3), since its gaps are in
composition, not drawing. Its reply room goes from 8,000 to 12,000 tokens
to fit the thinking.
Where: rule 4 of both composers' "THINK FIRST" (`src/server/prompts.ts`);
way 4's settings (`src/lib/bench-ways.ts`); `replyRoom`
(`src/server/claude.ts`).

Watch: if way 4 at ~6 cents isn't clearly better than way 3 at ~5, it
loses its reason to exist.

New codes: 4-TG6T, 5-3BZM.

## 13 Nov 2026 - back and front

Asked (the user): care about what's drawn in front of what - things that
are nearer, or smaller, must be drawn in front.

**Lesson 10 - back to front.** What's written later lies on top, so:
- on composed pages (ways 4-5) the layout pass now sorts the characters
  by depth - further back (higher up the picture) first, nearer after;
  at the same depth, bigger before smaller, so a small character isn't
  hidden by a big one beside it. Each moves with what belongs to it: the
  near="1" seat or tree just before it, and what it holds or hides behind
  just after it (a near="1" piece between two characters goes with the
  one it's closer to across the picture). The main action's target still
  can't be drawn under anyone;
- the painters (v0, ways 2-3), which draw as they go, are told to paint
  back to front, smaller after bigger, and things in front of a
  character after it; the composers' DEPTH rule says the same.
Where: `byDepth` in `src/server/paint/layout.ts`; `LAYERED_CHARACTERS`
and the composers' DEPTH rule (`src/server/prompts.ts`).

Checked: a nearer character written first was moved after a further one
(each keeping its log and its basket); a small mouse beside a big bear
came after it; a target in its group moved as one.

New codes: 1-UG95, 2-ICWF, 3-9GGH, 4-TUHU, 5-HMQ6.

## 13 Nov 2026 - "The frog's lily pad" (c29), repainted

Seen: way 2 kept the brief best (Hop at the front of the pad, Berry and
Avo behind, the dragonfly). Way 3 had the frog lying off to the right and
the three overlapping. Way 4 was tidy, with the pad, but had all three
standing in a row - nobody sitting at the front or holding on. Way 5 was
still a pile-up: the frog almost covering Avo, and Avo far bigger than
Berry.

**Lesson 11 - overlapping is allowed only for true depth.** Two
characters were let overlap whenever one stood more than 40 higher up the
page, so way 5's Avo, placed a little higher but just as big, was piled
behind the frog. Now they may overlap only if the further one is higher up
AND clearly smaller (under 80% of the nearer one's size); otherwise
they're side by side and are eased apart.
Where: `apartInDepth` (`src/server/paint/layout.ts`), used by the layout
pass and by `spaceOut` (`src/server/paint/expand.ts`).

**Lesson 12 - sizes true to each other.** The composer gave an avocado and
a strawberry very different sizes. Now each character is kept within 20%
of the page's usual size times its own share (1 for a grown character,
about two thirds for a squirrel or a frog, from lesson 1's kinds) - in the
layout pass, and in the translator's size band, which now scales by the
same share (it had pushed small characters back up to grown size).
Where: step 0 of `layoutComposed`; `sized` and `ExpandContext.sizeOf`
(`src/server/paint/expand.ts`); `sizeShare` (`src/server/claude.ts`).

**Lesson 13 - the arrangement the brief describes is kept.** "At the
front", "behind him", "sitting on", "holding on" were treated as optional.
The composers' main-action rule now says the arrangement is part of the
action and is kept exactly, with the poses that say it (sit, hold,
reach) - never all standing in a row.
Where: rule 1 of both composers' "THINK FIRST" (`src/server/prompts.ts`).

Checked: way 5's pile-up re-created (Avo higher up but bigger, the frog in
front, Berry beside) came out with Avo resized to 1.06, the frog to a
frog's share, all three eased apart and drawn back to front.

New codes: 2-JJTI, 3-9URI, 4-U8SV, 5-H8F5.

## 13 Nov 2026 - "The biggest pumpkin" (c31): things in front of characters

Seen: the autumn colours now come through in every way (lesson 5 working).
Way 4 - the one the user is rooting for - had good directions but the
wrong order: the giant pumpkin was drawn over Bobo, who stood inside it.
There's no pumpkin piece, so the composer drew it, after the characters;
and the depth sort only moved characters, carrying any piece written just
after one along with it as if held.

**Lesson 14 - things have depth too.** The layout pass (ways 4-5) now
orders big pieces and the shapes a composer draws by their own depth,
with the characters: further back first; at the same depth a thing before
the characters beside it (so paws on the pumpkin show). Only small things
(props, effects) still travel with the character they follow; seats and
covers (near="1") keep the composer's order. A character standing inside
a big thing at its depth is moved to the thing's nearer edge, just
touching it. A drawing's extent is read from its own shapes.
Where: `itemsOf`, `extentOf`, `pieceExtent` and `byDepth` in
`src/server/paint/layout.ts`.

**Lesson 15 - spatial awareness.** In the layout pass: everyone other than
the main action's target is turned towards it, and looks at it - a
character, or the thing the child taps - unless running or flying away;
characters standing at about the same depth (within 14) share one ground
line. And both composers are given the footprint numbers to place with: a
character at size s is about 110*s wide and 170*s tall, the top of its
head at y - 170*s, its eyes at y - 130*s, its hands in front at
x + 30*s, y - 75*s; side by side needs 110*s between them, touching about
80*s.
Where: step 2b of `layoutComposed`, `targetX`; "SIZES ON THE PAGE" in the
composers' rules (`src/server/prompts.ts`).

Checked: the pumpkin page re-created (three pushers written, then the
pumpkin drawn over Bobo) came out pumpkin first, Bobo moved to its left
edge; a basket as the tap target turned two characters towards it and
gave them a gaze, left a runner facing away, and put three sets of feet
(246, 250, 255) on one line.

New codes: 4-UN3W, 5-IFC8.

**Lesson 16 - the action has to read.** A layout that is tidy but loses
the story's moment is wrong. In the layout pass (ways 4-5):
- two characters who are both hugging are brought together, facing each
  other, about 80*s apart;
- the main action's character is kept well inside the frame (x 90-310); the
  whole group shifts, rather than that one character;
- a sitting character beside its seat (a near="1" piece just before it,
  within its width) is set on the seat's top;
- the tap target is always there and marked. If it is a character, its tag
  is wrapped. If it is a piece already drawn, that piece is marked. If it
  is missing, it is added from the library: on the ground, or up in the air
  (y 120) for a kite, balloon or bird;
- one character alone still gets these checks (it used to skip the pass).

The composer is also given a phrasebook of action words into poses: push,
carry, give, hide, peek, climb, cheer, dance, think, cry, sit and more.
Each is given as the arms, legs and mood to combine, always with the
feeling.

Where: steps 2a and 2b, the seat snap and `ensureTarget` in
`src/server/paint/layout.ts`; "ACTION WORDS INTO POSES" in
`src/server/prompts.ts`.

Checked: the layout pass on a hug, a character at the edge, a seat and a
missing kite. A live page with a preset bear and rabbit and a newcomer
squirrel came out composed and laid out, using a stand-in for the AI
service.

New codes: 4-RUYP (now live for readers), 5-I117.

**Lesson 17 - what the story needs is there, at its true size, and seen.**
An overnight run of 20 rounds on an 18-page Odyssey (a giant, a six-headed
serpent, a boat on every sea page, a bedtime and a birthday supper) and a
second short book. Each round was repainted, looked at and graded. What
the live way 4 got wrong, and what now holds:
- **Each character once.** A composer sometimes writes a tag two or three
  times: three Pollys, two Odys. Every character now gets one tag. A group
  (the Sea-Larks) is one character, since its one tag draws all of them.
- **The size the sheet states.** "About five times Ody's height", "as tall
  as Ody's waist", "each about as big as Hoot" are read as numbers against
  the hero. A giant is drawn as big as the picture allows with its face in
  it. A grown-up's arms are never longer than a body's arms.
- **Riding in a boat.** A fixed boat, the same on every page, and its near
  side (`hull`) drawn after the riders. Everyone standing on its deck is
  put in it, the boat grows to hold them, and they keep their footing up on
  a wave. Nobody stands on the sea, and no grass grows on it.
- **Furniture they use.** Furniture is drawn at the characters' scale (a
  table at library size was knee-high and lost). A sitting character with
  a bed after it is tucked in to the chest. Diners sit behind the table,
  and what's on it stays on top.
- **The story's own things.** Every thing the brief names that no piece
  covers is drawn, big enough to see. A target with no piece is drawn by
  the composer, as it is told on the page. A small thing at a character's
  hands is drawn in front of that character.
- **Seen.** The hero is never hidden, and nobody is more than half hidden.
  The layout has the last word on spacing (two spacers disagreeing pushed
  Gran in front of the table). Drawn shapes and flat pieces (a rug, a
  puddle) no longer push characters away: a wave pushed Ody out of her
  boat.
- **Hugs.** If the brief says two characters hug, they hug. They turn to
  face each other, half a body apart, with the smaller one in front.
  Front-view hug arms open round the other instead of crossing the hugger's
  own chest.
- **Only what a composer may write.** A stray `<boat>` element hid a whole
  page, so unknown tags are dropped. The sky belongs to the backdrop (a
  composer's moon made two moons). A cloud someone sits on stays.
- **The paper reserve.** Under every painted figure the paper is kept
  clean, so the scene doesn't show through a body.
- **Rain only when it rains.** "A rainbow" isn't rain.

Not kept: the composer at high effort cost about 2.2 times as much, with no
clear gain.

Where: `src/server/paint/layout.ts` (`oncePerCharacter`,
`furnitureToScale`, `tuckedIn`, `inTheBoat`, `atTheTable`, `finalSpacing`,
`onlyKnownTags`), `sizeShare` and `huggersOf` in `src/server/claude.ts`,
the composer's new sections in `src/server/prompts.ts`, the boat and hull
in `stamps-more.ts`, arms in `poses.ts`, and the reserve in `PaintDefs.tsx`.
The bench, its two books and every round's paintings and notes are in
`scripts/rsi/`.

New code: 4-S99Q.

**Lesson 18 - natural limbs, and a test set (14 Nov, painter RSI part 2).**

Tested on three dev books (the Odyssey, Kai's snowy quest, Bao's giant
kitchen) and checked once at the end on a held-out book (Nell and the
dragon). Code changes were tried on free replays of each page's saved
composer tags; model calls only for new books and one fresh dev round.

- **Real knees.** A leg that bends - sitting, crouching, a jump's tucked
  legs, a kick - is a thigh and a shin with a round knee, not one bowed
  tube. A sitter's hips come down onto its seat (its hips always SIT_FEET
  above its feet, so the layout seats everyone by one measure: chair,
  boat, bed); from the front its knees face us.
- **Legs under round bodies.** An elephant, an owl, a penguin or a bun had
  its body to the ground and looked seated on every page: the body is
  lifted until MIN_LEG of leg shows.
- **Two arms, two jobs.** A one-handed gesture leaves the other hand
  resting; resting arms rest a little differently; both up becomes one up
  and one waving. Hugs, carrying and clapping keep both hands. The
  composer is asked for this too, and to sit anyone on a seat.
- **Giants by contrast.** When the frame can't hold a giant at its stated
  size, everyone else is drawn smaller (down to about half). Caution:
  with several big characters on one page the hero gets too small.
- **Groups whole.** A group (three mice) can't be posed from one skeleton:
  its portrait shows them all and it is placed whole from that, and its
  sheet tells the composer to place it with one tag, never to draw it.
- **Riders.** "On her shoulder", "on Brom's shoulders", "on top of the
  cat's head", "on her back": the rider is seated there, after its
  carrier.
- **From the words too.** In bed ("tucked the blanket round Ody") and hugs
  ("threw her arms around his neck") are read from the page's text when
  the brief doesn't say them; in bed means no legs under the quilt.
- **Never blank.** Pictures over 80k characters were blanked by the
  sanitiser (a seven-character page): the limit is 200k. Bare tags in the
  composer's notes ("<fig> and <stamp> tags only") are ignored, and when
  it corrects itself ("Final output:") only the corrected copy is kept.

New code: 4-VT2Q (way 4, style s20).
