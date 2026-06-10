---
"manifest": patch
---

Bill Anthropic Pro/Max OAuth requests against the subscription quota instead of metering them as pay-as-you-go API usage. Subscription requests now carry the Claude Code billing fingerprint — the `x-anthropic-billing-header` system block and a synthetic `metadata.user_id` — alongside the existing identity prompt and client headers.
