---
"manifest": patch
---

fix(routing): attribute models by their connection's provider, not by model-id prefix

The routing UI used to derive a model's logo from the prefix of its model id,
which broke for any provider that redistributes other vendors' models. Most
visibly, a Groq connection serving `qwen/qwen3-32b` rendered with the Qwen
logo and Qwen-on-OpenRouter pricing (≈$0.08/$0.24 per 1M) instead of Groq's
own pricing ($0.29/$0.59).

Two changes:

- **Frontend** (`RoutingTierCard.providerIdForModel`): when a model row has a
  stored `provider` that resolves to a registered first-party provider, that
  wins over prefix inference. OpenRouter remains the documented exception
  because its rows really do represent vendor-prefixed models served on behalf
  of those vendors.
- **Backend** (`ModelDiscoveryService.enrichModel`): `known-model-prices.ts`
  is now consulted *before* models.dev and the OpenRouter cache, so curated
  per-provider prices win over upstream catalogs that may attribute the same
  model id to a different (cheaper) inference provider. Behaviour change for
  the existing entries (moonshot-v1, gemma-3-1b-it, gemini-pro-latest): they
  become authoritative instead of last-resort, which matches their intent.

Builds on #1772, which introduced `route.provider` as the routing identity.
