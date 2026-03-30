---
"manifest": patch
---

Fix non-streaming responses for ChatGPT subscription (Codex) models

The Codex Responses API always returns SSE even when stream: false is requested.
The proxy now collects the SSE events and builds a proper non-streaming OpenAI
Chat Completion response instead of failing with a JSON parse error.
