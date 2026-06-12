---
"manifest": patch
---

Prevent OpenAI Responses-backed subscription streams from ending as interrupted client streams by forwarding terminal upstream error events as OpenAI-compatible SSE error payloads, and stop the provider request timeout from aborting healthy streaming response bodies after headers have arrived.
