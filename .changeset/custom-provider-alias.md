---
"manifest": minor
---

Custom providers now have an alias, the readable prefix their models are published under in `/v1/models` (`vercel-ai-gateway/alibaba/qwen-3-14b` instead of `custom:<uuid>/alibaba/qwen-3-14b`). The alias defaults to the provider name, is editable at creation and later, and the proxy accepts both the alias form and the internal `custom:<uuid>/…` form in the `model` field, so existing client configs keep working. Existing custom providers are backfilled on upgrade.
