# Training our own specialised SVG painter (fine-tune / distillation) - feasibility, cost, legal position, as of 12 Nov 2026

Research-method note for the report writer. This session's network blocked most primary hosts (openai.com, ai.google.dev, docs.aws.amazon.com, fireworks.ai, arxiv.org, kaggle.com, and several third-party trackers). Only anthropic.com and support.claude.com could be read directly. Everything else below comes from web-search result summaries (snippets), and is labelled as such. Prices from third-party blogs conflict in several places; conflicts are shown, not resolved. Items I could only recall from background knowledge are confined to "Gaps" or "Inferences" and labelled "unverified". All cost arithmetic is mine (inference), using the cited unit prices.

## 1. Terms of service: may Claude / OpenAI / Gemini outputs be used to train our own painter? Does Anthropic offer Claude fine-tuning?

### Takeaway
On the texts read directly today, using stored Claude outputs as training targets for any model (open-weights or another vendor's) requires Anthropic's prior written authorisation: this is no longer only a "competing model" question, because the Usage Policy bans training on outputs outright and Anthropic's help article lists "Using Outputs as training targets for models" as prohibited. The "no ToS question" route of fine-tuning Claude Haiku itself appears to be effectively closed (Bedrock fine-tuning was only ever reported for Claude 3 Haiku, which is reported retired), so the clean routes are (a) get written permission from Anthropic, or (b) build the training set from a vendor whose own tuning product accepts its own outputs (e.g. Gemini outputs -> tuned Gemini Flash-Lite), or from licensed/open models.

### Cited Findings
Anthropic (read directly, 12 Nov 2026)
- Commercial Terms, section D.4 (Use Restrictions), verbatim in fragments: "Customer may not and must not attempt to (a) access the Services to build a competing product or service," / "including to train competing AI models or resell the Services except as expressly approved by Anthropic;" / "(b) reverse engineer or duplicate the Services; or (c) support any third party's attempt" / "at any of the conduct restricted in this sentence." Page shows "Effective: Jun 17, 2025". — [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
- Commercial Terms, section B: "Customer retains all rights to its Inputs, and (b) owns its Outputs." and "Subject to Customer's compliance with these Terms, Anthropic hereby assigns to Customer its right, title and interest (if any) in and to Outputs." (Ownership is conditional on compliance and does not by itself grant a right to train on outputs.) — [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
- Usage Policy (AUP), under "Do Not Abuse Our Platform", prohibits: "Use outputs to train an AI model (e.g., “model scraping” or “model distillation”) without prior authorization from Anthropic". The page as fetched shows an effective date of "Nov 12, 2026" (the same day as this research; confirm the date on the page, see Gaps). This clause has no "competing" qualifier. — [Anthropic Usage Policy](https://www.anthropic.com/legal/aup)
- Anthropic help article "Can I use my Outputs to train an AI model?" (dated March 16, 2026): "We prohibit customers from using our services to train or develop AI models without our written permission." and "Our Terms do not allow the use of Outputs to train models that are competitive with Anthropic's own." Permitted examples listed: "Sentiment analysis tools", "Content categorization systems", "Summarization tools", "Information extraction tools", "Semantic search tools", "Anomaly detection tools". Prohibited examples listed: "General purpose chatbots", "Models designed for open-ended text generation", "Using Outputs as training targets for models", "Reverse engineering training methods". The article names no contact or process for requesting permission. — [Claude Help Center](https://support.claude.com/en/articles/12326764-can-i-use-my-outputs-to-train-an-ai-model)
- The AUP also says products serving minors "must comply with the additional guidelines outlined in our Support article", and defines a minor as under 18. Relevant to the existing Claude-based app, independent of fine-tuning. — [Anthropic Usage Policy](https://www.anthropic.com/legal/aup)
- Secondary commentary: one legal/VC analysis says Anthropic has not said where everyday work on open models falls, and that the position is "less clear" for distillers whose outputs were obtained through authorised access; a practitioner guide stresses that output ownership, the provider's no-training promise, and the customer's right to train a student are separate provisions. — [Variant Fund, "License to Distill"](https://variant.fund/articles/license-distill-law-distillation-anthropic/); [Omid Saffari, model distillation](https://omidsaffari.com/blog/model-distillation)

Claude fine-tuning (search snippets only)
- Search results report that Bedrock fine-tuning of Anthropic models is supported only for Claude 3 Haiku, in US West (Oregon); nothing was found for Haiku 4.5 or Haiku 5.5. A fine-tuned Claude on Bedrock had to be hosted on Provisioned Throughput (hourly, not per-token). Claude 3 Haiku is reported as reaching end of life on Bedrock on 10 Sep 2026 in most Regions. Training price was not found in any fetched text. — [AWS Bedrock model card, Claude 3 Haiku](https://docs.aws.eu/bedrock/latest/userguide/model-card-anthropic-claude-3-haiku.html); [developersdigest Bedrock fine-tuning tracker](https://www.developersdigest.tech/models/fine-tuning/amazon-bedrock)
- For comparison, Haiku 4.5 on Bedrock is listed at $1.00 input / $5.00 output per 1M tokens (batch -50%); an aggregator lists "Haiku 5.5" (released 7 Oct 2026) at $0.10/1M input on Bedrock, which the search summary itself flags as unconfirmed. — [pecollective Bedrock pricing 2026](https://pecollective-com.pages.dev/tools/aws-bedrock-pricing/); [llmreference Haiku 5.5 on Bedrock](https://www.llmreference.com/model/claude-haiku-5-5/aws-bedrock)

OpenAI (primary site blocked; snippets)
- OpenAI's consumer Terms of Use (effective 1 Jan 2026) include the bullet "Use Output to develop models that compete with OpenAI." — [OpenAI Terms of Use](https://openai.com/terms/?popup=true)
- OpenAI's business/services terms carry the restriction to not "use Output to develop artificial intelligence models that compete with OpenAI's products and services", with a "Permitted Exception" wording captured July 2026 by a third-party tracker. A Carahsoft-hosted copy of an OpenAI services agreement states the carve-out: customers may build models that categorise, classify or organise data (e.g. embeddings or classifiers) provided those models are not distributed or sold, and may fine-tune models provided as part of the Services. — [conductatlas provision record](https://conductatlas.com/platform/openai/openai-business-terms/provision/CA-P-059973/prohibition-on-using-output-to-develop-competing-ai-models/); [Carahsoft copy of OpenAI agreement](https://carahsoft.com/buy/gsa-schedule-contracts/approved-csas/docFileDownload/286450/32504/54193839); [OpenAI Services Agreement PDF](https://cdn.openai.com/osa/openai-services-agreement.pdf)

Google (primary site blocked; snippets)
- Gemini API Additional Terms: prohibit using the Services to develop models that compete with the Services (examples given: Gemini API or Google AI Studio), and prohibit attempts to reverse engineer, extract or replicate any component of the Services, including underlying data or models (e.g. parameter weights). The restriction is present in archived versions from March and May 2024 and in the current preview version. — [Gemini API terms preview](https://ai.google.dev/gemini-api/terms_preview); [archived 20 Mar 2024 version](https://ai.google.dev/gemini-api/terms-archive/terms_03_20_24)

### Inferences
- Unambiguous for Anthropic: (1) training any model on Claude outputs without Anthropic's prior authorisation is against the Usage Policy as currently published; (2) the help article explicitly names "Using Outputs as training targets for models", which is exactly what a (brief -> SVG) distillation set is. So both asked variants, (a) an open-weights model you host and (b) another vendor's model, need written permission. This applies to the already-stored activity log too.
- Range of interpretation on "competing": narrow reading - an in-app painter that only emits one house style of 400x300 SVG is not a general model and does not compete with Claude (closest to the "permitted" spirit); broad reading - it is a generative model that replaces Claude API spend for exactly the task Claude was sold for, i.e. a substitute. Under the Commercial Terms alone (D.4) the narrow reading is arguable; under the AUP + help article the argument is moot because training on outputs is restricted regardless of competition. The permitted list is all analysis/classification-type models, none generative.
- OpenAI and Google restrict only "competing" models in the texts found; both also sell first-party distillation/tuning of their own small models on their own large models' outputs, which is the contractually clean path. A narrow SVG painter trained on Gemini or GPT outputs and hosted elsewhere sits in the same "is it competing?" grey zone and needs a lawyer or vendor answer.
- Practical consequence: the cheapest legally clean plan is probably "teacher = a model whose terms allow it" (e.g. regenerate the corpus with Gemini Pro and tune Flash-Lite on Vertex; or use an open-weights teacher), keeping the Claude log only as art briefs/inputs and as an evaluation reference, unless Anthropic grants permission. Whether art briefs written by Claude are themselves "outputs used to train" should be asked too.
- Ask Anthropic in writing (sales/support) for authorisation naming the exact use: narrow, single-style, in-app, not distributed. Not legal advice.

### Gaps
- The AUP effective date displayed as "Nov 12, 2026" equals today's date; the fetch tool may have mis-read it. Confirm the date and the version history on the page.
- OpenAI Services Agreement and Usage Policies could not be read directly (host blocked); the exact current wording and the definition of "Permitted Exception" need checking at openai.com/policies.
- Google Cloud Service Specific Terms (generative AI services section, governing Vertex AI) were not found; whether they contain a "competing models" restriction on Generated Output is unverified. Unverified recollection: Cloud terms have a similar clause barring use of the services to develop similar or competing products/models.
- No primary AWS page was readable to confirm whether any current Claude Haiku is tunable on Bedrock in Nov 2026, or its training/Provisioned Throughput prices.
- The Anthropic "additional guidelines" support article for products serving minors was not read.

## 2. Managed fine-tuning options and prices now; who offers serverless per-token LoRA inference with no idle cost; GPU prices and cold starts

### Takeaway
The two managed routes that combine tuning with true per-token, zero-idle serving are Vertex AI Gemini Flash-Lite tuning and (reported) Fireworks/Together LoRA-at-base-price serving, plus Amazon Nova custom models with on-demand inference; OpenAI fine-tuning is reported closed to new users and winding down. Almost all prices below are from third-party pages that disagree with one another and must be re-checked on the vendors' pricing pages.

### Cited Findings
OpenAI
- A third-party tracker reports OpenAI fine-tuning is closed to new users, with existing users able to create jobs until 6 Jan 2027; methods listed are SFT, DPO, RFT and vision SFT; gpt-4.1-2025-04-14 base shuts down 14 Jan 2027; gpt-4.1-nano fine-tunes were listed for removal on 23 Oct 2026. Single source, unverified against OpenAI. — [developersdigest OpenAI fine-tuning tracker](https://www.developersdigest.tech/models/fine-tuning/openai)
- Training price claims conflict: GPT-4.1 ~$3 vs $25 per 1M training tokens; GPT-4.1 mini ~$0.80 vs $5.00; GPT-4.1 nano $1.50; GPT-4o $25; one table lists GPT-5 SFT $125, GPT-5 mini $25, GPT-5 nano $12 per 1M; RFT $100/hour. Tuned inference is variously described as 1.5x base, or ~2x input / 1.5x output; one example gives tuned GPT-4.1 at ~$3 in / $12 out. — [pricepertoken fine-tuning](https://pricepertoken.com/fine-tuning); [aicostcheck](https://aicostcheck.com/blog/ai-fine-tuning-costs-2026); [tutorsbot comparison](https://tutorsbot.com/blog/llm-fine-tuning-cost-comparison-2026)

Google Vertex AI (now branded "Agent Platform" on the pricing URL)
- Google's pricing page (via search snippet) lists supervised tuning for Gemini 3.5 Flash-Lite and 3.1 Flash-Lite at $0.003 per 1,000 (implying ~$3 per 1M training tokens) and Gemini 2.5 Flash-Lite at $0.0015 per 1,000 (~$1.50 per 1M); a third-party tracker reports Gemini 3.5 Flash tuning at $0.01 per 1,000 training tokens (~$10 per 1M). Units need verification. — [Google Cloud Agent Platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing?hl=en); [developersdigest Google tuning tracker](https://www.developersdigest.tech/models/fine-tuning/google)
- Tuned inference: from Gemini 3 onward, tuned endpoints are reported to charge 1.5x the base model rate; tuned 2.5-and-earlier models charge base rates. — [developersdigest Google tuning tracker](https://www.developersdigest.tech/models/fine-tuning/google); [beri.net fine-tuning hosting costs](https://www.beri.net/article/fine-tuning-pricing-openai-azure-bedrock-vertex-hosting-fee-monthly-cost-2026)
- Base prices reported: Gemini 3.1 Flash-Lite $0.25 input / $1.50 output per 1M; Gemini 3.5 Flash-Lite $0.30 / $2.50 per 1M. — [cloudzero Vertex AI pricing 2026](https://www.cloudzero.com/blog/google-vertex-ai-pricing/)

Fireworks AI and Together AI
- Fireworks LoRA SFT: about $0.50 per 1M training tokens for models up to 16B, $3 for 16.1B-80B (one comparison says $6.00 for a 70B-100B tier), $10 for models over 300B; DPO costs 2x SFT. — [morphllm Fireworks vs Together](https://www.morphllm.com/comparisons/fireworks-vs-together); [activepieces Fireworks pricing 2026](https://www.activepieces.com/blog/fireworks-ai-pricing-models-gpus-billing-2026)
- Together LoRA: $0.48 per 1M tokens as starting price ($0.34 for an 8B/9B model in another source); $1.50 for 17B-69B and $2.90 for 70B-100B. — [maximem Fireworks vs Together 2026](https://www.maximem.ai/blog/fireworks-vs-together-ai-pricing-2026); [hokai guide](https://hokai.io/guides/fireworks-ai-vs-together-ai)
- Serving: Fireworks is reported to bill LoRA adapter inference at the base model's serverless per-token price with no separate loading or idle charge; one source says both Together and Fireworks serve fine-tuned models at base model prices. — [perkstack Fireworks vs Together](https://perkstack.co/blog/fireworks-vs-together); [maximem](https://www.maximem.ai/blog/fireworks-vs-together-ai-pricing-2026)
- Dedicated GPUs: Fireworks H100 reported at $8.00/hour vs Together $3.99 (another source: Together $5.49). — [shattered.io comparison](https://shattered.io/openrouter-pricing-vs-together-ai-vs-fireworks-ai-5-5-percent-fee-2026/)

Amazon Bedrock (Nova)
- AWS documentation (via search snippet) says on-demand, per-token inference is available for custom Nova Pro, Lite and Micro models customised after 16 Jul 2025 (PEFT only, not full-rank fine-tunes), and AWS's pricing page says custom Nova on-demand is priced the same as base Nova. Base rates reported: Nova Micro ~$0.035/$0.14, Nova Lite $0.06/$0.24, Nova Pro $0.80/$3.20 per 1M input/output. Bedrock also charges ~$1.95/month custom model storage. — [AWS Nova on-demand custom inference docs](https://docs.aws.amazon.com/nova/latest/userguide/custom-fine-tune-odi.html); [AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/); [cloudroute Nova pricing](https://www.cloudroutehq.com/aws-ai/amazon-nova-pricing)

Raw GPU (third-party listings, 2026)
- Modal (per-second, scale to zero): H100 $0.001097/s (~$3.95/h), A100 80GB $0.000694/s (~$2.50/h), L40S $0.000542/s (~$1.95/h); CPU and memory billed separately. — [markaicode Modal pricing](https://markaicode.com/pricing/modal-pricing/); [glamdring RunPod vs Modal Sept 2026](https://www.glamdringresearch.com/post/runpod-vs-modal)
- RunPod: H100 SXM $3.99/h and PCIe $2.89/h (Secure Cloud); A100 PCIe $1.19/h (Community Cloud); L40S $0.86-$1.09/h; serverless "flex" and "active" per-second tiers. — [spheron RunPod vs Lambda 2026](https://www.spheron.network/blog/runpod-vs-lambda-labs-2026/); [stork.ai RunPod alternatives](https://www.stork.ai/blog/runpod-alternatives-gpu-cloud-2026)
- Lambda: H100 SXM $3.99-$4.29/h, A100 ~$2.79/h, hourly VMs only; one source says Lambda deprecated its serverless offering in Sept 2025. — [premai serverless LLM deployment 2026](https://www.premai.io/blog/serverless-llm-deployment-runpod-vs-modal-vs-lambda-2026/)
- One editorial estimate: Modal is cheaper than a fixed-rate RunPod H100 pod below roughly 73% average utilisation. — [glamdring RunPod vs Modal](https://www.glamdringresearch.com/post/runpod-vs-modal)

### Inferences
- For bursty, low traffic the ranking by "no idle cost + no ops" is: tuned Gemini Flash-Lite (Vertex) and custom Nova on-demand (Bedrock) > Fireworks/Together serverless LoRA (if the chosen base model is on their serverless-LoRA list) > Modal/RunPod serverless GPU with scale-to-zero > any always-on dedicated endpoint.
- OpenAI should be treated as a dead end for a new project if the "closed to new users / shutting down Jan 2027" report is right.

### Gaps
- No verified data in this session for: Mistral (La Plateforme fine-tuning), Predibase, OpenPipe, Nebius, Baseten, Replicate, Hugging Face (AutoTrain / Inference Endpoints) pricing or status. Unverified recollection: Predibase was acquired by Rubrik and OpenPipe by CoreWeave in 2025, so their self-serve offers may have changed; check before considering them.
- Which exact base models Fireworks and Together serve as serverless LoRA in Nov 2026 was not verifiable (fireworks.ai blocked). Unverified recollection: both narrowed serverless-LoRA support during 2025 and push fine-tunes toward on-demand (hourly) deployments for many bases; this is the single most important thing to confirm on their docs.
- L4 and A10G hourly prices and measured cold-start times for vLLM with scale-to-zero were not returned by search. Unverified rule of thumb: container + weight load for a 8-14B model is tens of seconds to a few minutes; billed while loading.
- OpenAI current official fine-tuning prices and status not verified from openai.com.
- Nova's maximum output tokens (a 12k-token SVG must fit) was not checked.

## 3. Base model choice and evidence that small fine-tuned models reach frontier quality on text-to-SVG

### Takeaway
There is solid research evidence that 3B-8B models fine-tuned on millions of SVGs generate good icons/illustrations, but I found no public evidence of a small model distilled from a frontier model matching it on 150-300-element, 12k-token storybook scenes; and the 2025 Kaggle "Drawing with LLMs" winners did not use LLM code-writers at all (they used diffusion -> vectorise -> optimise). Sensible open-weights starting points in late 2026 are Apache-2.0 families: Gemma 4 (up to 31B), Qwen3-family small/mid models, Devstral/Mistral Small.

### Cited Findings
- Kaggle "Drawing with LLMs" (2025): 1st place used a Segmind Stable Diffusion 1B model plus an "OCR decoy" strategy; 3rd place used Flux -> vtracer -> differentiable SVG optimisation; 10th used Flux-1-Dev + HyperSD + Nunchaku -> vtracer + svgo + custom geometry simplification with VQA/aesthetic/OCR selection; 8th fine-tuned an SDXL model on the best images from 16 earlier runs. None of the write-ups found describes a fine-tuned LLM writing SVG directly; a Gemma 2 starter notebook existed. — [Kaggle blog on the competition](https://www.kaggle.com/blog/first-packages-competition-drawing-with-llms-draws); [3rd place write-up](https://www.kaggle.com/competitions/drawing-with-llms/discussion/581024); [10th place](https://kaggle.com/competitions/drawing-with-llms/discussion/581213); [8th place](https://www.kaggle.com/c/drawing-with-llms/discussion/581095); [Rist 6th-place slides](https://speakerdeck.com/rist/drawing-with-llms)
- OmniSVG (NeurIPS 2025): built on Qwen2.5-VL (3B and 7B variants) with an added SVG tokenizer that parameterises SVG commands and coordinates into discrete tokens (~40k SVG vocabulary on top of ~150k text vocabulary); trained on MMSVG-2M (~2M SVGs: about 1M icons, 0.5M illustrations, plus anime characters); the paper reports Qwen2.5-VL outperformed alternative backbones on all metrics. — [OmniSVG arXiv 2504.06263](https://arxiv.org/html/2504.06263v3); [NeurIPS paper PDF](https://papers.nips.cc/paper_files/paper/2025/file/a510f05a574d4203ef3952973672fe2f-Paper-Conference.pdf)
- DuetSVG (CVPR 2026): fine-tunes VLMs including Qwen3-VL-8B on ~5M examples (SVG-Hub-5M), treating SVG as ordinary text tokens; notes earlier LLM-based approaches trained on relatively small datasets. — [DuetSVG, CVPR 2026](https://openaccess.thecvf.com/content/CVPR2026/papers/Zhang_DuetSVG_Unified_Multimodal_SVG_Generation_with_Internal_Visual_Guidance_CVPR_2026_paper.pdf)
- StarVector was published at CVPR 2025 (image/text -> SVG code); LLM4SVG is arXiv 2412.11102 "Empowering LLMs to Understand and Generate Complex Vector Graphics". — [LLM4SVG arXiv](https://arxiv.org/pdf/2412.11102)
- 2026 work on RL / visual feedback for SVG generation exists (titles only seen in search results, not read): GeoSVG-RL (geometry-aware RL for layout-constrained text-to-SVG diagrams), CANVAS (long-context text-to-SVG with visual adaptive sampling), GVR-Coder (visual-feedback framework for structured SVG). — [GeoSVG-RL](https://arxiv.org/pdf/2605.25447); [CANVAS](https://arxiv.org/pdf/2608.30689); [GVR-Coder](https://arxiv.org/pdf/2607.28073)
- Open-weights candidates: Gemma 4 (April 2026) spans five sizes from "E2B" to a 31B dense model, reported as Apache 2.0; Qwen3 models reported Apache 2.0 at sizes 1.7B-235B, with a "Qwen3.8-27B" mentioned (licence unconfirmed); Qwen3 Coder's open release is 480B-A35B (too large); Devstral Small 2505 is 24B, Apache-2.0; Mistral Small 4 is listed as 119B total / 6.5B active. Roundups name DeepSeek V4.x, GLM-5.x and Kimi K2.6 as leading large open models, unconfirmed. — [Hugging Face blog, open models to run locally 2026](https://huggingface.co/blog/daya-shankar/open-source-llm-models-to-run-locally); [awesome-open-weight-models](https://github.com/phlx0/awesome-open-weight-models); [kingy.ai shortlist](https://kingy.ai/news/best-open-weight-ai-models-in-2026-glm-5-2-vs-deepseek-v4-vs-kimi-k2-6-vs-qwen-vs-mistral/)

### Inferences
- The research recipes (OmniSVG, DuetSVG, StarVector) use 2M-5M training SVGs and custom tokenisers; that is a different regime from "2k-10k distilled examples + LoRA on a general model". The app's case is easier in one respect (one fixed style, fixed palette, fixed layer structure) and harder in another (long outputs of 6k-20k tokens with scene composition and character likeness, far beyond typical icon datasets).
- The Kaggle result is weak evidence against "small LLM writes SVG better than alternatives" under a quality metric: the winners all bypassed LLM code generation. It supports the other researchers' raster-then-vectorise lane more than this one.
- Base model choice should be driven first by where it can be served serverlessly (see section 2), second by licence (Apache 2.0), third by long-output coding ability. A Qwen-family or Gemma 4 model in the 8B-31B range is the reasonable default; a Qwen-VL / Gemma multimodal variant additionally allows conditioning on a rendered character reference image rather than only its SVG text.

### Gaps
- No 2026 paper or blog post was found that distils frontier-model SVG output into a small model for a single house style and reports quality against the teacher. This is a real absence of public evidence, not just a search miss in one query (two queries).
- Details not verified (arxiv.org blocked): OmniSVG's max sequence length (recollection: up to ~30k tokens) and token-length reduction factor; StarVector's dataset (recollection: SVG-Stack ~2M, models 1B/8B, context limits of several thousand tokens); LLM4SVG's data (recollection: ~250k SVGs / ~580k instruction pairs with learnable "semantic tokens" for tags, attributes and path commands).
- Kaggle competition constraints (recollection: 10 kB SVG limit, VQA + aesthetic + OCR-penalty metric) not verified; the 1st-place write-up itself was not read.
- Llama 4 small variants, Phi, and "Qwen3.x-Coder" small sizes: nothing verifiable found.

## 4. Data: how many examples, how to curate, and what training costs

### Takeaway
Guidance for narrow style tasks clusters around a few hundred to a few thousand clean examples, with quality filtering mattering more than volume; for 15k-token SVG targets I would plan for 1k-3k rigorously filtered pairs first and scale to 10k only if evaluation shows gains. Training cost is small everywhere (tens to low thousands of dollars); it is not the deciding factor.

### Cited Findings
- Practitioner guidance: style/tone matching ~200-600 examples (with a warning that the model may copy phrasing rather than absorb style); narrow well-defined tasks 300-1,000 curated examples with LoRA; another guide puts style consistency at 1,000-5,000+. — [ertas.ai, how many training examples](https://www.ertas.ai/blog/how-many-training-examples-fine-tuning); [latitude.so dataset size](https://latitude.so/blog/dataset-size-impacts-llm-fine-tuning)
- Quality over quantity: one vendor-reported 7B experiment found 1,000 examples with 10% mislabelled performed like 600-700 clean examples; Databricks recommends a small number of diverse, high-quality samples for style alignment (LIMA-style argument that ~1,000 careful examples go a long way). — [ertas.ai data quality](https://www.ertas.ai/blog/data-quality-over-quantity); [Databricks, "LIMIT: Less is More for Instruction Tuning"](https://www.databricks.com/kr/blog/limit-less-more-instruction-tuning)
- A third-party blog relays that OpenAI's docs recommend starting with 50-100 examples (unconfirmed against OpenAI). — [Barry Zhang, "How much data is needed to fine-tune"](https://barryzhang.substack.com/p/our-humble-attempt-at-fine-tuning)
- Precedent for self-distillation with filtering in the SVG domain: the Kaggle 8th-place team fine-tuned its generator on the best images from 16 previous runs. — [Kaggle 8th place](https://www.kaggle.com/c/drawing-with-llms/discussion/581095)
- Unit prices used below: Fireworks ~$0.50/1M (<=16B) and $3/1M (16-80B); Together ~$0.48/1M; Vertex Flash-Lite 3.x ~$3/1M, 2.5 Flash-Lite ~$1.50/1M; OpenAI 4.1-mini $0.80 or $5/1M (conflicting). — [morphllm](https://www.morphllm.com/comparisons/fireworks-vs-together); [maximem](https://www.maximem.ai/blog/fireworks-vs-together-ai-pricing-2026); [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing?hl=en); [pricepertoken](https://pricepertoken.com/fine-tuning)

### Inferences
Training cost estimate (my arithmetic; assumes billing = dataset tokens x epochs, ~15k tokens per example, so 2,000 examples = 30M tokens/epoch and 10,000 = 150M tokens/epoch; 3 epochs shown in brackets):

| Platform / base | 2,000 examples | 10,000 examples |
|---|---|---|
| Fireworks or Together LoRA, model <=16B (~$0.50/M) | ~$15 (3 ep: ~$45) | ~$75 (3 ep: ~$225) |
| Fireworks LoRA, 16-80B ($3/M) | ~$90 (~$270) | ~$450 (~$1,350) |
| Vertex Gemini 3.x Flash-Lite (~$3/M, unit unverified) | ~$90 (~$270) | ~$450 (~$1,350) |
| Vertex Gemini 2.5 Flash-Lite (~$1.50/M) | ~$45 (~$135) | ~$225 (~$675) |
| OpenAI GPT-4.1 mini ($0.80-$5/M, conflicting; reported closed to new users) | $24-$150 (~$72-$450) | $120-$750 (~$360-$2,250) |
| Own GPU (H100 ~$4/h, LoRA on 8-14B; my rough guess of 2-6 GPU-hours per epoch at 30M tokens) | ~$10-$25 per epoch | ~$40-$120 per epoch |

- Curation recipe that fits this app: (1) keep only pictures that passed in production (not regenerated, not user-rejected); (2) validate each SVG by parsing and checking the house invariants (400x300 viewBox, wash/paint/ink/detail groups, palette membership, element count 150-300); (3) render to PNG and score with a vision judge against the brief and the character reference, keep the top 30-50%; (4) deduplicate near-identical compositions and balance across characters, settings, poses; (5) hold out 100-200 briefs as a fixed evaluation set judged blind against the current Claude output. Step 3 costs one cheap vision call per picture.
- Normalise the targets before training (consistent attribute order, rounded coordinates, no comments): it shortens sequences, lowers both training and serving cost, and makes the style more learnable.
- Data-rights caveat from section 1 overrides all of this for the Claude-generated log.

### Gaps
- No primary OpenAI or Google documentation on recommended example counts could be read.
- No published data on sample-efficiency for long-output (10k+ token) structured-drawing fine-tunes specifically; the numbers above come from short-text tasks.
- Whether platforms bill training tokens per epoch, and their maximum sequence length per training example (15k-token targets plus ~6k input may exceed some limits), was not verified.

## 5. Serving economics: cost per picture (about 6k input, 12k output tokens), speed, streaming

### Takeaway
Managed per-token routes put a picture at roughly $0.002-$0.05, i.e. 3x-100x cheaper than today's $0.10-$0.30, with zero idle cost; a self-hosted GPU at low, bursty utilisation is not clearly cheaper than today because one 12k-token generation occupies a GPU for minutes. Unit prices are third-party-reported and need confirmation.

### Cited Findings
- Gemini 3.1 Flash-Lite $0.25 in / $1.50 out per 1M; Gemini 3.5 Flash-Lite $0.30 / $2.50; tuned Gemini 3+ endpoints reported at 1.5x base. — [cloudzero Vertex AI pricing](https://www.cloudzero.com/blog/google-vertex-ai-pricing/); [developersdigest Google tracker](https://www.developersdigest.tech/models/fine-tuning/google)
- OpenAI tuned inference reported at ~1.5x-2x base; tuned GPT-4.1 example ~$3 in / $12 out per 1M. — [aicostcheck](https://aicostcheck.com/blog/ai-fine-tuning-costs-2026)
- Fireworks/Together: LoRA served at base model serverless price, no idle charge (reported). — [perkstack](https://perkstack.co/blog/fireworks-vs-together)
- Custom Nova on-demand at base price: Micro ~$0.035/$0.14, Lite $0.06/$0.24 per 1M. — [AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/); [cloudroute Nova pricing](https://www.cloudroutehq.com/aws-ai/amazon-nova-pricing)
- Modal L40S ~$1.95/h, A100-80GB ~$2.50/h, H100 ~$3.95/h, billed per second with scale to zero. — [markaicode Modal pricing](https://markaicode.com/pricing/modal-pricing/)
- Current Claude reference point: Haiku 4.5 is $1/$5 per 1M on Bedrock. — [pecollective Bedrock pricing](https://pecollective-com.pages.dev/tools/aws-bedrock-pricing/)

### Inferences
Cost per picture (my arithmetic: 6k input + 12k output tokens):

| Route | Unit price used | Per picture |
|---|---|---|
| (i) Tuned Gemini 3.1 Flash-Lite, 1.5x | $0.375 / $2.25 | ~$0.029 |
| (i) Tuned Gemini 3.5 Flash-Lite, 1.5x | $0.45 / $3.75 | ~$0.048 |
| (i) Untuned Gemini 3.1 Flash-Lite + few-shot (baseline to test first) | $0.25 / $1.50 | ~$0.020 (more with long few-shot input) |
| (ii) Tuned GPT-4.1 (reported $3/$12) | $3 / $12 | ~$0.16 (no saving) |
| (ii) Tuned OpenAI small model (4.1 mini/nano class) | not verified | not computable from verified data; recollection suggests ~$0.01-$0.04 |
| (iii) Serverless LoRA, 4-16B base on Fireworks/Together | not verified this session; recollection ~$0.20 per 1M flat | ~$0.004 (unverified) |
| (iii) Serverless LoRA, >16B base | recollection ~$0.90 per 1M | ~$0.016 (unverified) |
| Custom Nova Lite on-demand | $0.06 / $0.24 | ~$0.003 |
| Custom Nova Micro on-demand | $0.035 / $0.14 | ~$0.002 |
| Reference: untuned Claude Haiku 4.5 | $1 / $5 | ~$0.066 |
| (iv) Own GPU, Modal L40S, one stream at an assumed 50-80 tok/s | ~$1.95/h | 150-240 s of GPU = ~$0.08-$0.13, plus cold start and idle-timeout seconds |
| (iv) Own GPU, Modal H100, one stream at an assumed 120-200 tok/s | ~$3.95/h | 60-100 s = ~$0.07-$0.11, plus cold start |
| (iv) Same GPUs with 8-16 concurrent pictures batched by vLLM | same | roughly $0.01-$0.02 (only reachable with steady concurrent load) |

- The own-GPU rows are the key point for a bursty early-stage app: a long 12k-token generation makes single-stream GPU cost comparable to current Claude cost. Self-hosting only wins with concurrency the app does not have yet. Token-per-second assumptions are mine, not measured.
- Latency: at ~100 tok/s a 12k-token picture takes ~2 minutes; at ~300 tok/s (plausible for Flash-Lite-class managed models, unverified) ~40 s. A compact output format (section 6) cuts both cost and latency proportionally.
- All routes above support token streaming in principle (OpenAI-compatible SSE on Fireworks/Together/vLLM; streamGenerateContent on Vertex; ConverseStream on Bedrock) - standard API features, not re-verified today.
- Prompt caching of the fixed style guide/character reference would reduce the 6k input cost on untuned models; after fine-tuning most of that input can be dropped, so input cost matters little.

### Gaps
- No measured tokens/sec for any tuned model was found; all speeds are assumptions.
- Fireworks/Together serverless per-token prices by size tier and tuned OpenAI small-model prices were not verified (hosts blocked).
- Cold-start seconds for vLLM on Modal/RunPod with a 8-14B model: not found.
- Whether tuned Gemini endpoints have any per-endpoint hosting fee or regional limits: not verified (one third-party article title claims tuned-model hosting on some clouds "can cost $5,840 a month before use" - [beri.net](https://www.beri.net/article/fine-tuning-pricing-openai-azure-bedrock-vertex-hosting-fee-monthly-cost-2026) - not read; check which platforms that refers to).

## 6. Techniques that make a small model viable

### Takeaway
The published SVG-model literature points to three levers - compact SVG-specific tokenisation, render-in-the-loop feedback/RL, and select-best-of-N with a vision judge - and all three transfer to this app; grammar-constrained decoding and retrieval few-shot are standard engineering with no SVG-specific evidence found today.

### Cited Findings
- Compact tokenisation: OmniSVG parameterises commands and coordinates into discrete tokens, "decoupling structural logic from geometric details", with a dedicated ~40k SVG vocabulary. — [OmniSVG](https://arxiv.org/html/2504.06263v3)
- SVG-as-plain-text also works at scale: DuetSVG treats SVG as text tokens from the model's own vocabulary and adds internal visual guidance. — [DuetSVG](https://openaccess.thecvf.com/content/CVPR2026/papers/Zhang_DuetSVG_Unified_Multimodal_SVG_Generation_with_Internal_Visual_Guidance_CVPR_2026_paper.pdf)
- Render-in-the-loop reward: 2026 papers apply RL with rendering-based rewards to SVG LLMs (GeoSVG-RL; a multi-task multi-reward RL paper, arXiv 2603.16189; GVR-Coder's visual-feedback framework). Titles/abstract-level only. — [GeoSVG-RL](https://arxiv.org/pdf/2605.25447); [GVR-Coder](https://arxiv.org/pdf/2607.28073)
- Rejection sampling / selection: Kaggle top solutions generated multiple candidates and selected by VQA + aesthetic + OCR scores (10th place), and optimised SVG against a differentiable renderer (3rd place). — [10th place](https://kaggle.com/competitions/drawing-with-llms/discussion/581213); [3rd place](https://www.kaggle.com/competitions/drawing-with-llms/discussion/581024)
- Managed RL fine-tuning exists but is priced for bigger budgets: OpenAI RFT reported at $100/hour. — [pricepertoken](https://pricepertoken.com/fine-tuning)
- Style-matched training data helps: a cited result (Ren et al.) reports that matching training responses to the student's inherent style improves learning. — [arXiv 2402.11192](https://web3.arxiv.org/pdf/2402.11192v1)

### Inferences
- Cheapest high-value step, needing no training and raising no ToS issue: define a compact DSL for the house style (e.g. one line per primitive, palette indices instead of hex colours, integer coordinates on the 400x300 grid, layer keyword instead of group markup) and compile it to SVG in app code. A 2-4x reduction in output tokens is plausible (my estimate) and cuts cost and latency for the current Claude painter immediately, as well as making any later fine-tune easier. Note a tuned model can only use a custom tokeniser if self-hosted; on managed platforms the DSL must be plain text.
- Grammar-/schema-constrained decoding (vLLM guided decoding, Fireworks grammar mode, JSON schema on managed APIs) can guarantee well-formedness and palette/layer validity; it cannot guarantee a good picture. With a line-based DSL a simple parser plus "repair or drop bad lines" may be enough.
- Best-of-N with a vision judge becomes affordable once a picture costs ~$0.005-$0.03: generate 3-4 candidates, render, score against brief and character sheet, return the best; still cheaper than one Claude picture. This is the realistic way a small model gets "better in this one style".
- Retrieval of 1-3 similar past paintings as few-shot examples is a no-training baseline on a cheap untuned model (Flash-Lite, Haiku) and should be tested before any fine-tune; it also complements a tuned model for rare settings. Whether feeding stored Claude outputs as in-context examples to another vendor's model counts as "training" is outside the quoted clauses (in-context use is not training), but ask.
- Splitting scenery and characters: characters as fixed, hand-approved SVG components with a small pose vocabulary (placed/transformed by the model) removes the hardest likeness problem from the generative model; the model then paints only scenery plus pose parameters. This is an engineering inference, not something found in sources.

### Gaps
- No source found that measures grammar-constrained decoding or DSL targets for SVG quality/cost specifically.
- The 2026 RL papers were not read in full; their compute requirements and gains are unknown.

## 7. Risks, timeline and overall assessment

### Takeaway
The main risks are legal (training on Claude outputs is restricted), a likely quality drop on novel compositions and character likeness relative to Opus-class teachers, and platform churn (OpenAI fine-tuning winding down, Claude 3 Haiku tuning retired, Gemini tuned-price multiplier introduced). A staged plan - DSL + cheap-model few-shot baseline first, managed Flash-Lite tune second, self-hosting only at scale - limits exposure.

### Cited Findings
- Platform deprecation is concrete, not hypothetical: OpenAI fine-tuning reported closed to new users with base-model shutdowns in Jan 2027 and gpt-4.1-nano tunes removed Oct 2026; Bedrock's only tunable Claude (3 Haiku) reported end-of-life Sept 2026. — [developersdigest OpenAI tracker](https://www.developersdigest.tech/models/fine-tuning/openai); [developersdigest Bedrock tracker](https://www.developersdigest.tech/models/fine-tuning/amazon-bedrock)
- Pricing terms shift between generations: tuned Gemini 3+ endpoints carry a reported 1.5x multiplier that 2.5-and-earlier tuned models did not. — [developersdigest Google tracker](https://www.developersdigest.tech/models/fine-tuning/google)
- Anthropic's stated rationale for restricting training on outputs is that such models "may lack its safety measures" and cannot be monitored - relevant to a children's product, where the app would own output safety end to end. — [Claude Help Center](https://support.claude.com/en/articles/12326764-can-i-use-my-outputs-to-train-an-ai-model)
- Fine-tuning can degrade alignment/coherence in open-weights models in some settings (a 2025 paper on emergent misalignment, format and coherence in open-weights LLMs appeared in results; not read). — [arXiv 2511.20104](https://arxiv.org/pdf/2511.20104)
- Published SVG models that work were trained on 2M-5M examples, far above what the app's log can supply. — [OmniSVG](https://arxiv.org/html/2504.06263v3); [DuetSVG](https://openaccess.thecvf.com/content/CVPR2026/papers/Zhang_DuetSVG_Unified_Multimodal_SVG_Generation_with_Internal_Visual_Guidance_CVPR_2026_paper.pdf)

### Inferences
- Quality expectation (judgement, no direct evidence): a tuned small model will reproduce palette, layering and brushwork conventions well (in-distribution style), and will be weaker than Opus/Sonnet on spatial reasoning for unseen compositions, unusual poses, multi-character interactions, and exact character likeness. "Better than the teacher" is only plausible via best-of-N + judge and curated training data, not from the fine-tune alone.
- Child safety: SVG output from a narrow painter is low-risk for explicit content but not zero (text elements, shapes); keep the existing brief-level moderation upstream (the brief writer can stay on Claude), strip or whitelist `<text>`, scripts, links and external references at parse time, and include the vision judge as a safety check. A self-hosted or third-party model has no vendor safety layer.
- Maintenance burden: evaluation set + judge pipeline, retraining when style or cast changes (new characters need new data or a component approach), base-model deprecations every 12-18 months on managed platforms, and a fallback path to Claude for failures. For a small team this is the real cost, larger than training or serving dollars.
- Timeline estimate (judgement): 1-2 days to export, validate and score the dataset; 1-3 days for a DSL and no-training baselines; a managed tuning job is hours; 1-2 weeks of evaluation/iteration to reach a ship/no-ship answer; self-hosted LoRA + vLLM + constrained decoding adds 1-2 weeks of engineering. Legal clearance from Anthropic (if the Claude log is to be used) is the unpredictable item.
- Suggested order of work: (1) ask Anthropic for written authorisation, in parallel (2) DSL + prompt caching on current Claude, (3) untuned Gemini Flash-Lite / Haiku with retrieval few-shot and best-of-N, measured on a blind eval, (4) only if (3) falls short, tune Flash-Lite on a teacher corpus with clean rights, (5) open-weights LoRA on serverless per-token hosting, (6) own GPU only when there is sustained concurrency.

### Gaps
- No public case study of a production app replacing a frontier-model SVG illustrator with a fine-tuned small model was found; quality expectations here are judgement.
- No verified deprecation schedules for Gemini tuned models or Fireworks/Together base models.
- Network limits: to verify prices and terms from primary sources, the session would need access to openai.com, ai.google.dev, cloud.google.com (full page), docs.aws.amazon.com, fireworks.ai, together.ai, modal.com, runpod.io, arxiv.org and kaggle.com.
