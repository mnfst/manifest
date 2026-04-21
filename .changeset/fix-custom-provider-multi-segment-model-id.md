---
"manifest": patch
---

Fix custom providers mangling upstream model IDs that contain `/` characters (#1591, #1615). Multi-segment model names like `MiniMaxAI/MiniMax-2.7` or `accounts/fireworks/routers/kimi-k2p5-turbo` are now forwarded to the upstream API unchanged instead of having a legitimate slash segment stripped.
