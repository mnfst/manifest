---
"manifest": patch
---

Prevent OpenAI Responses-backed subscription streams from ending as interrupted client streams: forward terminal upstream `error` / `response.failed` events as OpenAI-compatible SSE error payloads, convert `response.incomplete` (max_output_tokens / content filter) into a proper `length` / `content_filter` finish chunk, surface upstream stream errors to `/v1/messages` clients as native Anthropic `error` events instead of a fabricated empty `end_turn` message, and stop the provider request timeout from aborting healthy streaming response bodies after headers have arrived.
