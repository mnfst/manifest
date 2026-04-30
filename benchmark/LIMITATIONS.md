# TaskBench Limitations

Last updated: 2026-04-29

This document lists every known limitation of the benchmark, with honest
assessments of impact and mitigations. Written to prepare for reviewer
questions, audience Q&A, and paper transparency.

## 1. LLM-as-Judge Bias

**The issue:** GPT-4o-mini evaluates all generative task outputs. It may
systematically favor responses that match GPT-family style (similar phrasing,
formatting conventions, verbosity level).

**Impact:** Could inflate scores for GPT-4o, GPT-4o-mini, and GPT-5.1 by
0.1-0.3 points relative to models with different output styles (Claude,
Mistral, Gemini).

**Mitigations in place:**
- Dual metric on 4 tasks (accuracy is judge-independent)
- Judge rubrics are task-specific and style-neutral ("rate correctness" not
  "rate quality of writing")

**Possible future mitigation:**
- Add Claude Haiku as second judge on 20% subset (~$1 cost)
- Report inter-judge agreement (Cohen's kappa)

**Should you worry?** Probably not for tier-level conclusions ("Economy matches
Premium"). Possibly for within-tier rankings ("GPT-4o-mini vs Gemini Flash").

## 2. Sample Size (50 cases per task)

**The issue:** 50 cases gives a 95% confidence interval of approximately
+/-0.2 points on the 1-5 scale. This is enough to distinguish a 4.0 from
a 4.5, but not a 4.3 from a 4.5.

**Impact:** Cannot make statistically significant claims about models within
0.3 points of each other. Fine for tier-level comparisons (Economy at 4.5 vs
Premium at 4.7), insufficient for individual model rankings within a tier.

**Why we chose 50:** Cost-quality tradeoff. 100 cases would halve the CI to
+/-0.14 for double the cost. 500 would cost 10x more. The structural findings
(which tier wins) do not change with more cases.

**Should you worry?** Not if you read the results as tier comparisons. Yes if
you are trying to crown one specific model as "best."

## 3. Price Snapshot

**The issue:** Model prices are recorded at benchmark time (April 2026). LLM
pricing changes frequently (monthly price cuts, new pricing tiers, volume
discounts).

**Impact:** Specific cost comparisons ("GPT-4o-mini costs 100x less than Opus")
may be outdated within months.

**Mitigation:** The paper presents results both by model name AND by price
tier (Premium/Standard/Economy/Micro). Tier-level findings ("Economy models
match Premium on classification") are more durable than specific price
comparisons because relative pricing between tiers rarely inverts completely.

**Should you worry?** Check current prices before making purchasing decisions.
Use the structural findings (tier-level) as the durable takeaway.

## 4. Reasoning Model Non-Determinism

**The issue:** Several reasoning models (DeepSeek-R1, Kimi-K2.6, Claude
Opus 4.7) do not support temperature=0. Their outputs vary between runs,
introducing non-reproducible variance.

**Impact:** Results for these models have higher variance than deterministic
models. A second run could shift scores by 0.2-0.5 points.

**Mitigation:** The diversity of 50 cases naturally samples the model's
performance distribution, reducing the impact of per-case variance.

**Should you worry?** For reasoning models specifically, yes. Their scores
should be read as "approximately 4.5" not "exactly 4.5." For deterministic
models (temperature=0), results are fully reproducible.

## 5. No Retry Logic

**The issue:** When an API call fails (rate limit, timeout, network error),
the case is skipped, not retried. Some models have fewer than 50 cases on
some tasks (e.g., Mistral Large often completes only 4-8 of 50 cases due
to free-tier rate limits).

**Impact:** Models with partial data have less reliable scores. A model
with 4 cases could be misleadingly high or low.

**Mitigation:** We mark partial results in the analysis and flag models
with fewer than 30 cases as "insufficient data."

**Should you worry?** Ignore models with fewer than 20 cases for a given
task. Their averages are not statistically meaningful.

## 6. No Open-Source Self-Hosted Models

**The issue:** All models are accessed via cloud APIs. No locally-hosted
models (Ollama, vLLM, llama.cpp) are included.

**Impact:** Misses an important deployment scenario where cost is dominated
by hardware, not API pricing. A self-hosted Llama-3.3-70B has zero marginal
API cost but significant hardware cost.

**Why excluded:** Self-hosted model performance depends on hardware (GPU,
quantization level), making reproducibility difficult. API pricing is
universal and comparable.

**Should you worry?** If you are comparing cloud API costs, no. If you are
deciding between cloud and self-hosted, this benchmark only covers the cloud
side.

## 7. English-Only (Mostly)

**The issue:** All tasks except translation use English prompts and expect
English outputs. The translation task is EN-FR only.

**Impact:** Does not test multilingual capabilities. Some models (Qwen, Kimi,
DeepSeek) may perform differently in their native languages (Chinese).

**Should you worry?** If your production use case is non-English, this
benchmark may not apply directly.

## 8. Single-Turn Only

**The issue:** Every test case is a single prompt-response pair. No multi-turn
conversations, no context accumulation, no system prompts.

**Impact:** Does not test conversational ability, context window utilization,
or instruction persistence across turns.

**Why excluded:** Multi-turn evaluation is significantly more complex (need to
evaluate coherence across turns, not just individual responses). The runner
architecture would need major changes.

**Should you worry?** If your use case involves extended conversations (chatbots,
coding assistants with back-and-forth), this benchmark tests the building
blocks but not the full interaction.

## 9. No Latency Measurement

**The issue:** We measure cost per query but not response time. A model that
costs $0.001 but takes 30 seconds may not be suitable for real-time
applications.

**Impact:** Cost-optimal recommendations may not be latency-optimal.

**Why excluded:** Latency depends on server load, geographic location, time
of day, and provider infrastructure. A benchmark run over hours from one
location cannot produce reliable latency data.

**Should you worry?** If latency matters for your use case, test it separately.
Our cost-quality findings still apply; you would just add latency as a third
axis.

## 10. Judge-Accuracy Divergence

**The issue:** On reasoning tasks (GSM8K), LLM-judge scores and exact-answer
accuracy diverge. Claude Opus gets 98% correct answers but only 3.5/5 from
the judge because it answers verbosely.

**Impact:** The judge penalizes correct-but-verbose answers. This
systematically disadvantages reasoning models that "show their work."

**Mitigation:** We report both metrics on every task where a native metric
exists. The paper discusses this divergence explicitly as a limitation of
LLM-as-judge evaluation methodology, and notes that both metrics together
provide a richer picture than either alone.

**Should you worry?** Use the native metric (accuracy, F1, exact match) for
correctness. Use the judge score for "usable quality" (format, concision).
They measure different things.
