---
"manifest": minor
---

Add OpenCode Zen as an API-key provider. OpenCode Zen exposes an OpenAI-compatible `/v1/models` catalog and `/v1/chat/completions` proxy endpoint, plus a native Anthropic `/v1/messages` endpoint for Claude models. Manifest now discovers Zen models on connect and routes Claude requests through `/v1/messages` (with `x-api-key` auth) and everything else through `/v1/chat/completions` (with Bearer auth).
