---
'manifest': patch
---

Fix prompt-caching token counters on `/v1/messages`. Requests with `cache_control` markers always reached Anthropic (caching was working server-side), but the chat → Anthropic-Messages conversion in `toAnthropicUsage` hardcoded `cache_creation_input_tokens: 0`, and the `parseUsageObject` Anthropic branch read cache reads from the wrong key. Result: client responses lost cache creation counts, and `agent_messages` rows recorded `0` for both cache creation and cache reads even when Anthropic actually hit the cache.
