---
'manifest': minor
---

Support the full Kimi Coding Plan model lineup for Moonshot subscriptions: add kimi-k3-256k and kimi-for-coding-highspeed alongside kimi-k3 and kimi-for-coding, with correct per-model context windows (1M for kimi-k3, 256k for the rest, including an explicit kimi-k3-256k entry so prefix matching cannot inherit the 1M window) and curated input modalities (image+video for kimi-k3 and both kimi-for-coding variants, image-only for kimi-k3-256k).
