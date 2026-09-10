---
'manifest': patch
---

Fix DeepSeek thinking-mode 400s by replaying `reasoning_content` under the scoped session key and covering non-tool assistant turns in tool conversations.
