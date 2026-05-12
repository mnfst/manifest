---
"manifest": patch
---

Fix GitHub Copilot routing for GPT-5 Codex models. Copilot serves Codex variants (`gpt-5-codex`, `gpt-5.2-codex`, `gpt-5.3-codex`) only via `/responses`, so chat-completions requests now swap to that endpoint instead of returning "Unsupported API for model". Also rewrites `max_tokens` to `max_completion_tokens` for the GPT-5 / o-series family on Copilot, fixing the "Unsupported parameter: 'max_tokens'" error reported alongside.
