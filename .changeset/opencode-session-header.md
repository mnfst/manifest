---
'manifest': patch
---

Send the `x-opencode-session` header on every OpenCode Go/Zen request — hashed per-conversation id when the caller provides `x-session-key`, stable per-agent fallback otherwise — ahead of OpenCode's 09/06 enforcement deadline.
