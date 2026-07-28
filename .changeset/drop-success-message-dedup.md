---
'manifest': patch
---

Stop silently discarding successful requests from the Messages log. A heuristic
deduplicator treated two distinct successes as the same completion whenever they
hit the same agent and model with identical input/output token counts inside a
30s window — which an agent looping over one model satisfies routinely — and
dropped the second one. It was added to suppress double-writes when the old OTLP
telemetry pipeline and the proxy both recorded a request; that second writer has
since been removed, so every match it could still find was a false positive.
