---
'manifest': patch
---

Avoid forwarding image-bearing requests to DeepSeek; use configured fallbacks when available and otherwise return a Manifest error explaining that the selected route does not support image input.
