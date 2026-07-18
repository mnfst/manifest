---
'manifest': patch
---

Reject empty or truncated Claude Messages completions with native Anthropic error events, record stream-integrity failures instead of zero-token successes, and serve local token-count estimates so Claude clients do not create extra fallback inference requests.
