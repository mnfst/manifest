---
"manifest": patch
---

Skip prompt caching injection for Anthropic subscription (OAuth) requests. Fixes HTTP 400 errors when using Sonnet and Opus models with Claude Max/Pro subscription tokens.
