# Current cost model of the SVG page-painting pipeline, and every Claude-side cost lever

Scope: Taleo repo at commit `36c6476` (2026-11-12) plus the bundled claude-api skill reference files and three live Anthropic doc pages. No API key was available, so **no token count in these notes is measured from the API**. Every number carries one of three labels:

- **[code]** read or computed directly from the repository (character counts, element counts, constants, control flow).
- **[docs]** stated in Anthropic documentation (skill reference files or platform.claude.com pages fetched 2026-11-12).
- **[est]** my estimate; the assumption is stated next to it.

Source shorthand used in links:
- `claude.ts` = /home/user/Taleo/src/server/claude.ts
- `prompts.ts` = /home/user/Taleo/src/server/prompts.ts
- `route.ts` = /home/user/Taleo/app/api/illustrate/route.ts
- `usePaintings.ts` = /home/user/Taleo/src/lib/usePaintings.ts
- `metrics.ts` = /home/user/Taleo/src/server/metrics.ts
- `presetArt.ts` = /home/user/Taleo/src/lib/art/presetArt.ts
- `ages.ts` = /home/user/Taleo/src/lib/ages.ts, `tiers.ts` = /home/user/Taleo/src/lib/tiers.ts
- skill docs = /tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/{prompt-caching,cost-optimization,model-migration,models}.md
- Pricing = https://platform.claude.com/docs/en/about-claude/pricing.md ; Batch = https://platform.claude.com/docs/en/build-with-claude/batch-processing.md ; Effort = https://platform.claude.com/docs/en/build-with-claude/effort.md

Token-conversion assumptions used everywhere **[est]**:
- English prompt prose: **3.2 chars/token** (the current tokenizer generation counts the same text as ~30% more tokens than the older ~4 chars/token rule; models.md says this for Haiku 5.5 and model-migration.md for Sonnet 5). Plausible range 2.8-3.8.
- SVG markup (path data, digits, hex colours, quotes): **2.7 chars/token**, range 2.5-3.0. SVG tokenises poorly because digits and punctuation split into many small tokens.
- One SVG element costs **~30 output tokens** (82 chars per element measured in the preset art, divided by 2.7). Range 26-33.

---

## 0. Verified pipeline facts (background check)

### Takeaway
The background in the brief is correct in every material point, with three refinements: (a) Opus paints the characters on only 33-44% of pages today because the first two pages of every part already go to Sonnet; (b) real stories are 9, 14 or 18 pages, in parts of 3-4 pages; (c) the three painters form three separate cache lineages, and the Opus lineage usually has only one or two requests per part.

### Cited Findings
- [code] Each page is painted by `paintPage`; a page with any cast or an action is layered (default `TALEO_LAYERED_PAINT=all`), running a scenery brush and a character brush concurrently through `inLayers`. — [claude.ts L601-721](/home/user/Taleo/src/server/claude.ts)
- [code] Scenery brush: `claude-sonnet-5-5`, effort `low`, thinking off via `{type:"between_tools"}`, system = `sceneryPrompt()`, user content is one uncached text block (world, previous brief, page text, picture brief, stage, hand-off line). — [claude.ts L64-73, L681-703](/home/user/Taleo/src/server/claude.ts)
- [code] Character brush: `claude-opus-5-5` at effort `low` (`LAYER_CHARACTERS_EFFORT`), thinking cannot be turned off (`thinkingOff` returns null for Opus); on quick pages `claude-sonnet-5-5` at effort `medium`, thinking off. System = `illustratorPrompt()`; user content = world block, then up to 3 central character sheets each with its own `cache_control`, then an uncached "rest" block that includes `LAYERED_CHARACTERS`. — [claude.ts L27-46, L79, L632-669](/home/user/Taleo/src/server/claude.ts)
- [code] Quick = `retry === true` OR `pageInPart < quickPages`; `quickPages` is 2 on Basic, Plus and Pro (1 on admin). — [route.ts L80-84](/home/user/Taleo/app/api/illustrate/route.ts), [tiers.ts L100-147](/home/user/Taleo/src/lib/tiers.ts)
- [code] Story sizes: Quest 9 pages (3,3,3), Adventure 14 (3,4,4,3), Odyssey 18 (3,4,4,4,3). So Opus paints characters on 3 of 9, 6 of 14 and 8 of 18 pages; Sonnet on the rest. — [ages.ts L209-219](/home/user/Taleo/src/lib/ages.ts)
- [code] The developers' own figure, committed today: "about 14 US cents a painted page (and a little for the writing)". — [ages.ts L213-217](/home/user/Taleo/src/lib/ages.ts)
- [code] Every paint call uses `max_tokens: 32000`, streams, and (except Haiku) sends the `server-side-fallback-2026-07-01` beta. — [claude.ts L482-492](/home/user/Taleo/src/server/claude.ts)
- [code] The client asks for every unpainted page as soon as it exists, up to `CONCURRENCY = 10` in flight; pages arrive from the writer's stream as `pages` events (handled in StoryReader.tsx L339), so in normal reading the requests of one part are staggered by the writer's pace, while a reopened story fires up to 10 at the same instant. — [usePaintings.ts L7-12, L166-192](/home/user/Taleo/src/lib/usePaintings.ts)
- [code] Prices assumed by the app: Opus 5.5 $4/$20, cache read $0.20; Sonnet 5 $2/$10, cache read **$0.20**; Haiku 5 $0.10/$0.50, cache read $0.01; cache writes at 1.25x input. — [metrics.ts L54-83](/home/user/Taleo/src/server/metrics.ts)
- [docs] Current list prices per MTok: Opus 5.5 $4 in / $5 5m-write / $8 1h-write / $0.20 read / $20 out; Sonnet 5.5 $2 / $2.50 / $4 / **$0.10** / $10; Haiku 5.5 (prompt <=100K tokens) $0.10 / $0.125 / $0.20 / $0.01 / $0.50, and 5x those above 100K prompt tokens. Cache reads are 0.05x on Opus 5.5 and Sonnet 5.5. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing.md)

### Inferences
- `metrics.ts` prices Sonnet 5.5 cache reads at $0.20 where the price list says $0.10, so the admin dashboard overstates Sonnet cache-read spend 2x (a tiny dollar amount). It also has no 1-hour write rate and no Haiku >100K tier; both would need adding before those levers are adopted, or the dashboard will mis-state them.
- The three painters never share a cache: scenery (Sonnet + scenery prompt), quick characters (Sonnet + illustrator prompt + sheets), main characters (Opus + illustrator prompt + sheets). Caches are per model and per prefix ([prompt-caching.md "Invalidation hierarchy"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md)).

### Gaps
- I did not read StoryReader.tsx in full; that painting starts per streamed page (rather than once per finished part) is inferred from the `pages` event handler and the `usePaintings` effect, not traced end to end.

---

## 1. Token sizes and the cost model of one page and one story

### Takeaway
A layered page costs roughly **6 cents when Sonnet paints the characters and 11 cents when Opus does** with warm caches (central estimate), rising to about 8 and 15 cents when every cached prefix is a cold write; a whole story is about **$0.86 (Quest), $1.37 (Adventure), $1.77 (Odyssey)** on the central estimate, i.e. ~10 cents a page, against the developers' own "about 14 cents". Output tokens are 75-90% of the bill; cold cache writes are the second-largest item (up to 17-27%), and plain uncached input is under 10%.

### Cited Findings
Prompt and request sizes:
- [code] `illustratorPrompt()` is 14,171 chars (2,380 words); `sceneryPrompt()` is 5,545 chars (913 words); `LAYERED_CHARACTERS` is 872 chars; `characterDesignerPrompt()` 9,676 chars; `writerPrompt()` 19,626 chars. Measured by importing the functions with tsx. — [prompts.ts](/home/user/Taleo/src/server/prompts.ts)
- [est] At 3.2 chars/token: illustrator system ~**4,400 tokens** (range 3,700-5,100); scenery system ~**1,730 tokens** (1,450-2,000); `LAYERED_CHARACTERS` ~270; the stage block (~900 chars, [claude.ts L611-618](/home/user/Taleo/src/server/claude.ts)) ~280.
- [code] The 16 preset reference paintings, after `referenceArt` rounding, are 1,762-4,301 chars (median ~3,300) and hold **17-51 drawable elements** (median ~41), averaging **82 chars per element** including group tags (range 74-107). — [presetArt.ts](/home/user/Taleo/src/lib/art/presetArt.ts), rounding in [claude.ts L426-430](/home/user/Taleo/src/server/claude.ts)
- [code] Custom designed characters are asked for "about 80-120 elements" on a 200x200 canvas; the model sheet (`look`) is capped at 600 chars. — [prompts.ts L283](/home/user/Taleo/src/server/prompts.ts), [claude.ts L876](/home/user/Taleo/src/server/claude.ts)
- [est] One cached character block: preset ~**1,360 tokens** (3,300 chars / 2.7 + ~140 for name and model sheet), range 800-1,750; custom ~**3,200 tokens** (100 elements x 82 chars / 2.7 + ~190), range 2,600-3,900. Note the brief's "80-120 elements each" applies to custom characters only; the presets in the repo are about half that.
- [code] Per-page uncached text is bounded: `picture` <= 1,200 chars, `previous` <= 1,200 chars, page text, target line, stage, `LAYERED_CHARACTERS`. — [claude.ts L381, L641-652](/home/user/Taleo/src/server/claude.ts), [validate.ts L100](/home/user/Taleo/src/server/validate.ts)
- [est] Uncached tail: ~**1,400 tokens** for the character painter, ~**1,200** for the scenery painter (assumes a 900-char picture brief, a full 1,200-char previous brief, 250 chars of page text).

Output sizes:
- [code] Scenery is asked for "usually 60-120 elements"; layered characters "usually 50-150 elements in all ... a single character rarely needs more than 65"; 40-60 per main character. — [prompts.ts L135, L205, L215](/home/user/Taleo/src/server/prompts.ts)
- [est] At 30 tokens/element: scenery 1,800-3,600 output tokens (**central 2,700** at 90 elements); characters 1,500-4,500 (**central 2,700** at 90 elements, i.e. about two characters).
- [docs] Thinking on Opus 5.5 is always on, billed as output, counts toward `max_tokens`, and is returned empty by default. — [model-migration.md "Migrating to Claude Opus 5.5", Breaking change 1](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/model-migration.md)
- [est] Opus hidden thinking per character layer at effort low: **central 1,000 tokens**, range 300-3,000 (see section 3 for why the range is wide).

Cost of one page, central estimate (2 preset central characters on the page), computed with the [docs] prices:

| Item | Scenery (Sonnet low) | Characters, quick (Sonnet medium) | Characters, main (Opus low) |
|---|---|---|---|
| Cached prefix tokens [est] | 1,730 | 7,220 (4,400 system + 100 world + 2 x 1,360) | 7,220 |
| ... if read (0.05x) | $0.0002 | $0.0007 | $0.0014 |
| ... if written (1.25x) | $0.0043 | $0.0181 | $0.0361 |
| Uncached input | $0.0024 | $0.0028 | $0.0056 |
| Visible output (2,700 tok) | $0.0270 | $0.0270 | $0.0540 |
| Hidden thinking (1,000 tok) | none | none | $0.0200 |
| **Layer total, warm / cold** | **$0.030 / $0.034** | **$0.031 / $0.048** | **$0.081 / $0.116** |

- [est] Whole page: **quick page $0.060 warm, $0.082 cold; Opus page $0.111 warm, $0.149 cold**.
- [est] Sensitivity: low case (60 + 55 elements, 26 tok/element, 300 thinking) gives $0.036 / $0.060 warm; high case (120 + 150 elements, 33 tok/element, 3,000 thinking) gives $0.095 / $0.208 warm.

Cost of one story (central estimate; "part-cold" = the first request of each lineage in each part pays a write, later ones in the part read, which is what happens when a reader takes more than 5 minutes per part or traffic is thin):

| Story | Pages (quick + Opus) | All warm | Part-cold | All cold | Part-cold per page |
|---|---|---|---|---|---|
| Quest | 9 (6 + 3) | $0.69 | **$0.86** | $0.94 | $0.096 |
| Adventure | 14 (8 + 6) | $1.14 | **$1.37** | $1.55 | $0.098 |
| Odyssey | 18 (10 + 8) | $1.49 | **$1.77** | $2.01 | $0.098 |

- [est] Low/high sensitivity, part-cold: Quest $0.56-$1.36, Adventure $0.87-$2.24, Odyssey $1.12-$2.90 (6.2 to 16 cents a page). With custom rather than preset central characters: Adventure $1.48 (+8%).

Where the money goes (Adventure, central):

| Split | All warm | Part-cold | All cold |
|---|---|---|---|
| Visible output | 80% | 67% | 59% |
| Hidden Opus thinking | 10% | 9% | 8% |
| Cache writes | 0% | 17% | 27% |
| Cache reads | 1% | 1% | 0% |
| Uncached input | 8% | 7% | 6% |
| Scenery painter (Sonnet) | 36% | 31% | 30% |
| Character painter on Sonnet (8 pages) | 21% | 23% | 25% |
| Character painter on Opus (6 pages) | 42% | 46% | 45% |

### Inferences
- The developers' 14 cents a page sits between my central (10 cents) and high (16 cents) cases. The likeliest reasons the real figure is above my central case: paintings near the top of the element ranges, Opus thinking above 1,000 tokens, Sonnet at effort `medium` writing more than at `low`, cold writes, and repaints. The app already logs `in/out/cacheRead/cacheWrite/usdMicro` per call ([metrics.ts L186-211](/home/user/Taleo/src/server/metrics.ts)), so the production activity log can replace every estimate here.
- Opus paints characters on 43% of Adventure pages but takes ~46% of painting spend; scenery, although on the cheaper model, is nearly a third because it runs on every page.
- Input-side tuning (shorter prompts, the 1,200-char briefs) can move the total only a few percent; the output side and the cache-write line are where the money is.

### Gaps
- No real `usage` data in the repository (the `reports/` folder is empty; `docs/roadmap.md` lists cost visibility as a to-do). All token counts are estimates from character counts.
- Thinking tokens cannot be separated from visible output in `usage.output_tokens`; the only way to size them from logs is `output_tokens` minus (characters of streamed SVG / ~2.7).
- I assumed two central characters per page and the same element count for Sonnet-medium and Opus-low characters; neither is verified.

---

## 2. Prompt caching correctness

### Takeaway
Every cached prefix is long enough to cache (minimum is 512 tokens on all three 5.5 models; the scenery prompt is ~1,730), but the design leaks money in one specific place: **the Opus character lineage has only one or two requests per part, so its ~7,200-token prefix is written at 1.25x on almost every use and rarely read back** unless the next part starts within five minutes. Cold writes are ~17% of an Adventure's painting cost in the part-cold case; a keep-alive or 1-hour TTL recovers roughly 9-12% of the story cost, and nothing here costs quality.

### Cited Findings
- [docs] Minimum cacheable prefix: **512 tokens for Opus 5.5, Sonnet 5.5 and Haiku 5.5** (the file says to check the live caching page before relying on the value); shorter prefixes silently do not cache. — [prompt-caching.md "API reference"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md)
- [docs] Cache writes cost 1.25x (5-minute) or 2x (1-hour); reads 0.05x on Opus 5.5 and Sonnet 5.5, 0.1x on Haiku 5.5. A read refreshes the timer at no extra cost; lifetime is measured from the **start** of the request. — [prompt-caching.md "Economics", "Choosing the TTL"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md); [Pricing](https://platform.claude.com/docs/en/about-claude/pricing.md)
- [docs] "A cache entry becomes readable only after the first response begins streaming. N parallel requests with identical prefixes all pay full price - none can read what the others are still writing." Fix: send one, await its first streamed token, then fire the rest. — [prompt-caching.md "Concurrent-request timing"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md)
- [docs] Pre-warming: a `max_tokens: 0` request writes the cache and returns at once with zero output tokens billed; it must carry the same thinking and effort settings as real traffic; it is rejected with `stream: true`, `output_config.format`, or inside a batch. — [prompt-caching.md "Pre-warming the cache"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md)
- [docs] TTL choice: under 5 minutes start-to-start use the 5-minute TTL; 5-60 minutes is "the only window where the 2x write pays off"; a `max_tokens: 0` keep-alive just before expiry bills only a cheap read and can beat the 1-hour TTL. Longer TTL entries must precede shorter ones in the prompt. — [prompt-caching.md "Choosing the TTL", "Automatic vs explicit breakpoints"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md)
- [docs] Caches are model-scoped; changing `thinking` or top-level `effort` invalidates at least the messages cache; caches are isolated per workspace. Max 4 breakpoints per request. — [prompt-caching.md "Invalidation hierarchy", "API reference"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md)
- [code] Breakpoints in use: one on the system prompt, plus one per central character present on the page (max 3), so the 4-breakpoint limit is exactly reached. The scenery request has only the system breakpoint. — [claude.ts L487, L654-658](/home/user/Taleo/src/server/claude.ts)
- [code] Only characters that appear on the page are sent (`castFor` maps `page.characters`), in fixed order hero, companion1, companion2. — [story-utils.ts L6-9](/home/user/Taleo/src/lib/story-utils.ts), [claude.ts L632](/home/user/Taleo/src/server/claude.ts)

### Inferences
- **Is the scenery prompt long enough to cache?** Yes: ~1,730 tokens against a 512 minimum, on Sonnet 5.5 and on Haiku 5.5. It would not have cached on Haiku 4.5 (4,096 minimum), which matters only if someone pins an old model.
- **How many of 10 simultaneous requests pay the write?** For truly simultaneous requests, all of them: 10 scenery requests each write the 1,730-token scenery prefix, and every character request writes its full ~7,200-token prefix. Worst-case extra cost for a 10-page simultaneous burst (4 Opus, 6 Sonnet character pages) versus one write plus reads per lineage is about $0.04 scenery + $0.09 Sonnet characters + $0.10 Opus characters = **~$0.23, or ~2.3 cents per page**. This burst happens on story reopen ([usePaintings.ts L166-192](/home/user/Taleo/src/lib/usePaintings.ts)); in normal reading the writer's stream staggers the pages by seconds, so the second and later scenery requests of a part probably read.
- **Structural problem, independent of timing:** in a 3-page part there is exactly one Opus character request, in a 4-page part two. With one request there is nothing to read the write back; the 1.25x premium on ~7,200 tokens ($0.036 versus $0.029 uncached) is pure surcharge unless the next part's Opus page starts within five minutes. The quick-character lineage has two requests per part, the scenery lineage three or four.
- **Does the 5-minute TTL expire between parts?** Often, I estimate. The gap that matters is start-to-start between the last request of a lineage in one part and its first in the next: reading 3-4 pages aloud, tapping targets, choosing, then the writer producing the next part. Stories are sold as roughly 5-10 minutes (Adventure) or over 10 minutes (Odyssey) for 4-5 parts ([git log, commit bb01666](/home/user/Taleo/src/lib/ages.ts)), so 2-3 minutes a part when read straight through, but small children linger, and the Opus lineage's last request in a part is page 3 or 4 while its next is page 3 of the following part. The system-prompt portion is shared across all users, so it stays warm whenever the app sees at least one painting per lineage every five minutes; the character-sheet portion is per story and gets no such help.
- **1-hour TTL** [est, Adventure central]: one 2x write per lineage per story, then reads: ~$1.24, a **~9.5% saving against part-cold ($1.37)** and ~20% against all-cold, but ~3% dearer than the case where the 5-minute cache happened to stay warm all story ($1.20). It pays whenever two or more parts would otherwise go cold.
- **Keep-alive on the 5-minute TTL** [est]: a non-streaming `max_tokens: 0` request per lineage roughly every 4 minutes while a story is open costs ~$0.0024 per round (reads of 7,220 Opus + 7,220 Sonnet + 1,730 Sonnet tokens); three rounds in a 15-minute story is under one cent. Result ~$1.21, **~11-12% saving against part-cold**, and never worse than today. It needs a timer (client ping to a small route, since the app is serverless).
- **Pre-warm at the right moment** [est]: fire the three `max_tokens: 0` requests when the reader makes a choice (cast and world are known from part 2 on), while the writer is still writing. It adds no cost (the first real request would have paid the same write), turns same-instant writes into reads, and shortens time to first stroke. For the reopen burst, the same effect comes from sending one request per lineage first and releasing the rest when its stream begins.
- **Cast-dependent prefixes**: a page showing only companion1 has a different prefix after the system prompt than a page showing the hero, so it writes its own entry. Always sending all central sheets in fixed order would give one prefix per story (extra sheets cost only 0.05x once cached) but risks the painter drawing characters who are not in the scene; I rate that a quality risk to test, not a free win.
- **Unifying lineages** is the other fix: if one model painted the characters on every page, a 4-page part would have one write and three reads instead of two writes and two rarely-read entries (see section 4).
- Supporting-cast sheets go in the uncached tail ([claude.ts L641-643](/home/user/Taleo/src/server/claude.ts)); a preset supporting character adds up to ~1,600 uncached tokens ($0.006 on Opus) to every page they appear on. Small.

### Gaps
- Whether "begins streaming" for an Opus request (which thinks silently first) means `message_start` or the first content delta is not stated in the docs I read; it affects how long a second Opus request must wait to read.
- Whether `max_tokens: 0` is accepted together with the `server-side-fallback-2026-07-01` beta and `fallbacks: "default"` is not documented in the files read; the pre-warm must match the real request's rendered prefix, so this needs one live test.
- The real cache-hit rate is unknown here; the activity log's `cacheRead` / `cacheWrite` per call would show it immediately.
- The 512-token minimum is flagged in the skill file as "check the prompt caching docs before relying on"; I did not fetch the live caching page.

---

## 3. What Opus 5.5's always-on thinking adds

### Takeaway
The docs give no token figure for Opus 5.5 thinking at effort `low`, so this is an estimate: roughly **1,000 hidden tokens, about 2 cents, per Opus character layer (range 0.6 to 6 cents)**, which is 25% of that layer's cost and about 9% of a story's painting cost. The code's own 60-second first-stroke fallback shows the tail is sometimes far larger.

### Cited Findings
- [docs] On Opus 5.5 thinking cannot be disabled at any effort; "Effort is now the control for how much the model thinks, and therefore for latency and cost"; "At `low` the model keeps its thinking short; how often it skips thinking altogether depends on the prompts"; a system-prompt line such as "Answer directly without deliberating." can reduce thinking further, with a possible accuracy cost. — [model-migration.md, Opus 5.5 Breaking change 1](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/model-migration.md)
- [docs] "At a given level, Claude Opus 5.5 tends to think more per turn than Claude Opus 5"; lowering effort reduces thinking "more reliably than prompting does". — [model-migration.md, Opus 5.5 "Choosing an effort level"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/model-migration.md)
- [docs] "The effort parameter affects all tokens in the response", including text, not only thinking; effort is "a behavioral signal, not a strict token budget". — [Effort](https://platform.claude.com/docs/en/build-with-claude/effort.md)
- [code] The app already runs the Opus character painter at `low`, the lowest level, and notes that at `medium` "the characters arrived long after the scenery (or not inside the first-stroke limit at all)". — [claude.ts L74-79](/home/user/Taleo/src/server/claude.ts)
- [code] A 60-second first-stroke clock (`FIRST_STROKE_MS`) aborts the Opus painter and hands the page to the quick painter; queueing time counts toward it. — [claude.ts L47-54, L470-475, L515](/home/user/Taleo/src/server/claude.ts)
- [code] Sonnet 5.5 "in side-by-side tests ... painted the same pages ~15% faster and at about half the cost, with somewhat less careful characters". — [claude.ts L33-38](/home/user/Taleo/src/server/claude.ts)

### Inferences
- [est] 1,000 thinking tokens x $20/MTok = $0.020 per Opus layer; across an Adventure's 6 Opus pages that is $0.12, **~9% of painting cost**; removing it entirely is an upper bound of 8.8%, halving it 4.4%.
- The "about half the cost" the developers measured for Sonnet versus Opus on whole pages is consistent with price alone (output $10 vs $20), which suggests Opus thinking at `low` is modest on typical pages; the 60-second clock exists for the tail.
- Since effort is already at the floor, the only remaining Opus-side dials are the documented "Answer directly without deliberating." line (unmeasured for this task) and moving the layer off Opus.

### Gaps
- No documented thinking-token figure for Opus 5.5 at `low`. The app can measure it: `output_tokens` minus streamed SVG characters / 2.7.
- How often `paintings_slow` fires (the metric exists in [route.ts L129](/home/user/Taleo/app/api/illustrate/route.ts)) is production data I do not have.

---

## 4. Model choice: Sonnet for all characters, Haiku for scenery or characters, few-shot budget

### Takeaway
On price alone, painting all characters with Sonnet saves ~32% of a story; Haiku scenery saves ~30%; both together ~62%; Haiku for everything ~95-97%. Haiku output is so cheap that a 20,000-token cached exemplar library adds two hundredths of a cent per request, so the entire question for Haiku is quality, and the budget for closing the gap (few-shot paintings, higher effort, even two attempts) is effectively unlimited.

### Cited Findings
- [docs] Haiku 5.5: $0.10 in / $0.50 out, cache read $0.01, 5-minute write $0.125, **5x higher prices when the prompt exceeds 100,000 tokens** (counting cached tokens). Output is 20x cheaper than Sonnet 5.5 and 40x cheaper than Opus 5.5. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing.md)
- [docs] Haiku 5.5 thinks adaptively by default, accepts `thinking: {type:"disabled"}` at effort `high` or below, supports effort `low` to `max` (default `medium`), has **no server-side fallback**, and its safety classifiers can return `stop_reason: "refusal"`. `xhigh`/`max` make "thinking and replies ... much longer". — [models.md Haiku 5.5 entry](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/models.md); [model-migration.md "Migrating to Claude Haiku 5.5"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/model-migration.md)
- [docs] Model step-downs are the riskiest lever and should come after effort sweeps, one notch at a time against an eval; "the smallest model ... fits high-volume work with checkable outputs". For a shared few-shot preamble, put the breakpoint at the end of the shared portion. — [cost-optimization.md 2.7](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/cost-optimization.md); [prompt-caching.md "Shared prefix, varying suffix"](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/prompt-caching.md)
- [code] The team tried Haiku 5.5 at medium effort for scenery: "its places came out plainer and less finished; Haiku still works if set here". The code already handles Haiku (plain `disabled` thinking, no fallback beta). — [claude.ts L55-73, L457-459](/home/user/Taleo/src/server/claude.ts)
- [code] The scenery model and effort, the quick model, and the main art model are all environment variables (`TALEO_SCENERY_MODEL`, `TALEO_SCENERY_EFFORT`, `TALEO_ART_MODEL`, `TALEO_QUICK_ART_MODEL`), so every swap below is a configuration change. — [claude.ts L24-65](/home/user/Taleo/src/server/claude.ts)

### Inferences (all [est], Adventure 14 pages, central case, part-cold baseline $1.37)
| Change | Story cost | Saving | Quality / latency risk |
|---|---|---|---|
| Characters on Sonnet 5.5 (thinking off) for every page | $0.93 | **32%** | The team's own note: "somewhat less careful characters". Faster first stroke, no 60 s Opus stalls, and one cache lineage for all character requests |
| Scenery on Haiku 5.5, same output size | $0.96 | **30%** | Known: "plainer and less finished" at medium without examples |
| Scenery on Haiku 5.5 with a 20K-token cached exemplar prefix and 1.5x the output | $0.98 | **28%** | Unknown; this is the experiment worth running |
| Haiku scenery + Sonnet characters everywhere | $0.52 | **62%** | Sum of the two above |
| Haiku for both layers | $0.05 | **97%** | Highest: character likeness and anatomy are the hard part of the task |
| Haiku for both layers, 20K exemplars each | $0.07 | **95%** | As above, mitigated by examples |

- Per-page view: an Opus page falls from $0.111 to $0.060 on Sonnet characters (a 46% cut on those pages); scenery falls from $0.030 to ~$0.002 on Haiku.
- **Few-shot affordability on Haiku**: a cached exemplar prefix costs $0.0001 (10K tokens), $0.0002 (20K), $0.0005 (50K), $0.0009 (90K) per request when read; $0.0013 to $0.011 per cold write; and even fully uncached only $0.001 to $0.009. A complete scenery painting is ~2,700 tokens, so **20K tokens holds about 7 full exemplar sceneries and 90K about 30**, for less than a tenth of a cent. For comparison the Sonnet scenery output alone is $0.027. The hard ceiling is the 100K-token prompt threshold, above which all Haiku prices rise 5x; stay under ~90K.
- The saving on Haiku is large enough to fund quality techniques that would be unaffordable on Sonnet: effort `high` with thinking on (even tripling output keeps scenery near $0.005), two candidates per page with a cheap validator, or a second "finishing" pass that adds pen detail to the first pass's output. Thinking before painting delays the first stroke, which matters on quick pages only.
- Techniques for closing the Haiku gap, in the order I would test them: (1) 5-10 exemplar sceneries in the cached prefix, chosen for variety (indoor, outdoor, night, water), since the complaint was "plainer and less finished", which is exactly what examples of finish address; (2) effort `high`; (3) a tighter scenery prompt with explicit minimums (for example a floor of 80 elements and required ink and detail groups); (4) two-pass paint-then-enrich. Exemplars must be byte-stable and sit before the breakpoint.
- Risks specific to Haiku in this pipeline: no server-side fallback, so a refusal or overload fails the layer and with it the page (section 7); and exemplars can pull every scene toward the same composition.
- An intermediate option the docs point to: before stepping characters down a model, try Sonnet at `low` instead of `medium` for the quick character painter, since effort affects visible output length too ([Effort](https://platform.claude.com/docs/en/build-with-claude/effort.md)); the size of that effect on SVG output is unmeasured.

### Gaps
- No quality evaluation exists in the repo, so every model swap is unverified on likeness, anatomy and finish. The cost-optimization guide's advice is to build a small fixed set of pages (including the hardest: three characters, an action, a custom character) and compare side by side.
- I found no documentation of Haiku 5.5's SVG or drawing ability; the only evidence is the one-line comment in `claude.ts`.
- Haiku output-token counts may differ from Sonnet's for the same picture (it may draw fewer elements); the 30% and 97% figures assume equal output.

---

## 5. Batches, fast mode, priority tier, structured outputs

### Takeaway
The Batch API's 50% discount is real and stacks with caching, but it has no latency guarantee (usually under an hour, up to 24) and no streaming, so it cannot serve a page a reader will reach in one or two minutes; its realistic uses are offline (exemplar libraries, a reusable scenery library, evaluation runs). Fast mode doubles the price, and structured outputs would add tokens; neither is a saving.

### Cited Findings
- [docs] Batch: "most batches finishing in less than 1 hour while reducing costs by 50 percent"; "You can access batch results when all messages have completed or after 24 hours, whichever comes first"; batches expire at 24 hours and processing "might be slowed down based on current demand". — [Batch](https://platform.claude.com/docs/en/build-with-claude/batch-processing.md)
- [docs] Batch limitations: `stream: true` is not supported ("results come back as a single file"); `max_tokens: 0` is not supported; with caching, "consider using the 1-hour cache duration ... for better cache hit rates". Opus 5.5, Sonnet 5.5 and Haiku 5.5 are all supported. — [Batch](https://platform.claude.com/docs/en/build-with-claude/batch-processing.md)
- [docs] Batch prices: Opus 5.5 $2 / $10, Sonnet 5.5 $1 / $5, Haiku 5.5 $0.05 / $0.25 per MTok; caching multipliers stack with the batch discount. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing.md)
- [docs] "that window is an expiry, not an SLA. Keep user-facing work synchronous"; cache hits inside a concurrent batch are best-effort. — [cost-optimization.md 2.5](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/cost-optimization.md)
- [docs] Fast mode: "up to 2.5x higher output tokens per second at premium pricing"; Opus 5.5 fast mode is $8 / $40 per MTok (2x); not available with the Batch API. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing.md)
- [code] Later parts do not exist until the reader chooses, and the pages of the current part are 3-4, read in a few minutes; only the page on screen shows its painting streaming in, the others paint in the background. — [ages.ts L219](/home/user/Taleo/src/lib/ages.ts), [usePaintings.ts L39-43](/home/user/Taleo/src/lib/usePaintings.ts)
- [code] The character designer returns its SVG inside a JSON string (`output_config.format` with a Zod schema). — [claude.ts L733-744](/home/user/Taleo/src/server/claude.ts)

### Inferences
- **Batch for story pages**: the only pages not needed immediately are pages 3-4 of the current part, needed in roughly 1-3 minutes. If all of them (the Opus pages) went through batch the ceiling would be ~24% of an Adventure [est], but "usually under an hour" does not fit a 1-3 minute need, so a synchronous fallback would fire nearly every time and the page would be paid for twice. I rate the realistic saving in the reading path as **about zero**. Background pages do not need streaming, so the missing stream is not itself the blocker; latency is.
- **Batch where it does fit**: (a) building the few-shot exemplar library; (b) pre-painting a library of reusable sceneries (meadow, kitchen, bedroom at dusk, and so on) with the best model at half price, which then makes scenery free at read time when the writer picks a library place; (c) evaluation sweeps for the model and effort experiments; (d) repainting failed or missing pages of finished library books overnight. These are architecture choices rather than a switch.
- **Fast mode** is a price increase (2x on Opus 5.5) for speed. Not a cost lever; conceivable only as a paid latency fix for the quick page, where Sonnet is already used.
- **Priority tier**: I found nothing in the files or pages read that describes it as a discount; I did not research it further.
- **Structured outputs for paintings** would cost more: SVG inside a JSON string needs every attribute quote escaped (`\"`), about 8-12 extra characters on an 82-character element, i.e. roughly **10% more output characters** [est]. This overhead is being paid today in `designCharacter`, a one-off per character. Having the designer use single-quoted attributes, or return the SVG outside the JSON, would remove it.

### Gaps
- No observed batch latency for this account; "most under 1 hour" is the vendor's statement.
- Priority tier pricing and terms were not located in the sources read.
- I did not measure the JSON-escaping overhead; the 10% is counted from typical attribute counts in the preset art.

---

## 6. Output-token hygiene: boilerplate versus coordinates, and a compact notation

### Takeaway
In the repo's real paintings about **44% of characters are markup boilerplate** (tag names, attribute names, quotes, class names, closing tags) and 56% are payload (path data, numeric attributes, colours). Because boilerplate tokenises more efficiently than digits, I estimate it is 25-30% of output tokens; a compact notation that the server expands back to the existing SVG while streaming could cut visible output tokens by **~20-30%**, about **15-17% of story cost**, at a real risk to drawing quality.

### Cited Findings
- [code] Measured over the 16 preset paintings after `referenceArt` rounding: path/points data 43-50% of characters, numeric attributes 3-10%, hex colours 5-6%, everything else ("boilerplate") **37-58%, median ~44%**. Example, bunny: 3,984 chars, of which 1,777 path data, 245 numeric attributes, 238 colours, 1,724 boilerplate. — [presetArt.ts](/home/user/Taleo/src/lib/art/presetArt.ts) (measured with a throwaway script)
- [code] The prompt already asks for compact SVG: whole-number coordinates, no trailing zeros, no unneeded whitespace, shared attributes hoisted to the group. — [prompts.ts L26](/home/user/Taleo/src/server/prompts.ts)
- [code] The format contract: inner SVG only; elements g, path, circle, ellipse, rect, polygon, polyline, line; groups classed wash / paint / ink / detail; exactly one `<g class="target">`; fixed palette of ~30 hex colours. — [prompts.ts L7-26, L157-159](/home/user/Taleo/src/server/prompts.ts)
- [code] The server already sits in the stream between model and browser (`paint(delta)` in the route) and the client sanitises and extracts markup, so a server-side expander is plug-compatible. — [route.ts L104-118](/home/user/Taleo/app/api/illustrate/route.ts), [usePaintings.ts L129](/home/user/Taleo/src/lib/usePaintings.ts)
- [docs] "To shorten visible responses, specify the exact output shape in the prompt, ideally with an example." — [cost-optimization.md 2.4](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/cost-optimization.md)

### Inferences
- [est] Per 82-character element, ~36 characters are boilerplate. A line-per-shape notation (for example a one-letter shape code, a palette index, then the untouched path data, with layer headers instead of `<g class=...>` tags) needs ~6-8 characters of framing, removing ~28 characters, **~34% of characters**. Boilerplate words such as `path`, `fill`, `stroke` are single tokens, so I put boilerplate at ~9-10 of an element's ~30 tokens and the compact form at ~3: **20-25% fewer output tokens**, up to 30% with the two additions below.
- Two further trims inside the payload: palette indices instead of hex (a 7-character hex is ~4-5 tokens, an index 1-2; colours are 5-6% of characters but nearer 10% of tokens), and relative path commands (smaller numbers, fewer digits). The integer-coordinate rule is already in place.
- [est] A 25% cut in visible output is **~17% of story cost** (Adventure $1.37 to $1.14), on every model and stacking with every other lever. The expander is deterministic: it can emit valid SVG line by line, preserving progressive streaming, the layer classes, the target group and the palette.
- Risk: the models have seen far more SVG than any private notation, so a notation that changes how shapes are written may cost drawing quality, most on the weakest model. Mitigation: keep SVG path syntax byte-for-byte inside the notation, change only the wrapper, and teach it with exemplars in the cached prefix (affordable everywhere, nearly free on Haiku). The reference paintings sent as input could stay as SVG or be converted too; mixing input SVG with output notation is itself a risk to test.
- A zero-risk variant to try first: keep SVG but tighten the house style (shortest legal attribute forms, no redundant `class` on shapes inside classed groups, one group per layer rather than several). The preset files show 3-9 groups per painting; fewer groups means fewer wrappers.
- The cheapest output lever is fewer elements. The prompt ranges are wide (60-120, 50-150); a 25% lower element count saves the same ~17% as the notation, with a direct visible cost in richness.

### Gaps
- Token shares are estimated from character shares; no tokenizer was run. One `count_tokens` call on a real painting in both notations would settle it.
- No evidence in the repo or docs on how well any Claude model draws in a custom notation.

---

## 7. Waste in the current code path

### Takeaway
The avoidable waste is concentrated in failure handling: one failed layer throws away the other layer's paid work and the retry repaints both; a slow Opus start can bill up to a minute of hidden thinking, discard a finished scenery, and then pay for a full repaint, making that page roughly 1.5 times a normal Opus page. `max_tokens: 32000` and the 1,200-character briefs are minor.

### Cited Findings
- [code] `inLayers`: "If either fails the other is stopped and the failure is the picture's"; the scenery streams to the browser first, the characters are held until scenery ends. — [claude.ts L533-591](/home/user/Taleo/src/server/claude.ts)
- [code] On any failure the route sends `<!--taleo:error-->`; the client discards the text (no done marker), waits 4 s and asks again once with `retry: true`, which the server paints with the quick painter, in layers, from scratch (new scenery and new characters). — [route.ts L125-138](/home/user/Taleo/app/api/illustrate/route.ts), [usePaintings.ts L129-150](/home/user/Taleo/src/lib/usePaintings.ts), [claude.ts L596-607](/home/user/Taleo/src/server/claude.ts)
- [code] `SlowPainter`: after 60 s with no first text delta the Opus request is aborted and the page fails as "slow"; the usage tracker notes that what was generated before a stop "is still billed". The scenery brush carries the same 60 s clock. — [claude.ts L470-475, L515, L686](/home/user/Taleo/src/server/claude.ts), [metrics.ts L142-145](/home/user/Taleo/src/server/metrics.ts)
- [code] Client watchdog: 90 s of silence aborts the attempt and triggers the same single retry. Leaving the story aborts all in-flight paintings. — [usePaintings.ts L14-17, L44-58, L71-78](/home/user/Taleo/src/lib/usePaintings.ts)
- [code] Reopen: pages still unpainted are first looked up in the account's draft copy "before any is painted again (paid work)", then repainted with header `x-taleo-reopened`. — [app/story/[id]/page.tsx L20-40](/home/user/Taleo/app/story/[id]/page.tsx), [usePaintings.ts L51-54, L92](/home/user/Taleo/src/lib/usePaintings.ts)
- [code] Every page gets a freshly painted scenery; the only continuity device is the previous page's text brief (`previous`, up to 1,200 chars) sent to both painters. — [claude.ts L639, L688-700](/home/user/Taleo/src/server/claude.ts)
- [code] `max_tokens: 32000` on every painter; hitting it is treated as a failed painting. — [claude.ts L485, L509-511](/home/user/Taleo/src/server/claude.ts)
- [code] The character painter's system prompt is the whole-scene illustrator prompt (it still says "Paint the WHOLE scene ... Usually 150-300 elements" and describes scenery pen detail), countermanded by `LAYERED_CHARACTERS` in the user turn. — [prompts.ts L149-169, L211-215](/home/user/Taleo/src/server/prompts.ts)
- [docs] "`max_tokens` is a backstop, not a tuning knob. The model never sees it"; a hit is a failed attempt. — [cost-optimization.md 2.4](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/cost-optimization.md)

### Inferences (dollar figures [est], central case)
- **Failed layer discards the other.** The scenery usually finishes first (it starts at once, no thinking). When the character layer then fails, a paid ~$0.030 scenery is thrown away and bought again on the retry. Keeping the finished layer (for example holding it server-side for a minute keyed by the page signature, or re-running only the failed brush inside the same request) would make a retry cost one layer instead of two.
- **SlowPainter.** If Opus really is generating for those 60 seconds (rather than queueing behind a rate limit, which is free), at an assumed 60 tokens/s that is ~3,600 thinking tokens, **~$0.07**, plus the discarded scenery $0.03, plus the quick repaint $0.06: about **$0.16 for a page that normally costs $0.11**. Fixes: fall back in-process to the quick character brush and keep the scenery; or shorten the clock; or take those pages off Opus altogether. The frequency is in the `paintings_slow` counter.
- **Retries change the model, so they also miss the cache**: an Opus page retried on Sonnet reads the Sonnet-illustrator lineage, which is warm only if a quick page of the same story ran in the last five minutes.
- **Reopen** is already guarded against repainting finished pages. The residual cost is in-flight work aborted when the reader leaves, and the simultaneous burst of up to 10 cold cache writes on return (section 2).
- **Scenery for consecutive pages in the same place.** If the writer marked each page with a place key and the server reused the previous page's finished scenery layer for the same place, the scenery call disappears on those pages. If 35% of pages qualify (my guess; parts are short and often stay in one spot), that is **~11% of story cost**. It also improves continuity, which today depends on a text brief. Risks: the stage's clear zone widens with the number of characters ([claude.ts L612](/home/user/Taleo/src/server/claude.ts)), so a scenery painted for one character may crowd three; and identical backdrops on consecutive pages may look static.
- **`max_tokens: 32000`** costs nothing in normal operation. Its only cost role is the worst case: a runaway Opus layer could bill 32,000 x $20 = $0.64. A cap nearer 12,000-16,000 bounds that, but a hit becomes a failure and a retry, so the cap must sit well above the largest healthy painting plus thinking.
- **The 1,200-char previous brief** is ~375 tokens sent to both painters: about $0.0008 (Sonnet) + $0.0015 (Opus) per page, **~2% of a page**. Not worth cutting if it helps continuity. The picture brief is the same size and is the actual instruction.
- **A dedicated character-only system prompt** would be a little shorter and, more usefully, would stop telling the character painter to paint 150-300 elements and scenery detail. Any reduction in over-painting is an output saving; the input saving is negligible once cached.
- **Eager painting** of every page in a part is not waste when the pictures are kept, but a reader who drops a story after page 1 has paid for pages 2-4. Lazy painting (page n+1 only when page n is opened) would avoid that at the cost of visible waiting; I do not recommend it without abandonment data.

### Gaps
- Failure, slow-start, stall and reopen rates are production metrics (`paintings_failed`, `paintings_slow`, activity-log cases "second go", "story reopened") that are not in the repository; without them the waste cannot be turned into a percentage of spend.
- Whether a "change of mind" (limits allow 3-6 per period, [tiers.ts](/home/user/Taleo/src/lib/tiers.ts)) discards an already painted part was not traced.
- Whether an aborted Opus request is billed for thinking generated so far is taken from the code comment in `metrics.ts`, not from Anthropic documentation.
- The share of consecutive pages set in the same place is a guess.

---

## 8. Ranked list of Claude-side levers

### Takeaway
Three groups: no-quality-risk fixes worth about 15-25% together (cache keep-alive or 1-hour TTL, keeping the surviving layer on failure, pre-warming); output-shape changes worth 10-17% each with moderate risk (compact notation, scenery reuse, element budgets); and model swaps worth 30-95% whose only obstacle is quality, with Haiku scenery plus exemplars the most promising because the plain version was already tried and its weakness is the kind examples address.

### Cited Findings
- [docs] Recommended order: caching first, then input and output hygiene, then batch, then effort, with model selection "last, deliberately", one lever at a time against an eval. — [cost-optimization.md Step 2](/tmp/claude-0/bundled-skills/2.1.322/b09448c864dbfe5fc3aa6d22f09bf52d/claude-api/shared/cost-optimization.md)
- [code] All model and effort choices for the painters are environment variables, so the model levers need no code. — [claude.ts L24-84](/home/user/Taleo/src/server/claude.ts)

### Inferences
Savings are [est] percentages of painting cost for a 14-page Adventure against the central part-cold baseline of $1.37; they overlap and do not add (after a model swap, the caching and thinking levers shrink in dollar terms). All keep the output contract: inner SVG, wash/paint/ink/detail classes, one target group, fixed palette, progressive streaming.

| # | Lever | Est. saving | Quality risk | Latency effect | Effort to build |
|---|---|---|---|---|---|
| 1 | Characters on Sonnet 5.5 for every page (drop Opus) | ~32% | Medium: "somewhat less careful characters" per the team's own test | Better: no hidden thinking, no 60 s stalls | Config |
| 2 | Scenery on Haiku 5.5 with a cached library of exemplar sceneries, effort raised | ~28-30% | Medium, untested; plain Haiku was "plainer and less finished" | Similar or better, unless thinking is turned on | Config + exemplar set |
| 3 | 1 + 2 together | ~62% | Sum of both | Better | As above |
| 4 | Compact notation expanded server-side | ~15-17% (20-30% of visible output) | Medium: unfamiliar format may hurt drawing; keep path syntax intact | Better: fewer tokens to stream | Moderate (expander, prompts, exemplars) |
| 5 | Keep the 5-minute cache alive per open story (`max_tokens: 0` pings), or 1-hour TTL on system and sheets | ~9-12% (0 if caches already stay warm) | None | Better first stroke | Small |
| 6 | Reuse the previous page's scenery when the place is unchanged | ~11% at 35% of pages | Low-medium: static backdrops, stage width mismatch | Better | Moderate (writer emits a place key) |
| 7 | Tighter element budgets (for example scenery 50-90) | up to ~17% for 25% fewer elements | Direct loss of richness | Better | Prompt edit |
| 8 | Keep the finished layer when the other fails; in-process fallback for slow Opus | Proportional to failure rate; each incident saves $0.03-$0.10 | None | Better on retries | Small-moderate |
| 9 | Pre-warm the three lineages at choice time; lead-then-release on reopen bursts | Up to ~13% in the all-cold case, ~2 cents/page on a 10-page burst | None | Better first stroke | Small |
| 10 | Less Opus thinking ("Answer directly without deliberating.") | 0-9% (bound) | Low-medium, unmeasured | Better | Prompt edit |
| 11 | Sonnet quick characters at effort `low` instead of `medium` | Unknown | Low-medium | Better | Config |
| 12 | Haiku for characters too, with exemplars | ~95% | High: likeness and anatomy | Better | Config + exemplars + eval |
| 13 | Batch API for reading-path pages | ~0 realistic (24% ceiling) | None | Unusable: no latency guarantee | n/a |
| 14 | Batch API for offline work (exemplars, scenery library, evals) | 50% of that work | None | n/a | Small |
| 15 | Trim the 1,200-char briefs, lower `max_tokens` | ~2%; tail-risk cap only | Low | None | Trivial |

- Not levers: fast mode (2x price), structured outputs for paintings (adds ~10% escaping overhead), and removing `cache_control` (it would save the 0.25x premium on unread Opus writes but lose all reads; lever 5 is strictly better).
- A sensible order of work: 5, 8 and 9 first (no quality question); then a small fixed evaluation set of pages; then 2, 1 and 11 as configuration experiments judged side by side; then 4 and 6 as engineering projects.

### Gaps
- Every saving above rests on estimated token counts; one day of the app's own per-call log would replace the estimates with measurements and may reorder levers 4-10.
- No quality evaluation exists, so the risk column is judgement, informed only by the two comments in `claude.ts` about Sonnet and Haiku.
