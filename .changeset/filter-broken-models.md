---
"manifest": patch
---

Filter non-working models from provider discovery results

- Add Mistral-specific parser with metadata filtering (deprecation, capabilities.completion_chat)
- Filter Mistral labs-prefixed models (require admin opt-in)
- Filter xAI multi-agent models (not chat-compatible)
- Filter deprecated Gemini models (gemini-2.0-flash-lite, flash-lite-preview snapshots)
- Add per-provider exact-ID blocklist for models with no pattern (voxtral-mini-2602)
