---
'manifest': patch
---

Reject empty, malformed, or truncated Claude Messages completions and tool arguments with native Anthropic error events, treat output-budget exhaustion without text or tool output as retryable before streaming begins, recover usable terminal output when deltas are omitted, retry a silent Codex primary once when every fallback is unavailable or rate-limited while enforcing a Cloudflare-safe 105-second pre-response budget, record every recovery attempt and stream-integrity failure instead of zero-token successes, emit content-blind contract evidence and correlation IDs, provide an exact-output canary that never prints response text, normalize deprecated Opus 4.8 sampling fields at the provider boundary, keep long-lived SSE responses active through proxy-safe heartbeats and a separately bounded streaming timeout, and serve local token-count estimates so Claude clients do not create extra fallback inference requests.
