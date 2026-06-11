---
'manifest': patch
---

Route already-resolved OpenAI `o3-deep-research` API-key requests through the Responses endpoint, matching the existing deep-research handling for `o4-mini-deep-research` without adding unavailable models to discovery. Preserve non-streaming mode when forwarding Chat Completions-shaped requests to OpenAI Responses, and surface collected Responses SSE error events as upstream failures instead of empty successful completions.
