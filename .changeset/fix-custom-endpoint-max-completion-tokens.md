---
"manifest": patch
---

Fix custom OpenAI-compatible providers (Azure Foundry / vLLM / LiteLLM) serving gpt-5 or o-series models: the outbound request now rewrites `max_tokens` to `max_completion_tokens`, matching native OpenAI and Copilot behavior, instead of sending `max_tokens` and getting a 400.
