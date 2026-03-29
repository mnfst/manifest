---
"manifest": patch
---

Fix HTTP 400 errors from Anthropic API via routing proxy: remove redundant top-level cache_control field and filter empty text content blocks in assistant messages with tool_calls. Surface actual upstream error messages in development mode.
