---
"manifest": patch
---

Preserve DeepSeek `reasoning_content` on every follow-up turn, regardless of which provider proxies it (OpenCode Go, custom providers, future aggregators). Fixes a hard failure on OpenCode Go's `deepseek-v4-pro` ("The reasoning_content in the thinking mode must be passed back to the API") — issue #1862.
