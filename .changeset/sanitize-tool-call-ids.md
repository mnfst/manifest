---
"manifest": patch
---

Sanitize tool_use ids emitted on /v1/messages responses so non-Anthropic upstream ids (e.g. `Edit:0`) no longer poison session histories against Anthropic's id pattern
