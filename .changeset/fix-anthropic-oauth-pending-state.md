---
'manifest': patch
---

Persist Anthropic OAuth pending state in Postgres so production exchanges survive reloads, restarts, and multi-instance routing.
