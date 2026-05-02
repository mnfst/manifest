# TaskBench: Related Work and Positioning

Last updated: 2026-05-02

This document positions TaskBench relative to existing LLM benchmarks. Written
to prepare for reviewer comments, paper introduction, and audience questions
like "how is this different from X?"

## The Gap TaskBench Fills

Existing benchmarks answer one of:
- "Which model is smartest overall?" (MMLU, LMSYS Arena)
- "Which router picks the best model?" (RouterArena, RouterBench)
- "How can I reduce LLM cost?" (FrugalGPT, cascading approaches)

None answer: **"For my specific production task, which model gives acceptable
quality at the lowest cost?"** That is what TaskBench measures.

## Benchmark Comparison Table

| Benchmark | What it measures | Tasks | Models | Cost axis? | Per-task? | Our differentiation |
|-----------|-----------------|-------|--------|-----------|----------|-------------------|
| **MMLU** | General knowledge | 57 academic subjects | ~50 | No | Yes but academic | We measure production tasks, not exam questions |
| **LMSYS Chatbot Arena** | Human preference (pairwise) | Open-ended chat | ~100 | No | No (aggregate) | We measure per-task, they measure overall preference |
| **HELM** (Stanford) | Comprehensive capabilities | 42 scenarios | ~30 | No | Yes | We add cost as a primary axis, they only measure quality |
| **RouterArena** | Router quality | Delegates to benchmarks | Routers, not models | Indirectly | No | We benchmark models directly, they benchmark routers |
| **RouterBench** | Router efficiency | Similar to RouterArena | Routers | Yes (routing cost) | No | Same distinction: we rank models, they rank routers |
| **FrugalGPT** (2023) | Cost reduction via cascading | 1-2 datasets | 3-5 | Yes | No (single task) | We test 16+ tasks and 30 models, not cascading |
| **Cost-Aware Model Selection** (2025) | Cost-quality for classification | 1 classification task | ~10 | Yes | Single task only | We extend this idea to 16+ production tasks |
| **CEBench** | Infrastructure efficiency | Throughput, latency | ~10 | Infra cost | No | We measure API cost per query, not infrastructure |
| **Artificial Analysis** | Speed + price comparison | Aggregate quality | ~50 | Yes | No (aggregate) | We provide per-task granularity they do not |
| **TaskBench (ours)** | Cost-quality per production task | 16+ production tasks | 30 models, 7 providers | Yes (primary axis) | Yes (per-task Pareto) | First systematic multi-task cost-quality benchmark |

## Detailed Comparisons

### vs MMLU and Academic Benchmarks

MMLU tests whether a model knows facts ("What is the capital of Mongolia?").
TaskBench tests whether a model can do production work ("Classify this customer
message as one of 150 intents"). Academic benchmarks correlate with general
capability but do not tell you which model to use for your specific API call.
A model that scores 90% on MMLU might score 66% on adversarial content
moderation (as we found with Ministral-3B on ToxiGen).

### vs LMSYS Chatbot Arena

Arena produces a single Elo rating per model from human pairwise comparisons.
It answers "which model do humans prefer overall" but not "which model is best
for sentiment classification" or "which model is cheapest for function calling."
Arena also has no cost axis. A model ranked #1 on Arena might cost 100x more
than the #10 model for the same quality on a specific task.

### vs RouterArena and RouterBench

These benchmark routing systems, not models. They assume you already have a
set of models and test whether a router (like Manifest) picks the right one.
TaskBench produces the data that a router would USE to make decisions. In fact,
TaskBench findings directly validate the routing thesis: different models win
on different tasks, confirming that a router adds value.

### vs FrugalGPT

FrugalGPT (Chen et al., 2023) pioneered cost-aware LLM usage but tested on a
single dataset with 3-5 models and focused on cascading (try cheap first, fall
back to expensive). TaskBench is broader: 16+ tasks, 30 models, direct
comparison without cascading. The FrugalGPT cascading approach and TaskBench
findings are complementary: TaskBench tells you which model to pick per task,
FrugalGPT tells you how to cascade within a task.

### vs Cost-Aware Model Selection (2025)

This paper is the closest to TaskBench. It does exactly cost-quality comparison
for text classification models. The limitation: it covers one task category
(classification) with ~10 models. TaskBench extends this to 16+ task categories
covering classification, generation, structured output, reasoning, and coding.
We cite this paper as direct inspiration and acknowledge their methodology
influenced our approach.

### vs Artificial Analysis

Artificial Analysis provides speed and price comparison across many models,
but quality scores are aggregate (not per-task). You can see that Model A is
faster and cheaper than Model B, but not whether Model A is better for SQL
generation specifically. TaskBench adds per-task quality granularity.

## What TaskBench Does NOT Replace

- **MMLU/LMSYS for model ranking:** If you want to know which model is
  "smartest" overall, use established benchmarks.
- **RouterArena for router evaluation:** If you want to compare routing
  systems, use RouterArena.
- **Custom evals for your specific use case:** TaskBench covers common
  production tasks. If your task is highly specialized, you still need
  custom evaluation.

TaskBench fills the gap between "which model is generally best" and "which
model should I use for THIS specific API call, considering cost."

## Key Citations for the Paper

1. Hendrycks et al., 2021 - MMLU (the standard general knowledge benchmark)
2. Zheng et al., 2023 - LMSYS Chatbot Arena (human preference benchmark)
3. Chen et al., 2023 - FrugalGPT (cost-aware LLM usage, cascading)
4. Liang et al., 2023 - HELM (holistic evaluation framework)
5. Li et al., 2025 - RouterArena (router benchmarking)
6. [Author], 2025 - Cost-Aware Model Selection (cost-quality for classification)
7. Bommasani et al., 2022 - Foundation Models report (landscape context)

## One-Line Pitch

"TaskBench is the first benchmark that systematically answers: for each
production LLM task, which model delivers acceptable quality at the lowest
cost? We test 55 models from 13 providers across 21 production tasks and find
that economy models ($0.10-0.15/M tokens) match premium models ($5-15/M) on
12 of 16 tasks."
