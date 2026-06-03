---
"manifest": patch
---

Reuse upstream provider connections with a shared keep-alive HTTP pool, cutting time-to-first-token by skipping repeat DNS/TCP/TLS handshakes on busy or bursty traffic.
