---
'manifest': patch
---

Fix native `/v1/responses` forwarding so typed non-message input items such as `reasoning` and `item_reference` are preserved without a `role`, preventing ChatGPT subscription Codex backend 400 errors on multi-turn Codex requests.
