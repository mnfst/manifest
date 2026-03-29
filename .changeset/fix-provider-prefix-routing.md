---
"manifest": patch
---

fix: validate inferred provider prefix against active providers before routing (#1383)

Models from proxy providers (e.g. OpenRouter) carry vendor prefixes like `anthropic/claude-sonnet-4`. The router previously inferred the provider from this prefix without checking if that provider was active, causing requests to fail when the native provider was disabled.
