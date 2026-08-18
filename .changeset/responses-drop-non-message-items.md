---
'manifest': patch
---

Fix Responses→chat-completions conversion emitting content-less `{"role":"user"}` messages for `reasoning`, `item_reference`, and other non-message input items, which strict OpenAI-compatible providers rejected with 400/422.
