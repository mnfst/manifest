# TaskBench Methodology

Last updated: 2026-04-28

This document records every methodological decision made during the TaskBench benchmark.
It serves two purposes: (1) reproducibility for the arXiv paper, and (2) continuity
across work sessions so the methodology stays consistent even with different operators.

## 1. Objective

Produce a cost-quality Pareto frontier for LLM production tasks. For each (model, task)
pair, measure quality and cost per query. The paper answers: "For task X, which model
gives the best cost-to-quality ratio?"

## 1b. Design Rationale (the "why" behind every choice)

This section answers the questions a reviewer or collaborator would ask. It captures
the reasoning that led to each decision, not just the decision itself.

### Why this benchmark exists

No published benchmark systematically answers "which model is cheapest for which
production task." Existing benchmarks measure general capability (MMLU, LMSYS Arena),
router quality (RouterArena), or infrastructure efficiency (CEBench). They don't produce
a practitioner-facing matrix of "cheapest model per task at acceptable quality." Every
developer using LLM APIs faces this decision daily. We wanted to give them data instead
of opinions.

### Why score on 1-5 and not 1-100 or 1-10

Three reasons:
1. **LLM-judge reliability**: When asked to score on a 100-point scale, LLMs cluster
   around round numbers (70, 80, 90) making the extra precision illusory. A 1-5 scale
   with clear qualitative anchors (1=fail, 2=poor, 3=acceptable, 4=good, 5=perfect)
   produces more consistent inter-rater agreement.
2. **Alignment with the question we're answering**: We don't need to rank model A at
   87.3 vs model B at 87.1. We need to know if a $0.15/M model is "good enough" (>=4/5)
   compared to a $15/M model. A coarse scale serves this better.
3. **Precedent**: RouterArena, LMSYS, and the Cost-Aware Model Selection paper all
   use small ordinal scales for LLM-judged evaluations.

We validate the 1-5 scale against native metrics (accuracy, F1, exact match) on
tasks where both are available. The correlation confirms the scale works.

### Why these specific models

Model selection was driven by three constraints:
1. **API availability**: We included every model we could actually call. This meant
   models accessible via Anthropic, OpenAI, Google, Mistral, MiniMax, Moonshot, and
   OpenRouter APIs. We didn't cherry-pick models to tell a particular story.
2. **Price tier coverage**: We deliberately ensured at least 2 models per price tier
   (Premium >$5, Standard $1-5, Economy $0.10-1, Micro <$0.10) to test whether
   price predicts quality.
3. **Provider diversity**: The benchmark covers 7+ providers and 4+ model families
   (GPT, Claude, Gemini, Mistral, DeepSeek, Llama, Qwen, Kimi, MiniMax, ByteDance
   Seed, Grok). This avoids the bias of benchmarking only OpenAI vs Anthropic.

Models that are missing (e.g., Cohere Command-R, AI21 Jamba) are missing because we
didn't have API access or ran out of time, not because of a selection bias.

### Why these specific tasks

The 8 production tasks (with 50 cases each) were chosen to cover the most common LLM
use cases in production:

| Task | Why included |
|------|-------------|
| Sentiment (SST-2) | Simplest classification. Baseline task. If a model fails here, something is wrong. |
| Intent (CLINC-150) | 150-class classification. Tests instruction following at scale. |
| Reasoning (GSM8K) | Math word problems. Tests whether expensive reasoning models justify their cost. |
| NER extraction | Structured output from unstructured text. Common in data pipelines. |
| Translation (OPUS-100) | Language generation quality. Tests multilingual capability. |
| SQL generation (Spider) | Code generation for non-code tasks. Common in analytics tools. |
| Content moderation (ToxiGen) | Safety classification with adversarial inputs. Tests robustness. |
| Function calling | Tool use / structured API calls. Core capability for AI agents. |

Tasks we didn't include at 50 cases yet (code review, test generation, email summary,
JSON transform, extraction hard) are available at 5 cases from the v1 exploratory run.
They can be scaled up in a future iteration.

### Why exact match for classification instead of LLM-judge

For sentiment, intent, and moderation: the "correct" answer is a single label from a
fixed set. Using an LLM judge to evaluate "is positive the right answer for this
positive text" adds cost and noise without improving accuracy. Exact match is faster,
cheaper, and deterministic.

The challenge with exact match is reasoning models that wrap answers in explanations.
We solved this with `strip_thinking()` and `effective_max_tokens()` rather than
switching to LLM-judge.

### Why gpt-4o-mini as the judge and not a stronger model

Cost. At $0.15/M input tokens, gpt-4o-mini costs ~$0.0001 per judge call. With ~4000+
judge calls across all tasks, a stronger judge (GPT-4o at $2.50/M) would cost 16x more
for marginal quality improvement. The dual-metric validation on 4 tasks shows gpt-4o-mini
judgments correlate well with native metrics.

Limitation: gpt-4o-mini may have a slight bias toward GPT-family output style. We
document this in the paper.

### Why 50 cases per task and not 100 or 500

Statistical power vs. cost tradeoff. With 50 cases:
- 95% confidence interval is approximately +/-0.2 on the 1-5 scale
- This is sufficient to distinguish clusters (economy models at 4.5 vs premium at 4.7)
  but not individual model differences within 0.1 points
- Cost per task is ~$1-2 across 20 models (affordable)

With 100 cases, CI drops to +/-0.14 (diminishing returns). With 500 cases, the cost
would multiply 10x without changing the structural findings.

### Why temperature=0

Reproducibility. With temperature=0, the same prompt produces the same output. This
means our results are deterministic and reproducible without multiple runs.

Exception: reasoning models that don't support temperature=0 (DeepSeek-R1, Kimi-K2.6,
Claude Opus 4.7). These models have inherent run-to-run variance. We document this as
a limitation rather than running 3x repetitions (which would triple cost for a subset
of models).

### Why batch execution and not all models in parallel

Safety and debuggability:
1. **Budget control**: Sequential execution lets us check spend after each model and
   stop before hitting the cap.
2. **Error isolation**: When a model fails (wrong endpoint, rate limit, auth error),
   we can diagnose and fix before running the remaining 19 models.
3. **Resume**: The resume logic checks CSV state at startup. Parallel writes to the
   same CSV would cause corruption.

### Why we switched from Azure to direct APIs

Azure AI was our initial provider for 10+ models (DeepSeek, Grok, Kimi, Llama, Mistral,
GPT-5.x, o4-mini). It went down mid-benchmark (HTTP 500 on all models) and didn't come
back. Rather than wait, we added direct API integrations for each provider:
- Mistral: api.mistral.ai (free tier, rate-limited on large models)
- Moonshot/Kimi: api.moonshot.ai (required endpoint discovery, temperature quirks)
- OpenRouter: openrouter.ai (fallback for ByteDance Seed, Qwen, DeepSeek, Grok)

This made the benchmark more resilient but also more complex (7 provider-specific callers
instead of 1 Azure caller). The tradeoff was worth it for coverage.

## 2. Tooling Decisions

### Why not promptfoo

We started with [promptfoo](https://github.com/promptfoo/promptfoo) (open-source LLM
eval framework) but switched to a custom Python runner (`scripts/run_full_benchmark.py`,
then `scripts/run_batch.py`) after discovering that:

- promptfoo has no native support for Azure AI, Gemini, MiniMax, Moonshot, or OpenRouter endpoints
- promptfoo cannot strip `<think>` tags from reasoning model output before evaluation
- promptfoo has no built-in budget tracking or resume-after-crash logic
- We needed dual metrics (LLM-judge score + native dataset accuracy) which promptfoo doesn't support natively

The custom runner handles all of this in ~500 lines of Python with zero dependencies
beyond `requests`.

### Runner architecture

Two runners exist:
- `run_full_benchmark.py` (v1): Tasks hardcoded in the script. Used for the initial
  exploratory run (14 tasks, 5-10 cases each). Kept for reference.
- `run_batch.py` (v2): Tasks loaded from JSONL dataset files. Supports per-task
  execution, resume, and provider auto-detection. Used for all production runs.

### Why custom API callers instead of LiteLLM

Each provider has quirks that a unified library obscures:
- Anthropic: `temperature` deprecated on reasoning models (Opus 4.7), needs separate handling
- Gemini: `max_completion_tokens` instead of `max_tokens`, thinking tokens count against the budget
- MiniMax: `<think>` tags in visible content
- Moonshot/Kimi: `temperature` must be exactly 1 (not 0) for kimi-k2.6
- OpenRouter: model IDs contain slashes that break filesystem paths

Having explicit per-provider callers makes these quirks visible and debuggable.

## 3. Evaluation Methodology

### Scoring: 1-5 LLM-judge scale

For generative tasks (email summary, SQL generation, code review, translation,
entity extraction, function calling, test generation, reasoning):

- **Judge model**: gpt-4o-mini (chosen for cost, ~$0.0001/call)
- **Scale**: 1-5 integer (5=perfect, 1=fail)
- **Protocol**: Single-turn judge call with task-specific rubric
- **Temperature**: 0 (deterministic)

Rubric template (varies per task):
```
Rate this [output type] on a 1-5 scale.
5=[criteria for perfect]. 4=[good with minor issues].
3=[acceptable]. 2=[poor]. 1=[fail].
Respond with ONLY a number 1-5.
```

### Scoring: exact match

For classification tasks (sentiment, intent, content moderation):
- Score 5 if expected label appears in model response (case-insensitive)
- Score 0 otherwise
- Reasoning model output is pre-processed with `strip_thinking()` to remove
  `<think>...</think>` tags before matching

### Native metrics (dual scoring)

For tasks with standard datasets, we compute both the LLM-judge score AND the
dataset's native metric:

| Task | Dataset | Native Metric |
|------|---------|---------------|
| sentiment_sst2 | SST-2 validation | Accuracy (% exact match) |
| intent_clinc150 | CLINC-150 test | Accuracy (% exact match) |
| reasoning_gsm8k | GSM8K test | Exact answer match (extract number after "ANSWER:") |
| moderation_toxigen | ToxiGen test | Accuracy (% exact match) |

This enables us to (a) validate that LLM-judge scores correlate with standard metrics,
and (b) compare our results to published benchmarks.

### Reasoning model handling

Models identified as "reasoning models" (those that consume thinking tokens internally):
```
DeepSeek-R1, o4-mini, grok-4-20-reasoning, gpt-5.1-chat,
Kimi-K2.6, kimi-k2.6, gemini-2.5-pro, MiniMax-M2.7,
claude-opus-4-7, Phi-4-reasoning, qwen3-32b
```

Special handling:
1. **Token budget**: `effective_max_tokens()` bumps requested max to at least 2000
   (reasoning models need headroom for invisible thinking tokens)
2. **Temperature**: Omitted for models that reject `temperature=0`
3. **Think tag stripping**: `strip_thinking()` removes `<think>...</think>` from
   visible output before evaluation
4. **Gemini 2.5 Pro**: Uses `max_completion_tokens: 8192` because thinking tokens
   count against this limit (500 tokens of thinking = 0 visible output if limit is 500)

## 4. Cost Measurement

Cost per query = `(input_tokens * input_price + output_tokens * output_price) / 1,000,000`

Prices are hardcoded per model in the runner at benchmark time. We record the exact
price used in every CSV row (`input_price_per_m`, `output_price_per_m`) for
reproducibility.

**Judge costs**: Each LLM-judge call adds ~$0.0001 to spend tracking. Judge calls are
NOT included in per-model cost calculations (they're infrastructure cost, not model cost).

**Budget**: Hard cap at $200 in the runner (total cap $250, $50 margin). Spend tracker
at `results/spend_tracker.json` persists across runs.

## 5. Dataset Selection

### Standard datasets (7 tasks)

| Task | Dataset | Split | Sample Size | Sampling |
|------|---------|-------|-------------|----------|
| sentiment_sst2 | SST-2 (GLUE) | validation | 50 | 25 positive + 25 negative, seed=42 |
| intent_clinc150 | CLINC-150 (OOS) | test | 50 | 1 sample from 50 random intents, seed=42 |
| reasoning_gsm8k | GSM8K | test | 50 | Random 50, seed=42 |
| moderation_toxigen | ToxiGen | test | 50 | 25 toxic (score>=4) + 25 safe (score<=2), seed=42 |
| sql_spider | Spider | validation | 50 | Random 50 from len>20 and query<300, seed=42 |
| translation_enfr | OPUS-100 EN-FR | test | 50 | Random 50 from len 30-400, seed=42 |
| ner_extraction | Hand-curated | - | 50 | 50 news-style sentences with known entities |

### Hand-curated datasets (1 task)

| Task | Cases | Method |
|------|-------|--------|
| function_calling | 50 | Hand-written tool-use scenarios covering dev ops, productivity, finance, smart home |

### V1 datasets (5 tasks, 5-10 cases each, not yet scaled to 50)

| Task | Cases | Status |
|------|-------|--------|
| test_generation | 5 | Needs HumanEval sampling or synthetic generation |
| email_summary | 5 | Needs synthetic generation from Enron-like themes |
| json_transform | 5 | Needs synthetic generation |
| code_review | 5 | Needs PR diffs from OSS repos |
| extraction_hard | 5 | Needs synthetic semi-structured documents |

## 6. Model Selection

### Provider integration

| Provider | Endpoint | Auth | Models |
|----------|----------|------|--------|
| Anthropic | api.anthropic.com/v1 | x-api-key header | Opus 4.7, Sonnet 4, Haiku 4.5 |
| OpenAI | api.openai.com/v1 | Bearer token | GPT-4o, GPT-4o-mini |
| Google | generativelanguage.googleapis.com/v1beta/openai | Bearer token | Gemini 2.5 Pro/Flash, 2.0 Flash |
| MiniMax | api.minimaxi.chat/v1 | Bearer token | MiniMax-M2.7 |
| Mistral | api.mistral.ai/v1 | Bearer token | Large, Medium, Small, Ministral-3B |
| Moonshot | api.moonshot.ai/v1 | Bearer token | Kimi-K2.6 |
| OpenRouter | openrouter.ai/api/v1 | Bearer token | ByteDance Seed, Qwen, DeepSeek, Grok |
| Azure AI | Custom endpoint | api-key header | DeepSeek, Grok, Kimi, Llama, GPT-5.x (currently down) |

### Price tiers

| Tier | Input price/M tokens | Models |
|------|---------------------|--------|
| Premium | >$5 | Claude Opus 4.7 ($15) |
| Standard | $1-5 | GPT-5.1, GPT-4o, Sonnet 4, Gemini 2.5 Pro, Grok-4, MiniMax M2.7, Mistral Large, Qwen Max |
| Economy | $0.10-1 | GPT-4o-mini, Haiku 4.5, Gemini Flash, Mistral Medium/Small, DeepSeek, Kimi, Llama, ByteDance Seed, Qwen Flash |
| Micro | <$0.10 | Ministral-3B ($0.04), Seed 1.6 Flash ($0.075) |

## 7. Execution Protocol

### Batch execution

Tasks run sequentially via `run_batch.py --task <task_id> --skip-azure`.
Each task processes all available models before moving to the next.

### Resume logic

The runner loads existing (task, model) pairs from `benchmark_results.csv` at startup.
A pair is considered "complete" if it has rows >= number of cases in the dataset.
Complete pairs are skipped. This enables:
- Resume after crashes (power outages, process kills)
- Incremental model addition (add new models, re-run, only new models execute)

### Temperature

`temperature=0` for all models that support it. Models that reject temperature=0
(reasoning models) use default temperature. This is documented in the paper as a
limitation: reasoning model outputs are non-deterministic.

### Rate limiting

- 0.5s delay between models (not between cases)
- OpenRouter and Gemini free tier hit rate limits frequently
- Mistral free tier limits mistral-large to ~4-8 cases per run
- No retry logic (failed cases are logged as errors and skipped)

## 8. Data Storage

```
benchmark/
  datasets/           # Input data (JSONL, one file per task)
  results/
    benchmark_results.csv    # All results, append-only
    spend_tracker.json       # Cumulative spend
    raw/                     # Per-case JSON with full response text
    figures/                 # Generated plots (Pareto, heatmap, etc.)
    analysis_report.md       # Generated analysis summary
  scripts/
    run_batch.py             # V2 runner (production)
    run_full_benchmark.py    # V1 runner (legacy)
    analyze_costs.py         # Pareto plots, heatmaps, report generation
```

### CSV schema

```
timestamp, task, case_idx, model, provider, input_price_per_m,
output_price_per_m, input_tokens, output_tokens, cost_usd,
score, eval_type, response_preview
```

## 9. Known Limitations

1. **LLM-as-judge bias**: GPT-4o-mini as judge may favor GPT-family outputs.
   Mitigation: dual metrics on 4 tasks show judge/accuracy correlation.
2. **Judge-accuracy divergence on reasoning**: Opus scores 98% exact answer but
   3.5/5 from judge on GSM8K. The judge penalizes verbose format, not correctness.
3. **Small sample sizes**: 50 cases per task. Confidence intervals ~+/-0.2 points
   at 95% CI. Sufficient for 1+ point gaps, marginal for 0.3-point differences.
4. **Price snapshot**: Prices recorded at benchmark time (April 2026). Model pricing
   changes frequently. Structural findings (tier-level) are more durable than
   model-specific price comparisons.
5. **No retry logic**: Rate-limited cases are lost, not retried. Some models have
   fewer than 50 cases on some tasks.
6. **Reasoning model non-determinism**: temperature cannot be set to 0 for some
   reasoning models, introducing run-to-run variance.

## 10. Key Findings (preliminary, as of lot 8)

1. **Economy models match premium on most tasks**: GPT-4o-mini ($0.15/M) and
   Mistral Small ($0.10/M) achieve 90-100% of premium quality for 15-100x less cost.
2. **Premium models worst on moderation**: Claude Opus (86%) and GPT-4o (86%)
   score below economy models on ToxiGen adversarial content moderation.
3. **Reasoning models fail exact-match without preprocessing**: Without `strip_thinking()`
   and `effective_max_tokens()`, reasoning models score 0% on classification tasks.
4. **Ministral-3B defies expectations**: At $0.04/M (cheapest model), it scores 94%
   on GSM8K (matching GPT-4o) and 4.5/5 on function calling.
5. **Judge/accuracy divergence**: LLM-judge scores and native metrics diverge on
   reasoning tasks. Report both.

## 11. Reproducibility Checklist

To reproduce the exact benchmark:
1. Use `random.seed(42)` for all dataset sampling
2. Use `temperature=0` for all models that support it
3. Use the exact model IDs listed in `run_batch.py` MODELS dict
4. Use the exact prompt templates in TASK_DEFS
5. Use gpt-4o-mini as the LLM judge with the exact rubric prompts
6. Run with `--skip-azure` if Azure is unavailable (Azure models are supplementary)
