---
"manifest": minor
---

Add prompt caching support for Anthropic (native Messages API), Google Gemini (explicit caching), and OpenRouter Anthropic models. Auto-injects cache_control breakpoints on system prompts and tool definitions. Forwards xAI conversation ID header for improved Grok caching.
