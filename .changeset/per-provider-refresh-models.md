---
"manifest": minor
---

Per-provider model refresh: a small refresh button next to each provider in the Connect Providers detail view and next to each section header in the model picker. Toasts now report the actual count or upstream error instead of a blanket "Models refreshed" lie. Empty discovery results no longer wipe a non-empty cache, so a transient API hiccup can't silently empty the model list. The model picker subtitle now shows "Default tier" instead of just "tier".
