---
'manifest': patch
---

Fix Kiro tool calling. Forward OpenAI tool definitions as Kiro tool specifications, map assistant `tool_calls` and `tool` role messages into Kiro `toolUses`/`toolResults`, and return Kiro `toolUseEvent` frames as OpenAI `tool_calls` (with `finish_reason: tool_calls`) in both streaming and non-streaming responses.
