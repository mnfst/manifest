---
"manifest": patch
---

Rename the agent_provider_access table to agent_enabled_providers so the database, API routes, and dashboard all use the same "enabled providers" naming. The migration is a pure rename — no data is modified — and rolls back cleanly.
