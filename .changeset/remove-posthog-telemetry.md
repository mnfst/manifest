---
"manifest": patch
---

Remove PostHog product analytics from plugin, backend, and frontend. No external analytics calls are made in any mode. OTLP telemetry (traces/metrics to user's own endpoint) is unaffected. Restructure SKILL.md with security-first layout and local mode as primary setup path.
