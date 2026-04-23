---
"manifest": minor
---

Context-aware routing: the proxy now estimates token counts up front (js-tiktoken cl100k_base + 10% safety margin) and filters tier candidates by whether their context window can fit `estimatedTokens + max_tokens`. When no model in the scored tier fits, the router escalates upward (simple → standard → complex → reasoning) instead of silently routing to a too-small model. When no model in any tier can fit, the user gets an actionable error that breaks out input vs reserved-output rather than an opaque 400. Emits `X-Manifest-Context-Estimated`, `X-Manifest-Context-Used`, and `X-Manifest-Context-Escalated: <fromTier>-><toTier>` response headers so agents can adapt per-response. Addresses the #1617 RFC (context window awareness for agentic integrations) end-to-end.
