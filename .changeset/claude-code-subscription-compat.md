---
'manifest': patch
---

Fix Claude Code subscription routing for Anthropic Messages requests by capping Manifest-added `cache_control` markers at Anthropic's four-block limit, enabling the `context_management` beta header expected by recent Claude Code clients, and downgrading `output_config.effort: "xhigh"` when routing resolves to Sonnet.
