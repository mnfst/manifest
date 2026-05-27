---
"manifest": patch
---

Fix OpenCode Go reasoning-tier routing by sending qwen3.7 models through the provider's Anthropic-compatible endpoint, keeping Mimo on the OpenAI-compatible endpoint, and hardening streamed reasoning_content caching for tool-call continuations.
