---
"manifest": patch
---

Fix OAuth subscription tokens getting permanently invalidated (#2012). Providers like OpenAI now rotate refresh tokens on every refresh, so the previous "refresh then persist" path could brick an account when parallel proxy requests refreshed the same credential at once, or when the DB write failed after the provider had already rotated. Lazy refreshes are now coordinated per credential: concurrent refreshes coalesce into a single round-trip, the freshest token is re-read from the database before refreshing, and the rotated token is persisted with retries. Applies to all subscription OAuth providers (OpenAI, Gemini, Anthropic, MiniMax, xAI, Kiro).
