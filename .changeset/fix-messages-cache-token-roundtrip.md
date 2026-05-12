---
'manifest': patch
---

Fix prompt-caching token counters on `/v1/messages`. `cache_control` markers always reached Anthropic (caching was working server-side), but the chat → Anthropic-Messages conversion in `toAnthropicUsage` hardcoded `cache_creation_input_tokens: 0`, and the `parseUsageObject` Anthropic branch read cache reads from the wrong key. Result: client responses lost cache creation counts, and `agent_messages` rows recorded `0` for both cache creation and cache reads even when Anthropic actually hit the cache.

Also fixes the recorder's duplicate-write detector, which summed `input_tokens + cache_read_tokens + cache_creation_tokens` when computing a row's total prompt tokens — `input_tokens` already stored the chat-shape total, so the sum double-counted caches and caused legitimate duplicates to bypass dedup. And `toAnthropicUsage` now reads OpenAI-compat nested `prompt_tokens_details.cached_tokens` as a fallback so `/v1/messages` requests routed to OpenAI / DeepSeek / Z.AI / MiniMax / Mistral surface their cached-input counts too.
