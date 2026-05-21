---
"manifest": patch
---

Stop recording Railway and proxy noise headers on every message. Headers injected by the hosting edge (x-railway-*, x-forwarded-*, x-real-ip, etc.) are dropped before storage, so the message Headers tab only shows headers the agent actually sent.
