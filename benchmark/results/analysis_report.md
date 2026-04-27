# TaskBench Analysis Report

Generated from 1413 data points

- **Tasks:** 14
- **Models:** 17
- **Total API spend:** $1.71

## Cheapest Adequate Model per Task (>=90% of max quality)

| Task | Cheapest Model | Score | Cost/query | vs Most Expensive | Savings |
|------|---------------|-------|-----------|-------------------|---------|
| code_review | Llama-4-Scout | 4.0/5 | $0.000131 | Gemini 2.5 Pro ($0.0184) | 99% |
| content_moderation | Gemini 2.5 Flash | 5.0/5 | $0.000010 | MiniMax M2.7 ($0.0007) | 99% |
| email_summary | Llama-4-Scout | 4.4/5 | $0.000045 | Claude Sonnet 4 ($0.0018) | 98% |
| entity_extraction | Llama-4-Scout | 4.6/5 | $0.000025 | MiniMax M2.7 ($0.0023) | 99% |
| extraction_hard | Llama-4-Scout | 3.8/5 | $0.000056 | MiniMax M2.7 ($0.0042) | 99% |
| function_calling | gpt-4o-mini | 4.6/5 | $0.000037 | Kimi K2.6 ($0.0016) | 98% |
| intent_easy | gpt-4o-mini | 5.0/5 | $0.000013 | MiniMax M2.7 ($0.0008) | 98% |
| intent_hard | gpt-4o-mini | 4.5/5 | $0.000018 | Kimi K2.6 ($0.0014) | 99% |
| json_transform | gpt-4o-mini | 4.8/5 | $0.000052 | o4-mini ($0.0019) | 97% |
| reasoning | Gemini 2.5 Flash | 4.1/5 | $0.000308 | Gemini 2.5 Pro ($0.0043) | 93% |
| sentiment | gpt-4o-mini | 4.5/5 | $0.000009 | MiniMax M2.7 ($0.0006) | 98% |
| sql_generation | Llama-4-Scout | 4.8/5 | $0.000029 | MiniMax M2.7 ($0.0026) | 99% |
| test_generation | gpt-4o-mini | 3.6/5 | $0.000472 | Gemini 2.5 Pro ($0.0183) | 97% |
| translation | Llama-4-Scout | 4.6/5 | $0.000032 | Kimi K2.6 ($0.0036) | 99% |

## Quality by Price Class

| Price Class | Avg Quality | Min | Max | Models |
|------------|-------------|-----|-----|--------|
| Standard | 4.38/5 | 1.6 | 5.0 | 112 entries |
| Economy | 4.19/5 | 0.4 | 5.0 | 111 entries |

## Surprise Findings

Cases where cheap models match or beat expensive ones:

- **code_review**: DeepSeek V3.2 (Economy, $0.0008) matches Grok-4 (Standard, $0.0062) at 8x less cost
- **content_moderation**: DeepSeek V3.2 (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 10x less cost
- **content_moderation**: Llama-4-Scout (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 17x less cost
- **content_moderation**: Mistral Medium (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 7x less cost
- **content_moderation**: Codestral (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **content_moderation**: gpt-4o-mini (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 19x less cost
- **content_moderation**: Gemini 2.5 Flash (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 21x less cost
- **email_summary**: Mistral Medium (Economy, $0.0002) matches Claude Sonnet 4 (Standard, $0.0018) at 9x less cost
- **email_summary**: Codestral (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0018) at 18x less cost
- **email_summary**: gpt-4o-mini (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0018) at 30x less cost
- **email_summary**: Gemini 2.5 Flash (Economy, $0.0001) matches Claude Sonnet 4 (Standard, $0.0018) at 27x less cost
- **entity_extraction**: Llama-4-Scout (Economy, $0.0000) matches o4-mini (Standard, $0.0015) at 61x less cost
- **entity_extraction**: Mistral Medium (Economy, $0.0001) matches o4-mini (Standard, $0.0015) at 11x less cost
- **extraction_hard**: Llama-4-Scout (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 31x less cost
- **extraction_hard**: Gemini 2.5 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 12x less cost
- **extraction_hard**: Gemini 2.0 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0018) at 24x less cost
- **function_calling**: DeepSeek V3.2 (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0006) at 8x less cost
- **function_calling**: Mistral Medium (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0006) at 5x less cost
- **function_calling**: gpt-4o-mini (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0006) at 17x less cost
- **function_calling**: Gemini 2.5 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0006) at 12x less cost
- **intent_easy**: gpt-4o-mini (Economy, $0.0000) matches gpt-4o (Standard, $0.0002) at 17x less cost
- **intent_hard**: Llama-4-Scout (Economy, $0.0000) matches gpt-4o (Standard, $0.0003) at 15x less cost
- **intent_hard**: Codestral (Economy, $0.0000) matches gpt-4o (Standard, $0.0003) at 8x less cost
- **json_transform**: DeepSeek V3.2 (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 7x less cost
- **json_transform**: Codestral (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 6x less cost
- **json_transform**: gpt-4o-mini (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 13x less cost
- **json_transform**: Gemini 2.5 Flash (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0007) at 10x less cost
- **sentiment**: DeepSeek V3.2 (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **sentiment**: Llama-4-Scout (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 16x less cost
- **sentiment**: Mistral Medium (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 6x less cost
- **sentiment**: Codestral (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0002) at 9x less cost
- **sql_generation**: DeepSeek V3.2 (Economy, $0.0001) matches Grok-4-R (Standard, $0.0006) at 5x less cost
- **sql_generation**: Llama-4-Scout (Economy, $0.0000) matches Grok-4-R (Standard, $0.0006) at 22x less cost
- **sql_generation**: Codestral (Economy, $0.0001) matches Grok-4-R (Standard, $0.0006) at 6x less cost
- **test_generation**: DeepSeek V3.2 (Economy, $0.0011) matches Grok-4-R (Standard, $0.0076) at 7x less cost
- **test_generation**: Gemini 2.5 Flash (Economy, $0.0012) matches Grok-4-R (Standard, $0.0076) at 7x less cost
- **translation**: DeepSeek V3.2 (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0008) at 9x less cost
- **translation**: Codestral (Economy, $0.0001) matches GPT-5.1 (Standard, $0.0008) at 7x less cost
- **translation**: gpt-4o-mini (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0008) at 18x less cost
- **translation**: Gemini 2.5 Flash (Economy, $0.0000) matches GPT-5.1 (Standard, $0.0008) at 16x less cost

## Figures

- `figures/heatmap.png` — Cross-task quality heatmap
- `figures/cost_efficiency_overall.png` — Overall cost vs quality scatter
- `figures/cheapest_adequate.png` — Cheapest adequate model per task
- `figures/pareto_<task>.png` — Per-task Pareto frontiers