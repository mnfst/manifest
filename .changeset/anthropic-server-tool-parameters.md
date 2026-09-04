---
'manifest': patch
---

Fix Anthropic server tools (web_search, bash, computer, etc.) being forwarded to non-Anthropic providers with no `parameters` field, which some providers reject with a 400.
