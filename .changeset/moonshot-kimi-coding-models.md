---
'manifest': minor
---

Support the full Kimi Coding Plan model lineup for Moonshot subscriptions using the wire-format ids the api.kimi.com/coding endpoint expects: k3, k3-256k, kimi-for-coding, and kimi-for-coding-highspeed (the previous curated list sent kimi-k3, which the endpoint does not accept). Includes correct per-model context windows (1M for k3, 256k for the rest, with an explicit k3-256k entry so prefix matching cannot inherit the 1M window) and curated input modalities (image+video for k3 and both kimi-for-coding variants, image-only for k3-256k).
