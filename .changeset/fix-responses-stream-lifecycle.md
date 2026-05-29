---
"manifest": patch
---

Fix `/v1/responses` streaming to emit the full OpenAI Responses API event lifecycle when bridging a Chat Completions upstream. The converter now opens a message item and content part (`response.output_item.added` / `response.content_part.added`) before the text deltas and closes them (`response.output_text.done` / `response.content_part.done` / `response.output_item.done`) with a populated `response.completed`, instead of emitting bare `output_text.delta` + `response.completed{output:[]}`. Strict Responses API clients (Pi, OpenClaw-style) previously dropped the deltas and rendered empty assistant messages.
