---
'manifest': patch
---

Fix auto routing resolving to a provider the agent never connected. A stale legacy auto-assigned (or promoted fallback) route now reuses the gateway's provider-key lookup before it becomes primary, so an unconfigured provider is skipped without adding a separate model-discovery query. When nothing routable remains, the request returns the neutral `M101` "no providers configured" error. The proxy also treats the resolver's fallback chain as definitive so a fallback promoted to primary is not retried as its own fallback.
