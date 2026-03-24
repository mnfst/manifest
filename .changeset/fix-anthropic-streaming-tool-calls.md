---
"manifest": patch
---

fix: handle tool calls in Anthropic streaming responses

The Anthropic adapter was silently dropping tool calls in streaming mode.
The adapter now emits OpenAI-compatible `tool_calls` chunks (ids, function names,
and streaming args) so tool use works end-to-end when routing through Manifest.
