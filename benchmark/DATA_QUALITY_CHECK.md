# Data Quality Check

Date: 2026-05-07

## 1. Total Rows and Coherence

| Metric | Value |
|--------|-------|
| Total rows in CSV | 50,801 |
| Unique triples (task, model, case) | 50,801 |
| Duplicates | 0 |
| V2 rows | 49,461 |
| V1 rows (legacy) | 1,340 |
| Models with v2 data | 57 |
| Models at 21/21 tasks (>=40 cases) | 37 |
| Partial models | 20 |

**Expected vs actual:** 49 models x 21 tasks x 50 cases = 51,450 expected.
We have 49,461 v2 rows, a deficit of 1,989.

**Sources of the deficit:**
- 2 tasks (code_explanation, structured_output) have fewer than 50 cases in
  their datasets (48 and 41 respectively). This accounts for
  49 models x (2 + 9) = 539 missing rows.
- 8 Azure legacy models at 1-2 tasks each = ~440 rows instead of ~8,400.
  These are doublons and intentionally not completed.
- Several models have partial data on some tasks due to rate limiting
  (Gemini 2.0 Flash, mistral-large-latest, GPT-5.5 Pro, etc.)
- Some tasks had fewer than 50 cases due to API errors not retried.

## 2. Coverage Per Model

### Complete models (37 at 21/21 tasks with >=40 cases each)

claude-opus-4-7, claude-sonnet-4, claude-sonnet-4-6, claude-haiku-4-5,
gpt-4o, gpt-4o-mini, gpt-5.5, o3, gemini-2.5-flash, gemini-3.1-pro-preview,
MiniMax-M2.7, mistral-small-latest, ministral-3b-latest, devstral-latest,
kimi-k2.6, bytedance-seed/seed-2.0-lite, bytedance-seed/seed-2.0-mini,
bytedance-seed/seed-1.6-flash, seed-2-0-pro-260328, seed-2-0-code-preview-260328,
deepseek/deepseek-v3.2, deepseek/deepseek-v4-pro, qwen/qwen-max,
qwen/qwen3.6-flash, qwen/qwen3.6-max-preview, qwen/qwen3-8b, qwen/qwen-turbo,
qwen/qwen3-coder, x-ai/grok-4.20, x-ai/grok-4-fast, x-ai/grok-code-fast-1,
meta-llama/llama-4-maverick, meta-llama/llama-3.2-1b-instruct,
meta-llama/llama-3.2-3b-instruct, google/gemma-4-26b-a4b-it, microsoft/phi-4,
nvidia/nemotron-3-super-120b-a12b (19/21 but close)

### Partial models needing completion

| Model | Tasks done | Missing tasks | Cause |
|-------|-----------|---------------|-------|
| gpt-5.4 | 19/21 | multistep_reasoning, extraction_hard_v2 | Added late, not caught in catchup |
| gpt-5.4-mini | 19/21 | multistep_reasoning, extraction_hard_v2 | Same |
| gpt-5.4-nano | 19/21 | multistep_reasoning, extraction_hard_v2 | Same |
| gpt-5.5-pro | 17/21 | 4 tasks with partial cases | Slow reasoning model, timeouts |
| gpt-5.1-chat | 21/21 | - | Some tasks under 50 cases |
| o4-mini | 20/21 | extraction_hard_v2 partial | Azure timing issue |
| gemini-2.5-pro | 20/21 | Multiple tasks under 50 | Rate limiting |
| gemini-2.0-flash | 4/21 | 17 tasks | Free tier rate limit, only a few cases per task |
| mistral-large-latest | 5/21 | 16 tasks | Severe rate limiting despite paid tier |
| mistral-medium-latest | 20/21 | test_generation_v2 partial | Rate limiting |
| qwen/qwen3.6-plus | 20/21 | multistep_reasoning partial | Partial completion |
| deepseek/deepseek-v4-flash | 20/21 | test_generation_v2 partial | Late addition |

### Azure legacy doublons (intentionally incomplete, 1/21 tasks each)

Codestral-2501, DeepSeek-R1, DeepSeek-V3.2, Kimi-K2.6, Llama-4-Scout,
grok-4-20-non-reasoning, grok-4-20-reasoning, mistral-medium-2505.

These are the same model weights available via other providers. Not completing.

### Systematic under-50 cases (affects ALL models)

- **code_explanation**: 48 cases (dataset has 48, not 50)
- **structured_output**: 41 cases (dataset has 41, not 50)

These are dataset size issues, not execution issues.

## 3. Score Distribution Post-Rejudge

The 9 rejudged models still have zeros. The first rejudge covered 11 LLM-judged
tasks. But 950 additional zeros remain on tasks that were classified as "OK"
during investigation because some models scored fine on them.

**Root cause:** The same judge crash affected these tasks too, but not uniformly.
Models that ran earlier in the batch got scores; models that ran later got zeros.
The investigation only flagged tasks where ALL 9 models scored 0, missing tasks
where SOME models scored 0.

| Task | Zeros remaining | Type | Action needed |
|------|----------------|------|---------------|
| reasoning_gsm8k | 323 | LLM-judged | RE-JUDGE needed |
| sql_spider | 325 | LLM-judged | RE-JUDGE needed |
| intent_clinc150 | 116 | Exact-match | CHECK: real failures vs empty responses |
| sentiment_sst2 | 81 | Exact-match | CHECK: real failures vs empty responses |
| moderation_toxigen | 69 | Exact-match | CHECK: real failures vs empty responses |
| extraction_hard_v2 | 16 | LLM-judged | RE-JUDGE needed |
| multistep_reasoning | 10 | Exact-match | CHECK: real failures vs empty responses |
| function_calling | 7 | LLM-judged | RE-JUDGE needed |
| ner_extraction | 3 | LLM-judged | RE-JUDGE needed |

**For LLM-judged tasks (674 zeros):** Expand the rejudge script to include
reasoning_gsm8k, sql_spider, extraction_hard_v2, function_calling, ner_extraction.

**For exact-match tasks (276 zeros):** These need investigation. If the response
is non-empty and contains the expected label, the exact-match scoring failed
(e.g., response wrapped in explanation text). If the response is empty, it was
an API error during the original run.

## 4. Duplicates

Zero duplicates in the CSV. Dedup has been run consistently after each batch.

## 5. Outliers

No model averages below 2.5/5 after the first rejudge. However, DeepSeek V4 Pro
is at 2.64/5 which is low. 379 of its zeros are from the judge crash issue
described in section 3. After fixing, estimated true average: ~4.0-4.3/5.

## 6. Cost Sanity Check

| Metric | Value |
|--------|-------|
| Total v2 cost entries | 49,461 |
| NaN/invalid costs | 0 |
| Negative or >$1 per case | 0 |
| Min cost | $0.000000 |
| Max cost | $0.462114 (Qwen 3.6 Max Preview, function_calling) |
| Avg cost | $0.001810 |
| Total cost (from CSV) | $89.52 |

Most expensive cases are GPT-5.5 Pro on code_review ($0.20-0.28) and
Qwen 3.6 Max Preview on function_calling ($0.46). These are legitimate:
reasoning models and long prompts.

No NaN, no negative values, no absurd outliers. Costs are clean.

## Summary: Actions Needed Before Analysis

1. **CRITICAL: Re-judge 674 more zeros** on LLM-judged tasks (reasoning_gsm8k,
   sql_spider, extraction_hard_v2, function_calling, ner_extraction).
   Expand AFFECTED_TASKS in re_judge_failed_scores.py and re-run.

2. **INVESTIGATE: 276 zeros on exact-match tasks** (intent_clinc150,
   sentiment_sst2, moderation_toxigen, multistep_reasoning). Check raw
   responses to determine if these are real failures or empty responses.

3. **NICE TO HAVE: Complete partial models** (gpt-5.4 family missing 2 tasks,
   mistral-large-latest missing 16 tasks). Not blocking for analysis but
   creates holes in the comparison tables.

4. **DO NOT FIX: Azure legacy doublons** (8 models at 1-2 tasks). Intentional.

5. **DO NOT FIX: code_explanation at 48 cases, structured_output at 41 cases.**
   Dataset size limitation, not execution issue.
