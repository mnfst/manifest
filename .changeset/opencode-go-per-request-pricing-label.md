---
'manifest': patch
---

Show OpenCode Go's per-request cost in the model picker and tier cards. OpenCode Go bills a per-request slice of its dollar quota rather than a flat fee, so models with a published cost now display e.g. `$0.0136/req` instead of the generic "Included in subscription" label. The `available-models` API surfaces `cost_per_request` (from the OpenCode Go catalog) for gateway models; flat-fee subscriptions are unchanged.
