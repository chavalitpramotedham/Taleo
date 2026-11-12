# Raster-then-vectorise as a cheaper replacement for LLM-written SVG (as of 12 Nov 2026)

Reading notes for the report writer:
- All prices were collected on 12 Nov 2026 through web search. Direct page fetches to fal.ai, ai.google.dev, recraft.ai, img.ly and rentierdigital.xyz were blocked by this session's network policy, so every price below comes from a search-result excerpt of the linked page (official page where the link is official, aggregator where it is not). Nothing was confirmed by opening the live pricing page. Treat each figure as "reported", and re-check before budgeting.
- "Local test" means a small experiment I ran in this session with the `vtracer` Python package (0.6.x) on a synthetic 110-shape flat scene. It is not a real diffusion image; real output will be messier. The script is at /tmp/claude-0/-home-user-Taleo/d7c09cb9-7461-5c84-88c4-fc434fb2f191/scratchpad/vt/t.py.
- No latency figures for any hosted image model were found in sources. All seconds-per-image statements are in Gaps or marked as unverified estimates.

## 1. Cheapest capable image models, exact prices, reference-image support, character consistency, flat-style steering

### Takeaway
Image generation is now 3-50x cheaper than the current $0.10-0.30 LLM-SVG step: roughly $0.001-0.015 per 1 MP image for open-weight fast models (FLUX.2 klein, Z-Image Turbo, FLUX schnell), $0.005-0.04 for the closed multi-reference editors (gpt-image mini/2 low, Nano Banana 2.1 / 2 Lite, Seedream 5.0 Flash/Lite, Qwen-Image-Edit). Independent evidence on likeness across 10-20 storybook pages is thin and partly contradictory (one benchmark puts Seedream 5.0 Pro and Qwen Image 3.0 ahead of Nano Banana Pro; reviewers elsewhere call Nano Banana the reference standard), so consistency must be tested on the app's own characters.

### Cited Findings

Price table (per image at about 1 MP unless stated; all "reported", 12 Nov 2026):

| Model | Host | Reported price | Reference images | Source |
|---|---|---|---|---|
| FLUX.2 [klein] 4B | fal | $0.005 / MP | edit endpoint exists (multi-ref) | [fal klein 4B](https://fal.ai/models/fal-ai/flux-2/klein/4b/llms.txt) |
| FLUX.2 [klein] 4B | Cloudflare Workers AI | $0.000287 per output 512x512 tile, $0.000059 per input 512x512 tile (about $0.0012 for 1024x1024 by my arithmetic) | yes (input tiles priced) | [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| FLUX.2 [klein] 4B | BFL direct | $0.014 first MP + $0.001 per extra MP | yes | [BFL pricing](https://docs.bfl.ai/quick_start/pricing.md) |
| FLUX.2 [klein] 9B | fal | $0.011 / MP (base); $0.015 / MP (LoRA) | edit + LoRA endpoint listed | [fal klein 9B base](https://fal.ai/models/fal-ai/flux-2/klein/9b/base/llms.txt), [fal klein 9B LoRA](https://fal.ai/models/fal-ai/flux-2/klein/9b/lora/llms.txt), [fal klein 9B edit LoRA](https://fal.ai/models/fal-ai/flux-2/klein/9b/edit/lora) |
| FLUX.2 [klein] 9B | Cloudflare | $0.015 first MP, $0.002 per further MP, $0.002 per input image MP | yes | [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| FLUX.2 [dev] | fal | $0.012 / MP; edit billed per MP on input and output | yes | [puter FLUX pricing, Sep 2026](https://developer.puter.com/tutorials/flux-api-pricing/) |
| FLUX.2 [dev] Turbo | fal | about $0.008 / image (one tracker says $0.016) | - | [fal explore](https://fal.ai/explore/best-ai-image-generators?page=2), [Artificial Analysis](https://artificialanalysis.ai/image/models/fal_flux-2-dev-turbo) |
| FLUX.2 [pro] | fal | $0.03 first MP + $0.015 per extra input/output MP; up to 9 reference images | up to 9 | [puter FLUX pricing](https://developer.puter.com/tutorials/flux-api-pricing/) |
| FLUX.1 Kontext pro / max | BFL | $0.04 / $0.08 per image | 1 reference image | [BFL pricing](https://docs.bfl.ai/quick_start/pricing.md) |
| FLUX.1 Kontext dev | fal / other | $0.037 (third-party list for fal); $0.025 on another host | 1 | [pricepertoken fal](https://pricepertoken.com/fal-ai-pricing) |
| FLUX.1 schnell | Cloudflare | $0.0000528 per 512x512 tile + $0.0001056 per step | no | [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Z-Image Turbo (6B, 8 steps) | fal | $0.005 / MP; LoRA variant $0.0085 / MP; image-to-image endpoint exists | img2img only, no identity reference | [fal Z-Image Turbo](https://fal.ai/models/fal-ai/z-image/turbo/llms.txt), [fal Z-Image Turbo LoRA](https://fal.ai/models/fal-ai/z-image/turbo/lora) |
| Qwen-Image (gen) | fal | $0.02 / MP | - | [fal FLUX vs Qwen](https://fal.ai/learn/tools/flux-vs-qwen-image) |
| Qwen-Image-Edit 2511 | fal | about $0.03 / MP (aggregators: $0.030-0.031 per 1024x1024) | multi-image edit | [fal FLUX vs Qwen](https://fal.ai/learn/tools/flux-vs-qwen-image), [pricepertoken](https://pricepertoken.com/image/model/qwen-qwen-image-edit-2511) |
| Qwen Image 2 / 3 / Max | fal | $0.035 (2K) / $0.04 (1K) / $0.075 | - | [llmreference fal](https://www.llmreference.com/provider/fal-api/models) |
| Seedream 4.5 | fal | $0.04 / image | multi-ref | [teamday fal pricing 2026](https://www.teamday.ai/blog/fal-ai-pricing-2026) |
| Seedream 5.0 Lite / 5.0 Flash | fal | $0.035 / $0.027 per image | multi-ref | [llmreference fal](https://www.llmreference.com/provider/fal-api/models) |
| gpt-image-1-mini | OpenAI | $0.005 low, $0.011 medium, $0.036 high at 1024x1024 (272 output tokens at $8/M for low); possibly flagged obsolete on one localised docs page | accepts input images (edit) | [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-image-1-mini), [pricepertoken](https://pricepertoken.com/gpt-image-pricing) |
| gpt-image-2 | OpenAI | $0.006 low at 1024x1024 (third-party listing) | accepts input images | [costgoat](https://costgoat.com/pricing/openai-images), [OpenAI community thread](https://community.openai.com/t/replacement-for-gpt-image-1-mini/1382424) |
| Nano Banana (Gemini 2.5 Flash Image) | Google | $0.039 / image, $0.0195 batch; reported retiring 15 Mar 2027 | yes | [benchlm](https://benchlm.ai/media-pricing/nano-banana) |
| Nano Banana 2 (Gemini 3.1 Flash Image) | Google | $0.045 (0.5K), $0.067 (1K), $0.101 (2K), $0.151 (4K) | yes | [myarchitectai](https://www.myarchitectai.com/blog/nano-banana-api-pricing) |
| Nano Banana 2 Lite (Gemini 3.1 Flash-Lite Image, June 2026) | Google | about $0.0336 / image at 1K | yes | [eesel](https://www.eesel.ai/blog/nano-banana-2-lite-pricing) |
| Nano Banana 2.1 (GA 6 Oct 2026, single source) | Google | about $0.0336 (1K), $0.0504 (2K), $0.113 (4K) | yes | [fourweekmba](https://fourweekmba.com/ai-google-halves-nano-banana-image-price-triples-input-price/) |
| Nano Banana Pro (Gemini 3 Pro Image) | Google | $0.134 (1K/2K), $0.24 (4K) | yes | [myarchitectai](https://www.myarchitectai.com/blog/nano-banana-api-pricing) |
| Recraft V4 Vector / V4 Pro Vector (native SVG) | Recraft, fal | $0.08 / $0.30 per image; Recraft V2 raster from $0.022; units sold at $1 = 1,000 | style reference in V4 "styles" variants | [Recraft pricing](https://www.recraft.ai/docs/api-reference/pricing.md), [usagepricing](https://usagepricing.com/blueprint/recraft), [fal Recraft V4 vector](https://fal.ai/models/fal-ai/recraft/v4/text-to-vector/llms.txt) |

- fal bills FLUX, Z-Image, Krea and Qwen endpoints per megapixel, and Nano Banana, Seedream, Recraft and Kling Image per image — [aident.ai](https://aident.ai/blog/fal-ai-image-pricing-per-image-vs-megapixel).
- The fourweekmba headline for the October 2026 Google change is "Halves Nano Banana Image Price, Triples Input Price", so reference-image input cost on Nano Banana 2.1 rose while output fell; single source — [fourweekmba](https://fourweekmba.com/ai-google-halves-nano-banana-image-price-triples-input-price/).
- Character consistency, img.ly benchmark: Seedream 5.0 Pro ranked first on identity holding at 4.86/5, Qwen Image 3.0 4.72/5, Nano Banana Pro 3.89/5, Seedream 4.5 3.75/5 (img.ly runs the benchmark itself; methodology not read because the host was blocked) — [img.ly consistency findings](https://img.ly/ai-benchmarks/findings/consistency/).
- Decrypt's comparison calls Nano Banana the gold standard for character consistency but more content-restrictive, says it handles combining several reference elements poorly, ranks FLUX Kontext second, and says Qwen-Image-Edit is a reliable open option where precise identity across generations is challenging — [Decrypt](https://decrypt.co/?p=341845).
- One benchmark rejects FLUX Kontext Pro for multi-character work because it accepts only one reference image — [rentierdigital](https://rentierdigital.xyz/blog/ai-image-model-character-consistency-benchmark).
- Google's "up to five characters" consistency figure is a vendor claim, not an independent success rate — [Dreamina guide](https://dreamina.capcut.com/ai-image/consistent-character-generators-reference-controls).
- Flat-style steering: SimpleVectorFlux is a FLUX.1-dev LoRA for flat vector art on white (about 50 synthetic images, trigger "v3ct0r style, simple flat vector art, isolated on white bg") — [Hugging Face](https://huggingface.co/renderartist/simplevectorflux). Scenario hosts "Simple Vector v2" and "Minimalism" flat-colour LoRAs — [Scenario](https://www.scenario.com/models/simple-vector-v2).
- Illustration LoRAs commonly leak the base model's photographic texture and blur into flat images, and small uniform datasets teach composition instead of style — [HackerNoon](https://hackernoon.com/lang/hr/five-common-failure-modes-in-flux-illustration-lora-training).
- fal lists LoRA endpoints for FLUX.2 klein 9B (including edit + LoRA) and Z-Image Turbo, so a custom flat-style LoRA can be combined with reference editing on klein — [fal klein 9B edit LoRA](https://fal.ai/models/fal-ai/flux-2/klein/9b/edit/lora), [fal Z-Image Turbo LoRA](https://fal.ai/models/fal-ai/z-image/turbo/lora).

### Inferences
- The best price/feature fit for this app is FLUX.2 klein 9B edit (+ a flat-style LoRA): about $0.011-0.02 per page with one or two reference images, open weights, LoRA support. Klein 4B on Cloudflare is the absolute floor (about $0.001-0.002) but its likeness and prompt adherence are untested here.
- For likeness without training anything, the multi-reference closed editors (Seedream 5.0 Flash/Lite at $0.027-0.035, Nano Banana 2.1 / 2 Lite at about $0.034, Qwen-Image-Edit at about $0.03) are the safer first test; they are still 3-10x cheaper than today.
- The app's flat hero reference picture and hex-colour model sheet are easier to hold than a photoreal face: flat cartoon characters with stated colours are the easy case for reference editing, and a later palette-quantise step forces exact hex values regardless of model drift. This is reasoning, not a tested result.
- Z-Image Turbo, FLUX schnell and SDXL/SD3.5 turbo have no identity-reference input, so they only suit pages without recurring characters, or need a per-character LoRA (not practical for user-created heroes).

### Gaps
- No source gave seconds-per-image for any model. Unverified expectation: 1-4 s for klein / Z-Image Turbo, 5-20 s for Nano Banana / Seedream / gpt-image.
- No prices found for Runware, Together or Replicate; HiDream, Ideogram 3, Imagen 4, SD3.5 turbo and Recraft V3 raster prices were not retrieved.
- Recraft custom-style creation price and whether V4 styles accept a per-character reference were not confirmed.
- No independent test of likeness specifically across 10-20 storybook pages was found; the img.ly and rentierdigital methodologies could not be read.
- gpt-image-2 pricing is from an aggregator; the reference-image input token cost for OpenAI and Google models was not retrieved.
- How existing AI storybook products keep characters consistent was not researched (budget).

## 2. Vectorisers: price, output character, size, licence, semantic ordering

### Takeaway
Classical tracers (VTracer, Potrace, autotrace) are free, run in milliseconds on a server or in WASM, and give unordered colour-region paths; hosted options cost about $0.01 (Recraft vectorize) to $0.17-0.20 (Vectorizer.AI) per image. None produces the app's wash/paint/ink/detail semantics, and learned image-to-SVG models are either unsuitable for illustrations (StarVector) or research code. In my local test a 110-shape flat scene traced to 88-135 paths and 22-33 KB in polygon mode, 44-70 KB with splines, so the 10-30 KB budget is reachable only with palette quantisation, speckle filtering and integer coordinates.

### Cited Findings
- VTracer handles full-colour, high-resolution input directly, while Potrace accepts only binarised input — [VTracer README](https://github.com/visioncortex/vtracer).
- VTracer exposes `filter_speckle` (0-128 px), `color_precision` (1-8 bits per channel), and curve simplification that gives the fewest curves within a pixel tolerance; it ships as a Rust crate, CLI, Python binding and WASM web app — [VTracer README](https://github.com/visioncortex/vtracer), [vtracer crate docs](https://docs.rs/crate/vtracer/0.6.5).
- A vectorisation guide recommends a speckle filter of 4-8 px, fewer colours or longer segments when output has thousands of tiny paths (vendor blog, rule of thumb) — [convertintomp4 guide](https://convertintomp4.com/blog/image-vectorization-guide).
- Potrace is not designed for centre-line tracing; its maintainer points to autotrace for that — [Inkscape bug thread](https://bugs.launchpad.net/inkscape/+bug/170537/comments/5).
- Autotrace has a `-centerline` mode that turns a line drawing into strokes — [autotrace man page](https://manpages.org/autotrace), [inkscape-centerline-trace](https://github.com/fablabnbg/inkscape-centerline-trace).
- A CVPR 2026 supplement reports Potrace producing patchy, often broken outlines with low noise resistance in its visual comparison — [VectorArk supplemental](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Gehlaut_VectorArk_Learning_Practical_CVPR_2026_supplemental.pdf).
- Recraft vectorize on fal (`fal-ai/recraft/vectorize`) is listed at $0.01 per image — [fal Recraft vectorize](https://fal.ai/models/fal-ai/recraft/vectorize/llms.txt); a third-party tracker gives the same $0.01 for Recraft's own API (verified May 2026) — [scopeful](https://www.scopeful.org/tools/recraft).
- Vectorizer.AI API: one credit per image; reported plans $9.99 for 50 credits, $18.99 for 100 ($0.19 each), $34.99 for 200 ($0.175 each), up to $4,999 for 100,000 ($0.05 each); previews 0.2 credit (aggregator figures) — [toolradar](https://toolradar.com/tools/vectorizer-ai/pricing), [Vectorizer.AI pricing](https://www.vectorizer.ai/pricing).
- StarVector's project page states it will not work for natural images or illustrations because it was not trained on them; the official example caps generation at 4,000 tokens; a hosted endpoint exists on fal — [StarVector project page](https://starvector.github.io/starvector/), [fal StarVector](https://fal.ai/models/fal-ai/star-vector/llms.txt).
- OmniSVG says illustrations and anime characters reach 10k-30k tokens and claims to parameterise SVGs beyond 30k tokens (authors' own claim) — [OmniSVG paper](https://arxiv.org/html/2504.06263v3).
- LayerTracer (ICCV 2025) uses a diffusion transformer to produce staged "construction blueprints", then layer-wise vectorisation with path deduplication; it supports image input and has public code; trained on 20,000+ designer process traces — [LayerTracer paper](https://arxiv.org/html/2502.01105v3).
- "Layered Image Vectorization via Semantic Simplification" uses score distillation plus segmentation to create progressively simplified images and builds SVG layers from coarse to fine — [arXiv 2406.05404](https://arxiv.org/html/2406.05404v1).
- LayerPeeler combines vision-language reasoning with diffusion editing to peel layers progressively — [arXiv 2505.23740](https://arxiv.org/pdf/2505.23740v2).
- Qwen-Image-Layered decomposes one RGB image into 1-10 semantically separated RGBA layers; fal lists it at $0.05 per image; WaveSpeed charges $0.05 (2 layers) to $0.20 (8 layers); code is Apache 2.0 — [fal Qwen Image Layered](https://fal.ai/models/fal-ai/qwen-image-layered/llms.txt), [WaveSpeed docs](https://wavespeed.ai/docs/docs-api/wavespeed-ai/qwen-image-layered), [paper](https://arxiv.org/html/2512.15603).

Local test (my own measurement, synthetic scene, VTracer; "rounded" = integer coordinates and whitespace stripped, a rough stand-in for SVGO):

| Input | VTracer settings | Paths | Raw | Rounded | Gzip |
|---|---|---|---|---|---|
| 400x300 clean flat render | default | 205 | 338 KB | 88 KB | 26 KB |
| 400x300 clean | spline, speckle 8, colour precision 5 | 98 | 74 KB | 54 KB | 18 KB |
| 400x300 clean | polygon mode, same filters | 98 | 25 KB | 25 KB | 8 KB |
| 400x300 with blur, shading, noise, JPEG (diffusion-like) | default | 580 | 655 KB | 178 KB | 48 KB |
| 400x300 diffusion-like | tuned spline | 135 | 93 KB | 70 KB | 22 KB |
| 400x300 diffusion-like | polygon | 135 | 33 KB | 33 KB | 10 KB |
| 400x300 diffusion-like, snapped to 12-colour palette + 5 px mode filter | tuned spline | 88 | 59 KB | 44 KB | 14 KB |
| same | polygon | 88 | 22 KB | 22 KB | 6 KB |
| 1024x768 diffusion-like | default | 1,573 | 1,634 KB | 456 KB | 123 KB |
| 1024x768 diffusion-like, palette-snapped | tuned spline / polygon | 83 | 52 KB / 24 KB | 52 KB / 24 KB | 18 KB / 8 KB |

### Inferences
- Default tracer settings on raw diffusion output blow the size budget by 10-50x (0.5-1.6 MB). Palette snapping before tracing is the single biggest lever: it cut paths from 580 to 161 at defaults in the test, and it also enforces the app's hex palette.
- Each traced path costs about 250-500 bytes even after rounding, against roughly 60-100 bytes for a hand-written primitive (`<ellipse>`, short `<path>`). A real page with 200-400 traced regions would land around 50-150 KB with splines, 25-60 KB as polygons. Meeting 10-30 KB means aggressive simplification (visible facets) or compressing before storage; share links take gzip/brotli well (6-14 KB in the test) but localStorage stores UTF-16 strings, so compression there needs base64 or a binary store.
- Outlined shapes trace as filled outline regions with holes, not strokes; this roughly doubles geometry and is why a separate centre-line pass matters (section 3).
- Recraft vectorize at $0.01 is the only cheap hosted tracer worth trialling; Vectorizer.AI costs as much as the current LLM step and is ruled out on price.
- StarVector and OmniSVG image mode are not viable for 150-300-shape scenes; LayerTracer and the semantic-simplification methods match the wanted layer idea but have no hosted endpoint found and (for the SDS-based method) optimisation-style runtimes, so they are not plug-and-play today.

### Gaps
- No published path-count or file-size benchmark for VTracer/Potrace/autotrace on AI illustrations was found; the only numbers are my synthetic test.
- Typical path count and file size of Recraft vectorize and Vectorizer.AI output were not found; Adobe's API, ImageTracer.js and LIVE were not researched.
- Licences were not verified in this session (VTracer, Potrace, autotrace, Recraft output terms). Unverified recollection: VTracer MIT, Potrace GPL with a commercial licence, autotrace GPL/LGPL.
- Whether VTracer has any stroke or centre-line mode was not confirmed by any source; none of the results indicate it does.
- Inference time for LayerTracer, OmniSVG and the semantic-simplification method was not found.

## 3. Mapping into the app's wash / paint / ink / detail format, tap target, progressive painting

### Takeaway
No tool emits the four groups; they have to be reconstructed with a deterministic post-process: palette-quantise, trace colour regions, classify by area and colour (largest regions to wash, sepia and near-black thin regions to ink, tiny regions to detail), cut out the tap target with a text-prompted SAM 3 mask at about $0.005, and sort back-to-front by area for the painting-in reveal. This is a real engineering project (est. days to weeks of tuning), not a drop-in swap.

### Cited Findings
- SAM 3 on fal accepts a text prompt for segmentation; the image endpoint is listed at $0.005 per request (another page says $0.002); SAM 3.1 image-RLE is $0.01 per request — [fal SAM 3 image-RLE](https://fal.ai/models/fal-ai/sam-3/image-rle/llms.txt), [fal SAM 3.1 image-RLE](https://fal.ai/models/fal-ai/sam-3-1/image-rle/llms.txt), [fal SAM 3 image](https://fal.ai/models/fal-ai/sam-3/image).
- Roboflow reports 251 ms for SAM 3 concept segmentation from one text prompt on its own hardware — [Roboflow docs](https://docs.roboflow.com/models/supported-models/sam3).
- Autotrace centre-line mode converts clean line drawings to editable strokes — [Inkscape tracing tutorial](https://inkscape.org/doc/tutorials/tracing/tutorial-tracing.html); a user report says results are mediocre on most images and good only on very clean line drawings — [LightBurn forum](https://forum.lightburnsoftware.com/t/splitting-the-difference-after-trace-image-aka-centerline-trace/83921).
- `centerline-svg` (pure Python) outputs medial-axis paths from a solid black shape instead of its outline — [PyPI centerline-svg](https://pypi.org/project/centerline-svg/).
- Qwen-Image-Layered returns up to 10 RGBA layers per image via a `num_layers` parameter at $0.05 on fal — [fal developer guide](https://fal.ai/learn/devs/qwen-image-layered-image-to-image-developer-guide).
- FLUX.2 pro edit accepts up to 9 reference images; klein and Qwen-Image-Edit also have edit endpoints, which allow a second "line art only" or "colours only" pass from the first image — [puter FLUX pricing](https://developer.puter.com/tutorials/flux-api-pricing/), [fal FLUX vs Qwen](https://fal.ai/learn/tools/flux-vs-qwen-image).

### Inferences
Three realistic recipes, cheapest first:

1. Single image, split by colour (one generation). Prompt for flat fills with a dark sepia outline. Snap pixels to the fixed palette. Pixels of the ink colour form the ink mask; inpaint or dilate neighbouring fills under the lines; trace fills with VTracer in stacked mode as `paint`; send the ink mask through autotrace centre-line or skeletonisation to get stroked paths for `ink`. Regions above about 8-10% of the canvas go to `wash`; regions under about 30 px inside the character, or white/near-black dots, go to `detail`. Risk: line colour bleeding into dark fills, broken lines.
2. Two-pass (two generations, about double the image cost). Generate the colour image, then call the same edit model with "same picture, black line art only on white" (or "remove all outlines, flat colour only"). Trace each separately. Cleaner ink, but the second pass can shift geometry by a few pixels so lines no longer sit on fill edges; the app's wobbly watercolour look tolerates small misregistration.
3. Lineless paint plus synthetic ink (one generation). Generate a lineless flat image, trace fills, then create `ink` as strokes along the fill boundaries (re-use each paint path's outline as a sepia stroke, optionally only for regions inside the SAM character mask). Zero registration error and the smallest file, because ink paths can reference the same geometry; the linework is less expressive than hand-drawn pen lines.

- Tap target: run SAM 3 with the noun the story already knows ("the fox", "the red kite"), then assign every traced path whose centroid (or over 50% of area) falls inside the mask to the tap-target `<g>`. Because the app's layer groups are separate, the target needs one sub-group per layer or a restructure where the target group holds its own paint/ink/detail children. Animating a group cut out of a traced scene exposes whatever is behind it, so the background needs filling under the target (wash and large paint regions usually cover this when traced in stacked mode).
- Progressive painting-in still works: order is wash, then paint sorted by descending area, then ink, then detail, and the client reveals paths in document order exactly as now. The reveal will look like regions appearing rather than objects being drawn, since traced regions are not object-aligned.
- Qwen-Image-Layered ($0.05) could give object-level layers (background, character, props) to make grouping and the tap target more semantic, but it costs more than the image itself and adds a model call; SAM 3 is cheaper for the one mask actually needed.
- Recurring characters lose their current advantage: with LLM-SVG a character can be re-used as identical shapes; with tracing, every page re-traces a slightly different raster of the hero.

### Gaps
- No published end-to-end example of this exact pipeline (diffusion image to wash/paint/ink/detail SVG) was found; all recipes above are reasoned designs, untested.
- Quality of autotrace centre-line on AI-generated line art, and a lineart-ControlNet or edge-detection alternative, were not evaluated.
- fal SAM 3 latency was not found; the $0.002 vs $0.005 price conflict is unresolved.

## 4. Does double stylisation hurt (watercolour SVG filters over traced fragments)?

### Takeaway
There is no direct evidence on watercolour filters over traced output, but browser bug reports show feTurbulence and feDisplacementMap are slow and not GPU-accelerated, especially on iOS Safari. Because the app filters per layer group rather than per path, a few hundred extra paths should matter far less than the filter itself; the main quality risk is visual, with ragged traced edges and slivers being amplified by displacement.

### Cited Findings
- WebKit bug 191197 reports that SVG filters can crash on iOS and are slow in general — [WebKit 191197](https://bugs.webkit.org/show_bug.cgi?id=191197).
- A newer WebKit report found an feTurbulence grain filter on a large element much slower in WebKit than Chrome while scrolling — [WebKit 287982](https://bugs.webkit.org/show_bug.cgi?id=287982).
- feDisplacementMap is not GPU-accelerated in Firefox and takes a slower rendering path — [Mozilla 1883933](https://bugzilla.mozilla.org/show_bug.cgi?id=1883933); a page using it was reported nearly unusable due to repaint cost — [Mozilla 1879590](https://bugzilla.mozilla.org/show_bug.cgi?id=1879590).
- feTurbulence cost rises with `numOctaves` — [Mozilla 422371](https://bugzilla.mozilla.org/show_bug.cgi?id=422371).
- An animated feTurbulence/feDisplacementMap effect ran well on desktop but stuttered on iOS and could reload the Safari tab — [GreenSock forum](https://greensock.com/forums/topic/33075-gsap-and-feturbulence-mobile-performance/).

### Inferences
- Filter cost scales with filtered pixel area and repaint frequency, not path count, when the filter is on the group. The current app already pays this cost; going from 150-300 primitives to 200-500 traced paths adds rasterisation work but should not change the picture materially. The progressive reveal is the exception: each newly shown path repaints the whole filtered layer, so more paths means more full-layer filter passes during painting-in on phones.
- Visually, tracers leave thin gaps and overlaps between adjacent regions and jagged micro-segments. Displacement makes gaps flicker into visible paper-coloured cracks, and edge-pooling/darkening filters draw a dark rim around every fragment, so a sky split into six fragments gets six pooled edges. Mitigations: VTracer stacked mode (shapes overlap, no gaps), merging same-colour neighbours, strong speckle filtering, and keeping fragment count low.
- The filters also help: displacement hides the mechanical polygon facets from aggressive simplification, which supports using polygon mode to hit the size budget.
- The image model should be asked for flat colour, not watercolour, otherwise texture is baked in, the tracer emits hundreds of blotch fragments, and the app's filters stylise a second time.

### Gaps
- No source tests many-path SVG under these filters on current phones; bug reports span 2018-2026 and may not reflect current Safari.
- No visual evidence was found either way; this needs a 10-picture side-by-side on an iPhone and a low-end Android device.

## 5. Alternative: store a raster picture and keep SVG only for the tap target

### Takeaway
Skipping vectorisation removes the hardest engineering and all tracer artefacts, at the cost of leaving the plug-and-play SVG model: pictures would no longer fit in localStorage or share links and the per-layer watercolour filters and painting-in reveal would not apply.

### Cited Findings
- SAM 3 text-prompted masks at about $0.005 per image give the tap-target outline without tracing the whole picture — [fal SAM 3 image-RLE](https://fal.ai/models/fal-ai/sam-3/image-rle/llms.txt).
- Qwen-Image-Layered can return the tap target as its own RGBA layer for animation, at $0.05 per image on fal — [fal Qwen Image Layered](https://fal.ai/models/fal-ai/qwen-image-layered/llms.txt).

### Inferences
- Cost would be the same as the pipelines in section 6 minus tracing (which is free anyway), so there is no cost advantage; the gain is quality and simplicity.
- A 30-80 KB WebP/AVIF per page breaks the share-link design (a 12-page book would be 0.4-1 MB of base64) and strains the roughly 5 MB localStorage quota, so it needs blob storage and URLs, i.e. a backend the SVG design avoids.
- A hybrid is possible: raster background plus traced SVG for the tap-target character only. It halves the tracing problem but still needs blob storage.
- Whole-image SVG filters can still be applied to an `<image>` element, but the per-layer wash/paint/ink treatment is lost unless the model paints the watercolour look itself, which then varies page to page.

### Gaps
- Actual WebP/AVIF sizes for this style at 800x600 were not measured.
- The app's current storage and share-link limits were not inspected in this task.

## 6. Total cost, latency and size for the three best pipelines; child-safety filter behaviour

### Takeaway
All three candidate pipelines come out at roughly $0.01-0.05 per picture against $0.10-0.30 today (about 3-25x cheaper), with the saving dominated by the image model choice; tracing is free and segmentation adds about half a cent. Provider child-safety filters are a real operational risk for a children's app, best documented for Google, where reference photos of children and the word "child" trigger blocks that cannot be configured away.

### Cited Findings
- Component prices used below: FLUX.2 klein 9B $0.011-0.015/MP on fal and $0.002 per input MP on Cloudflare — [fal klein 9B base](https://fal.ai/models/fal-ai/flux-2/klein/9b/base/llms.txt), [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/); Seedream 5.0 Flash $0.027 — [llmreference fal](https://www.llmreference.com/provider/fal-api/models); Nano Banana 2.1 about $0.034 at 1K — [fourweekmba](https://fourweekmba.com/ai-google-halves-nano-banana-image-price-triples-input-price/); gpt-image-2 low $0.006 — [costgoat](https://costgoat.com/pricing/openai-images); SAM 3 $0.005 — [fal SAM 3 image-RLE](https://fal.ai/models/fal-ai/sam-3/image-rle/llms.txt); Recraft vectorize $0.01 — [fal Recraft vectorize](https://fal.ai/models/fal-ai/recraft/vectorize/llms.txt).
- Google's Vertex documentation lists a safety category for photorealistic depictions of children and a separate one for child content not allowed under the request's settings or allowlisting — [Google Cloud responsible AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-responsible-ai).
- A developer reported reference photos of their own child being blocked; Google staff attributed it to child-safety filters in AI Studio and the Gemini API — [Google AI forum](https://discuss.ai.google.dev/t/safety-protocols-prevent-the-use-of-children-my-own-or-ai-generated-for-proper-purposes/110551).
- Developers report inconsistent "prohibited content" false positives in a kids' product on Gemini 3.1 Flash Image — [Google AI forum](https://discuss.ai.google.dev/t/nconsistent-prohibited-content-errors-false-positives-in-kids-virtual-try-on-project-using-gemini-3-1-flash-image-preview/169380).
- Blocked Nano Banana generations can return HTTP 200 with no image data, blocks are intermittent for the same input, and the word "child" reportedly triggers the strictest filtering (proxy-vendor blog, anecdotal) — [apiyi FAQ](https://docs.apiyi.com/en/faq/nano-banana-image-failure).
- Adobe Firefly applies additional protections whenever children appear, even in everyday scenes — [Adobe community](https://community.adobe.com/questions-404/firefly-won-t-accept-my-image-1483270).
- On aggregator platforms, blocks can be triggered by the prompt, the reference image, or the combination — [Scenario help](https://help.scenario.com/articles/8779329416-content-policy-copyright-what-each-model-allows).

### Inferences
Estimated totals per picture (my arithmetic from the reported prices; latency figures are unverified estimates because no source gave timings):

| Pipeline | Image step | Segmentation | Vectorise | Total | Est. latency | Est. SVG size |
|---|---|---|---|---|---|---|
| A. Cheapest: FLUX.2 klein 9B edit (+ flat-style LoRA, 1-2 refs) on fal or Cloudflare, VTracer + centre-line in the app's own server function | $0.011-0.02 (one pass), $0.02-0.04 (two-pass colour + line) | SAM 3 $0.005 | $0 (self-run) | about $0.016-0.045 | est. 4-10 s | 25-60 KB polygon, 50-150 KB spline; 10-25 KB gzipped |
| B. Best likeness bet: Seedream 5.0 Flash/Lite or Nano Banana 2.1 / 2 Lite with reference images, VTracer | $0.027-0.035 (plus input-image tokens on Google) | $0.005 | $0 | about $0.032-0.045; $0.06-0.08 two-pass | est. 10-25 s | same as A |
| C. Lowest engineering: gpt-image-2 low or klein for the image, Recraft vectorize API for tracing | $0.006-0.02 | $0.005 | $0.01 | about $0.02-0.035 | est. 10-25 s | unknown, likely larger than tuned VTracer; needs palette snapping and path budget enforced afterwards |

- Versus today: cost falls from $0.10-0.30 to about $0.02-0.05 (single pass), and time from 20-90 s to an estimated 5-25 s. File size goes the wrong way: 10-30 KB of clean primitives becomes 25-150 KB of traced paths unless simplification is aggressive or pictures are compressed in storage.
- Pipeline A needs a server-side function (WASM VTracer in a Next.js route is feasible; autotrace needs a native binary or a WASM port) and a trained flat-style LoRA; it is the cheapest to run and the most work to build.
- "Better looking" is not guaranteed. Diffusion composition and character appeal are usually stronger than LLM-drawn primitives, but tracing loses the clean primitive geometry, the semantic layer order and exact character re-use, and the result then passes through filters tuned for hand-placed shapes.
- Child safety: the app generates cartoon children from a drawn reference, not photos, which avoids the most heavily filtered path (photoreal minors, uploaded child photos). Even so, Google models are the most likely to produce intermittent silent failures; the pipeline needs to check for empty responses, retry, and fall back to another provider. Open-weight models hosted on fal or Cloudflare (klein, Z-Image, Qwen) are likely the least restrictive for benign child characters, which shifts responsibility for output safety onto the app.
- Failed or off-model generations (wrong character, text artefacts, extra limbs) need a retry budget; a 10-20% regeneration rate would add the same percentage to cost, still far below today's price.

### Gaps
- End-to-end latency is entirely estimated; no measured timings were found for any step except Roboflow's 251 ms SAM 3 figure.
- OpenAI, BFL, ByteDance (Seedream) and Alibaba (Qwen) child-related filter behaviour for benign cartoon children was not documented in any source found; the only OpenAI source was a third-party blog about sexual content.
- Whether Google offers an allowlist route for legitimate children's products was suggested by its documentation categories but not confirmed.
- Real SVG sizes for genuine diffusion illustrations in this style were not measured; a 20-image trial with the app's own prompts is the missing evidence.
- Prices for input reference images on Google and OpenAI models (which the October 2026 Google change reportedly tripled) were not retrieved, so pipeline B's total may be a cent or two higher.
