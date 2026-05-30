---
'manifest': patch
---

Fix token-cost calculation for providers that report cache-read prompt tokens. Manifest now uses models.dev cache-read/cache-write prices when available, so cached DeepSeek input tokens are billed at the cache-hit rate instead of the full input-token rate.
