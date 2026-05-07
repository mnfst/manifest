# Suspect Models Investigation

Date: 2026-05-07

## Summary

9 models score below 3.0/5 overall. Investigation reveals a single root cause
affecting all 9: the LLM judge (GPT-4o-mini) crashed due to OpenAI quota
exhaustion during batch 2 execution. Models responded correctly but received
score 0 because the judge could not evaluate them.

## Root Cause

When OpenAI credits ran out mid-batch, `judge_response()` in `run_batch.py`
called `call_openai("gpt-4o-mini", ...)` which returned
`{"error": "You exceeded your current quota"}`. The error handler returned
score 0. This affected ALL LLM-judged tasks for ALL models that ran after
the credits were exhausted.

**This is NOT a model quality issue. It is a judge infrastructure failure.**

## Evidence

1. **Same 11 tasks fail for all 9 models.** The failing tasks are all LLM-judged:
   code_explanation, code_generation, code_review_v2, data_to_text,
   email_summary_v2, instruction_following, json_transform_v2,
   long_summarization, rag_qa, structured_output, test_generation_v2.

2. **Same 10 tasks succeed for all 9 models.** The passing tasks are either
   exact-match (sentiment, intent, moderation, multistep) or LLM-judged tasks
   that ran before credits ran out (extraction_hard, function_calling, NER,
   translation, SQL).

3. **Raw responses are correct.** Checked 3-5 responses per model on failing
   tasks. Examples:
   - Qwen-Max on RAG QA: "Lake Überlingen" (correct answer, scored 0)
   - Grok-4-fast on code_generation: `return ''.join(strings)` (correct, scored 0)
   - DeepSeek V4 Pro on reasoning: correct math solution (scored 0)

## Affected Models

| Model | Overall Score | Actual Quality (estimated) | Tasks Needing Rescore |
|-------|-------------|---------------------------|----------------------|
| deepseek/deepseek-v4-pro | 1.1/5 | ~4.0-4.5 | 11 LLM-judged tasks |
| nvidia/nemotron-3-super-120b-a12b | 1.3/5 | ~3.5-4.0 | 11 LLM-judged tasks |
| bytedance-seed/seed-2.0-mini | 1.8/5 | ~4.3-4.5 | 11 LLM-judged tasks |
| meta-llama/llama-4-maverick | 1.8/5 | ~4.3-4.5 | 11 LLM-judged tasks |
| x-ai/grok-code-fast-1 | 1.8/5 | ~4.4-4.6 | 11 LLM-judged tasks |
| qwen/qwen-max | 1.8/5 | ~4.5-4.7 | 11 LLM-judged tasks |
| x-ai/grok-4-fast | 1.8/5 | ~4.5-4.7 | 11 LLM-judged tasks |
| qwen/qwen3.6-plus | 1.9/5 | ~4.3-4.5 | 11 LLM-judged tasks |
| qwen/qwen3-coder | 2.2/5 | ~4.3-4.5 | 11 LLM-judged tasks |

"Actual Quality" estimated from the 10 tasks where the judge worked correctly.

## Fix

**Option A: Rescore from raw responses (RECOMMENDED)**
Delete the 0-score rows for the 11 affected tasks on all 9 models.
Re-run with OpenAI credits available. The raw responses are saved,
but the runner re-calls the model (it does not rescore from saved responses).
Cost: ~$2-3 (judge calls only for exact-match tasks, full re-run for LLM-judged).

**Option B: Build a rescore script**
Write a script that reads raw responses from `results/raw/` and re-calls
only the judge (not the model). This would be cheaper (~$0.50) and faster.
Requires a new script.

## Decision

Pending user approval. Do not re-run without explicit confirmation.

## Prevention

Add a check in `judge_response()`: if the judge returns an error, log it
prominently and skip the case (do not write score 0 to CSV). Currently the
error is silently converted to score 0, which is indistinguishable from a
genuine 0.
