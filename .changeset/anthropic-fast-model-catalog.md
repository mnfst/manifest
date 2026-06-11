---
"manifest": patch
---

Fix the Anthropic subscription model catalog. Drop the `claude-*-fast` ids it pulled from the pricing cache — those 404 at `api.anthropic.com` because fast mode is an `anthropic-beta` header on the base Opus model, not a model id. Also add `claude-fable-5` (Claude Fable 5), a new subscription model that didn't match the existing `claude-*-4` prefixes.
