---
"manifest": patch
---

Close an SSRF hole where a custom provider URL written as an IPv4-mapped IPv6 literal (for example `https://[::ffff:169.254.169.254]`) slipped past the guard and could reach cloud metadata or private hosts. The carrier-grade NAT range (100.64.0.0/10, used by managed Kubernetes and Tailscale) is now blocked too. Separately, MiniMax, Kiro, and Copilot OAuth errors no longer echo refresh tokens or client secrets into logs.
