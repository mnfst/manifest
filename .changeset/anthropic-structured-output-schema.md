---
'manifest': patch
---

Close object schemas in Anthropic structured output. Every `type: object` node in `output_config.format.schema` now gets `additionalProperties: false` (unless the author set it), on both the chat-completions → Anthropic translation and the native `/v1/messages` pass-through, so Anthropic no longer rejects requests with "For 'object' type, 'additionalProperties' must be explicitly set to false".
