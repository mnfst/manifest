# TaskBench: Questions This Benchmark Answers

Last updated: 2026-05-02

This is the North Star of the project. Every task, every model, every data point
exists to answer one or more of these questions. If a question cannot be answered
with the current data, it is marked as such.

## Core Questions (cost vs quality)

**Q1. For a given production task, which model delivers acceptable quality at the lowest cost?**
Status: ANSWERABLE. 55 models x 21 tasks. This is the main output of the benchmark.
Graph: Per-task Pareto frontier (cost on X, quality on Y, one dot per model).

**Q2. Do economy models ($0.10-0.15/M) match premium models ($5-15/M) on simple tasks?**
Status: ANSWERABLE. Finding #1 confirmed across 21 tasks.
Graph: Tier comparison bar chart (avg quality by price tier per task).

**Q3. Do reasoning models justify their extra cost on complex tasks?**
Status: PARTIALLY ANSWERABLE. GPT-5.5 Pro has format scoring bug. Opus diverges on judge vs accuracy. Data exists but needs rescoring on 2-3 models.
Graph: Reasoning tier cost-per-correct-answer vs other tiers on GSM8K, ARC, RAG QA.

**Q4. Within a single provider, what is the quality gradient from cheap to expensive?**
Status: ANSWERABLE. OpenAI has 6 tiers (nano to 5.5 Pro), Mistral has 4, Qwen has 5.
Graph: Per-provider quality curve (price on X, quality on Y, one line per provider).

**Q5. At the same price tier, which provider wins?**
Status: ANSWERABLE. Haiku vs GPT-5.4-mini vs Gemini Flash vs Mistral Small etc.
Graph: Head-to-head comparison table at each tier.

## Structural Questions

**Q6. Which tasks are "commodity" (all models perform equally) vs discriminative?**
Status: ANSWERABLE. Finding #12. Sentiment/data-to-text are commodity. ToxiGen/RAG QA discriminate.
Graph: Task discriminativeness chart (spread between best and worst model per task).

**Q7. What is the "cost per correct answer" for each model?**
Status: ANSWERABLE on exact-match tasks (sentiment, intent, moderation, multistep reasoning). Need to define "correct" for LLM-judged tasks (score >= 4?).
Graph: Cost-per-correct-answer bar chart per model, colored by tier.

**Q8. Is there a quality floor below which models become unreliable?**
Status: ANSWERABLE. Finding: 1B params is below the floor. 3B is the minimum for classification.
Graph: Quality vs model size scatter (params on X, avg quality on Y).

## Cross-cutting Questions

**Q9. Are Chinese models (DeepSeek, Qwen, Kimi, ByteDance, MiniMax) competitive with American models (OpenAI, Anthropic, Google)?**
Status: ANSWERABLE. 13 Chinese-origin models vs 15 American-origin models.
Graph: Boxplot of quality distribution, Chinese vs American, per task.

**Q10. Are open-weight models (Llama, DeepSeek, Qwen, Gemma, Phi, Nemotron) competitive with closed-source (GPT, Claude, Gemini)?**
Status: ANSWERABLE.
Graph: Same as Q9 but open vs closed.

**Q11. Does the current generation (2026) improve over the previous (2024-2025)?**
Status: ANSWERABLE for OpenAI (GPT-4o vs 5.x). Partially for others (Sonnet 4 vs 4.6, DeepSeek V3.2 vs V4, Seed 1.6 vs 2.0). Secondary finding, appendix material.
Graph: Before/after bar chart per provider showing quality delta.

**Q12. For an AI agent (the Manifest use case), what set of 3-4 models covers all task tiers at the best total cost?**
Status: ANSWERABLE. This is the "recommended routing configuration" output.
Graph: Coverage matrix showing which models handle which tasks optimally.

## Practical Questions

**Q13. For each concrete use case, what are the top 5 models by cost-quality ratio?**
Status: ANSWERABLE. Map use cases to benchmark tasks, rank by quality/cost.
Output: Table, not a graph. Goes in Practical Recommendations section.

**Q14. Does routing (picking different models per task) actually save money vs using one model for everything?**
Status: ANSWERABLE. Compare: cost of best single model on all tasks vs cost of per-task optimal model. This directly validates Manifest.
Graph: Two bars showing total cost for "one model fits all" vs "routed per task".

**Q15. Where does per-task routing have the most value?**
Status: ANSWERABLE. Finding #12: high-discrimination tasks benefit most from routing. Commodity tasks do not (any cheap model works).
Graph: Savings from routing per task (delta between cheapest adequate and most expensive adequate).

## Questions We Cannot Answer (limitations)

- **Latency**: we do not measure response time.
- **Vision tasks**: excluded because not all models support image input.
- **Multi-turn conversation**: runner is single-turn only.
- **Self-hosted models**: all models are cloud API, no Ollama/vLLM.
- **Fine-tuned models**: all models are base/instruct, no custom fine-tunes.
- **Real production workloads**: our tasks are synthetic 50-case samples, not production traffic.

## Graphs We Can Generate

| Graph | What it shows | Which questions it answers |
|-------|--------------|--------------------------|
| Per-task Pareto frontier | Cost vs quality scatter with frontier line | Q1, Q3 |
| Cross-task heatmap | Quality score by model x task | Q6, Q9, Q10 |
| Cost-efficiency scatter | Avg cost vs avg quality across all tasks | Q1, Q2 |
| Cheapest adequate bar chart | Cost of cheapest model at >=90% quality per task | Q1, Q7 |
| Tier comparison | Avg quality by price tier per task | Q2, Q5 |
| Provider gradient | Quality curve from cheap to expensive per provider | Q4 |
| Task discriminativeness | Spread (max-min quality) per task | Q6, Q15 |
| Routing savings | One-model vs routed cost comparison | Q14, Q15 |
| Generational delta | Quality improvement old vs new gen per provider | Q11 |
| Cost-per-correct-answer | Cost to get one correct answer per model | Q7 |
| Chinese vs American boxplot | Quality distribution by origin | Q9 |
| Open vs closed boxplot | Quality distribution by license type | Q10 |
| Coverage matrix | Which models win on which tasks | Q12 |
