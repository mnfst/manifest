# TaskBench Analysis Report

Generated from 24242 data points

- **Tasks:** 34
- **Models:** 31
- **Total API spend:** $57.97

## Cheapest Adequate Model per Task (>=90% of max quality)

| Task | Cheapest Model | Score | Cost/query | vs Most Expensive | Savings |
|------|---------------|-------|-----------|-------------------|---------|
| code_explanation | ministral-3b-latest | 4.9/5 | $0.000008 | claude-opus-4-7 ($0.0114) | 100% |
| code_generation | ministral-3b-latest | 4.2/5 | $0.000009 | qwen/qwen3.6-max-preview ($0.0150) | 100% |
| code_review | Llama-4-Scout | 4.0/5 | $0.000131 | Gemini 2.5 Pro ($0.0184) | 99% |
| code_review_v2 | mistral-small-latest | 4.2/5 | $0.000246 | claude-opus-4-7 ($0.1168) | 100% |
| content_moderation | Gemini 2.5 Flash | 5.0/5 | $0.000010 | MiniMax M2.7 ($0.0007) | 99% |
| data_to_text | ministral-3b-latest | 4.9/5 | $0.000009 | claude-opus-4-7 ($0.0118) | 100% |
| email_summary | Llama-4-Scout | 4.4/5 | $0.000045 | Claude Sonnet 4 ($0.0018) | 98% |
| email_summary_v2 | ministral-3b-latest | 4.9/5 | $0.000007 | claude-opus-4-7 ($0.0100) | 100% |
| entity_extraction | Llama-4-Scout | 4.6/5 | $0.000025 | MiniMax M2.7 ($0.0023) | 99% |
| extraction_hard | Llama-4-Scout | 3.8/5 | $0.000056 | MiniMax M2.7 ($0.0042) | 99% |
| extraction_hard_v2 | gpt-4o-mini | 3.6/5 | $0.000178 | claude-opus-4-7 ($0.0255) | 99% |
| function_calling | ministral-3b-latest | 4.5/5 | $0.000005 | qwen/qwen3.6-max-preview ($0.0131) | 100% |
| instruction_following | ministral-3b-latest | 4.3/5 | $0.000007 | claude-opus-4-7 ($0.0168) | 100% |
| intent_clinc150 | gpt-4o-mini | 4.5/5 | $0.000078 | claude-opus-4-7 ($0.0136) | 99% |
| intent_easy | gpt-4o-mini | 5.0/5 | $0.000013 | MiniMax M2.7 ($0.0008) | 98% |
| intent_hard | gpt-4o-mini | 4.5/5 | $0.000018 | Kimi K2.6 ($0.0014) | 99% |
| json_transform | gpt-4o-mini | 4.8/5 | $0.000052 | o4-mini ($0.0019) | 97% |
| json_transform_v2 | ministral-3b-latest | 4.2/5 | $0.000009 | qwen/qwen3.6-max-preview ($0.0098) | 100% |
| long_summarization | ministral-3b-latest | 5.0/5 | $0.000019 | claude-opus-4-7 ($0.0252) | 100% |
| moderation_toxigen | Gemini 2.5 Flash | 4.6/5 | $0.000008 | qwen/qwen3.6-max-preview ($0.0020) | 100% |
| multistep_reasoning | ministral-3b-latest | 4.5/5 | $0.000005 | qwen/qwen3.6-max-preview ($0.0050) | 100% |
| ner_extraction | ministral-3b-latest | 4.5/5 | $0.000004 | claude-opus-4-7 ($0.0054) | 100% |
| rag_qa | ministral-3b-latest | 4.2/5 | $0.000009 | claude-opus-4-7 ($0.0077) | 100% |
| reasoning | Gemini 2.5 Flash | 4.1/5 | $0.000308 | Gemini 2.5 Pro ($0.0043) | 93% |
| reasoning_gsm8k | ministral-3b-latest | 4.6/5 | $0.000014 | qwen/qwen3.6-max-preview ($0.0077) | 100% |
| sentiment | gpt-4o-mini | 4.5/5 | $0.000009 | MiniMax M2.7 ($0.0006) | 98% |
| sentiment_sst2 | ministral-3b-latest | 4.7/5 | $0.000003 | qwen/qwen3.6-max-preview ($0.0022) | 100% |
| sql_generation | Llama-4-Scout | 4.8/5 | $0.000029 | MiniMax M2.7 ($0.0026) | 99% |
| sql_spider | Gemini 2.0 Flash | 4.9/5 | $0.000020 | MiniMax M2.7 ($0.0033) | 99% |
| structured_output | ministral-3b-latest | 4.9/5 | $0.000009 | claude-opus-4-7 ($0.0100) | 100% |
| test_generation | gpt-4o-mini | 3.6/5 | $0.000472 | Gemini 2.5 Pro ($0.0183) | 97% |
| test_generation_v2 | ministral-3b-latest | 4.0/5 | $0.000042 | claude-opus-4-7 ($0.1497) | 100% |
| translation | Llama-4-Scout | 4.6/5 | $0.000032 | Kimi K2.6 ($0.0036) | 99% |
| translation_enfr | ministral-3b-latest | 4.3/5 | $0.000007 | qwen/qwen3.6-max-preview ($0.0118) | 100% |

## Quality by Price Class

| Price Class | Avg Quality | Min | Max | Models |
|------------|-------------|-----|-----|--------|
| Premium | 4.47/5 | 3.5 | 5.0 | 21 entries |
| Standard | 4.35/5 | 0.0 | 5.0 | 297 entries |
| Economy | 4.21/5 | 0.0 | 5.0 | 342 entries |
| Micro | 4.26/5 | 0.0 | 5.0 | 42 entries |

## Surprise Findings

Cases where cheap models match or beat expensive ones:

- **code_explanation**: gpt-4o-mini (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 9x less cost
- **code_explanation**: Gemini 2.5 Flash (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 10x less cost
- **code_explanation**: Gemini 2.0 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 15x less cost
- **code_explanation**: mistral-small-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 15x less cost
- **code_explanation**: ministral-3b-latest (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 71x less cost
- **code_explanation**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 6x less cost
- **code_explanation**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 6x less cost
- **code_generation**: gpt-4o-mini (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 10x less cost
- **code_generation**: mistral-small-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0006) at 15x less cost
- **code_generation**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0006) at 5x less cost
- **code_review**: DeepSeek V3.2 (Economy, $0.0008) matches Grok-4 (Standard, $0.0062) at 8x less cost
- **code_review_v2**: claude-haiku-4-5-20251001 (Economy, $0.0032) matches claude-opus-4-7 (Premium, $0.1168) at 36x less cost
- **code_review_v2**: Gemini 2.5 Flash (Economy, $0.0017) matches claude-opus-4-7 (Premium, $0.1168) at 69x less cost
- **code_review_v2**: mistral-small-latest (Economy, $0.0002) matches claude-opus-4-7 (Premium, $0.1168) at 476x less cost
- **code_review_v2**: qwen/qwen3.6-flash (Economy, $0.0030) matches claude-opus-4-7 (Premium, $0.1168) at 39x less cost
- **code_review_v2**: deepseek/deepseek-v3.2 (Economy, $0.0009) matches claude-opus-4-7 (Premium, $0.1168) at 132x less cost
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
- **entity_extraction**: Llama-4-Scout (Economy, $0.0000) matches o4-mini (Standard, $0.0015) at 61x less cost
- **entity_extraction**: Mistral Medium (Economy, $0.0001) matches o4-mini (Standard, $0.0015) at 11x less cost
- **extraction_hard**: Llama-4-Scout (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 31x less cost
- **extraction_hard**: Gemini 2.5 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 12x less cost
- **extraction_hard**: Gemini 2.0 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 24x less cost
- **extraction_hard_v2**: claude-haiku-4-5-20251001 (Economy, $0.0014) matches claude-opus-4-7 (Premium, $0.0255) at 18x less cost
- **function_calling**: DeepSeek V3.2 (Economy, $0.0001) matches gpt-4o (Standard, $0.0006) at 7x less cost
- **function_calling**: gpt-4o-mini (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 17x less cost
- **function_calling**: Gemini 2.5 Flash (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 12x less cost
- **function_calling**: mistral-small-latest (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 26x less cost
- **function_calling**: ministral-3b-latest (Micro, $0.0000) matches gpt-4o (Standard, $0.0006) at 101x less cost
- **function_calling**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches gpt-4o (Standard, $0.0006) at 8x less cost
- **instruction_following**: Gemini 2.5 Flash (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0010) at 10x less cost
- **instruction_following**: mistral-small-latest (Economy, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0010) at 26x less cost
- **instruction_following**: ministral-3b-latest (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0010) at 148x less cost
- **instruction_following**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0010) at 8x less cost
- **instruction_following**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0010) at 7x less cost
- **intent_easy**: gpt-4o-mini (Economy, $0.0000) matches gpt-4o (Standard, $0.0002) at 17x less cost
- **intent_hard**: Llama-4-Scout (Economy, $0.0000) matches gpt-4o (Standard, $0.0003) at 15x less cost
- **intent_hard**: Codestral (Economy, $0.0000) matches gpt-4o (Standard, $0.0003) at 8x less cost
- **json_transform**: DeepSeek V3.2 (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 7x less cost
- **json_transform**: Codestral (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 6x less cost
- **json_transform**: gpt-4o-mini (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 13x less cost
- **json_transform**: Gemini 2.5 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 10x less cost
- **json_transform_v2**: claude-haiku-4-5-20251001 (Economy, $0.0005) matches claude-opus-4-7 (Premium, $0.0083) at 17x less cost
- **json_transform_v2**: gpt-4o-mini (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0083) at 156x less cost
- **json_transform_v2**: Gemini 2.5 Flash (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0083) at 108x less cost
- **json_transform_v2**: mistral-small-latest (Economy, $0.0000) matches claude-opus-4-7 (Premium, $0.0083) at 224x less cost
- **json_transform_v2**: bytedance-seed/seed-2.0-lite (Economy, $0.0006) matches claude-opus-4-7 (Premium, $0.0083) at 13x less cost
- **json_transform_v2**: bytedance-seed/seed-1.6-flash (Micro, $0.0003) matches claude-opus-4-7 (Premium, $0.0083) at 29x less cost
- **json_transform_v2**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches claude-opus-4-7 (Premium, $0.0083) at 82x less cost
- **json_transform_v2**: mistral-medium-latest (Economy, $0.0002) matches claude-opus-4-7 (Premium, $0.0083) at 37x less cost
- **json_transform_v2**: deepseek/deepseek-v4-flash (Economy, $0.0003) matches claude-opus-4-7 (Premium, $0.0083) at 25x less cost
- **long_summarization**: gpt-4o-mini (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0035) at 29x less cost
- **long_summarization**: Gemini 2.5 Flash (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0035) at 29x less cost
- **long_summarization**: mistral-small-latest (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0035) at 44x less cost
- **long_summarization**: ministral-3b-latest (Micro, $0.0000) matches Claude Sonnet 4 (Standard, $0.0035) at 183x less cost
- **long_summarization**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches Claude Sonnet 4 (Standard, $0.0035) at 15x less cost
- **long_summarization**: deepseek/deepseek-v3.2 (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0035) at 18x less cost
- **long_summarization**: mistral-medium-latest (Economy, $0.0005) matches Claude Sonnet 4 (Standard, $0.0035) at 7x less cost
- **long_summarization**: deepseek/deepseek-v4-flash (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0035) at 21x less cost
- **moderation_toxigen**: Gemini 2.5 Flash (Economy, $0.0000) matches o4-mini (Standard, $0.0006) at 72x less cost
- **moderation_toxigen**: bytedance-seed/seed-1.6-flash (Micro, $0.0001) matches o4-mini (Standard, $0.0006) at 8x less cost
- **moderation_toxigen**: deepseek/deepseek-v3.2 (Economy, $0.0000) matches o4-mini (Standard, $0.0006) at 37x less cost
- **moderation_toxigen**: mistral-medium-latest (Economy, $0.0000) matches o4-mini (Standard, $0.0006) at 22x less cost
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
- **ner_extraction**: gpt-4o-mini (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 12x less cost
- **ner_extraction**: Gemini 2.5 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 9x less cost
- **ner_extraction**: ministral-3b-latest (Micro, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 88x less cost
- **ner_extraction**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0004) at 7x less cost
- **rag_qa**: Gemini 2.0 Flash (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 22x less cost
- **rag_qa**: mistral-small-latest (Economy, $0.0000) matches gpt-4o (Standard, $0.0006) at 25x less cost
- **rag_qa**: ministral-3b-latest (Micro, $0.0000) matches gpt-4o (Standard, $0.0006) at 70x less cost
- **rag_qa**: bytedance-seed/seed-1.6-flash (Micro, $0.0001) matches gpt-4o (Standard, $0.0006) at 8x less cost
- **reasoning_gsm8k**: Gemini 2.0 Flash (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0038) at 61x less cost
- **reasoning_gsm8k**: mistral-small-latest (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0038) at 52x less cost
- **reasoning_gsm8k**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches Claude Sonnet 4 (Standard, $0.0038) at 16x less cost
- **reasoning_gsm8k**: deepseek/deepseek-v3.2 (Economy, $0.0003) matches Claude Sonnet 4 (Standard, $0.0038) at 14x less cost
- **reasoning_gsm8k**: mistral-medium-latest (Economy, $0.0005) matches Claude Sonnet 4 (Standard, $0.0038) at 7x less cost
- **reasoning_gsm8k**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0038) at 27x less cost
- **sentiment**: DeepSeek V3.2 (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **sentiment**: Llama-4-Scout (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 16x less cost
- **sentiment**: Mistral Medium (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 6x less cost
- **sentiment**: Codestral (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **sentiment_sst2**: gpt-4o-mini (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 8x less cost
- **sentiment_sst2**: Gemini 2.5 Flash (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 9x less cost
- **sentiment_sst2**: Gemini 2.0 Flash (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 11x less cost
- **sentiment_sst2**: mistral-small-latest (Economy, $0.0000) matches Gemini 2.5 Pro (Standard, $0.0001) at 10x less cost
- **sql_generation**: DeepSeek V3.2 (Economy, $0.0001) matches Grok-4-R (Standard, $0.0006) at 5x less cost
- **sql_generation**: Llama-4-Scout (Economy, $0.0000) matches Grok-4-R (Standard, $0.0006) at 22x less cost
- **sql_generation**: Codestral (Economy, $0.0001) matches Grok-4-R (Standard, $0.0006) at 6x less cost
- **sql_spider**: Gemini 2.5 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 11x less cost
- **sql_spider**: Gemini 2.0 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 22x less cost
- **sql_spider**: mistral-small-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0004) at 22x less cost
- **sql_spider**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0004) at 8x less cost
- **structured_output**: gpt-4o-mini (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 16x less cost
- **structured_output**: Gemini 2.5 Flash (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 13x less cost
- **structured_output**: mistral-small-latest (Economy, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 26x less cost
- **structured_output**: ministral-3b-latest (Micro, $0.0000) matches x-ai/grok-4.20 (Standard, $0.0011) at 124x less cost
- **structured_output**: bytedance-seed/seed-1.6-flash (Micro, $0.0002) matches x-ai/grok-4.20 (Standard, $0.0011) at 7x less cost
- **structured_output**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 9x less cost
- **structured_output**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches x-ai/grok-4.20 (Standard, $0.0011) at 8x less cost
- **test_generation**: DeepSeek V3.2 (Economy, $0.0011) matches Grok-4-R (Standard, $0.0076) at 7x less cost
- **test_generation**: Gemini 2.5 Flash (Economy, $0.0012) matches Grok-4-R (Standard, $0.0076) at 7x less cost
- **test_generation_v2**: mistral-small-latest (Economy, $0.0003) matches GPT-5.1 (Standard, $0.0038) at 13x less cost
- **test_generation_v2**: ministral-3b-latest (Micro, $0.0000) matches GPT-5.1 (Standard, $0.0038) at 91x less cost
- **translation**: DeepSeek V3.2 (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0008) at 9x less cost
- **translation**: Codestral (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0008) at 7x less cost
- **translation**: gpt-4o-mini (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0008) at 18x less cost
- **translation**: Gemini 2.5 Flash (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0008) at 16x less cost
- **translation_enfr**: gpt-4o-mini (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0009) at 34x less cost
- **translation_enfr**: Gemini 2.5 Flash (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0009) at 19x less cost
- **translation_enfr**: Gemini 2.0 Flash (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0009) at 16x less cost
- **translation_enfr**: mistral-small-latest (Economy, $0.0000) matches mistral-large-latest (Standard, $0.0009) at 34x less cost
- **translation_enfr**: deepseek/deepseek-v3.2 (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0009) at 17x less cost
- **translation_enfr**: deepseek/deepseek-v4-flash (Economy, $0.0001) matches mistral-large-latest (Standard, $0.0009) at 7x less cost

## Figures

- `figures/heatmap.png` — Cross-task quality heatmap
- `figures/cost_efficiency_overall.png` — Overall cost vs quality scatter
- `figures/cheapest_adequate.png` — Cheapest adequate model per task
- `figures/pareto_<task>.png` — Per-task Pareto frontiers