---
'manifest': patch
---

Strip DeepSeek-specific `reasoning_content` from forwarded chat history unless the target endpoint/model supports it, preventing cross-provider chat completion failures when a conversation switches models.
