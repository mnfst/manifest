---
'manifest': patch
---

fix(proxy): route xAI Responses API requests to xAI's native /v1/responses endpoint

Adds native xAI Responses API forwarding and routes xAI multi-agent Grok models
through /v1/responses instead of filtering them out of model discovery.
