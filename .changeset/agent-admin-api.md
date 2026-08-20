---
'manifest': minor
---

Add a scoped AI-admin API surface (`/api/v1/admin`) for agent-native administration of a self-hosted Manifest install.

- New `scope` column on `api_keys` (defaults to `owner`, additive — existing keys unchanged).
- New `mnfst_admin_ai_*` key type minted as `api_keys` rows with `scope = 'ai_admin'`.
- `AdminAiGuard` restricts the admin surface to those keys; the global `ApiKeyGuard` now stashes the resolved scope on the request.
- `AdminController` manages admin keys (create/list/revoke) and a health endpoint, reusing existing `ApiKey`/`Tenant` services.

This is the foundation for agents to administer agents, providers, and routing via API (a wanted capability for the "AI Agents that don't break" mission). Subsequent milestones (M2–M4) layer agent CRUD, provider-key attach + match-verify, and routing/usage read over the existing services.
