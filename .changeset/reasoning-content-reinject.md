---
'manifest': patch
---

fix(proxy): re-inject cached reasoning_content for OpenAI-compatible tool turns

When reasoning providers return `reasoning_content` alongside tool calls, Manifest now caches the field and restores it on the next request if an OpenAI-compatible client dropped it from the assistant history. The replay is guarded to DeepSeek/Kimi/OpenCode Go-compatible targets and strict providers still have the field stripped.
