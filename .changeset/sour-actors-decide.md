---
"manifest": patch
---

Prevent Anthropic signed thinking blocks from being replayed into incompatible fallback attempts. Cached thinking is now scoped to the provider, auth type, and model that produced it, so an incompatible fallback omits stale signatures while a later compatible Anthropic attempt can restore them.
