---
'manifest': minor
---

Add a scoped AI-admin API surface (`/api/v1/admin`) for agent-native administration of a self-hosted Manifest install.

- New `scope` column on `api_keys` (defaults to `owner`, additive — existing owner keys unchanged) and a `key_hash` column on `tenant_providers` (one-way hash of the stored provider key, for match-verify without ever returning the raw secret).
- New `mnfst_admin_ai_*` key type minted as `api_keys` rows with `scope = 'ai_admin'`.
- `AdminAiGuard` restricts the admin surface to those keys; the global `ApiKeyGuard` now stashes the resolved scope on the request.
- Controllers under `/api/v1/admin`:
  - `AdminController` — admin key create/list/revoke + health.
  - `AdminAgentController` — full agent CRUD (create, get, rename, rotate-key, duplicate, delete) over the existing lifecycle services.
  - `AdminProviderController` — attach/update a provider key (custom + standard) and **match-verify** a posted key against the stored one-way hash (no raw secret returned).
  - `AdminObservabilityController` — read-only per-agent/per-provider usage and agent routing visibility.

This is the foundation for agents to administer agents, providers, and routing via API (a wanted capability for the "AI Agents that don't break" mission). Provider-key writes now also persist `key_hash` so match-verify works.
