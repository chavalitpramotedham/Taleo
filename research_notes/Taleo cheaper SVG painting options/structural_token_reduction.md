# Structural / architectural ways to generate fewer tokens per Taleo page (reuse, composition, rigging, compact notation, caching)

Notes dated 2026-11-12. Repo state: commit `36c6476`. Repo sources are cited as `[repo: path]` links (absolute paths).

**Read this first: method caveats**

- `arxiv.org` is not reachable from this session (WebFetch fails with ENOTFOUND; it would have to be allowed in the session's network settings). Every paper below is therefore cited from search-result abstracts and secondary summaries, not from the full text. Numbers from papers are flagged "(secondary)" where I could not check the original.
- All token counts I measured are with the **o200k_base (OpenAI) tokenizer as a proxy** (npm `gpt-tokenizer`), run on SVG that is already in the repo. Claude's tokenizer is different and I could not run it; treat absolute counts as +/-30%, and ratios as indicative.
- The repo contains no stored page paintings and I had no access to production logs, so "tokens per page" is derived from the prompts' element budgets times a measured tokens-per-element figure. It excludes thinking tokens (the Opus character painter always thinks; amount unknown) and input tokens.

**Baseline used for every estimate below (assumptions, label B0)**

| Quantity | Value | Where it comes from |
|---|---|---|
| Tokens per SVG element | ~45 (2.0 chars/token) | Measured: 16 preset portraits = 432 shapes, 38.8k chars, 19.5k proxy tokens; `HOME_SCENE` = 151 shapes, 6.8k tokens = 45.0/element |
| Scenery layer | 60-120 elements, mid 90 = ~4.0k tokens | `sceneryPrompt` budget |
| Character layer | 50-150 elements, mid 100 = ~4.5k tokens (one character "rarely more than 65" = ~2.9k) | `LAYERED_CHARACTERS` budget |
| Page total | ~8.5k visible output tokens | sum |
| Price | scenery on Sonnet 5.5 $10/M out; characters on Opus 5.5 $20/M out (Sonnet on "quick" pages) | `PRICES` in metrics.ts, model constants in claude.ts |
| Cost per page | ~$0.040 scenery + ~$0.090 characters = ~$0.13 (main painter) | derived |
| Story length | 9 / 14 / 18 pages (Quest / Adventure / Odyssey) | `PAGES` in ages.ts |
| Story (14 pages) | ~119k tokens, ~$1.82 (56k scenery tokens = $0.56; 63k character tokens = $1.26) | derived |

So in dollars the character layer is ~70% of painting cost and scenery ~30%, even though they are about equal in tokens. That ordering drives the ranking at the end.

---

## Context verified in the code (what exists today)

### Takeaway
The brief's description is accurate. Three facts matter most for the rest: (1) the two-painter split already has a fixed "stage" convention that makes any scenery interchangeable under any characters; (2) the sanitizer drops anything outside 8 tags and a fixed attribute list, so every shorthand must be expanded on the server before the stream leaves `paintPage`; (3) the writer schema already has a "pick from a preset list or null" precedent for characters that a location field can copy.

### Cited Findings
- Two painters run concurrently; scenery strokes stream first and the character painter's strokes are held and appended after, so the output is plain concatenation `scenery + characters` — [repo: src/server/claude.ts `inLayers`, `paintPage`](/home/user/Taleo/src/server/claude.ts)
- Both painters get the same `stageFor` text: ground line at y≈240, horizon/wall join at y≈150, characters in x `200±half` (half = min(150, 45+35·n)) from y≈75 to feet at y 235-250, light from upper left. The scenery prompt forbids ink, hatching, dark shapes and landmarks inside that space — [repo: src/server/claude.ts `stageFor`](/home/user/Taleo/src/server/claude.ts), [repo: src/server/prompts.ts `sceneryPrompt`](/home/user/Taleo/src/server/prompts.ts)
- Scenery painter: Sonnet 5.5, low effort, thinking off, never sees character sheets. Character painter: Opus 5.5 at low effort (cannot turn thinking off) or Sonnet 5.5 on quick pages. A code comment records that Sonnet painted "at about half the cost, with somewhat less careful characters" and that Haiku 5.5 scenery "came out plainer and less finished" — [repo: src/server/claude.ts](/home/user/Taleo/src/server/claude.ts)
- Element budgets in prompts: whole page 150-300; scenery 60-120; layered characters 50-150; main character 40-60; background character 15-25; character designer portrait 80-120 — [repo: src/server/prompts.ts](/home/user/Taleo/src/server/prompts.ts)
- The prompt already asks for compact SVG: whole-number coordinates, no needless whitespace, shared attributes hoisted to the group — [repo: src/server/prompts.ts `LAYERS`](/home/user/Taleo/src/server/prompts.ts)
- Sanitizer whitelist: tags `g path circle ellipse rect polygon polyline line`; attributes are geometry, fill/stroke family, opacity, `transform`, `fill-rule`; `class` is consumed (layer -> filter, first `target` group -> `tl-target` wrapper); values must match `^[#a-zA-Z0-9\s.,\-+()%]*$`; page limit 80,000 chars (character portraits 30,000 in validate.ts). `use`, `symbol`, `defs`, ids, `data-*` and `style` are all dropped — [repo: src/lib/svg-sanitize.ts](/home/user/Taleo/src/lib/svg-sanitize.ts), [repo: src/server/validate.ts](/home/user/Taleo/src/server/validate.ts)
- Progressive paint-in relies on markup that only grows at its end: `grow()` appends new nodes down the last open branch and fades them in; otherwise it redraws everything — [repo: src/components/art/Painting.tsx `paintOnto`, `grow`](/home/user/Taleo/src/components/art/Painting.tsx)
- The "what is being painted now" caption is derived from the last `class="wash|paint|ink|detail"` group and whether the stream is inside `class="target"` — [repo: src/lib/art/paintingStage.ts](/home/user/Taleo/src/lib/art/paintingStage.ts)
- Watercolour filters (`tl-wash`, `tl-paint`, `tl-ink`) use absolute values (displacement scale 12/3/1.3, blur stdDeviation, erode radius) with default primitive units, i.e. in the filtered element's user space — [repo: src/components/art/PaintDefs.tsx](/home/user/Taleo/src/components/art/PaintDefs.tsx)
- Writer output per page: `text`, `aside`, `picture`, `characters[]`, `action{word,target,sound,motion}`; `NewCharacterSchema.preset` is `z.enum(presetKeys).nullable()` "Reuse a preset character's look if it fits exactly, else null" — [repo: src/server/schemas.ts](/home/user/Taleo/src/server/schemas.ts)
- `Page.svg` holds the finished painting; all stories with paintings are one JSON string in `localStorage` (`taleo.stories.v1`); account drafts are capped at 4,000,000 bytes — [repo: src/lib/types.ts](/home/user/Taleo/src/lib/types.ts), [repo: src/lib/storage.ts](/home/user/Taleo/src/lib/storage.ts), [repo: src/server/drafts.ts](/home/user/Taleo/src/server/drafts.ts)
- The fallback composer already does deterministic generation: keyword-chosen landscapes, a `tuft(x,y)` grass generator, hatching rows, 14 stars and 30 snowflakes from modular arithmetic, and whole reference portraits placed with `translate/scale/rotate/flip` and wrapped in `<g class="target">` — [repo: src/lib/art/compose.ts](/home/user/Taleo/src/lib/art/compose.ts)

### Inferences
- Because of `stageFor`, a scenery plate painted for page 3 is geometrically valid under page 7's characters with no changes. The app has already paid the design cost of making scenery reusable; it just does not reuse it.
- Any new notation is invisible to the client if it is expanded inside `paintPage` (or a wrapper around `brushStrokes`) into whitelisted SVG. Then `Painting.tsx`, `paintingStage.ts`, the sanitizer, storage and the share/gallery paths need no change.

### Gaps
- No real page paintings or generation logs were available, so the true split of tokens between scenery, characters, thinking and texture detail is unmeasured. `genlog` stores each painting's result (`gen.end(..., { result: svg })` in the illustrate route); one query over a week of those would replace every assumption in B0.

---

## Scenery reuse within a book (location plates), and a cross-user scenery library

### Takeaway
Painting each location once per book and reusing it removes roughly 60-65% of scenery tokens (about 30% of all page tokens, about 20% of painting dollars because scenery is already on the cheaper model), and it improves continuity, which the prompts currently try to get by asking the painter to "keep the place the same". A curated cross-user library selected by the writer from an enum (the character-preset pattern) could take scenery spend close to zero on hits; I found no published evidence of any storybook product doing this, so the hit rate is an assumption.

### Cited Findings
- Today every page triggers a fresh scenery painting; continuity is requested only in words via `PREVIOUS PAGE'S PICTURE` and "Keep the place the same as the previous page's picture when the brief is set in the same spot" — [repo: src/server/claude.ts](/home/user/Taleo/src/server/claude.ts), [repo: src/server/prompts.ts](/home/user/Taleo/src/server/prompts.ts)
- The client asks for every page of a new part at once (`CONCURRENCY = 10`, "no picture waits for another to finish") — [repo: src/lib/usePaintings.ts](/home/user/Taleo/src/lib/usePaintings.ts)
- Trade picture-book guidance puts a standard 32-page book at about 12-15 scenes / 12-14 double-page spreads; none of the sources found says how many distinct settings a book has (retrieved 2026-11) — [Debbie Ohi, Picture Books 101](https://debbieohi.substack.com/p/picture-books-101-part-3-understanding); [Reedsy template guide](https://reedsy.com/blog/guide/how-to-self-publish-a-childrens-book/children-book-template/)
- "Retrieve assets, let the LLM arrange them" is the standard pattern in LLM scene synthesis: SceneCraft (ICML 2024) has the LLM list asset descriptions, fetches them with a CLIP retriever, plans a relational graph and solves the layout rather than generating geometry (secondary) — [SceneCraft, arXiv 2403.01248](https://arxiv.org/pdf/2403.01248)
- Imaginarium (ACM TOG 2025) ships a curated library of 2,037 scene assets and 147 scene layouts for the same purpose (secondary, from abstract) — [Crossref record 10.1145/3763353](https://api.crossref.org/works/10.1145%2F3763353)
- LayoutGPT (NeurIPS 2023) shows LLMs can plan layouts as CSS-like numeric boxes from in-context examples, reported as 20-40% better than text-to-image systems on numerical/spatial correctness and near human on layout — [NeurIPS proceedings](https://proceedings.neurips.cc/paper_files/paper/2023/hash/3a7f9e485845dac27423375c934cb4db-Abstract.html)
- AI storybook products talk about consistency through reference images, not asset reuse: e.g. "give the model the same reference picture for every scene", "always use your original anchor image", and Neolemon's "pose library (Action Editor)"; these are vendor/how-to posts, not engineering write-ups (2025-2026) — [learnwithhasan](https://learnwithhasan.com/guide/consistent-ai-characters-visual-stories/); [Neolemon](https://www.neolemon.com/blog/ai-cartoon-generator-for-beginners)
- Semantic-cache studies give a sense of achievable hit rates for "nearly the same request": 61.6-68.8% in a lab evaluation; practitioner reports of 10% (open chat) to 70% (FAQ-like) in production (secondary, 2024-2026) — [GPT Semantic Cache, arXiv 2411.05276](https://arxiv.org/pdf/2411.05276); [tianpan.co, 2026-04](https://tianpan.co/blog/2026/04/10/semantic-caching-llm-production)

### Inferences
**How it would work here (per-book plates)**
- Writer: add `location` (short id, e.g. "pond", "kitchen") and `light` (enum: day / golden / dusk / night / rain / snow) to `PageSchema`; add a per-segment `newLocations[{id, brief}]` beside `newCharacters`, with the brief written as a place description with landmarks and their sides. Files: `src/server/schemas.ts`, `writerPrompt` in `src/server/prompts.ts`, `normalizeSegment` in `src/server/claude.ts`, `Page`/`Story` in `src/lib/types.ts`, `cleanPage` in `src/server/validate.ts`, and the page signature in `src/server/tickets.ts` if the new fields must be covered by it.
- Painting: a new `paintPlate` job (the existing scenery `Brush` with the location brief instead of the page brief) keyed `(location, light)`. `usePaintings` starts it when a segment first mentions an unseen key, stores the result on `story.locations[key]`, and page requests send the plate id instead of asking for scenery. `paintPage` then runs only the character brush. Effort: medium (about 6 files; the hard part is the client scheduling, since pages currently never wait on each other).
- Latency: no worse than today if the plate request is issued as soon as the segment text arrives; each page's character layer still paints concurrently and is laid over the plate when both exist. First page of a part: the plate is exactly the scenery job it already waits for.
- Storage: store the plate once and have pages reference it (`page.scene = {plate, crop}`; `Painting.tsx` composes plate + `page.svg`). For a 14-page book with 5 plates, stored scenery markup falls by about 64%, and total stored SVG by about 30%. The plug-compatible alternative is to copy the plate into every `page.svg` on the server: zero client change, no storage saving.
- Tap target: unaffected when the target is a character. When the target is a scenery object ("puddle", "door"), the prompt already gives it to the character painter ("the tap target ... painted by the other hand"), so the plate must not contain it. The plate brief must exclude any object the writer names as a target on any page in that location; simplest rule: the per-page delta paints it.

**Camera changes**
- A crop is one wrapper: `<g transform="translate(cx·(1-s) 240·(1-s)) scale(s)">plate</g>` zooms about a point on the ground line so the stage's ground stays at y≈240. `transform` on `g` passes the sanitizer.
- Risk specific to this app: the filters are in user space, so a 1.6x zoom also scales the watercolour wobble, edge pooling and ink width by 1.6x and the plate will look coarser than the characters over it. Mitigations: cap zoom at about 1.3-1.4x; or bake the transform into the coordinates on the server (rewrite path data, keep stroke widths) so filters and line weight stay native; or paint plates on a wider virtual canvas (e.g. 600x300) and pan rather than zoom. Low/high camera angles cannot be faked by a transform; treat "close-up" pages as needing either a soft generic backdrop (a few wash shapes, ~10 elements) or a fresh painting.
- Close-ups are an opportunity: a close-up of a face needs almost no scenery. A writer-supplied `camera` enum lets the server substitute a ~300-token wash-only backdrop for the ~4k plate on those pages regardless of reuse.

**Light changes**
- The whitelist has no blend modes or gradients, so a tint is only a translucent rect (e.g. `<rect fill="#5B6283" opacity="0.35">` in a wash group). That reads as dusk but will not produce lamp-lit windows or stars. Safer: make light part of the plate key and repaint for a genuinely different light; use the overlay only for small shifts.

**Savings (assumptions: B0; a 14-15 page book uses 4-5 `(location, light)` keys; plates cost the same as a page's scenery; per-page delta of 0-10 prop elements ≈ 0.3k tokens average)**
- Scenery tokens per 14-page story: 56k -> 5 x 4.0k + 9 x 0.3k ≈ 23k (-59%). 15 pages with 4 keys: 60k -> 16k + 3.3k ≈ 19k (-68%).
- Per story: about -33k tokens (-28% of all painting tokens), about -$0.33 (-18% of painting dollars).
- Sensitivity: with 7 keys in 14 pages the saving halves. Taleo's branching structure (3-5 parts of 3-4 pages, each "show the result of the choice" then "raise things a notch") suggests roughly one main place per part plus returns, i.e. 3-6 keys, but this is my reading of the writer prompt, not data.

**Quality / variety**
- Likeness of place improves (identical landmarks) versus today's best-effort redraws. Variety falls: three consecutive pages on an identical backdrop can feel static; crops, a prop delta and character staging carry the change. Real picture books do reuse a setting across spreads, but usually from varied viewpoints.

**Cross-user library**
- Mechanism that fits this codebase best: a curated catalogue of plates in `src/lib/art/` (like `presetArt.ts`), exposed to the writer as an enum with one-line descriptions, exactly as `presetKeys` is exposed for side characters. The writer picks `plate: "meadow-day" | ... | null`; null falls back to painting a per-book plate. This avoids embeddings, a vector store and false matches; retrieval error becomes the writer's judgement, which it already exercises for presets.
- An embedding/keyword matcher over free-text briefs is the alternative when the catalogue grows past what fits in the writer prompt (each entry costs input tokens on every segment, though the system prompt is cached). `compose.ts`'s keyword matcher (`has(brief, "bedroom", "kitchen", ...)`) is a crude existing version.
- A self-filling variant: publish every freshly painted per-book plate into a shared pool keyed by a normalised location brief, and promote the well-rated ones into the catalogue. `genlog` already stores painted results.
- Savings (assumption: 50% of plates hit the library): scenery falls to ~12-14k tokens per 14-page story (-75% vs today). At 80% hits, ~7-8k. Cost of building: 40-80 plates x 4-5k tokens ≈ under $4 of generation once, plus human curation time, which is the real cost.
- Risks: books by different families look alike (the same meadow); the default art direction is already "a gentle English countryside in late summer", so sameness may be acceptable but should be tested; plates must match `world` (season, palette) or be skipped; a plate with a landmark on the wrong side contradicts the brief.

### Gaps
- No data on how many distinct places Taleo's writer actually uses per story, nor on location distribution across users. Both are measurable from stored stories (`picture` briefs) with a cheap classification pass.
- I found no engineering write-up from any AI storybook, comic or game-asset product describing a reusable background library; the vendor posts found only discuss reference images. Absence of evidence, not evidence that nobody does it.
- No source found on the typical number of distinct settings in published picture books.

---

## Character reuse instead of redrawing: rigs, pose libraries, head reuse

### Takeaway
Characters are the expensive half (about 70% of painting dollars), so this is where the largest saving is, and also the largest quality risk. Ranked by risk-adjusted value for Taleo: (c) reuse the head verbatim and redraw only the body (about -35 to -45% of character tokens, likeness improves); (b) a lazily filled per-character pose cache (about -50 to -60% once warm); (a) full part rigs with pose-only output (about -75 to -90%, but the known "paper doll" stiffness directly contradicts the illustrator prompt's top priority, "character, action and life").

### Cited Findings
- The painter is told to "re-pose and re-express the character completely for this moment", prefers three-quarter views and overlapping forms, and treats likeness as "exact fill colours ... signature features ... proportions ... face style"; the designer's portrait is one neutral pose on a 200x200 canvas of 80-120 elements — [repo: src/server/prompts.ts](/home/user/Taleo/src/server/prompts.ts)
- Each central character's reference SVG is resent as a cached input block on every page — [repo: src/server/claude.ts `paintPage`](/home/user/Taleo/src/server/claude.ts)
- The fallback composer already places whole reference portraits with `translate / scale / rotate / mirror` and a tap-target wrapper; its only "poses" are a lift and tilt for leaping, a tilt for running and sleeping — [repo: src/lib/art/compose.ts `composePainting`](/home/user/Taleo/src/lib/art/compose.ts)
- Preset portraits measured: 12-39 shapes, 1.4-3.5k chars each (16 presets, 432 shapes) — [repo: src/lib/art/presetArt.ts](/home/user/Taleo/src/lib/art/presetArt.ts)
- Cutout animation "requires fewer drawings ... as elements can be reused rather than redrawn", at the price of "more limited movement" — [GarageFarm overview](https://garagefarm.net/blog/cut-out-animation-the-timeless-art-form-shaping-modern-storytelling)
- Godot's cutout documentation notes that pivot placement determines whether limbs look right, and that even cutout productions switch to redrawn (cel) art "for complex parts such as hands, feet, changing facial expressions" — [Godot docs, cutout animation](https://docs.godotengine.org/en/3.5/tutorials/animation/cutout_animation.html)
- Spine's answer to rigid joints is weighted meshes: vertices bound to several bones so a limb bends as one skin instead of two overlapping rigid pieces — [Spine mesh docs](https://esotericsoftware.com/spine-meshes); [Spine blog, mesh weight workflows](https://esotericsoftware.com/blog/Mesh-weight-workflows)
- Meta's Animated Drawings rigs a child's drawing with a simple joint skeleton and deforms a mesh with as-rigid-as-possible (ARAP) reposing, driven by a library of preselected motion clips (2023) — [arXiv 2303.12741](https://arxiv.org/pdf/2303.12741)
- AniClipart (2024) animates clipart by moving keypoints along Bezier paths with ARAP deformation and a skeleton-fidelity loss; its motivation is that generic video models lose the clipart's identity (secondary) — [AniClipart project page](https://aniclipart.github.io)
- Decomate (NeurIPS 2025 workshop) uses a multimodal LLM (Claude Sonnet 4) to restructure a raw SVG into "semantically meaningful, animation-ready components"; evaluated only with a six-person formative study (secondary) — [arXiv 2511.06297](https://arxiv.org/abs/2511.06297v1)
- VAnim (May 2026) describes itself as the first LLM framework for open-domain text-to-SVG animation and represents motion as sparse state updates on a persistent SVG DOM; it edits path geometry for non-rigid deformation "rather than relying only on CSS or SMIL transforms" (secondary) — [arXiv 2605.01517](https://arxiv.org/html/2605.01517)
- An LLM emitting joint hierarchies and motions as structured text for rigged (3D) models was shown in 2023 — [arXiv 2310.17838](https://arxiv.org/pdf/2310.17838)

### Inferences
**(a) Part rigs with pose-only output**
- How: `designCharacter` returns parts instead of one SVG: `{name, parent, pivot:[x,y], z, paint, ink, detail}` for head, torso, upper/lower arms and legs, hands, feet, ears, tail, plus face variants. Ids cannot live in the SVG (the sanitizer strips them), so parts must be JSON fields: extend `CharacterDesignSchema` and `CharacterDef` (`rig?`). The page painter outputs something like `pose hero at 180 240 s0.6 face L; head -8; armR.u 120; armR.l 40; legL.u -20; expr laugh`, about 15 angles ≈ 80-150 tokens versus ~2.7k for a redrawn main character. A new `src/lib/art/rig.ts` does forward kinematics and emits three layer groups (all parts' paint in z-order inside one `<g class="paint">`, then ink, then detail) with per-part `transform="rotate(a px py)"`, wrapped in `<g class="target">` when the character is the target.
- A property of this app that helps: the watercolour filter is applied per layer group, not per shape, so same-coloured overlapping parts inside one paint group are filtered as one silhouette (edge pooling and shading follow the union). Seams between an upper and lower arm largely disappear without mesh skinning, provided the fills are opaque and identical in colour. Parts with translucent glazes (`opacity` 0.3-0.6, which the prompt encourages) would double-darken at overlaps; rig parts need opaque base fills with glazes as separate top shapes.
- Known failure modes and what they mean here:
  - Stiff paper-doll look: rigid rotation cannot produce a line of action, squash/stretch or a twist. Mitigation: 2-3 torso variants (upright, bent, curled), limb parts drawn as tapered tubes with round ends, and allow the painter to replace any part with freshly drawn shapes for that page (the Godot "cel for hard parts" practice).
  - Joint tearing/gaps: pivots wrong by a few units open gaps at extreme angles. Mitigation: round overlapping joint caps, server clamps on angle ranges, automatic validation render at creation (rotate each joint through its range and check coverage).
  - Ink contours: the style contours every shape; part outlines would cross the body at overlaps. Mitigation: parts carry open (broken) contours that stop short of the joint end, which matches the prompt's "varied and often broken" line.
  - No real three-quarter turns or back views: only mirror flips. Mitigation: design front and three-quarter head/torso variants at creation (more design tokens).
  - Interaction (hugging, holding, reaching a specific object): needs inverse kinematics or the model reasoning about angles numerically; LLMs are weak at this spatial arithmetic. Mitigation: let the model specify hand targets (`handR -> 230 180`) and solve two-bone IK on the server.
- Savings (assumption: props, effects, shadows and foreground strokes still drawn, ~15-25 elements ≈ 0.9k tokens per page): character layer 4.5k -> ~1.1k (-75%); per 14-page story -47k tokens, about -$0.95 (-52% of painting dollars) at Opus prices. A pose-only output is also plausibly within reach of a smaller model, which would compound the saving; that is unverified.
- One-time cost: a rigged design is larger than today's portrait (parts plus variants, maybe 150-250 elements ≈ 7-11k tokens ≈ $0.15-0.22 on Opus) and the 16 presets need hand or offline rigging. Existing custom characters have no rig: either keep the redraw path for them or run a one-off Decomate-style "regroup this portrait into parts" pass.
- Effort: high. New schema and designer prompt, rig expander, pose grammar, validator, a second painter prompt, fallbacks; touches `schemas.ts`, `prompts.ts` (`characterDesignerPrompt`, `illustratorPrompt`), `claude.ts` (`designCharacter`, `paintPage`), `types.ts`, `presets.ts`/`presetArt.ts`, `character-jobs.ts`, `validate.ts`.

**(b) Pose library per character (whole-figure poses reused with transforms)**
- How: store named whole-figure paintings per character (`standing`, `sitting`, `running`, `reaching-up`, `sleeping`, `hugging`, `waving`, `carrying`), each a normal layered SVG on the 200x200 canvas. The page painter outputs `<pose who="hero" name="sitting" x= y= scale= flip= />` plus freshly drawn held props and effects; the server expands it exactly as `composePainting` does today.
- Fill it lazily rather than at creation: when a page asks for a pose that is not cached, the painter draws the figure normally inside a marked group, and the server saves that group (normalised back to 200x200) onto the character as that pose. No upfront spend; each later use costs ~20 tokens instead of ~2.7k. Presets can ship with pre-made poses.
- Upfront alternative for comparison: 8 poses x ~100 elements ≈ 36k tokens ≈ $0.72 on Opus per custom character, recovered after ~13 reuses (about one story for a hero who is on nearly every page). Character creation is currently priced at 3 credits ($1.50 at $0.50/credit) per `tiers.ts`.
- Expression is the weak point: a cached pose has a fixed face. Mitigation: combine with (c): the pose stores a faceless body and the head/face is placed separately with an expression choice.
- Savings (assumptions: warm cache hit on 60% of character appearances; hits cost ~0.3k placement + ~0.7k props/effects per page): character layer 4.5k -> 0.4 x 4.5k + 0.6 x 1.0k = 2.4k (-47%); per 14-page story about -29k tokens, -$0.59. The first story with a new character saves less than this; a series with a recurring hero saves more.
- Quality: every cached pose is a real painting by the main painter, so no paper-doll look within a pose; the risk is repetition (the same sitting figure five times) and poses that only roughly fit the brief. Variety control: let the painter request `fresh` when the brief's action is specific.
- Effort: medium. `CharacterDef.poses`, expander in `paintPage`, prompt changes, persistence of poses to the family's saved roster (`src/server/characters.ts`, `character-client.ts`) so later books benefit, plus storage growth per character (8 poses ≈ 40-70 KB).

**(c) Hybrid: head verbatim, body redrawn**
- How: split each reference portrait into `head` (skull, ears, hair, markings, glasses) and `face features` at creation (two extra JSON fields from the designer, or one regrouping pass for existing characters). The painter draws the body from scratch as today and writes a placeholder for the head: position, scale, rotation, flip, and either an expression id (if face variants exist) or 6-10 freshly drawn face elements (brows, eyes, mouth, cheeks). The server splices the stored head shapes into the paint/ink/detail groups.
- Why it fits: the prompt says likeness is colours, signature features, proportions and face style, and most of those live on the head; the body carries the pose, which is exactly what must stay free. It also removes the commonest likeness failures (wrong hair parting, ear shape, glasses).
- Limits: head angle is fixed to the stored view(s) plus mirror and tilt; a head looking up/down or seen from behind needs a redraw (allow `fresh`). The body painter must match the neck join; the prompt's "head overlaps the top of the body" construction makes that tolerant.
- Savings (assumption: the head is 40-45% of a main character's elements; unmeasured): about -1.0 to -1.2k tokens per main character, character layer -35 to -40% with expressions drawn fresh; per 14-page story about -23k tokens, -$0.45 (-25% of painting dollars).
- Effort: low-medium. Designer schema gains `head` and `face`; expander in `paintPage`; `illustratorPrompt` gains one paragraph and one placeholder form. Progressive paint-in is unaffected if expansion happens in-stream (the head appears at once when its placeholder arrives).

**Tap target and stored size for all three**
- The expander must emit the whole character inside the single `<g class="target">` when that character is the target, with no transform on that group (the sanitizer wraps it; the prompt forbids a transform there). Placement transforms go on an inner group, as `composePainting` already does.
- If pages store expanded SVG, stored size is unchanged. If pages store the compact reference and the client expands (`Painting.tsx` + a shared `expand()` in `src/lib/art/`), stored size per page falls roughly in line with the token saving, but published gallery stories and OG images (`sanitizeSvgFlat`) must expand too.

### Gaps
- I found no paper or product that has an LLM design a 2D SVG character as a named-part rig and then drive it with pose-only output for still illustrations. The nearest work animates existing SVGs (Decomate, VAnim, AniClipart) or rigs 3D models. This would be novel engineering with no external benchmark for quality.
- No quantitative evidence on how often cutout rigs look unacceptably stiff in still illustration; the cited sources are qualitative practice notes.
- The share of a Taleo character's elements that belong to the head is unmeasured; a script over the presets needs part labels that do not exist yet.
- No documentation found for Rive or Adobe Character Animator in this session's searches; Spine and Godot stand in for the cutout/skeletal family.

---

## Compact output notations (DSL), server shorthand, and stamps

### Takeaway
A purely syntactic shorthand for the same shapes saves about 24-29% of tokens in my proxy measurement, because path data is already about half of all tokens and no notation shrinks it. The cheap, low-risk parts are worth doing (server-supplied group defaults, palette handles, stamps for repeated motifs); a full unfamiliar DSL carries a documented accuracy risk that could cost more in retries and quality than it saves.

### Cited Findings
- Measured on the 16 preset portraits (proxy tokenizer): SVG 19,507 tokens; one-line-per-shape DSL with single-letter tags, positional geometry, hex without `#`: 14,804 (-24.1%); same with palette indices instead of hex: 13,871 (-28.9%). Path `d` strings alone are 10,247 tokens = 52.5% of the SVG — measured from [repo: src/lib/art/presetArt.ts](/home/user/Taleo/src/lib/art/presetArt.ts); script at /tmp/claude-0/-home-user-Taleo/d7c09cb9-7461-5c84-88c4-fc434fb2f191/scratchpad/tok.mjs
- Measured token splits (proxy tokenizer): integers up to 3 digits are one token each (`120`), a decimal costs three (`120.5` -> `120` `.` `5`), a minus sign is its own token, a hex colour costs 5 tokens (`C|8|A|57|A`) plus `="#`; `<circle cx="200" cy="150" r="12" fill="#C8A57A"/>` = 22 tokens vs `c 200 150 12 C8A57A` = 12 vs `c 200 150 12 4` = 9; the standard ink group opening tag (`<g class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">`) = 38 tokens vs `<g class="ink">` = 6; `M120 46 q5 -5 10 0` and `M120,46q5-5,10,0` are both 12 tokens — same script
- A three-stroke grass tuft as a path is 30 tokens; `<use href="#tuft" x="40" y="270"/>` is 15; `tuft 40 270` is 6 — same script
- Research on SVG-specialised models treats tokenisation as a first-order problem: generic tokenizers handle SVG as plain text and produce long sequences; a 2026 hierarchical tokenisation reports about 2.7x token efficiency (secondary) — [arXiv 2604.05072](https://arxiv.org/pdf/2604.05072)
- OmniSVG (2025) parameterises commands and coordinates as discrete tokens, credits the resulting shorter sequences for its results, and says existing LLM methods struggle with SVGs over 10k tokens while it handles 30k (secondary) — [OmniSVG, arXiv 2504.06263](https://arxiv.org/html/2504.06263v3); [project page](https://omnisvg.github.io)
- LLM4SVG (CVPR 2025) adds learnable semantic tokens for SVG and treats coordinates as number strings (secondary) — [arXiv 2412.11102](https://arxiv.org/abs/2412.11102)
- These gains come from training a model on the new vocabulary; they are not available by prompting a general model.
- Chat2SVG (CVPR 2025) restricts the LLM to basic primitives (rect, ellipse, line, polyline, polygon, short paths) "because LLMs struggle with complex geometry", then repairs detail with optimisation; removing the LLM template step worsened Path FID from 39.07 to 70.13 (secondary) — [arXiv 2411.16602](https://arxiv.org/abs/2411.16602v1)
- SketchAgent (CVPR 2025) shows an off-the-shelf multimodal LLM can draw in a custom string-based stroke language taught only by in-context examples, on a numbered grid; outputs are simple sketches and quality depends on the backbone (secondary) — [CVPR 2025 open access](https://openaccess.thecvf.com/content/CVPR2025/html/Vinker_SketchAgent_Language-Driven_Sequential_Sketch_Generation_CVPR_2025_paper.html)
- Evidence that compact unfamiliar formats cost accuracy: "Notation Matters" (2026) found TOON gave up to 18% token reduction at about a 9-point accuracy cost in tool-calling pipelines, worse over multiple turns, and that the format-model interaction is as large as the format effect; TOON's own benchmark claims the opposite direction (73.9% vs 69.7% for JSON with ~40% fewer tokens) but is vendor-run (secondary) — [arXiv 2605.29676](https://arxiv.org/html/2605.29676); [TOON repo](https://github.com/davesnx/toon)
- For file size (not tokens), moving repeated inline SVG to symbols halved one page's SVG payload (50 kB to 25 kB) — [DEV post](https://dev.to/bmstefanski/can-svg-symbols-affect-web-performance-3gl0)
- Practitioner cost tracking of LLM-drawn SVG (Simon Willison's pelican test) reports output tokens as the driver of per-image cost, e.g. 4,017 output tokens for one cheap model and 9,205 for GPT-5 pro ($1.10) (secondary, 2025) — [simonwillison.net pelican tag](https://simonwillison.net/tags/pelican-riding-a-bicycle/)

### Inferences
- What the measurements rule out: relative path commands and comma/space tricks save nothing on a 400x300 integer canvas, since each coordinate is already one token and a minus sign adds one. The prompt's existing "whole-number coordinates" rule is the single most valuable notation choice and is already in place. Enforcing it matters: one decimal place triples a coordinate's cost.
- What remains, in order of risk:
  1. **Server-supplied group defaults (near-zero risk).** Tell painters to write bare `<g class="ink">` and have the expander/sanitizer add the standard ink attributes. Saves ~32 tokens per ink group; with 6-12 groups a page that is 0.2-0.4k tokens (2-4%). Change: one line in `LAYERS`, a few lines in `sanitizeSvg` (or a pre-pass in `paintPage`). Stored SVG also shrinks if the defaults are applied at render time by CSS on the layer class rather than written into the markup.
  2. **Palette handles (low risk).** The palette is already fixed in `PALETTE` (about 30 colours) and character sheets pin exact hex values. Allowing `fill="g3"` or `fill="ink"` and expanding on the server saves ~4-5 tokens per coloured shape, about 5% overall (the measured gap between the two DSL variants). Models must not confuse handles; named handles (`moss`, `ochre`) are safer than indices and cost 1-2 tokens.
  3. **Stamps (low-medium risk).** A server symbol table of 20-40 motifs in the house style (grass tuft, daisy, leaf, cloud, stone, bird "v", star, eye pair, rosy cheek, ground shadow), invoked as `<use href="#tuft" x= y= [transform] />` and expanded in-stream into whitelisted shapes inside the current layer group. `<use>` is real SVG that models know, so this is not an unfamiliar DSL. Multi-layer motifs (a flower has paint and ink) need either single-layer stamps or the expander to defer the ink part to the next ink group. Saving depends on the share of repeated motifs: at 15-30% of scenery elements (assumption) it is 0.4-1.0k tokens per scenery painting. Also allow painter-defined local symbols (`<g def="leaf">` then `<use href="#leaf">`) and a mirror wrapper (`<g mirror="200">` expanded to `transform="translate(400 0) scale(-1 1)"` plus a duplicate), useful for symmetric faces and curtains.
  4. **Full line DSL (higher risk).** Up to ~24-29% on whatever is still drawn. Streaming expansion is easy (expand each completed line; markup still only grows at the end, so `grow()` and `paintingStage` keep working). The risk is drawing quality: these models learned to draw in SVG, the cited format studies show accuracy losses in unfamiliar notations, and a 400-line positional format gives the model fewer anchors (`cx=`, `fill=`) to keep track of what each number means. An A/B on likeness and anatomy errors is required before adopting it; a middle path is a DSL that keeps SVG's attribute names but drops quotes and closing syntax.
- Files: `src/server/prompts.ts` (`LAYERS`, `PALETTE`), a new `src/lib/art/expand.ts` called from `paintPage`/`brushStrokes` in `src/server/claude.ts` (stream-safe: buffer to the last complete tag or line), and `streamCharacterDesign`'s shape counter (`/<[a-z]/g`) if the designer uses the notation too.
- Token savings and stored size are separate questions: after server expansion the stored SVG is as large as before. Storage only shrinks if the client stores the compact form and expands at render.

### Gaps
- No published measurement found of Claude-tokenizer counts for SVG versus a compact drawing DSL, and no benchmark comparing drawing quality of a frontier model in SVG versus a custom DSL for the same scene. The TOON-type studies are about data serialisation, not drawing.
- The real share of repeated motifs in Taleo scenery is unmeasured (needs stored paintings).
- Whether Claude's tokenizer also makes 3-digit integers single tokens is unverified; the conclusion that relative coordinates do not help depends on it.

---

## Procedural detail (texture directives instead of drawn marks)

### Takeaway
Texture marks are well suited to deterministic generation: the repo already generates grass tufts, hatching, stars and snow in code for the fallback painter. A one-line directive with a region and seed replaces 0.2-0.5k tokens of drawn marks each; I estimate 10-20% of scenery tokens, with the main risk being a mechanical, repeated look if the generators are few.

### Cited Findings
- The prompts ask for exactly the kinds of marks that are procedural: "grass tufts, leaf veins, bark lines and knots, stones with crack lines, wood grain, roof tiles, ripples on water, soft scalloped cloud edges, a few birds as tiny 'v' strokes; groups of 3-7 short hatching strokes" — [repo: src/server/prompts.ts `sceneryPrompt`](/home/user/Taleo/src/server/prompts.ts)
- Existing generators: `tuft(x, y)`, two hatching rows via `Array.from`, 14 stars and 30 snowflakes from modular arithmetic — [repo: src/lib/art/compose.ts `landscape`](/home/user/Taleo/src/lib/art/compose.ts)
- In the hand-built `HOME_SCENE` (151 shapes, 6.8k proxy tokens), ink groups are 32% of tokens and wash groups 13% — measured from [repo: src/lib/art/homeScene.ts](/home/user/Taleo/src/lib/art/homeScene.ts)
- Rough.js is established prior art for seeded, hand-drawn-looking fills: fill styles hachure, cross-hatch, zigzag, dots, dashed; `roughness`; a `seed` option "for reproducible drawings" — [Rough.js options (JSR)](https://jsr.io/@rough/roughjs/doc/~/Options)
- p5.brush provides watercolour fills, hatching (`brush.hatch(distance, angle)`) and vector fields for natural-media strokes in generative art — [p5.brush site](https://p5-brush.cargo.site/)

### Inferences
- How: directives such as `<tufts box="20 250 380 290" n="12" seed="3"/>`, `<hatch under="60 180 40" n="5"/>`, `<scatter kind="leaf" box=... n="8" seed=.../>`, `<stars n="14" seed="2"/>`, `<ripples at="230 262" w="78"/>`, about 15-25 tokens each, expanded on the server into one `path` (multi-subpath) or a handful of shapes inside the current layer group. A 12-tuft path drawn by hand is about 12 x 22 ≈ 260 tokens.
- The server knows the stage rectangle (`stageFor`), so generators can refuse to place ink inside the character space, which enforces a rule the scenery painter currently has to remember.
- Share estimate (assumptions: ink is ~30% of scenery tokens as in `HOME_SCENE`; half of that is repeatable texture rather than contours; scatter items in paint add a few points): 10-20% of scenery tokens ≈ 0.4-0.8k per scenery painting, ≈ 6-11k tokens (≈ $0.06-0.11) per 14-page story without plate reuse, and proportionally less once plates are reused.
- For characters the prompt already bans hatching and limits fur ticks to "a few", so procedural detail has little to remove there. Motion ticks and dashed trails are few elements.
- Quality: uniform generators look stamped. Mitigations: seeded jitter in length, angle and spacing; 3-4 variants per motif; let the `tl-ink` displacement filter do the rest (it already wobbles lines). Client-side expansion would allow per-view variation but must stay deterministic per page, otherwise a picture changes between openings.
- Progressive paint-in: an expanded directive arrives as one burst. Emit generated marks as several elements so they fade in over a few chunks if that matters.
- Effort: low-medium. `src/lib/art/` gains a `procedural.ts` (lift `tuft` and the hatching code from `compose.ts`), the expander from the notation section calls it, and `sceneryPrompt` lists the directives. Stamps and procedural directives share one mechanism and should be built together.

### Gaps
- No measurement of how many of a real Taleo page's elements are texture marks; `HOME_SCENE` is hand-built and may not match what the painters produce.
- I found no published example of an LLM illustration pipeline that delegates texture to procedural generators via directives; the prior art cited is general generative-art tooling.

---

## Reuse across readers and time: caching and avoiding repaints

### Takeaway
I found no code path that repaints a finished picture on reopen: paintings are saved on the story, published stories carry their SVG, and a reader leaving aborts the model call. The avoidable spend is in failure handling: when one layer fails or the main painter is slow, both layers are thrown away and the whole page is painted again.

### Cited Findings
- `usePaintings` paints only pages with no `svg`; it marks requests for pages that were unpainted when the story was opened with `x-taleo-reopened`, and the route logs that as "story reopened" so it can be audited — [repo: src/lib/usePaintings.ts](/home/user/Taleo/src/lib/usePaintings.ts), [repo: app/api/illustrate/route.ts](/home/user/Taleo/app/api/illustrate/route.ts)
- Leaving the story aborts in-flight paintings and the server stops the model at once ("finishing it would only spend tokens on a result that's thrown away") — same files
- The account draft keeps paintings; only the `?light=1` variant used for the "pick up where you left off" card strips them — [repo: app/api/draft/route.ts](/home/user/Taleo/app/api/draft/route.ts)
- Publishing writes the whole story including each page's `svg` to the gallery store — [repo: src/server/gallery.ts](/home/user/Taleo/src/server/gallery.ts)
- `inLayers`: "If either fails the other is stopped and the failure is the picture's" — a failure in one layer discards the other layer's completed or partial work — [repo: src/server/claude.ts](/home/user/Taleo/src/server/claude.ts)
- The main painter has a 60 s first-stroke limit; on `SlowPainter` the page is "asked for again at once" as a quick page, and a retry is a full `paintPage`, i.e. scenery and characters again — [repo: src/server/claude.ts](/home/user/Taleo/src/server/claude.ts), [repo: app/api/illustrate/route.ts](/home/user/Taleo/app/api/illustrate/route.ts)
- A 90 s client stall watchdog abandons a painting and starts a second go after 4 s — [repo: src/lib/usePaintings.ts](/home/user/Taleo/src/lib/usePaintings.ts)
- The route counts `paintings_slow` and `paintings_failed`, and `genlog` stores each attempt's result — [repo: app/api/illustrate/route.ts](/home/user/Taleo/app/api/illustrate/route.ts), [repo: src/server/genlog.ts](/home/user/Taleo/src/server/genlog.ts)
- Prompt caching is already used for the system prompt and up to three central character sheets (input side only) — [repo: src/server/claude.ts `paintPage`](/home/user/Taleo/src/server/claude.ts)

### Inferences
- **Keep the surviving layer on retry.** When the scenery finished (it is the faster, thinking-free job) and the character painter failed or timed out, a retry should send the saved scenery and paint only characters. With plates this comes for free, since the plate is stored before any page needs it. Without plates: have the route hold the finished scenery under a short-lived key and accept `sceneryKey` on the retry. Saving = (retry rate) x ~4k Sonnet tokens per retried page; the rate is in the `paintings_slow`/`paintings_failed` counters, which I could not read.
- **Abandonment.** All pages of a part are requested immediately; a reader who stops after page 1 has pages 2-4 in flight, aborted on leave, so the loss is bounded to tokens already generated. Painting only the current page plus one or two ahead would cut that loss but would make later pages wait; the code's design choice ("no picture waits for another") favours speed. Worth revisiting only if logs show many "left" outcomes.
- **Exact-request caching across readers** has almost no hits for user-written stories: each page's text and brief are unique and characters differ. It applies in three places: library/published stories (already stored painted), the demo/first-run stories (pre-paint them), and any future "same story template for many families" feature, where the scenery layer is identical across readers and only the character layer differs. That last case is the cross-user plate library again.
- **Near-identical caching** (embedding match on briefs) is only safe for scenery, where a close match is acceptable; for characters a near match is a wrong picture.
- **Loss of finished work on the client.** Paintings live in client state and `localStorage` until saved; a write that fails (quota) returns false in `writeAll`. If the quota is hit, a finished painting may not persist and would be repainted next time. Smaller stored SVG (plates stored once) reduces that risk; I did not trace how a failed write is handled upstream.

### Gaps
- Retry, slow-painter and "story reopened" rates are in production metrics I could not access, so the saving from layer-preserving retries is not quantified.
- I did not trace every caller of `saveStory*` to confirm that a quota failure cannot lead to a silent repaint.

---

## Tiered detail (fewer elements where they are not needed; cheap first pass)

### Takeaway
Tokens scale almost linearly with element count (about 45 per element), so element budgets are the simplest dial there is. Fixed tiers by page role or camera are low risk; "cheap draft, upgrade if kept" only pays if fewer than half of pages are upgraded.

### Cited Findings
- Budgets are plain prompt text ("Usually 60-120 elements", "usually 50-150 elements", "40-60 elements for a main character, 15-25 for a small, distant or background one") — [repo: src/server/prompts.ts](/home/user/Taleo/src/server/prompts.ts)
- The route already distinguishes page roles: `pageInPart`, `quick`, `retry`, and plan-based `quickPages` — [repo: app/api/illustrate/route.ts](/home/user/Taleo/app/api/illustrate/route.ts)
- The illustrator prompt says "Likeness is colours, features and proportions - NOT the portrait's finish" and "When in doubt, leave the mark out", i.e. the art direction already accepts sparse characters — [repo: src/server/prompts.ts](/home/user/Taleo/src/server/prompts.ts)

### Inferences
- **Budget by camera.** A close-up needs a soft backdrop (~10 elements instead of ~90); a wide shot needs small characters (15-25 elements each instead of 40-60). A writer-supplied `camera` enum lets the server set both painters' budgets per page. If a third of pages are close-ups (assumption), scenery tokens fall about 30% on its own, more modestly on top of plates.
- **Budget by plan or role.** Free-tier or "quick" pages could run at the low end of each range (60 scenery / 50 character elements ≈ 5k tokens instead of 8.5k, about -40%). The quality cost is plainer pictures; the Haiku comment in claude.ts ("plainer and less finished") shows the team has already judged that look unacceptable for scenery at least once, so this needs a visual check.
- **Draft then upgrade.** A draft at 50% of the budget plus a full repaint for a fraction f of pages costs 0.5 + f of today's spend, so it saves only when f < 0.5, and the reader sees the picture change. A better form of the same idea is additive: paint the sparse version first and, on keep/share/print, ask for a "detail pass" that only appends ink and detail groups over the existing markup. Appending fits the `scenery + characters` concatenation model and the grow-only paint-in, and costs draft + delta rather than draft + full.
- **Print/share upgrade** aligns cost with value: printed or published books are the ones where finish matters.
- Files: `sceneryPrompt`/`LAYERED_CHARACTERS` become functions of a tier; `IllustrateRequest` gains `tier`/`camera`; `parseIllustrateRequest`; route logic beside `quickPages`; `limitsFor` in `src/lib/tiers.ts` if tied to plans.

### Gaps
- No data on how long readers look at each page, how many stories are reopened, shared or printed, or what fraction of pages are close-ups; all are needed to size this.
- No external evidence found on reader-perceived quality versus element count for this style.

---

## How the top techniques compose, and combined savings

### Takeaway
The techniques stack because they act on different parts of the output: plates and the library remove scenery paintings, head/pose reuse removes character shapes, stamps/procedural/notation shrink whatever is still drawn. A low-risk stack (plates, stamps and procedural, group defaults) saves about 30% of tokens but only about 20% of dollars; adding head reuse reaches about 45%/43%; adding a warm pose cache and a scenery library reaches about 60%/55%. A full rig could approach 75-85% but changes the look.

### Cited Findings
- Cost weights used: Sonnet 5.5 $10/M and Opus 5.5 $20/M output; Haiku 5.5 $0.50/M — [repo: src/server/metrics.ts `PRICES`](/home/user/Taleo/src/server/metrics.ts)
- Sonnet 5.5 was judged acceptable for characters on quick pages ("about half the cost, with somewhat less careful characters"); Haiku 5.5 was rejected for scenery — [repo: src/server/claude.ts](/home/user/Taleo/src/server/claude.ts)
- Chat2SVG's design (LLM restricted to simple primitives, detail added elsewhere) and LayoutGPT's result (LLMs near human at numeric layout planning) support splitting "decide what goes where" from "draw the shapes" (secondary) — [Chat2SVG](https://arxiv.org/abs/2411.16602v1); [LayoutGPT](https://proceedings.neurips.cc/paper_files/paper/2023/hash/3a7f9e485845dac27423375c934cb4db-Abstract.html)

### Inferences
**Combined estimates for a 14-page story (baseline B0: 119k tokens, $1.82; all figures are my arithmetic on the stated assumptions, not measurements)**

| Stack | Scenery tokens | Character tokens | Total tokens | Painting cost | Main assumptions |
|---|---|---|---|---|---|
| Today | 56k | 63k | 119k | $1.82 | B0 |
| 1. Per-book plates + stamps/procedural + group defaults | ~22k | 63k | ~85k (-29%) | ~$1.48 (-19%) | 5 plates, each 20% larger as a reusable plate, then -20% from stamps/procedural; 0.3k delta on 9 pages |
| 2. Stack 1 + head reuse | ~22k | ~41k | ~63k (-47%) | ~$1.04 (-43%) | head = 40-45% of character elements; faces drawn fresh |
| 3. Stack 2 + lazy pose cache + scenery library | ~14k | ~34k | ~48k (-60%) | ~$0.81 (-55%) | 60% of character appearances hit a cached pose; 50% of plates come from the library |
| 4. Full rigs + library (pose-only output) | ~14k | ~14k | ~28k (-76%) | ~$0.42 (-77%) | every character rigged; ~1.0k per page for poses, props and effects |

- A compact line DSL would take a further ~24% off whatever is still drawn in any row, if drawing quality holds; it matters less as reuse grows (in stack 3 it is worth about 10k tokens).
- **Interaction with cheaper models.** As the character painter's job shrinks from "draw 100 shapes with correct anatomy" to "place a head, draw a body" (stack 2) or "choose poses, place figures, draw a prop" (stacks 3-4), the argument for Opus weakens. Moving stack 3's character layer to Sonnet would give about $0.14 + $0.34 = $0.48 (-74%); stack 4 on Sonnet about $0.28 (-85%). Whether smaller models place and pose reliably is a test for the model-choice researchers; LayoutGPT-type results suggest layout-level outputs are within reach of general models.
- **Thinking tokens.** Opus always thinks before painting and that is billed as output; shorter visible outputs do not shrink it. Any stack that lets the character layer run on a thinking-off model removes that hidden cost entirely, so real dollar savings from a model move are larger than the visible-token table shows.
- **Shared plumbing.** Stamps, procedural directives, palette handles, head placeholders, pose placeholders and rig poses are all "a short tag in the stream that the server expands". One stream-safe expander in `paintPage` (buffer to the last complete tag, expand known shorthand, pass everything else through) serves all of them, and the sanitizer remains the last line of defence. Build that first.
- **Suggested order by value per effort:** (1) expander + group defaults + stamps/procedural, with retries that keep the finished layer; (2) location/light/camera fields from the writer and per-book plates; (3) head reuse; (4) lazy pose cache stored on the family's saved characters; (5) curated plate library once location statistics exist; (6) rigs only if (3)-(4) show that readers accept reused figures.
- **What each stack does to the three plug-compatibility points:**
  - Tap target: plates must exclude scenery-object targets; pose/rig/head expanders must emit inside the single target group with no transform on it.
  - Progressive paint-in: unchanged as long as expansion is in-stream and append-only; reused plates appear instantly, which shortens the wait for the first stroke but removes the "washing in the sky" phase on reused pages (the caption logic in `paintingStage.ts` still works on the expanded markup).
  - Stored size: unchanged if pages store expanded SVG; falls 30-60% if plates, heads and poses are stored once per story/character and referenced, at the cost of client-side composition in `Painting.tsx` and in every other consumer of `page.svg` (cover extraction in `gallery.ts`/`story-utils.ts`, OG images via `sanitizeSvgFlat`, save-image).

### Gaps
- Every row of the table rests on B0 and on unmeasured shares (locations per story, head share, pose hit rate, library hit rate). A one-off analysis of stored paintings and briefs would turn these into measurements; until then the ordering of the stacks is more reliable than the percentages.
- Thinking-token volume for the Opus character painter is unknown and could change the dollar baseline materially.
- No external benchmark exists for the visual acceptability of reused plates, heads or poses in a watercolour picture-book style; each needs a side-by-side review on real Taleo pages.
