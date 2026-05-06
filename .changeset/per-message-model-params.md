---
'manifest': minor
---

Per-message model parameter telemetry. Each `agent_messages` row now carries a `request_params` JSONB snapshot of the effective request body parameters that hit the provider (today: DeepSeek's `thinking` toggle; future provider knobs and user-defined custom-provider params land here without a schema change). The dashboard's expanded message detail shows a new "Model Parameters" accordion next to Request Headers, with an info tooltip explaining the field. Existing rows stay NULL — back-compat is preserved.
