---
"manifest": patch
---

Fix broken product analytics funnel by unifying distinct IDs across funnel steps. Local mode now uses machine_id consistently, cloud mode uses SHA256(user.id). Suppress plugin analytics in dev mode. Add file-based dedup for local first_telemetry_received.
