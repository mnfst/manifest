---
"manifest": patch
---

Lower proxy latency and harden it against connection blips: reuse upstream provider connections with a shared keep-alive pool (skips repeat DNS/TCP/TLS handshakes), retry once on a dead reused socket before failing over, and fast-fail with a circuit breaker when a provider is repeatedly down.
