---
'manifest': patch
---

Reject empty or truncated Claude Messages completions with native Anthropic error events, record stream-integrity failures instead of zero-token successes, keep long-lived SSE responses active through proxy-safe heartbeats and a separately bounded streaming timeout, and serve local token-count estimates so Claude clients do not create extra fallback inference requests.
