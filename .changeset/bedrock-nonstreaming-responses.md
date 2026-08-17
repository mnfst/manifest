---
'manifest': patch
---

Fix empty non-streaming responses for Bedrock GPT-5.x models (openai.gpt-5.6-luna/sol/terra, gpt-5.5, gpt-5.4). The non-streaming Responses handler assumed the upstream always returns SSE, but the Bedrock mantle /openai/v1/responses endpoint returns a plain JSON Responses object when stream:false, so content came back null with zero usage. The handler now detects the response shape and parses JSON Responses objects directly.
