---
"manifest": patch
---

Fix the Playground using the wrong endpoint for region-based providers (qwen, zai) and forwarding vendor-prefixed model ids for copilot/zai. The proxy's endpoint + model resolution (region overrides for minimax/qwen/zai, prefix stripping for copilot/minimax/zai, custom-provider endpoints) is now a shared `resolveForwardEndpoint` helper used by both the proxy and the Playground, so the two paths can no longer drift.
