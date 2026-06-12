---
"manifest": patch
---

Restore prompt-cache hits on the ChatGPT subscription backend: send the session affinity headers the Codex CLI sends (`session-id`/`thread-id`, `x-codex-turn-state` replay, stable `prompt_cache_key`), and forward the caller's `prompt_cache_key` on OpenAI /responses conversions
