---
"manifest": patch
---

Stop offering Anthropic `claude-*-fast` models in the subscription catalog. Those ids come from the pricing cache but 404 at `api.anthropic.com` — fast mode is an `anthropic-beta` header on the base Opus model, not a model id. Routing to them returned "model not found"; they're now filtered out via a per-provider `knownModelsExclude`.
