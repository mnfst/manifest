# TaskBench Findings

Last updated: 2026-04-30
Status: NEAR-COMPLETE (19 of ~21 v2 tasks done, 2 remaining)

**Rule: every finding below must be revalidated against final data before
publication. Findings marked [STABLE] survived multiple lots without changing.
Findings marked [PRELIMINARY] are based on partial data and may shift.**

## Data Snapshot

- 18,678 unique data points
- 30 models across 7 providers (Anthropic, OpenAI, Google, Mistral, MiniMax, Moonshot, OpenRouter)
- 19 v2 tasks (50 cases each), 13 v1 tasks (5-10 cases, exploratory only)
- $51 spent of $250 budget (20%)
- Commit: a1da9e1b8 on branch taskbench-data
- Remaining: extraction_hard_v2, multistep_reasoning (datasets not yet created)

---

## Finding 1: Economy models match Premium on most production tasks [STABLE]

GPT-4o-mini ($0.15/M), Gemini 2.5 Flash ($0.15/M), and Mistral Small ($0.10/M)
achieve 90-100% of premium model quality on 12 of 16 tasks tested. The cost
difference is 15-100x.

**Evidence:**
- Sentiment SST-2: GPT-4o-mini 100% accuracy, Claude Opus 4.7 96% ($0.0005 vs $0.0947)
- Intent CLINC-150: Gemini 2.5 Flash 94%, Claude Opus 92% ($0.0047 vs $0.6800)
- Function calling: GPT-4o-mini 4.5/5, Claude Opus 4.6/5 ($0.0016 vs $0.2725)

**Implication:** For classification and structured output tasks, defaulting to
a premium model is paying 15-100x more for the same or worse quality.

**Risk of invalidation:** Low. This finding has held across every lot since lot 1.

---

## Finding 2: Premium models are paradoxically worse on some tasks [STABLE]

Claude Opus 4.7 ($15/M) is the worst model on sentiment classification (96%,
last of 13 models) and below average on content moderation (86%). Premium models
"overthink" simple classification tasks.

**Evidence:**
- Sentiment SST-2: Opus 96% (worst), errors on ambiguous cases like "slick piece
  of cross-promotion" where it over-interprets nuance
- ToxiGen moderation: Opus 86% (below ByteDance Seed 1.6 Flash at 96%)

**Implication:** Reasoning capability is a liability on tasks that require fast,
surface-level pattern matching. Sending simple classification to a reasoning
model is paying more for worse results.

**Risk of invalidation:** Low for sentiment/moderation. Could change if we add
tasks where premium models shine (complex multi-step reasoning).

---

## Finding 3: Ministral-3B punches far above its weight [STABLE]

At $0.04/M (the cheapest model tested, Micro tier), Ministral-3B consistently
scores 85-95% of premium quality.

**Evidence:**
- GSM8K reasoning: 94% exact answer (matches GPT-4o at $2.50/M)
- Function calling: 4.5/5 (matches Claude Haiku at $0.80/M)
- Sentiment: 94% accuracy
- Fails on: ToxiGen adversarial moderation (66%), CLINC-150 150-class intent (72%)

**Implication:** For simple production tasks (sentiment, basic math, straightforward
function calls), a $0.04/M model does the job. Only adversarial or high-complexity
tasks require more expensive models.

**Risk of invalidation:** Medium. With more cases per task, the 94% on GSM8K might
drop to 88-90%. The structural finding (Micro viable for simple tasks) is stable.

---

## Finding 4: No single model wins everywhere [STABLE]

The cheapest adequate model changes by task:

| Task type | Best cost-efficiency model |
|-----------|--------------------------|
| Sentiment, intent | GPT-4o-mini |
| Reasoning (math) | Gemini 2.5 Flash or Mistral Small |
| Content moderation | ByteDance Seed 1.6 Flash |
| Translation | GPT-4o-mini or Mistral Medium |
| Function calling | GPT-4o-mini or Ministral-3B |
| NER extraction | Ministral-3B or Llama-4-Scout |
| Code review | Mistral Large or Qwen 3.6 Flash |

**Implication:** A model router that selects the optimal model per task can
capture 95% of premium quality at 10-20% of the cost. This directly validates
the routing thesis (and Manifest's value proposition).

**Risk of invalidation:** Low for the structural finding. Specific model names
may change as we add more tasks and models.

---

## Finding 5: The cost-quality curve has brutal diminishing returns [STABLE]

Doubling the price per query from $0.001 to $0.002 gains ~0.3 quality points.
Doubling from $0.05 to $0.10 gains ~0.05 points. The curve is convex: most of
the quality is captured in the Economy tier ($0.10-0.15/M).

**Evidence:** Overall cost-efficiency scatter plot shows a tight cluster of
Economy models at (cost=low, quality=4.3-4.4) and a spread of Premium models
at (cost=high, quality=4.4-4.5). The quality gap is 0.1 points. The cost gap
is 10-100x.

**Implication:** The ROI of moving from Economy to Premium is almost always
negative. The only justification is the 2-4 tasks where premium models
provide meaningfully higher quality (complex reasoning, nuanced code review).

**Risk of invalidation:** Low. This is a structural property of the current
model market, not a benchmark artifact.

---

## Finding 6: LLM-judge and native accuracy diverge on reasoning [STABLE]

On GSM8K, Claude Opus 4.7 scores 98% exact answer accuracy but only 3.5/5
from the LLM judge. The judge penalizes verbose, unconventional formatting
even when the answer is correct.

**Evidence:**
- Opus: 98% accuracy, 3.5/5 judge
- GPT-4o-mini: 94% accuracy, 3.5/5 judge
- Mistral Small: 94% accuracy, 4.8/5 judge (concise format, judge likes it)

**Implication:** LLM-judge evaluates "usable quality" (format, concision),
not just correctness. For the paper: always report both metrics. The
divergence itself is a finding about evaluation methodology.

**Risk of invalidation:** None. This is an observed property of the evaluation
method, not a data-dependent finding.

---

## Finding 7: Dataset difficulty determines benchmark value [STABLE]

Easy datasets produce zero insight. Adversarial datasets reveal real differences.

**Evidence:**
- V1 content moderation (obvious cases): ALL models score 100%. Zero insight.
- V2 ToxiGen (adversarial cases): Models spread from 66% to 96%. 30-point gap.

**Implication:** Every new task needs a difficulty check: test 3 models on 5
cases first. If all score >95%, the dataset is too easy and needs adversarial
cases. The benchmark's value comes entirely from its discriminative power.

**Risk of invalidation:** None. This is a methodological principle, not a
data-dependent finding.

---

## Finding 8: Three models form the "default choice" cluster [PRELIMINARY]

GPT-4o-mini, Gemini 2.5 Flash, and Mistral Small appear in the top 5 cost-
efficiency on almost every task. They are interchangeable for most production
use cases.

**Evidence:** Top cost-efficiency across 8+ tasks. All three are in the
$0.10-0.15/M input price range.

**Implication:** If you have no benchmark data for your specific task, pick
any of these three. You will be within 5% of optimal.

**Risk of invalidation:** Medium. Adding more tasks (code generation, long
summarization, multi-step reasoning) might reveal tasks where these three
underperform and a different model cluster dominates.

---

## Finding 9: Reasoning models are overkill for production [PRELIMINARY]

Reasoning models (DeepSeek-R1, o4-mini, Kimi K2.6, Claude Opus 4.7) consume
2-10x more tokens in thinking overhead for marginal quality gain on most tasks.

**Evidence:**
- They match Economy models on sentiment, intent, NER, function calling
- They lead on GSM8K math (Opus 98% vs GPT-4o-mini 94%)
- They cost 5-100x more due to thinking token overhead

**Implication:** Only use reasoning models for tasks that actually require
multi-step reasoning (math, complex logic, planning). For everything else,
they are paying a "thinking tax" for no benefit.

**Risk of invalidation:** Medium. Adding the multi-step reasoning task (MATH
dataset) might show a larger gap that better justifies reasoning model costs.

---

## Finding 10: Provider diversity reveals unexpected winners [PRELIMINARY]

Models from less-known providers sometimes outperform established ones:
- ByteDance Seed 1.6 Flash: best on ToxiGen moderation (96%)
- Ministral-3B: matches GPT-4o on GSM8K for 60x less
- Kimi K2.6: 94% on ToxiGen (above Opus and GPT-4o)

**Implication:** Benchmarking only OpenAI vs Anthropic would miss these
findings. Provider diversity is essential for benchmark credibility.

**Risk of invalidation:** Low for the structural point. Specific model
rankings may shift with more data.

---

## Finding 11: RAG QA is the hardest generative task [STABLE]

RAG QA (SQuAD v2, answer from provided context only) is the most discriminative
generative task. Models that score 4.5+ on everything else drop to 3.0/5 here.

**Evidence:**
- Mistral Large: 3.0/5 on RAG QA vs 5.0/5 on sentiment, 4.8/5 on code gen
- Qwen 3.6 Flash: 3.0/5 on RAG QA vs 5.0/5 on data-to-text
- Gemini 2.0 Flash: 5.0/5 (only model to ace it with sufficient data)

**Implication:** RAG QA tests whether models follow the constraint "answer
ONLY from the provided context." Most models hallucinate additional information.
This is the task where model selection matters most for production quality.

**Risk of invalidation:** Low. The discriminative power is structural.

---

## Finding 12: Three task categories by discriminative power [STABLE]

Tasks fall into three categories based on how much they differentiate models:

**High discrimination (10+ point spread):** ToxiGen moderation (66-96%),
RAG QA (3.0-5.0), CLINC-150 intent (72-100%), GSM8K reasoning (86-98%)

**Medium discrimination (0.5-1.0 point spread on 1-5):** instruction following,
code review, test generation, function calling, translation, SQL, JSON transform

**Low discrimination (all models >4.5/5):** sentiment, email summary,
code explanation, data-to-text, NER extraction

**Implication:** The high-discrimination tasks are where model routing adds
the most value. The low-discrimination tasks confirm that all modern models
handle basic generation well, but they do not justify paying more for premium.

**Risk of invalidation:** None. This is an observed property of the benchmark.

---

## How to Update This Document

When new lots complete:
1. Re-check each finding against updated data
2. Update evidence sections with new numbers
3. Change [PRELIMINARY] to [STABLE] if the finding survived 3+ additional lots
4. Add new findings if the data reveals something new
5. Remove or mark [INVALIDATED] any finding contradicted by new data
6. Update the data snapshot at the top
