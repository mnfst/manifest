---
"manifest": minor
---

Auto-fix now explains *why* a request was repaired. Phoenix returns a human-readable explanation with each heal (a one-line summary plus a plain sentence per edit), and the message Auto-fix card renders it — replacing the locally re-derived operation prose, which couldn't describe most fixes. Falls back to the previous phrasing for older healed rows.
