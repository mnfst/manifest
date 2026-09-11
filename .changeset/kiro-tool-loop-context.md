---
'manifest': patch
---

Fix Kiro agent loops. When a request ends on a tool result with no new user text, leave the current Kiro turn empty instead of synthesizing `continue` (or prepending the system prompt). Kiro read that fabricated text as a fresh instruction and dropped the in-flight task, so tool-calling agents (opencode et al.) lost context immediately after the first tool call.
