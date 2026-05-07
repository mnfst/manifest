# TaskBench Analysis Report

Generated from 50787 data points

- **Tasks:** 34
- **Models:** 57
- **Total API spend:** $91.17

## Cheapest Adequate Model per Task (>=90% of max quality)

| Task | Cheapest Model | Score | Cost/query | vs Most Expensive | Savings |
|------|---------------|-------|-----------|-------------------|---------|
| code_explanation | qwen/qwen-turbo | 5.0/5 | $0.000007 | claude-opus-4-7 ($0.0114) | 100% |
| code_generation | google/gemma-4-26b-a4b-it | 4.5/5 | $0.000015 | gpt-5.5-pro ($0.0157) | 100% |
| code_review | Llama-4-Scout | 4.0/5 | $0.000131 | Gemini 2.5 Pro ($0.0184) | 99% |
| code_review_v2 | mistral-medium-latest | 4.6/5 | $0.001630 | o3 ($0.0126) | 87% |
| content_moderation | Gemini 2.5 Flash | 5.0/5 | $0.000010 | MiniMax M2.7 ($0.0007) | 99% |
| data_to_text | ministral-3b-latest | 4.9/5 | $0.000009 | claude-opus-4-7 ($0.0118) | 100% |
| email_summary | Llama-4-Scout | 4.4/5 | $0.000045 | Claude Sonnet 4 ($0.0018) | 98% |
| email_summary_v2 | qwen/qwen-turbo | 4.9/5 | $0.000005 | claude-opus-4-7 ($0.0100) | 100% |
| entity_extraction | Llama-4-Scout | 4.6/5 | $0.000025 | MiniMax M2.7 ($0.0023) | 99% |
| extraction_hard | Llama-4-Scout | 3.8/5 | $0.000056 | MiniMax M2.7 ($0.0042) | 99% |
| extraction_hard_v2 | qwen/qwen-turbo | 4.6/5 | $0.000017 | claude-opus-4-7 ($0.0255) | 100% |
| function_calling | qwen/qwen-turbo | 4.4/5 | $0.000004 | qwen/qwen3.6-max-preview ($0.0131) | 100% |
| instruction_following | qwen/qwen-turbo | 4.7/5 | $0.000004 | claude-opus-4-7 ($0.0168) | 100% |
| intent_clinc150 | qwen/qwen3-8b | 4.5/5 | $0.000036 | claude-opus-4-7 ($0.0136) | 100% |
| intent_easy | gpt-4o-mini | 5.0/5 | $0.000013 | MiniMax M2.7 ($0.0008) | 98% |
| intent_hard | gpt-4o-mini | 4.5/5 | $0.000018 | Kimi K2.6 ($0.0014) | 99% |
| json_transform | gpt-4o-mini | 4.8/5 | $0.000052 | o4-mini ($0.0019) | 97% |
| json_transform_v2 | qwen/qwen-turbo | 4.5/5 | $0.000007 | qwen/qwen3.6-max-preview ($0.0098) | 100% |
| long_summarization | meta-llama/llama-3.2-1b-instruct | 4.5/5 | $0.000012 | claude-opus-4-7 ($0.0252) | 100% |
| moderation_toxigen | microsoft/phi-4 | 4.5/5 | $0.000005 | gpt-5.5-pro ($0.0024) | 100% |
| multistep_reasoning | ministral-3b-latest | 4.5/5 | $0.000005 | qwen/qwen3.6-max-preview ($0.0050) | 100% |
| ner_extraction | qwen/qwen-turbo | 4.3/5 | $0.000004 | claude-opus-4-7 ($0.0054) | 100% |
| rag_qa | qwen/qwen-turbo | 5.0/5 | $0.000008 | gpt-5.5-pro ($0.0028) | 100% |
| reasoning | Gemini 2.5 Flash | 4.1/5 | $0.000308 | Gemini 2.5 Pro ($0.0043) | 93% |
| reasoning_gsm8k | qwen/qwen-turbo | 4.8/5 | $0.000010 | qwen/qwen3.6-max-preview ($0.0077) | 100% |
| sentiment | gpt-4o-mini | 4.5/5 | $0.000009 | MiniMax M2.7 ($0.0006) | 98% |
| sentiment_sst2 | qwen/qwen-turbo | 4.6/5 | $0.000002 | qwen/qwen3.6-max-preview ($0.0022) | 100% |
| sql_generation | Llama-4-Scout | 4.8/5 | $0.000029 | MiniMax M2.7 ($0.0026) | 99% |
| sql_spider | qwen/qwen-turbo | 4.6/5 | $0.000003 | gpt-5.5-pro ($0.0216) | 100% |
| structured_output | meta-llama/llama-3.2-1b-instruct | 4.5/5 | $0.000007 | claude-opus-4-7 ($0.0100) | 100% |
| test_generation | gpt-4o-mini | 3.6/5 | $0.000472 | Gemini 2.5 Pro ($0.0183) | 97% |
| test_generation_v2 | qwen/qwen-turbo | 4.8/5 | $0.000022 | gpt-5.5-pro ($0.0847) | 100% |
| translation | Llama-4-Scout | 4.6/5 | $0.000032 | Kimi K2.6 ($0.0036) | 99% |
| translation_enfr | qwen/qwen-turbo | 4.5/5 | $0.000003 | qwen/qwen3.6-max-preview ($0.0118) | 100% |

## Quality by Price Class

| Price Class | Avg Quality | Min | Max | Models |
|------------|-------------|-----|-----|--------|
| Premium | 4.34/5 | 0.4 | 5.0 | 42 entries |
| Standard | 4.34/5 | 0.0 | 5.0 | 423 entries |
| Economy | 3.76/5 | 0.0 | 5.0 | 593 entries |
| Micro | 3.95/5 | 0.0 | 5.0 | 189 entries |

## Surprise Findings

Cases where cheap models match or beat expensive ones:

- **code_explanation**: gpt-4o-mini (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 9x less cost
- **code_explanation**: Gemini 2.5 Flash (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 10x less cost
- **code_explanation**: Gemini 2.0 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 15x less cost
- **code_explanation**: mistral-small-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 15x less cost
- **code_explanation**: ministral-3b-latest (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 71x less cost
- **code_explanation**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 6x less cost
- **code_explanation**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 6x less cost
- **code_explanation**: gpt-5.4-nano (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 13x less cost
- **code_explanation**: devstral-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 15x less cost
- **code_explanation**: meta-llama/llama-3.2-3b-instruct (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 56x less cost
- **code_explanation**: qwen/qwen-turbo (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 88x less cost
- **code_explanation**: qwen/qwen3-8b (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 20x less cost
- **code_explanation**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 47x less cost
- **code_explanation**: microsoft/phi-4 (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 34x less cost
- **code_generation**: gpt-4o-mini (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 10x less cost
- **code_generation**: mistral-small-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 15x less cost
- **code_generation**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 5x less cost
- **code_generation**: gpt-5.4-nano (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 12x less cost
- **code_generation**: devstral-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 17x less cost
- **code_generation**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 40x less cost
- **code_review**: DeepSeek V3.2 (Economy, $0.0008) matches Grok-4 (Standard, $0.0062) at 8x less cost
- **content_moderation**: DeepSeek V3.2 (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 10x less cost
- **content_moderation**: Llama-4-Scout (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 17x less cost
- **content_moderation**: Mistral Medium (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 7x less cost
- **content_moderation**: Codestral (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **content_moderation**: gpt-4o-mini (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 19x less cost
- **content_moderation**: Gemini 2.5 Flash (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 21x less cost
- **data_to_text**: claude-haiku-4-5-20251001 (Economy, $0.0006) matches claude-opus-4-7 (Premium, $0.0118) at 20x less cost
- **data_to_text**: gpt-4o-mini (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0118) at 175x less cost
- **data_to_text**: Gemini 2.5 Flash (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0118) at 183x less cost
- **data_to_text**: mistral-small-latest (Economy, $0.0000) matches claude-opus-4-7 (Premium, $0.0118) at 291x less cost
- **data_to_text**: ministral-3b-latest (Micro, $0.0000) matches claude-opus-4-7 (Premium, $0.0118) at 1340x less cost
- **data_to_text**: kimi-k2.6 (Economy, $0.0020) matches claude-opus-4-7 (Premium, $0.0118) at 6x less cost
- **data_to_text**: bytedance-seed/seed-2.0-lite (Economy, $0.0007) matches claude-opus-4-7 (Premium, $0.0118) at 16x less cost
- **data_to_text**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches claude-opus-4-7 (Premium, $0.0118) at 73x less cost
- **data_to_text**: qwen/qwen3.6-flash (Economy, $0.0012) matches claude-opus-4-7 (Premium, $0.0118) at 10x less cost
- **data_to_text**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0118) at 107x less cost
- **data_to_text**: mistral-medium-latest (Economy, $0.0003) matches claude-opus-4-7 (Premium, $0.0118) at 44x less cost
- **data_to_text**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0118) at 103x less cost
- **data_to_text**: seed-2-0-pro-260328 (Economy, $0.0011) matches claude-opus-4-7 (Premium, $0.0118) at 11x less cost
- **data_to_text**: seed-2-0-code-preview-260328 (Economy, $0.0017) matches claude-opus-4-7 (Premium, $0.0118) at 7x less cost
- **email_summary**: Mistral Medium (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0018) at 9x less cost
- **email_summary**: Codestral (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0018) at 18x less cost
- **email_summary**: gpt-4o-mini (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0018) at 30x less cost
- **email_summary**: Gemini 2.5 Flash (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0018) at 27x less cost
- **email_summary_v2**: claude-haiku-4-5-20251001 (Economy, $0.0004) matches claude-opus-4-7 (Premium, $0.0100) at 28x less cost
- **email_summary_v2**: gpt-4o-mini (Economy, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 201x less cost
- **email_summary_v2**: Gemini 2.5 Flash (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0100) at 197x less cost
- **email_summary_v2**: mistral-small-latest (Economy, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 323x less cost
- **email_summary_v2**: ministral-3b-latest (Micro, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 1394x less cost
- **email_summary_v2**: kimi-k2.6 (Economy, $0.0015) matches claude-opus-4-7 (Premium, $0.0100) at 7x less cost
- **email_summary_v2**: bytedance-seed/seed-2.0-lite (Economy, $0.0008) matches claude-opus-4-7 (Premium, $0.0100) at 13x less cost
- **email_summary_v2**: bytedance-seed/seed-1.6-flash (Micro, $0.0001) matches claude-opus-4-7 (Premium, $0.0100) at 85x less cost
- **email_summary_v2**: qwen/qwen3.6-flash (Economy, $0.0012) matches claude-opus-4-7 (Premium, $0.0100) at 9x less cost
- **email_summary_v2**: Gemini 2.0 Flash (Economy, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 323x less cost
- **email_summary_v2**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0100) at 134x less cost
- **email_summary_v2**: mistral-medium-latest (Economy, $0.0002) matches claude-opus-4-7 (Premium, $0.0100) at 52x less cost
- **email_summary_v2**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0100) at 123x less cost
- **email_summary_v2**: gpt-5.4-mini (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0100) at 89x less cost
- **email_summary_v2**: gpt-5.4-nano (Economy, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 266x less cost
- **email_summary_v2**: devstral-latest (Economy, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 334x less cost
- **email_summary_v2**: meta-llama/llama-3.2-3b-instruct (Micro, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 1040x less cost
- **email_summary_v2**: qwen/qwen-turbo (Micro, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 1829x less cost
- **email_summary_v2**: qwen/qwen3-8b (Micro, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 490x less cost
- **email_summary_v2**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 1053x less cost
- **email_summary_v2**: microsoft/phi-4 (Micro, $0.0000) matches claude-opus-4-7 (Premium, $0.0100) at 884x less cost
- **email_summary_v2**: seed-2-0-pro-260328 (Economy, $0.0009) matches claude-opus-4-7 (Premium, $0.0100) at 11x less cost
- **email_summary_v2**: seed-2-0-code-preview-260328 (Economy, $0.0013) matches claude-opus-4-7 (Premium, $0.0100) at 8x less cost
- **entity_extraction**: Llama-4-Scout (Economy, $0.0000) matches o4-mini (Standard, $0.0015) at 61x less cost
- **entity_extraction**: Mistral Medium (Economy, $0.0001) matches o4-mini (Standard, $0.0015) at 11x less cost
- **extraction_hard**: Llama-4-Scout (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 31x less cost
- **extraction_hard**: Gemini 2.5 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 12x less cost
- **extraction_hard**: Gemini 2.0 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 24x less cost
- **extraction_hard_v2**: gpt-5.4-mini (Economy, $0.0003) matches gpt-4o (Standard, $0.0030) at 11x less cost
- **extraction_hard_v2**: gpt-5.4-nano (Economy, $0.0001) matches gpt-4o (Standard, $0.0030) at 23x less cost
- **extraction_hard_v2**: gpt-4o-mini (Economy, $0.0002) matches gpt-4o (Standard, $0.0030) at 16x less cost
- **extraction_hard_v2**: Gemini 2.5 Flash (Economy, $0.0002) matches gpt-4o (Standard, $0.0030) at 13x less cost
- **extraction_hard_v2**: Gemini 2.0 Flash (Economy, $0.0001) matches gpt-4o (Standard, $0.0030) at 25x less cost
- **extraction_hard_v2**: mistral-small-latest (Economy, $0.0001) matches gpt-4o (Standard, $0.0030) at 27x less cost
- **extraction_hard_v2**: ministral-3b-latest (Micro, $0.0000) matches gpt-4o (Standard, $0.0030) at 138x less cost
- **extraction_hard_v2**: devstral-latest (Economy, $0.0001) matches gpt-4o (Standard, $0.0030) at 27x less cost
- **extraction_hard_v2**: bytedance-seed/seed-1.6-flash (Micro, $0.0003) matches gpt-4o (Standard, $0.0030) at 10x less cost
- **extraction_hard_v2**: deepseek/deepseek-v3.2 (Economy, $0.0003) matches gpt-4o (Standard, $0.0030) at 9x less cost
- **extraction_hard_v2**: deepseek/deepseek-v4-flash (Economy, $0.0003) matches gpt-4o (Standard, $0.0030) at 9x less cost
- **extraction_hard_v2**: meta-llama/llama-4-maverick (Economy, $0.0002) matches gpt-4o (Standard, $0.0030) at 16x less cost
- **extraction_hard_v2**: qwen/qwen-turbo (Micro, $0.0000) matches gpt-4o (Standard, $0.0030) at 171x less cost
- **extraction_hard_v2**: qwen/qwen3-8b (Micro, $0.0001) matches gpt-4o (Standard, $0.0030) at 52x less cost
- **extraction_hard_v2**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches gpt-4o (Standard, $0.0030) at 88x less cost
- **function_calling**: DeepSeek V3.2 (Economy, $0.0001) matches gpt-4o (Standard, $0.0006) at 7x less cost
- **function_calling**: gpt-4o-mini (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 17x less cost
- **function_calling**: Gemini 2.5 Flash (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 12x less cost
- **function_calling**: mistral-small-latest (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 26x less cost
- **function_calling**: ministral-3b-latest (Micro, $0.0000) matches gpt-4o (Standard, $0.0006) at 101x less cost
- **function_calling**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches gpt-4o (Standard, $0.0006) at 8x less cost
- **function_calling**: gpt-5.4-mini (Economy, $0.0001) matches gpt-4o (Standard, $0.0006) at 10x less cost
- **function_calling**: gpt-5.4-nano (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 29x less cost
- **function_calling**: devstral-latest (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 27x less cost
- **function_calling**: qwen/qwen-turbo (Micro, $0.0000) matches gpt-4o (Standard, $0.0006) at 129x less cost
- **function_calling**: qwen/qwen3-8b (Micro, $0.0000) matches gpt-4o (Standard, $0.0006) at 18x less cost
- **function_calling**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches gpt-4o (Standard, $0.0006) at 62x less cost
- **function_calling**: microsoft/phi-4 (Micro, $0.0000) matches gpt-4o (Standard, $0.0006) at 58x less cost
- **function_calling**: qwen/qwen3-coder (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 12x less cost
- **function_calling**: Gemini 2.0 Flash (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 25x less cost
- **instruction_following**: Gemini 2.5 Flash (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0014) at 13x less cost
- **instruction_following**: mistral-small-latest (Economy, $0.0000) matches gpt-5.5 (Standard, $0.0014) at 36x less cost
- **instruction_following**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0014) at 10x less cost
- **instruction_following**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0014) at 10x less cost
- **instruction_following**: gpt-5.4-mini (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0014) at 14x less cost
- **instruction_following**: gpt-5.4-nano (Economy, $0.0000) matches gpt-5.5 (Standard, $0.0014) at 37x less cost
- **instruction_following**: devstral-latest (Economy, $0.0000) matches gpt-5.5 (Standard, $0.0014) at 33x less cost
- **instruction_following**: qwen/qwen-turbo (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0014) at 361x less cost
- **instruction_following**: qwen/qwen3-8b (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0014) at 43x less cost
- **intent_easy**: gpt-4o-mini (Economy, $0.0000) matches gpt-4o (Standard, $0.0002) at 17x less cost
- **intent_hard**: Llama-4-Scout (Economy, $0.0000) matches gpt-4o (Standard, $0.0003) at 15x less cost
- **intent_hard**: Codestral (Economy, $0.0000) matches gpt-4o (Standard, $0.0003) at 8x less cost
- **json_transform**: DeepSeek V3.2 (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 7x less cost
- **json_transform**: Codestral (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 6x less cost
- **json_transform**: gpt-4o-mini (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 13x less cost
- **json_transform**: Gemini 2.5 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 10x less cost
- **json_transform_v2**: gpt-4o-mini (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0023) at 44x less cost
- **json_transform_v2**: mistral-small-latest (Economy, $0.0000) matches gpt-5.5 (Standard, $0.0023) at 63x less cost
- **json_transform_v2**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0023) at 23x less cost
- **json_transform_v2**: gpt-5.4-mini (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0023) at 23x less cost
- **json_transform_v2**: gpt-5.4-nano (Economy, $0.0000) matches gpt-5.5 (Standard, $0.0023) at 70x less cost
- **json_transform_v2**: devstral-latest (Economy, $0.0000) matches gpt-5.5 (Standard, $0.0023) at 61x less cost
- **json_transform_v2**: qwen/qwen-turbo (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0023) at 330x less cost
- **json_transform_v2**: qwen/qwen3-8b (Micro, $0.0001) matches gpt-5.5 (Standard, $0.0023) at 46x less cost
- **json_transform_v2**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0023) at 165x less cost
- **long_summarization**: gpt-4o-mini (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0028) at 23x less cost
- **long_summarization**: Gemini 2.5 Flash (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0028) at 23x less cost
- **long_summarization**: mistral-small-latest (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0028) at 35x less cost
- **long_summarization**: ministral-3b-latest (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0028) at 146x less cost
- **long_summarization**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches gpt-5.5 (Standard, $0.0028) at 12x less cost
- **long_summarization**: deepseek/deepseek-v3.2 (Economy, $0.0002) matches gpt-5.5 (Standard, $0.0028) at 14x less cost
- **long_summarization**: mistral-medium-latest (Economy, $0.0005) matches gpt-5.5 (Standard, $0.0028) at 6x less cost
- **long_summarization**: deepseek/deepseek-v4-flash (Economy, $0.0002) matches gpt-5.5 (Standard, $0.0028) at 16x less cost
- **long_summarization**: gpt-5.4-mini (Economy, $0.0003) matches gpt-5.5 (Standard, $0.0028) at 11x less cost
- **long_summarization**: gpt-5.4-nano (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0028) at 28x less cost
- **long_summarization**: devstral-latest (Economy, $0.0001) matches gpt-5.5 (Standard, $0.0028) at 37x less cost
- **long_summarization**: meta-llama/llama-3.2-3b-instruct (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0028) at 127x less cost
- **long_summarization**: qwen/qwen-turbo (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0028) at 198x less cost
- **long_summarization**: qwen/qwen3-8b (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0028) at 71x less cost
- **long_summarization**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0028) at 110x less cost
- **long_summarization**: microsoft/phi-4 (Micro, $0.0000) matches gpt-5.5 (Standard, $0.0028) at 97x less cost
- **moderation_toxigen**: bytedance-seed/seed-1.6-flash (Micro, $0.0001) matches gpt-5.5-pro (Premium, $0.0024) at 32x less cost
- **moderation_toxigen**: x-ai/grok-4-fast (Economy, $0.0002) matches gpt-5.5-pro (Premium, $0.0024) at 13x less cost
- **moderation_toxigen**: x-ai/grok-code-fast-1 (Economy, $0.0003) matches gpt-5.5-pro (Premium, $0.0024) at 9x less cost
- **moderation_toxigen**: nvidia/nemotron-3-super-120b-a12b (Micro, $0.0000) matches gpt-5.5-pro (Premium, $0.0024) at 281x less cost
- **multistep_reasoning**: gpt-4o-mini (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0043) at 32x less cost
- **multistep_reasoning**: Gemini 2.0 Flash (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0043) at 57x less cost
- **multistep_reasoning**: mistral-medium-latest (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0043) at 25x less cost
- **multistep_reasoning**: mistral-small-latest (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0043) at 60x less cost
- **multistep_reasoning**: bytedance-seed/seed-2.0-lite (Economy, $0.0007) matches Claude Sonnet 4 (Standard, $0.0043) at 6x less cost
- **multistep_reasoning**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches Claude Sonnet 4 (Standard, $0.0043) at 19x less cost
- **multistep_reasoning**: deepseek/deepseek-v3.2 (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0043) at 20x less cost
- **multistep_reasoning**: DeepSeek V3.2 (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0043) at 21x less cost
- **multistep_reasoning**: Llama-4-Scout (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0043) at 71x less cost
- **multistep_reasoning**: Mistral Medium (Economy, $0.0004) matches Claude Sonnet 4 (Standard, $0.0043) at 10x less cost
- **multistep_reasoning**: Codestral (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0043) at 25x less cost
- **multistep_reasoning**: devstral-latest (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0043) at 63x less cost
- **multistep_reasoning**: meta-llama/llama-3.2-1b-instruct (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0043) at 629x less cost
- **multistep_reasoning**: meta-llama/llama-3.2-3b-instruct (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0043) at 311x less cost
- **multistep_reasoning**: qwen/qwen-turbo (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0043) at 328x less cost
- **multistep_reasoning**: qwen/qwen3-8b (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0043) at 91x less cost
- **multistep_reasoning**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0043) at 166x less cost
- **multistep_reasoning**: microsoft/phi-4 (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0043) at 194x less cost
- **multistep_reasoning**: meta-llama/llama-4-maverick (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0043) at 19x less cost
- **multistep_reasoning**: x-ai/grok-4-fast (Economy, $0.0003) matches Claude Sonnet 4 (Standard, $0.0043) at 14x less cost
- **multistep_reasoning**: bytedance-seed/seed-2.0-mini (Economy, $0.0003) matches Claude Sonnet 4 (Standard, $0.0043) at 16x less cost
- **multistep_reasoning**: nvidia/nemotron-3-super-120b-a12b (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0043) at 119x less cost
- **multistep_reasoning**: qwen/qwen3-coder (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0043) at 18x less cost
- **multistep_reasoning**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0043) at 39x less cost
- **ner_extraction**: claude-haiku-4-5-20251001 (Economy, $0.0002) matches gpt-5.5-pro (Premium, $0.0039) at 17x less cost
- **ner_extraction**: gpt-4o-mini (Economy, $0.0000) matches gpt-5.5-pro (Premium, $0.0039) at 129x less cost
- **ner_extraction**: ministral-3b-latest (Micro, $0.0000) matches gpt-5.5-pro (Premium, $0.0039) at 955x less cost
- **ner_extraction**: bytedance-seed/seed-2.0-lite (Economy, $0.0003) matches gpt-5.5-pro (Premium, $0.0039) at 12x less cost
- **ner_extraction**: bytedance-seed/seed-1.6-flash (Micro, $0.0001) matches gpt-5.5-pro (Premium, $0.0039) at 30x less cost
- **ner_extraction**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches gpt-5.5-pro (Premium, $0.0039) at 43x less cost
- **ner_extraction**: gpt-5.4-mini (Economy, $0.0001) matches gpt-5.5-pro (Premium, $0.0039) at 74x less cost
- **ner_extraction**: devstral-latest (Economy, $0.0000) matches gpt-5.5-pro (Premium, $0.0039) at 215x less cost
- **ner_extraction**: qwen/qwen3-8b (Micro, $0.0000) matches gpt-5.5-pro (Premium, $0.0039) at 135x less cost
- **ner_extraction**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches gpt-5.5-pro (Premium, $0.0039) at 531x less cost
- **ner_extraction**: x-ai/grok-4-fast (Economy, $0.0002) matches gpt-5.5-pro (Premium, $0.0039) at 16x less cost
- **ner_extraction**: x-ai/grok-code-fast-1 (Economy, $0.0003) matches gpt-5.5-pro (Premium, $0.0039) at 14x less cost
- **ner_extraction**: bytedance-seed/seed-2.0-mini (Economy, $0.0003) matches gpt-5.5-pro (Premium, $0.0039) at 14x less cost
- **ner_extraction**: nvidia/nemotron-3-super-120b-a12b (Micro, $0.0000) matches gpt-5.5-pro (Premium, $0.0039) at 239x less cost
- **ner_extraction**: seed-2-0-pro-260328 (Economy, $0.0005) matches gpt-5.5-pro (Premium, $0.0039) at 8x less cost
- **rag_qa**: gpt-5.4-mini (Economy, $0.0001) matches claude-sonnet-4-6 (Standard, $0.0014) at 18x less cost
- **rag_qa**: devstral-latest (Economy, $0.0000) matches claude-sonnet-4-6 (Standard, $0.0014) at 52x less cost
- **rag_qa**: meta-llama/llama-3.2-3b-instruct (Micro, $0.0000) matches claude-sonnet-4-6 (Standard, $0.0014) at 122x less cost
- **rag_qa**: qwen/qwen-turbo (Micro, $0.0000) matches claude-sonnet-4-6 (Standard, $0.0014) at 180x less cost
- **rag_qa**: qwen/qwen3-8b (Micro, $0.0000) matches claude-sonnet-4-6 (Standard, $0.0014) at 46x less cost
- **rag_qa**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches claude-sonnet-4-6 (Standard, $0.0014) at 102x less cost
- **rag_qa**: microsoft/phi-4 (Micro, $0.0000) matches claude-sonnet-4-6 (Standard, $0.0014) at 84x less cost
- **reasoning_gsm8k**: Gemini 2.0 Flash (Economy, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0035) at 56x less cost
- **reasoning_gsm8k**: mistral-small-latest (Economy, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0035) at 48x less cost
- **reasoning_gsm8k**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches gemini-3.1-pro-preview (Standard, $0.0035) at 14x less cost
- **reasoning_gsm8k**: deepseek/deepseek-v3.2 (Economy, $0.0003) matches gemini-3.1-pro-preview (Standard, $0.0035) at 13x less cost
- **reasoning_gsm8k**: mistral-medium-latest (Economy, $0.0005) matches gemini-3.1-pro-preview (Standard, $0.0035) at 7x less cost
- **reasoning_gsm8k**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0035) at 24x less cost
- **reasoning_gsm8k**: gpt-5.4-mini (Economy, $0.0002) matches gemini-3.1-pro-preview (Standard, $0.0035) at 20x less cost
- **reasoning_gsm8k**: gpt-5.4-nano (Economy, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0035) at 60x less cost
- **reasoning_gsm8k**: devstral-latest (Economy, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0035) at 42x less cost
- **reasoning_gsm8k**: qwen/qwen-turbo (Micro, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0035) at 345x less cost
- **reasoning_gsm8k**: qwen/qwen3-8b (Micro, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0035) at 51x less cost
- **reasoning_gsm8k**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0035) at 133x less cost
- **reasoning_gsm8k**: microsoft/phi-4 (Micro, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0035) at 143x less cost
- **reasoning_gsm8k**: qwen/qwen3-coder (Economy, $0.0002) matches gemini-3.1-pro-preview (Standard, $0.0035) at 15x less cost
- **sentiment**: DeepSeek V3.2 (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **sentiment**: Llama-4-Scout (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 16x less cost
- **sentiment**: Mistral Medium (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 6x less cost
- **sentiment**: Codestral (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **sentiment_sst2**: gpt-4o-mini (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 8x less cost
- **sentiment_sst2**: Gemini 2.5 Flash (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 9x less cost
- **sentiment_sst2**: Gemini 2.0 Flash (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 11x less cost
- **sentiment_sst2**: mistral-small-latest (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 10x less cost
- **sentiment_sst2**: gpt-5.4-nano (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 10x less cost
- **sentiment_sst2**: devstral-latest (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 12x less cost
- **sentiment_sst2**: meta-llama/llama-3.2-3b-instruct (Micro, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 23x less cost
- **sentiment_sst2**: qwen/qwen3-8b (Micro, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 6x less cost
- **sentiment_sst2**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 19x less cost
- **sentiment_sst2**: microsoft/phi-4 (Micro, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 19x less cost
- **sentiment_sst2**: meta-llama/llama-4-maverick (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 6x less cost
- **sentiment_sst2**: qwen/qwen3-coder (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 5x less cost
- **sql_generation**: DeepSeek V3.2 (Economy, $0.0001) matches Grok-4-R (Standard, $0.0006) at 5x less cost
- **sql_generation**: Llama-4-Scout (Economy, $0.0000) matches Grok-4-R (Standard, $0.0006) at 22x less cost
- **sql_generation**: Codestral (Economy, $0.0001) matches Grok-4-R (Standard, $0.0006) at 6x less cost
- **sql_spider**: Gemini 2.5 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 11x less cost
- **sql_spider**: Gemini 2.0 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 22x less cost
- **sql_spider**: mistral-small-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 22x less cost
- **sql_spider**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0004) at 8x less cost
- **sql_spider**: gpt-5.4-mini (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0004) at 7x less cost
- **sql_spider**: gpt-5.4-nano (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 17x less cost
- **sql_spider**: devstral-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 23x less cost
- **sql_spider**: qwen/qwen-turbo (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 127x less cost
- **sql_spider**: qwen/qwen3-8b (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 10x less cost
- **structured_output**: gpt-4o-mini (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 16x less cost
- **structured_output**: Gemini 2.5 Flash (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 13x less cost
- **structured_output**: mistral-small-latest (Economy, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 26x less cost
- **structured_output**: ministral-3b-latest (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 124x less cost
- **structured_output**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches x-ai/grok-4.20 (Standard, $0.0011) at 7x less cost
- **structured_output**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 9x less cost
- **structured_output**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 8x less cost
- **structured_output**: gpt-5.4-mini (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 11x less cost
- **structured_output**: gpt-5.4-nano (Economy, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 24x less cost
- **structured_output**: devstral-latest (Economy, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 27x less cost
- **structured_output**: meta-llama/llama-3.2-3b-instruct (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 80x less cost
- **structured_output**: qwen/qwen-turbo (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 154x less cost
- **structured_output**: qwen/qwen3-8b (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 24x less cost
- **structured_output**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 78x less cost
- **structured_output**: microsoft/phi-4 (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 73x less cost
- **test_generation**: DeepSeek V3.2 (Economy, $0.0011) matches Grok-4-R (Standard, $0.0076) at 7x less cost
- **test_generation**: Gemini 2.5 Flash (Economy, $0.0012) matches Grok-4-R (Standard, $0.0076) at 7x less cost
- **test_generation_v2**: gpt-5.4-mini (Economy, $0.0006) matches gpt-5.5-pro (Premium, $0.0847) at 133x less cost
- **test_generation_v2**: qwen/qwen-turbo (Micro, $0.0000) matches gpt-5.5-pro (Premium, $0.0847) at 3807x less cost
- **translation**: DeepSeek V3.2 (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0008) at 9x less cost
- **translation**: Codestral (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0008) at 7x less cost
- **translation**: gpt-4o-mini (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0008) at 18x less cost
- **translation**: Gemini 2.5 Flash (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0008) at 16x less cost
- **translation_enfr**: gpt-4o-mini (Economy, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0015) at 59x less cost
- **translation_enfr**: Gemini 2.5 Flash (Economy, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0015) at 34x less cost
- **translation_enfr**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0015) at 30x less cost
- **translation_enfr**: mistral-medium-latest (Economy, $0.0003) matches gemini-3.1-pro-preview (Standard, $0.0015) at 6x less cost
- **translation_enfr**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches gemini-3.1-pro-preview (Standard, $0.0015) at 13x less cost
- **translation_enfr**: gpt-5.4-nano (Economy, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0015) at 83x less cost
- **translation_enfr**: devstral-latest (Economy, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0015) at 58x less cost
- **translation_enfr**: google/gemma-4-26b-a4b-it (Micro, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0015) at 128x less cost
- **translation_enfr**: qwen/qwen3-coder (Economy, $0.0000) matches gemini-3.1-pro-preview (Standard, $0.0015) at 33x less cost

## Figures

- `figures/heatmap.png` — Cross-task quality heatmap
- `figures/cost_efficiency_overall.png` — Overall cost vs quality scatter
- `figures/cheapest_adequate.png` — Cheapest adequate model per task
- `figures/pareto_<task>.png` — Per-task Pareto frontiers