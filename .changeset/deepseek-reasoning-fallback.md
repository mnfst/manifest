---
'manifest': patch
---

Restore dropped `reasoning_content` on DeepSeek-compatible tool-call follow-up turns, including fallback requests where clients stripped provider-specific reasoning fields. Manifest now caches streamed and non-streamed assistant tool-call reasoning by session and first `tool_call.id`, and replays only exact DeepSeek-style `reasoning_content` for the same tool-call id. If no exact value is recoverable, Manifest injects an empty `reasoning_content` only as a last resort for DeepSeek-compatible assistant tool-call turns. Other reasoning fields such as `reasoning`, `reasoning_text`, and `reasoning_details` are treated as provider-specific and are not translated across formats. Normal assistant turns without tool calls are not cached or replayed by content fingerprint.
