---
"manifest": minor
---

Separate provider errors from Manifest's own errors in the dashboard. Each message now records who caused a failure (provider, transport, or a Manifest setup/limit/internal issue) and what kind, so a provider outage no longer reads the same as a missing API key. The Messages log shows one clear status pill per row (e.g. "Failed: Provider", "Failed: Custom limit"), hides pre-flight setup errors by default, and a new `/api/v1/errors/breakdown` endpoint reports the provider-vs-Manifest split.
