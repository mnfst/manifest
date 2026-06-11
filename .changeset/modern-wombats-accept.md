---
"manifest": patch
---

fix: strip `context_management` and signed thinking blocks from Anthropic proxy requests

Strips `context_management` from Anthropic Messages proxy requests to prevent
`invalid_request_error` when the compaction beta header isn't sent.

When routing to a different Anthropic model than the client requested, removes
signed `thinking` and `redacted_thinking` blocks from prior assistant turns
whose signatures are only valid for the original model, preventing
`Invalid signature in thinking block` upstream rejections.
