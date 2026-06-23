---
"manifest": minor
---

Add per-agent request healing. On a request-side 4xx (deprecated model, bad param, tool/message shape), Manifest asks the Healing service for deterministic catalog operations, applies them, and retries the same provider before falling back. Opt-in per agent via a dashboard toggle, and inert until HEALING_API_URL is set. The healer only ever receives a structural request plus the error, never provider keys or prompt content.
