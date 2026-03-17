---
"manifest": patch
---

Normalize DeepSeek `max_tokens` before forwarding requests so out-of-range values do not hard-fail upstream.
