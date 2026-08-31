---
'manifest': patch
---

Stop serializing tool_result images as base64 text on OpenAI-compatible routes (a single screenshot inflated to 100K+ input tokens and could overflow the provider context window), and return deterministic ChatGPT Codex context errors as HTTP 400 instead of 502.
