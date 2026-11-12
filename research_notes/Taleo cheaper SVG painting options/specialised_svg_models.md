# Specialised SVG / vector-generation models and commercial vector APIs (state as of 12 Nov 2026)

Method note (read first). All facts were checked on 12 Nov 2026. This session's network only allowed direct page fetches from github.com; arxiv.org, huggingface.co, recraft.ai, openrouter.ai, quiver.ai and the blogs were blocked. So only the OmniSVG and LLM4SVG GitHub READMEs were read first-hand. Everything else below is taken from web-search result summaries of the linked pages (marked "search snippet") and should be re-verified on the primary page before budgeting. Anything I could not source is in Gaps, not in Cited Findings.

## 1. Open research models: can any generate a multi-character storybook scene, and what limits apply?

### Takeaway
No open-weights specialised model found is a credible drop-in for a 150-300 element, multi-character, palette- and layer-controlled scene: they are trained on icons and single-object illustrations, run at roughly 80-100 s per 4k tokens, and the best dataset is non-commercial. OmniSVG 1.1 is the only one with released weights, an illustration subset and a "character reference" task, but it is still far from the app's requirements.

### Cited Findings
OmniSVG (most relevant open model)
- Code is Apache-2.0; the MMSVG dataset is CC BY-NC-SA 4.0 (non-commercial). 2.7k GitHub stars, 110 forks, 85 commits — [OmniSVG GitHub README, read directly](https://github.com/OmniSVG/OmniSVG)
- Released weights: OmniSVG1.1_8B (17.2 GB, updated 2025-12-02), OmniSVG1.1_4B (7.69 GB, 2025-12-02), OmniSVG-3B legacy (8.49 GB, 2025-07-22). The only 2026 news item is OmniLottie (2 Mar 2026), a separate Lottie model; no OmniSVG 2 was listed — [OmniSVG GitHub](https://github.com/OmniSVG/OmniSVG)
- GPU memory: about 26 GB for 8B, about 17 GB for 4B and 3B (so 8B does not fit a 24 GB A10G/L4 without quantisation) — [OmniSVG GitHub](https://github.com/OmniSVG/OmniSVG)
- Generation time per 256/512/1024/2048/4096 OmniSVG tokens: 8B = 5.38/9.02/20.11/40.34/98.11 s; 4B = 4.08/8.68/18.07/37.51/82.70 s. The README gives no hardware for these timings in what I could extract, and its table stops at 4096 tokens — [OmniSVG GitHub](https://github.com/OmniSVG/OmniSVG)
- MMSVG-2M: MMSVG-Icon 904K and MMSVG-Illustration 255K (both enlarged 22 Dec 2025), plus characters. MMSVGBench is 600 synthetic samples — [OmniSVG GitHub](https://github.com/OmniSVG/OmniSVG)
- The paper says OmniSVG parameterises SVG commands and coordinates into discrete tokens and can handle SVGs beyond 30k tokens, where earlier LLM-based methods struggle past about 10k; it is built on Qwen2.5-VL; its benchmark covers text-to-SVG, image-to-SVG and character-reference SVG generation (search snippet) — [OmniSVG arXiv 2504.06263](https://arxiv.org/html/2504.06263v3); [project page](https://omnisvg.github.io)

StarVector
- Apache-2.0 on both the Hugging Face card and GitHub; a reviewer notes the StarCoder base licence should also be checked (search snippet) — [StarVector-8B model card](https://huggingface.co/starvector/starvector-8b-im2svg)
- The GitHub README states StarVector models "will not work for natural images or illustrations"; scope is icons, logos, fonts, diagrams (search snippet) — [star-vector README](https://cdn.jsdelivr.net/gh/joanrod/star-vector@main/README.md)
- Token ceiling is unclear: the model card example uses max_length=4000; a third-party Replicate wrapper accepts up to 16000 (search snippet) — [model card](https://huggingface.co/starvector/starvector-8b-im2svg); [Replicate wrapper](https://replicate.com/gregpriday/starvector-8b-im2svg/versions/2cd3242be97ee8aeb815993501328ff7dad162ffe9a5b33ef8fbf4fb66410669/api)
- SVG-Bench covers 10 datasets and 3 tasks (image-to-SVG, text-to-SVG, diagram-to-SVG); the released checkpoints are named "im2svg" (search snippet) — [StarVector arXiv 2312.11556](https://arxiv.org/pdf/2312.11556)

LLM4SVG
- MIT licence, 675 stars. Weights are announced but the link is still marked "pending"; latest news entry is April 2025. Datasets SVGX-Core-250k and SVGX-SFT-1M. Examples use max length 4096 and recommend 2048+ for "complex" SVGs. Bases include Qwen2.5-VL-7B, Llama 3.2, Gemma 3 — [LLM4SVG GitHub, read directly](https://github.com/ximinng/LLM4SVG)

Others
- InternSVG: InternViT-300M vision encoder + Qwen2.5-7B language model; paper under CC BY-NC-SA 4.0; weight availability not confirmed (search snippet) — [InternSVG arXiv 2510.11341](https://arxiv.org/html/2510.11341); [project page](https://hmwang2002.github.io/release/internsvg/)
- Reason-SVG: reasoning + reinforcement learning for SVG generation; only the paper was found, no weights or model licence (search snippet) — [Reason-SVG arXiv 2505.24499](https://arxiv.org/html/2505.24499v2)
- IntroSVG (Mar 2026): a VLM with a generate-critique-refine loop using rendering feedback (search snippet) — [arXiv 2603.09312](https://arxiv.org/html/2603.09312)
- A further 2026 RL paper on reliable reasoning in SVG-LLMs exists (search snippet, title only) — [arXiv 2603.16189](https://arxiv.org/html/2603.16189)
- SVGBuilder: component-based autoregressive coloured SVG generation from text (search snippet) — [arXiv 2412.10488](https://arxiv.org/html/2412.10488v4)
- SVGDreamer: optimisation-based; models SVGs as distributions over control points and colours via vectorised particle-based score distillation (search snippet) — [arXiv 2312.16476](https://arxiv.org/abs/2312.16476)
- NeuralSVG: implicit representation for text-to-vector that encourages each shape to have standalone meaning (search snippet) — [arXiv 2501.03992](https://arxiv.org/pdf/2501.03992)
- LayerTracer (Feb 2025): diffusion transformer trained on designers' layer-by-layer construction sequences; does text-to-SVG and raster-to-layered-vector (search snippet) — [arXiv 2502.01105](https://www.arxiv.org/pdf/2502.01105)
- AmodalSVG (Apr 2026): VLM-guided semantic layer peeling, then per-layer vectorisation with inpainting of occluded parts; it reports that earlier coarse-to-fine layering methods such as LayerTracer give layers that rarely match semantic entities (search snippet) — [arXiv 2604.10940](https://arxiv.org/html/2604.10940)
- SemLayer (CVPR 2026) restores semantic layers for flattened abstract icons; Vector Prism (CVPR 2026) recovers semantic structure for animation (search snippets) — [SemLayer arXiv 2603.24039](https://arxiv.org/html/2603.24039v1); [Vector Prism](https://cvpr.thecvf.com/virtual/2026/poster/38438)
- Layered Image Vectorization via Semantic Simplification (2024) is an image-to-layered-vector method, not a generator (search snippet) — [arXiv 2406.05404](https://arxiv.org/html/2406.05404v1)
- 2026 arXiv work is mostly on diagrams/documents and evaluation rather than scenes: GeoSVG-RL (layout-constrained diagrams), GVR-Coder (document/meeting SVGs), SVG-Score (evaluation) (search snippets) — [GeoSVG-RL](https://arxiv.org/pdf/2605.25447); [GVR-Coder](https://arxiv.org/pdf/2607.28073); [SVG-Score](https://arxiv.org/abs/2609.03806)

### Inferences
- OmniSVG's 4096-token timing (83-98 s) is for a single icon/illustration-sized output. A 150-300 element scene would need several times that, i.e. minutes per picture, and the model emits its own path-command tokens, not `circle`/`ellipse`/`rect` primitives with classes.
- None of the open models exposes a mechanism for a fixed palette, a four-layer class convention or a tap-target group. Those would have to be added by fine-tuning (another researcher's scope) or post-processing.
- OmniSVG's character-reference task conditions on an image of a character, which is the nearest thing to the app's reference-SVG requirement, but I found no evidence of exact hex-colour or marking preservation.
- Because MMSVG is non-commercial and the weights were trained on it, commercial use of OmniSVG weights is legally unclear even though the code is Apache-2.0; ask the authors or a lawyer before shipping.
- Optimisation-based methods (SVGDreamer, VectorFusion, NeuralSVG) and diffusion-based ones (LayerTracer, SVGFusion) produce bezier-path art with no streaming and are research demos, not services.

### Gaps
- Not found or not verified in this session: SVGen, SVGThinker, Chat2SVG, SVGFusion details, SVGCraft, IconShop, DeepSVG, VectorFusion, SVGDreamer++, "LayerPeeler"/T2V-NPR, UniSVG, VGBench, SGP-Bench. I have no sourced facts on their weights, licences or limits. From background knowledge (unverified here): these are icon/single-object or optimisation-based systems, and SVGCraft was the one aimed at multi-object scenes via slow per-image optimisation.
- OmniSVG's benchmark hardware, true maximum sequence length in the released weights, and whether character-reference weights are included in the 1.1 release.
- Whether any hosted endpoint (Replicate, fal) serves OmniSVG, and at what price.
- No paper found that demonstrates a specialised model generating a multi-character storybook scene with consistent recurring characters.

## 2. Commercial vector-generation APIs: prices, structure, style and character features

### Takeaway
Two production options matter: QuiverAI's Arrow 2 (an SVG-code model with token pricing of $4/$20 per million, so not cheaper than today) and Recraft V4/V4.1 Vector (flat $0.08 per SVG, $0.30 for Pro, with style references). Neither is documented as emitting the app's primitive-shape, class-layered structure, and neither accepts an SVG character sheet as an exact reference.

### Cited Findings
QuiverAI Arrow
- Arrow 2 was released around 16 Sep 2026. Pricing is token-based: $4 per million input, $20 per million output, cached reads $0.40 per million. Arrow 2 Telos is 50% more: $6 input, $30 output. The older Arrow 1 series keeps per-asset pricing (search snippets from aggregators and news; not read on quiver.ai) — [runtimewire](https://runtimewire.com/article/quiverai-arrow-2-editable-svg-workspace-api); [Vercel AI Gateway](https://vercel.com/ai-gateway/models/arrow-2); [LLM Reference](https://www.llmreference.com/model/arrow-2); [CloudPrice](https://cloudprice.net/models/quiverai-arrow-2)
- Both Arrow 2 models cap output at 65,536 tokens. Arrow 2 writes SVG as code, works in shapes and groups (the basis for its micro-animation feature), accepts a reference image to produce variations keeping palette and shape style, and converts raster images to editable SVG. Telos is positioned for harder briefs and larger SVGs (search snippets) — [i-scoop](https://www.i-scoop.eu/arrow-2-brings-faster-svg-generation-micro-animations-and-token-pricing/); [meetcody](https://meetcody.ai/blog/quiverai-arrow-2-ai-svg-model/); [explainx](https://explainx.ai/blog/quiverai-arrow-2-vector-graphics-model-september-2026); [Arrow 2 Telos model page](https://quiver.ai/models/arrow-2-telos)
- Reviewers note that QuiverAI has not published a comparative benchmark, that cleaner-geometry claims are vendor claims, and at least one review was a desk review that generated no SVG (search snippets) — [artrealmai](https://artrealmai.com/article/quiverai-arrow-2-editable-svg-api); [note.com review](https://note.com/ai_driven/n/n89d4f6197a0f?hl=en)
- Design Arena's organiser says Quiver "produces production ready SVG outputs" encoding hierarchy and grouping, and that live drawing can be watched, which implies streamed output (search snippet of a post on X) — [Jason Cui on X](https://x.com/JasonSCui/status/2027108004009762953)
- A third-party page claims about $0.01 per call and 100 free calls a month, probably for Arrow 1; this conflicts with other sources and is unverified — [Stork](https://stork.ai/en/quiver-ai)

Recraft
- Official model table: Recraft V4 Vector $0.08 per image, V4 Pro Vector $0.30 (about 45 s generation); V4.1 Vector (`recraftv4_1_vector`) also $0.08. Raster-to-vector "vectorize" endpoint is $0.01 per image. fal.ai and OpenRouter list the same vector prices (search snippets) — [Recraft V4 docs](https://www.recraft.ai/docs/api-reference/models/recraft-v4.md); [Recraft V4.1 docs](https://www.recraft.ai/docs/api-reference/models/recraft-v4-1); [Recraft pricing](https://www.recraft.ai/docs/api-reference/pricing); [fal.ai](https://fal.ai/recraft-v4); [OpenRouter](https://openrouter.ai/recraft/recraft-v4.1-vector)
- A June 20 2026 price cut took V4.1 raster to $0.035 per image; it did not extend to vector (search snippet) — [invideo blog](https://invideo.io/blog/recraft-ai-image-generator/); [Recraft pricing](https://www.recraft.ai/docs/api-reference/pricing)
- Styles: Recraft's docs say every V4 and V4.1 model accepts a `style_id` or attached style references; creating a style costs $0.005 per request (search snippet) — [Recraft V4 Styles docs](https://www.recraft.ai/docs/api-reference/models/recraft-v4-styles); contradicted by an OpenRouter listing saying V4.1 Vector is generation-only with no image inputs, styles or style references — [OpenRouter](https://openrouter.ai/recraft/recraft-v4.1-vector-20260514)
- The V4 family was released in February 2026 (search snippet) — [Wikipedia: Recraft](https://en.wikipedia.org/wiki/Recraft)

Adobe Firefly
- No official per-call price for a text-to-vector API was found. Third-party sources say Firefly Services API billing is usage-based and separate from app plans, and one enterprise table lists text-to-vector at 4 credits in the app (search snippets) — [redresscompliance](https://redresscompliance.com/adobe-firefly-enterprise-pricing-2026); [activepieces](https://www.activepieces.com/blog/adobe-firefly-pricing-plans-and-credits-2026-guide)

### Inferences
- Arrow 2 is architecturally the same kind of thing the app uses today (an autoregressive model emitting SVG code, streamable, up to 65k output tokens), so in principle it could be prompted for layer classes, a palette and a target group. Whether it obeys such conventions as reliably as Claude is untested; its marketing targets logos, icons, stickers and clipart.
- Recraft's vector models are image-style generators returning traced-looking SVG; expect bezier paths rather than `circle`/`rect` primitives and no semantic class layers. Its SVG path counts were not documented in anything I found.
- Recraft's style feature gives look-and-feel consistency from reference images, not exact character identity with fixed hex colours and markings.

### Gaps
- Kittl, Vectorizer.AI, SVG.io, Vecteezy, Ideogram, Freepik, Canva, Figma and "Neoglyph": not researched (call budget and blocked hosts). No sourced facts.
- Arrow 2: official docs not read; no confirmation of streaming over the API, system-prompt style control, SVG-as-input editing, licence terms for outputs, or output tokens for an illustration-sized picture.
- Recraft: licence terms for API outputs, typical path counts and file sizes, and whether style references really work on the vector endpoint (sources conflict).
- Adobe: whether a public text-to-vector API endpoint exists in Firefly Services at all in Nov 2026.

## 3. Specialised models versus frontier general LLMs on SVG benchmarks

### Takeaway
On the main human-preference leaderboard the one specialised commercial model (Arrow 2 Telos) currently ranks first, ahead of GPT-6 Astra and Claude Opus 5.5, while Recraft's vector models rank about 29th-30th and open research models are absent. But its lead is reported on logos, icons, faces, animals and clipart; no source shows any specialised model beating frontier LLMs on complex, semantically controlled scenes, and every source says quality falls as complexity rises.

### Cited Findings
- Design Arena SVG Arena, snapshot 31 Oct 2026: Arrow 2 Telos #1 at about 1,611 Elo, GPT-6 Astra (xhigh) 1,410, Arrow 2 1,392, GPT-6 Astra (max) 1,363, Claude Opus 5.5 #5 at 1,331, Claude Opus 5 #10 at 1,305; Recraft V4 Vector Pro and V4 Vector both 1,245 at #29-30; Gemini 3.5 Flash #32 at 1,242. The same page inconsistently shows 1,529 for Telos in another table (search snippet) — [Design Arena SVG leaderboard](https://www.designarena.ai/leaderboard/svgs); [benchmarklist mirror](https://benchmarklist.com/arenas/design_arena_svg/)
- Design Arena states both Arrow 2 models "perform remarkably well on logos, stickers, faces, animals, people, organic shapes, and clipart-style generations, providing a level of detail unmatched by any frontier model" (search snippet) — [Design Arena on X](https://x.com/DesignArena/status/2104633448824803504)
- Arrow 1.0 reached 1,583 Elo in Feb 2026, the first model above 1,500 on a Design Arena board (search snippet) — [Jason Cui on X](https://x.com/JasonSCui/status/2027108338459463732)
- Rapidata's human-vote SVG benchmark (updated Aug 2026, 42 models) places claude-fable-5 4th, gpt-5.6-sol-high 5th, gemini-3.1-pro-preview 8th; rankings vary by category (search snippet) — [Rapidata svg-benchmark](https://huggingface.co/datasets/Rapidata/svg-benchmark)
- SVGenius: GPT-4o's generation quality score fell from 82.72% to 42.22% and Gemini 2.0 Flash from 77.78% to 31.11% as difficulty rose (older models) (search snippet) — [SVGenius arXiv 2506.03139](https://arxiv.org/pdf/2506.03139)
- A Lica analysis (roughly early 2026) reports OmniSVG and StarVector trailing proprietary general models (Gemini, GPT-4o, Claude) on alignment, preference and pixel fidelity, with OmniSVG ahead on some structural measures (search snippet) — [lica.world](https://lica.world/blog/why-svg-generation-needs-a-new-scorecard)
- SVG-Score (Sep 2026) finds CLIP-based scores barely react to the errors SVG generators actually make (wrong colours, counts, spatial relations) (search snippet) — [arXiv 2609.03806](https://arxiv.org/abs/2609.03806)
- A practitioner benchmark states simple icons pass but complex scenes break for every model tested (search snippet) — [svgcodeeditor.com](https://svgcodeeditor.com/ai-svg-benchmark)

### Inferences
- Honest state of the art: open research specialists lose to frontier LLMs; one closed specialist (Arrow 2 Telos) wins blind preference votes on single-subject art. For a prompt-specified scene with layer classes, palette, tap target and re-posed reference characters, frontier general LLMs remain the only demonstrated option.
- Arena Elo measures visual preference on short prompts, not adherence to structural conventions, so it does not predict "plug and play" fitness.
- Academic metrics that rely on CLIP likely overstate specialised models' quality on colour, count and spatial correctness, which are exactly what a picture book needs.

### Gaps
- No 2026 results found for OmniSVG, StarVector or InternSVG on current leaderboards against 2026 frontier models.
- UniSVG, VGBench, SGP-Bench and SVG-Bench 2026 standings not retrieved.
- No benchmark found that tests multi-character scenes, character consistency across pages, or instruction-following on SVG structure.

## 4. Could each plausible candidate be post-processed into the app's layered primitive SVG, and what is lost?

### Takeaway
Only an SVG-code model (Arrow 2) could plausibly emit the convention directly; path-emitting models (Recraft vector, OmniSVG) can be mechanically bucketed into wash/paint/ink/detail and palette-snapped, but lose primitives, the tap-target group, progressive painting and exact character likeness.

### Cited Findings
- Arrow 2 writes SVG as code with shapes and groups, and output can be watched being drawn (search snippets) — [i-scoop](https://www.i-scoop.eu/arrow-2-brings-faster-svg-generation-micro-animations-and-token-pricing/); [Jason Cui on X](https://x.com/JasonSCui/status/2027108004009762953)
- Recraft vector variants return a complete editable SVG per request, with Pro taking about 45 s (search snippet) — [Recraft V4 docs](https://www.recraft.ai/docs/api-reference/models/recraft-v4.md)
- OmniSVG emits its own discrete command/coordinate tokens that are decoded to SVG paths (search snippet) — [OmniSVG arXiv](https://arxiv.org/html/2504.06263v3)
- Semantic layer recovery from flat vector art is itself an open research problem (AmodalSVG, SemLayer, Vector Prism all published in 2026) (search snippets) — [AmodalSVG](https://arxiv.org/html/2604.10940); [SemLayer](https://arxiv.org/html/2603.24039v1)

### Inferences
- Arrow 2: test whether it follows a system prompt specifying class names, palette and a target group. If it does, nothing is lost and streaming is kept. If it ignores them, a post-pass can snap fills to the nearest palette colour and assign classes by heuristics (largest background shapes to wash, stroke-only shapes to ink, small late shapes to detail), but the tap target would need a second model call or bounding-box heuristic.
- Recraft vector: palette snapping and area/stroke-based layer bucketing are mechanical. Lost: primitive elements (everything is `path`), compact size, progressive streaming (the SVG arrives whole; a fake paint-in by revealing paths in z-order is possible), tap-target semantics, and exact recurring-character identity. The app's watercolour filters were tuned for 150-300 simple shapes and may look different on many small traced paths.
- OmniSVG: same losses as Recraft plus slow generation and no palette or character control; not worth post-processing in its current form.
- Since the app applies filters per class, not per element type, paths in place of primitives may be acceptable if the element count stays in the low hundreds; this is a product check, not a research finding.

### Gaps
- No measured path counts or byte sizes for Arrow 2 or Recraft outputs on scene prompts; a hands-on test of 5-10 real page prompts is needed.
- No evidence either way on Arrow 2 accepting an SVG (as text) character reference and re-posing it faithfully.

## 5. Rough cost per picture for the best three candidates versus $0.10-0.30 today

### Takeaway
None of the specialised options is "far cheaper" with adequate capability: Recraft Vector is a flat $0.08, Arrow 2 works out at roughly the same as today for a scene-sized SVG, and self-hosted OmniSVG could be a few cents but is slow and unfit for scenes.

### Cited Findings
- Recraft V4 / V4.1 Vector: $0.08 per SVG; Pro Vector $0.30; style creation adds $0.005 per request; vectorize endpoint $0.01 (search snippets) — [Recraft pricing](https://www.recraft.ai/docs/api-reference/pricing); [Recraft V4 Styles](https://www.recraft.ai/docs/api-reference/models/recraft-v4-styles)
- Arrow 2: $4 / $20 per million input / output tokens, $0.40 cached; Telos $6 / $30 (search snippets) — [Vercel AI Gateway](https://vercel.com/ai-gateway/models/arrow-2); [CloudPrice](https://cloudprice.net/models/quiverai-arrow-2)
- OmniSVG 4B: 82.70 s per 4096 tokens, about 17 GB VRAM; 8B: 98.11 s, about 26 GB — [OmniSVG GitHub](https://github.com/OmniSVG/OmniSVG)

### Inferences
- Arrow 2 arithmetic: if a 150-300 element scene is about 8k-15k output tokens (my assumption, not measured), output costs $0.16-0.30 on Arrow 2 and $0.24-0.45 on Telos, plus input for the prompt and character reference. That is equal to or above current cost. It is only attractive if quality is clearly better.
- Recraft arithmetic: $0.08 flat is below the top of today's range but not "far cheaper", and adds post-processing and loses character fidelity. The $0.30 Pro tier is no saving.
- OmniSVG arithmetic: at an assumed $0.80-1.50 per GPU-hour for a 24 GB card (assumption; GPU prices not checked in this session), one 4096-token picture at 83 s costs about $0.02-0.035 unbatched; a scene needing 3-4 times the tokens would be about $0.06-0.14 and take 4-6 minutes. Batching would cut cost but not latency.
- Net: the specialised route does not deliver the cost goal. Cost reduction is more likely to come from the options other researchers are covering (cheaper general LLMs, fine-tuning, raster-then-vectorise at Recraft's $0.035 raster + $0.01 vectorize).

### Gaps
- Current rented-GPU hourly prices (A10G, L4, A100, H100) were not checked; figures above are placeholders.
- Real output-token counts for Arrow 2 on a scene prompt are unknown; its tokenizer and verbosity may differ from Claude's.
- Arrow 1-series per-asset price not confirmed.
