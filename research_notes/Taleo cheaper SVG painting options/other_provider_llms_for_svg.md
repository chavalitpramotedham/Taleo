# Non-Anthropic general-purpose LLMs for writing illustrative SVG at lower cost (checked 12 Nov 2026)

**Read this first: how far to trust these notes.** Every figure below was checked on 12 Nov 2026, but only through web-search result summaries. Direct page fetches were blocked in the research session (ai.google.dev, developers.openai.com, simonwillison.net, modelgrep.com, svgbench.luke.lol and benchlm.ai all failed to resolve), so **no official pricing page, leaderboard page or blog post was read in full**. Where a search summary attributes a number to a primary page (Google pricing page, Design Arena live board, Simon Willison's static grid pages, Artificial Analysis) I say so; otherwise the source is a third-party aggregator. Model naming in the sources is inconsistent (Gemini 3.5 / 3.6 / 3.7 / 3.8 Flash; "GPT-5.6 Luna" vs "GPT-6 Luna"), which suggests fast release cadence and stale pages. Treat every price as "verify on the vendor page before committing".

Baseline for comparison (from the assignment, not re-verified): Claude Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 per million tokens in/out; about $0.25 (Opus) and $0.12 (Sonnet) per picture at 6k input + 12k output.

## 1. What are the current flagship, mid and cheap models and prices from each non-Anthropic provider?

### Takeaway
The cheap end has collapsed in price: OpenAI's GPT-6 Luna is reported at $0.10/$0.50 (same as Haiku 5.5), DeepSeek V4.1 Flash at $0.15-0.30/$0.60-1.20, and open-weight gpt-oss-120b at $0.15/$0.60 on Groq. Google's Flash tier is no longer cheap ($0.75/$3.75 introductory for Gemini 3.8 Flash, apparently doubling on 1 Jan 2027), and most flagships (Gemini 4 Argon, GPT-6 Sol, Kimi K3.1 Pro) sit at or above Sonnet 5.5's $2/$10.

### Cited Findings

Prices are USD per million tokens, input / cached input / output, standard tier.

**Google**
- Gemini 4 Argon (flagship): $2 / $0.10 cached / $10 through 30 Nov 2026, rising to $4/$20 from 1 Dec 2026. A third-party guide says it checked Google's page on 25 Oct 2026; the Vertex page summary shows the $2.00 input and $0.10 cached input figures — [Morph Gemini pricing](https://www.morphllm.com/gemini-api-pricing); [Google Cloud Vertex pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- Gemini 3.8 Flash: introductory $0.75 input / $3.75 output through 31 Dec 2026; the Google Cloud table's 2027 rates show $1.50 input and $0.15 cached input, and the developer page shows priority-tier prices doubling on 1 Jan 2027 ($6.75 to $13.50 output, "includes thinking tokens") — [Google Cloud agent platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing); [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Older Flash generations were dearer: Gemini 3.5 Flash launched at $1.50/$9 (Simon Willison titled his post "more expensive, but Google plan to use it for everything") — [Simon Willison, 19 May 2026](https://simonwillison.net/2026/May/19/gemini-35-flash/)
- Gemini 3.1 Pro: $2/$12 up to 200k context, $4/$18 above — [Morph Gemini pricing](https://www.morphllm.com/gemini-api-pricing)
- Gemini 3.5 Flash-Lite: most sources $0.30 / $0.03 cached / $2.50, max output 65,536 tokens, 1,048,576 context; one aggregator shows $0.15/$1.25 instead — [OpenRouter Gemini 3.5 Flash Lite](https://openrouter.ai/google/gemini-3.5-flash-lite-20260721); conflicting figure at [cloudprice.net](https://cloudprice.net/models/google-gemini-flash-lite)
- Gemini 3.1 Flash-Lite $0.25/$1.50 and Gemini 2.5 Flash-Lite $0.10/$0.40 are cited as older floor options; Gemini 2.5 Flash was scheduled for deprecation on 16 Oct 2026 — [Morph Gemini pricing](https://www.morphllm.com/gemini-api-pricing)
- No text model called "Gemini 3.8 Flash-Lite" was found; only a 3.8 Flash-Lite TTS model — [OpenRouter](https://openrouter.ai/google/gemini-3.8-flash-lite-tts)

**OpenAI**
- GPT-6 Sol and Luna launched 22 Sep 2026. Sol: $2 / $0.20 cached / $10. Luna: $0.10 / $0.01 cached / $0.50. Above 272k input the whole request is billed at 2x input and 1.5x output. All sources are third-party blogs — [Requesty](https://www.requesty.ai/blog/gpt-6-sol-luna-pricing-release-api); [TechJack](https://techjacksolutions.com/ai-tools/chatgpt/gpt-6-sol-and-luna-pricing-and-api/)
- Conflict: one of Simon Willison's grid pages lists Luna at $0.10/$0.50, another at $0.20/$1.20 (possibly a different Luna generation) — [static.simonwillison.net grid](https://static.simonwillison.net/static/2026/gpt-6-and-5.6-pelicans.html); [October grid](https://static.simonwillison.net/static/2026/openai-pelicans-october-2026.html)
- GPT-6 Astra is the top tier; one max-effort pelican cost 63.21 cents for 12,638 output tokens (implies roughly $50 per million output) — [static.simonwillison.net grid](https://static.simonwillison.net/static/2026/gpt-6-and-5.6-pelicans.html)
- Previous generation (July 2026): GPT-5.6 Sol $5/$30, Terra $2.50/$15, Luna $1/$6; GPT-5.4 mini $0.75/$4.50, GPT-5.4 nano $0.20/$1.25. GPT-5 / 5-mini / 5-nano are reported as no longer on OpenAI's price page — [Morph OpenAI pricing](https://morphllm.com/openai-api-pricing); [BenchLM](https://benchlm.ai/openai/api-pricing)

**xAI**
- Grok 4.7 (released 21 Sep 2026): $2 / $0.50 cached / $6, 500k context; whole request doubles to $4/$1/$12 at 200k+ prompt tokens. Value tier: Grok 4.3 and 4.20 at $1.25/$2.50. Grok 4.1 Fast ($0.20/$0.50) appears only in older tables — [nOps](https://www.nops.io/blog/grok-api-pricing/); [Puter, Sep 2026](https://developer.puter.com/tutorials/grok-api-pricing/)

**DeepSeek**
- DeepSeek V4.1 Flash: off-peak $0.15 input (cache miss) / $0.003 cache hit / $0.60 output; peak roughly double ($0.30/$1.20). V4 Pro: about $0.66/$1.98 off-peak, $1.32/$3.96 peak — [aipricing.guru](https://www.aipricing.guru/deepseek-pricing/); [Mercatus](https://www.mercatus-ai.com/blog/deepseek-api-pricing)

**Moonshot (Kimi)**
- Kimi K3: $3 / $0.30 cached / $15. Newer Kimi K3.1 Pro: $2 / $0.20 / $10; a Highspeed variant costs 2x and runs 2-3x faster. One aggregator shows K3 at $1.70/$8.50 — [Mercatus](https://www.mercatus-ai.com/blog/kimi-k3-api-pricing); [BenchLM Kimi, Nov 2026](https://benchlm.ai/moonshot/api-pricing); conflicting [pricepertoken](https://pricepertoken.com/pricing-page/model/moonshotai-kimi-k3)

**Zhipu / Z.ai (GLM)**
- GLM 5 Turbo listed at $1.90 (OpenRouter price shown on a leaderboard mirror, checked 1 Oct 2026; unclear whether input, output or blended) — [navid.me](https://navid.me/ai-models/svg)

**Fast inference hosts (open-weight models)**
- Cerebras public rate card (Oct 2026) lists only gpt-oss-120b at $0.35/$0.75 and Qwen 3.8 27B at $0.99/$1.49. GLM-4.7 left the card on 17 Aug 2026; Kimi, GLM, Llama, Gemma, Mistral and DeepSeek are available only through Dedicated Inference — [Morph Cerebras pricing](https://www.morphllm.com/cerebras-pricing)
- Groq (late Oct 2026): gpt-oss-120b $0.15/$0.60, gpt-oss-20b $0.075/$0.30, Qwen 3.8 27B $0.80/$4.00 (preview, "may be discontinued at short notice"); batch 50% off. Llama 3.1 8B, Llama 3.3 70B and MiniMax M2.7 are now "Contact Sales" — [Morph Groq pricing](https://www.morphllm.com/groq-pricing); [Glamdring, Sep 2026](https://www.glamdringresearch.com/post/groq-api-pricing)
- Fireworks, Together and DeepInfra serve Kimi K3 and GLM-5.3; Fireworks' US-hosted endpoints cost 50% more than default — [BenchLM hosts](https://benchlm.ai/hosts)
- Kimi K3 on OpenRouter hosts: roughly $11-13.50 output — [OpenRouter Kimi K3](https://openrouter.ai/moonshotai/kimi-k3)

### Inferences
- Only three price bands are meaningfully below Sonnet 5.5 on output: (a) about $0.50-1.20: GPT-6 Luna, DeepSeek V4.1 Flash, gpt-oss on Groq/Cerebras; (b) about $2.50-4: Gemini 3.5 Flash-Lite, Gemini 3.8 Flash (until 31 Dec 2026), DeepSeek V4 Pro; (c) $6: Grok 4.7. Gemini 4 Argon, GPT-6 Sol and Kimi K3.1 Pro are price-equal to Sonnet 5.5, and Kimi K3 is dearer.
- Gemini 3.8 Flash's saving is time-limited: if standard output follows the priority tier and doubles to about $7.50 on 1 Jan 2027, it will be only 25% below Sonnet 5.5.

### Gaps
- No official vendor pricing page was read directly (fetch blocked). Highest priority to re-verify: Gemini 3.8 Flash standard output price after 1 Jan 2027, and which GPT-6 Luna price ($0.10/$0.50 vs $0.20/$1.20) is current.
- No prices found for Alibaba Qwen 3.7 Max/Plus/Flash on Model Studio, Z.ai GLM-5.3 first-party, MiniMax M3, or any current Mistral or Meta Llama model. Searches returned nothing usable.
- SambaNova, Together, Fireworks and DeepInfra per-model prices were not retrieved.

## 2. Which of them are demonstrably good at drawing SVG?

### Takeaway
On the main human-preference board (Design Arena SVG), the best general LLMs cluster tightly: GPT-6 Astra about 1410-1430, then Gemini 4 Argon, Claude Opus 5.5, Kimi K3 and GPT-6 Sol all around 1315-1330, with **Gemini 3.8 Flash at about 1293** the only sub-Sonnet-priced model near that group. The very cheap models are measurably weaker: DeepSeek V4.1 Flash ranks about 48th (1198), and GPT-6 Luna is described by Simon Willison only as "competent-ish".

### Cited Findings
- Design Arena SVG board, official snapshot updated 31 Oct 2026 (per search summary): Arrow 2 Telos #1 at 1611 (a dedicated SVG model, not a general LLM), GPT-6 Astra (xhigh) #2 at 1410, Kimi K3 #6 at 1322, Gemini 3.7 Flash #24 at 1265, GLM 5.1 #33 at 1239, DeepSeek-V4.1-Flash #48 at 1198 — [Design Arena SVG](https://www.designarena.ai/leaderboard/svgs)
- A different snapshot of the same live page: Arrow 2 Telos 1529, GPT-6 Astra (xhigh) 1426, Arrow 2 1379, Gemini 4 Argon #5 at 1329; Qwen3.7 Plus 1181 and MiniMax M3 1165 in a sub-list. Elo is Bradley-Terry starting at 1200 — [Design Arena SVG](https://www.designarena.ai/leaderboard/svgs)
- Aggregator (Oct-Nov 2026): GPT-6 Astra 1429, Claude Opus 5.5 1328, GPT-6 Sol 1315; Google sub-board has Gemini 4 Argon 1327 and Gemini 3.8 Flash 1293 — [modelgrep SVG](https://modelgrep.com/best/svg); [modelgrep Google](https://modelgrep.com/best/svg/google)
- Another mirror (79 models, checked 1 Oct 2026): Kimi K3 #6 (1,300, 59.4% win rate), Gemini 3.8 Flash #8 (1,295), GLM 5 Turbo #23 (1,205, 55.0%), Claude Sonnet 4.6 #24 (1,195) — [navid.me](https://navid.me/ai-models/svg)
- Other snapshots: Grok 4.6 at 1268, Qwen3.7 Max at 1256; Kimi K3.1 Pro 1330 (4 Nov) — [The Aggregate](https://theaggregate.ai/benchmark?slug=design-arena-svg)
- Design Arena says Arrow 2 models give "a level of detail unmatched by any frontier model" on logos, stickers, faces, animals, people and clipart — [Design Arena on X](https://x.com/DesignArena/status/2104633448824803504)
- Rapidata's human-preference SVG benchmark places kimi-k3 and gemini-3.7-flash in its top ten and deepseek-v4-pro-thinking near the bottom — [Rapidata svg-benchmark](https://huggingface.co/datasets/Rapidata/svg-benchmark)
- Simon Willison: Gemini "has a track record of producing great SVGs"; Gemini 3.1 Pro produced "an excellent pelican" but took over 5 minutes on launch day; Gemini 3.5 Flash used 14,403 output tokens (just under 13 cents) for one pelican — [Simon Willison, Gemini 3.5 Flash](https://simonwillison.net/2026/May/19/gemini-35-flash/); [X post](https://x.com/simonw/status/2024544280451350689)
- Simon Willison on Luna: "GPT-6 Luna for 0.4 cents will draw you a competent-ish pelican riding a bicycle". Grid: Luna xhigh 7,900 output tokens for 0.40 cents; max 18,190 tokens for 0.91 cents; low 1,640 tokens for 0.08 cents — [static.simonwillison.net grid](https://static.simonwillison.net/static/2026/gpt-6-and-5.6-pelicans.html)
- A reported Gemini 4 Argon (High) illustration cost Simon Willison 17.166 cents (attribution to Argon not fully clear in the summary) — [pelican tag page](https://simonwillison.net/tags/pelican-riding-a-bicycle/)
- Playcode 34-model MacBook + pelican SVG benchmark: Claude Opus 5.5 (max) first, "zero errors"; GPT-6 Astra third at $2.29 per drawing; GPT-6 Luna "the most interesting cheap option", drawing a recognisable MacBook for under two cents, but its high-effort version "ships without a keyboard"; Gemini 3 Flash about $0.004-0.005 per drawing — [Playcode](https://playcode.io/blog/macbook-svg-benchmark)
- Older tool review: Claude top on SVGBench at 75.6% with GPT-5.2 at 74.4% ("simple icons pass and complex scenes break") — [SVG Genie](https://www.svggenie.com/blog/ai-svg-generator-comparison-2025)

### Inferences
- The Gemini reputation holds, and current evidence covers both tiers: Argon/Pro at roughly Opus 5.5 level, Flash (3.7/3.8) about 35-60 Elo lower. A 35-point Elo gap implies Gemini 3.8 Flash would win roughly 45% of blind pairings against Opus 5.5, i.e. close but perceptibly behind.
- Kimi K3 is the strongest open-weight SVG drawer, but it is priced above Sonnet 5.5 and is slow (see section 4), so it does not help on cost.
- The under-$1.20-output models (DeepSeek V4.1 Flash 1198, MiniMax M3 1165, Qwen3.7 Plus 1181) sit 100-130 Elo below the Opus cluster, roughly a 35% win rate. Since the app already found Haiku 5.5 "plainer", these are likely to disappoint in the same way.
- All of this evidence is single-shot prompt-to-SVG (logos, icons, simple illustrations, pelicans). None tests the app's actual task: 150-300 elements, layer classes, a 4,500-token art-direction prompt and exact matching of a reference character SVG. Reference-matching is closer to SVG editing/instruction-following than to free drawing, so arena rank is only a shortlist filter.
- Leaderboard snapshots disagree by tens of Elo points for the same model, so differences under about 30 points should be treated as noise.

### Gaps
- No Design Arena SVG scores were found for Claude Sonnet 5.5, Claude Haiku 5.5 or GPT-6 Luna, so the candidates cannot be placed directly against the app's current scenery model.
- Simon Willison's posts could not be read; his verdicts on Gemini 4 Argon, Gemini 3.8 Flash, Kimi K3.1 (23 Oct 2026 post) and Grok 4.7 are unknown.
- No results retrieved from svgbench.ai, SVGenius, UniSVG, SGP-Bench, VGBench, StarVector SVG-Bench or the Kaggle "Drawing with LLMs" competition for current-generation models.
- No SVG evidence at all for gpt-oss-120b, Qwen 3.8 27B, Grok 4.7, Mistral or Llama/Gemma models.
- A post titled "Are AI labs pelicanmaxxing?" exists ([dylancastillo.co](https://dylancastillo.co/posts/pelicanmaxxing.html)) but was not read; whether labs tune for the pelican test is unresolved.

## 3. What would one 400x300 picture cost on the most promising cheap candidates?

### Takeaway
At 6k input + 12k output, Gemini 3.8 Flash costs about $0.05 per picture today (about $0.10 if its price doubles in January 2027), Gemini 3.5 Flash-Lite about $0.03, and GPT-6 Luna or DeepSeek V4.1 Flash under $0.02 — against $0.25 on Opus 5.5 and $0.12 on Sonnet 5.5. Reasoning tokens can multiply these figures several-fold.

### Cited Findings
Arithmetic below is mine, using list prices cited in section 1 and treating all 6k input tokens as uncached (an upper bound; input is under 10% of cost in every row).

| Model | Price in/out per M | Output 12k | Input 6k | Per picture | vs Opus 5.5 ($0.25) |
|---|---|---|---|---|---|
| GPT-6 Luna | $0.10 / $0.50 | $0.006 | $0.0006 | ~$0.007 | ~3% |
| GPT-6 Luna (alt. price) | $0.20 / $1.20 | $0.014 | $0.001 | ~$0.016 | ~6% |
| gpt-oss-120b on Groq | $0.15 / $0.60 | $0.007 | $0.001 | ~$0.008 | ~3% |
| DeepSeek V4.1 Flash (peak) | $0.30 / $1.20 | $0.014 | $0.002 | ~$0.016 | ~6% |
| Gemini 3.5 Flash-Lite | $0.30 / $2.50 | $0.030 | $0.002 | ~$0.032 | ~13% |
| Gemini 3.8 Flash (to 31 Dec 2026) | $0.75 / $3.75 | $0.045 | $0.005 | ~$0.05 | ~20% |
| Gemini 3.8 Flash (2027, if doubled) | $1.50 / $7.50 | $0.090 | $0.009 | ~$0.10 | ~40% |
| DeepSeek V4 Pro (peak) | $1.32 / $3.96 | $0.048 | $0.008 | ~$0.055 | ~22% |
| Grok 4.7 | $2 / $6 | $0.072 | $0.012 | ~$0.084 | ~34% |
| Gemini 4 Argon (to 30 Nov / after) | $2 / $10, then $4 / $20 | $0.12 / $0.24 | $0.012 / $0.024 | ~$0.13 / ~$0.26 | 52% / 105% |
| GPT-6 Sol, Kimi K3.1 Pro | $2 / $10 | $0.12 | $0.012 | ~$0.13 | ~52% |

- Reasoning overhead is real and large: the same pelican prompt on GPT-6 Luna used 1,640 output tokens at low effort, 7,900 at xhigh and 18,190 at max — an 11x spread in billed output — [static.simonwillison.net grid](https://static.simonwillison.net/static/2026/gpt-6-and-5.6-pelicans.html)
- Simon Willison's grid spans 1.57 to 63.21 cents for one pelican depending on model and effort — [aiweekly summary](https://aiweekly.co/alerts/willison-benchmarks-gpt-6-astra-pelicans-vs-gpt-56-tiers)
- Google's price page states Flash output prices "include thinking tokens" — [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.5 Flash spent 14,403 output tokens on a single simple pelican, suggesting substantial thinking by default — [Simon Willison](https://simonwillison.net/2026/May/19/gemini-35-flash/)

### Inferences
- If a model thinks for as many tokens as it draws, double the "per picture" column. Even then Gemini 3.8 Flash (about $0.10 this year) stays under Sonnet 5.5, and Luna stays under 2 cents.
- The best cost/quality bet is Gemini 3.8 Flash for scenery (replacing Sonnet 5.5: about 60% saving now, about 20-25% after January if the price doubles and thinking is kept low). Replacing Opus 5.5 on characters with it would save about 80% now, but character fidelity is unproven.
- GPT-6 Luna is the "nearly free" option (about 97% saving) but is priced identically to Haiku 5.5, which the app already judged plainer; it is only worth testing if high reasoning effort lifts quality, which Willison's and Playcode's remarks ("competent-ish", "ships without a keyboard") do not strongly support.
- Gemini 4 Argon offers no saving after 1 Dec 2026 (it matches Opus 5.5 at $4/$20).

### Gaps
- Actual thinking-token counts for a 12k-token SVG scene on each candidate are unknown; only a pilot run will tell.
- Cache-write/storage charges were not confirmed for any provider (Google lists a storage price for explicit context caching; details not retrieved).

## 4. Are there very fast hosts serving a model that draws SVG acceptably?

### Takeaway
No. The 1,500-3,000 tokens/sec hosts (Cerebras, Groq) now publicly serve only gpt-oss and a small Qwen 3.8 27B, for which no SVG quality evidence was found. The fastest model with proven SVG skill is Gemini 3.8 Flash at about 305 tokens/sec.

### Cited Findings
- Gemini 3.8 Flash (high): median about 305.5 tokens/sec on Artificial Analysis; GPT-5.6 Luna (max) about 128.4 tokens/sec — [Artificial Analysis comparison](https://artificialanalysis.ai/models/comparisons/gemini-3-6-flash-vs-kimi-k3)
- Gemini 3.6 Flash: 303.6 tokens/sec, first in class, but time to first token at high thinking effort is 11.54 seconds — [reapi.ai](https://reapi.ai/blog/how-to-use-gemini-3-6-flash)
- Gemini 3.5 Flash-Lite: about 350 tokens/sec (third-party review) — [fast.io](https://fast.io/resources/fastest-ai-2026/)
- Kimi K3: 35-64 tokens/sec on Moonshot's API, 75-88 on OpenRouter hosts; time to first answer token 36-82 seconds at max reasoning on Artificial Analysis — [Artificial Analysis Kimi K3](https://artificialanalysis.ai/models/kimi-k3); [OpenRouter](https://openrouter.ai/moonshotai/kimi-k3)
- Cerebras claims about 3,000 tokens/sec for gpt-oss-120b and 1,500-1,850 for Qwen 3.8 27B (vendor figures; sources conflict on Qwen) — [Morph Cerebras pricing](https://www.morphllm.com/cerebras-pricing)
- Groq lists 450-1,000 tokens/sec depending on model, about 500 for gpt-oss-120b — [BenchLM hosts](https://benchlm.ai/hosts)
- Cerebras reported 981 tokens/sec on Kimi K2.6 in May 2026 (company claim), but Kimi is now Dedicated Inference only — [beri.net](https://www.beri.net/article/2026-05-31-cerebras-981-tokens-kimi-k2-6-gpu-inference-economics); [Morph Cerebras pricing](https://www.morphllm.com/cerebras-pricing)

### Inferences
- Time to paint a 12k-token picture (my arithmetic): Gemini 3.8 Flash about 40 s, Gemini Flash-Lite about 35 s, Luna about 95 s, Kimi K3 2.5-5 minutes, gpt-oss-120b on Cerebras about 4 s. Thinking adds a silent delay before the first stroke (11 s reported for Flash at high effort), which matters for a "watch it paint" experience; low/minimal thinking should be tested.
- A Kimi K3 on Cerebras Dedicated Inference would be the one fast + SVG-capable combination, but it needs a capacity contract, not pay-per-token.
- gpt-oss-120b on Cerebras/Groq is cheap and near-instant, so it is worth a 10-picture sanity test, but expect Haiku-or-worse drawing.

### Gaps
- No speed or time-to-first-token figures found for GPT-6 Luna (only GPT-5.6 Luna), GPT-6 Sol, Gemini 4 Argon, Grok 4.7 or DeepSeek V4.1 Flash.
- Output speed for Claude Opus 5.5 / Sonnet 5.5 was not looked up, so relative speed-up is not quantified.
- SambaNova's current catalogue was not retrieved.

## 5. Reliability concerns for a children's product

### Takeaway
Gemini's main risk is safety-filter blocks that can fire on benign prompts or on the output itself; DeepSeek's is data jurisdiction and absent retention guarantees; cheap hosts' is catalogue churn. Little hard evidence was found on truncation, prose/code-fence habits or rate limits.

### Cited Findings
- Gemini can withhold a response even when the prompt was benign, because the output trips the filter. Prompt blocks appear in `promptFeedback.blockReason`, output blocks in `candidates[].finishReason`; only `SAFETY` responds to threshold settings, while `PROHIBITED_CONTENT` and `BLOCKLIST` do not — [krater.ai](https://krater.ai/troubleshoot/gemini/response-blocked-safety); [yingtu.ai](https://yingtu.ai/en/blog/gemini-api-safety-settings-request-blocked)
- A 2026 Google forum thread reports a possible false positive returning HTTP 200 with `finishReason IMAGE_SAFETY` and no ratings (image model, not text) — [Google AI forum](https://discuss.ai.google.dev/t/possible-false-positive-image-safety-on-an-image-edit-gemini-api-gemini-nano-banana-2-1/195094)
- Gemini 3.1 Pro took over 5 minutes and returned capacity errors on launch day — [Simon Willison on X](https://x.com/simonw/status/2024544280451350689)
- Gemini Flash-Lite max output is 65,536 tokens, comfortably above the 20k needed — [OpenRouter](https://openrouter.ai/google/gemini-3.5-flash-lite-20260721)
- DeepSeek API terms are governed by mainland PRC law; no fixed retention period, no published zero-data-retention tier, no API-specific opt-out or DPA found; sources disagree on whether API data is used for training and on whether the current policy still names China as the storage location — [meetily.ai](https://meetily.ai/llm-privacy/deepseek); [unseensecurity.ai](https://www.unseensecurity.ai/ai-services/deepseek); [tokenmix](https://tokenmix.ai/blog/deepseek-api-is-it-safe)
- Groq warns preview models (e.g. Qwen 3.8 27B) "may be discontinued at short notice"; Cerebras dropped GLM-4.7 from its public card in Aug 2026 — [Morph Groq pricing](https://www.morphllm.com/groq-pricing); [Morph Cerebras pricing](https://www.morphllm.com/cerebras-pricing)
- Google prices change on fixed dates (Argon 1 Dec 2026, Flash 1 Jan 2027) and older Gemini models are retired on a schedule — [Morph Gemini pricing](https://www.morphllm.com/gemini-api-pricing)

### Inferences
- For a children's app, the prompt content (animals, children in storybook scenes) is benign, but descriptions of child characters' bodies/poses are exactly the kind of text that could trip a provider's child-safety classifier; a non-adjustable block on a page illustration would need a fallback model. Build fallback to Claude regardless of the provider chosen.
- Any switch requires re-tuning the 4,500-token art-direction prompt; models differ in obedience to "SVG only, no prose, no fences", so keep the output parser tolerant (strip fences, cut at `</svg>`).
- Model/price churn outside Anthropic is high (three Flash versions in about five months by the sources' naming), so pin dated model IDs and budget for re-evaluation.
- DeepSeek first-party is hard to justify for a children's product on data terms; open-weight models via US/EU hosts avoid that.

### Gaps
- Nothing found on whether thinking can be fully disabled on Gemini 3.8 Flash / Flash-Lite / Argon, GPT-6 Luna (e.g. effort "none"), Grok 4.7 or Kimi K3. Willison's grid shows Luna effort levels from low to max, implying it is adjustable; "off" is unconfirmed.
- No evidence found on long-output truncation, prose/code-fence tendencies, rate limits, or streaming quirks for any candidate. Streaming and prompt caching are assumed standard (cached-input prices are published for Google, OpenAI, xAI, DeepSeek and Moonshot, per section 1) but were not confirmed from documentation.
- Data-retention / zero-retention terms for Google, OpenAI, xAI and the inference hosts were not researched.
- Gemini text-model false-positive rates on children's-story content: no data found.
