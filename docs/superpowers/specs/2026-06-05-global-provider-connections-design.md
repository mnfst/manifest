# Global Provider Connections — Design (PR 1)

- **Date:** 2026-06-05
- **Status:** Draft — awaiting approval
- **Author:** Guillaume (with Claude)
- **Slice of:** Seb's PR #2061 (`coal-borogovia`, "subscription maximization pivot"), decomposed into small PRs.
- **Target branch:** new branch off `upstream/main` (fresh worktree). The existing `feat/global-provider-connections` / PR #2131 worktree is abandoned — it reimplemented the connection layer with a `scope` flag threaded through every OAuth controller and kept breaking. This design replaces that approach.

---

## 1. Motivation

Today every provider connection is **agent-scoped**: a row in `user_providers` is keyed to one `agent_id`, and the whole connect flow (`POST /api/v1/routing/:agentName/providers`, every OAuth controller, `provider.service`) resolves an agent first. The same subscription/API key connected to three agents is three independent rows.

Seb's pivot reframes providers as a **user-level resource shared across agents**. This PR ships the first, foundational slice of that: a **global (user-level) connection pool**. Existing agent connections are migrated up into it. Every agent then draws from the shared pool.

## 2. Goals

1. Introduce **global provider connections**: `user_providers` rows with `agent_id IS NULL`, owned by the user, managed in a dedicated sidebar area.
2. **Migrate** existing agent-scoped connections into the global pool — **moving** them (one row each, single credential), relabeled by source agent to disambiguate.
3. Reuse the **existing, proven connect components and OAuth flows** (no `scope`-flag rewrite). Connection mechanics are unchanged; only the *target* of a connection becomes "the user" instead of "an agent."
4. Make connected global providers **usable by all of the user's agents** at routing time.
5. Keep the migration **non-destructive and reversible**.

## 3. Non-goals (explicitly deferred — NOT in this PR)

- **Per-agent provider scoping / access control** (the `agent_provider_access` junction and the agent "Providers" ON/OFF toggle). **This PR ships without per-agent scoping — every agent can use every global provider.** This is the accepted trade-off; the junction is a *possible* future PR but is **not committed and not part of this work**.
- Provider analytics endpoints, usage charts, sparklines.
- Rate-limit snapshot capture / display.
- Global Playground.
- Custom-provider lifting to user level.
- Disable-impact preview.

## 4. Accepted consequence

Because connections are **moved** to a single shared pool and the access junction is **not** added, **every agent uses every connected provider**. There is no per-agent on/off in this PR. This is intentional and approved.

## 5. Data model

Single schema change:

```
user_providers.agent_id : varchar NOT NULL  →  varchar NULL
```

- `agent_id IS NULL`  ⇒ **global** connection (the only kind created going forward).
- The column is **retained** (not dropped) so the migration is reversible and we keep source-agent context during the transition.
- New user-scoped uniqueness: `UNIQUE (user_id, provider, auth_type, LOWER(label))` (replaces the old agent-scoped unique index).

### Migration `LiftAgentProvidersToGlobal`

Port Seb's `LiftProvidersToUserLevel` relabel logic, **minus** the `agent_provider_access` junction (out of scope). Steps:

**Refinement (vs. earlier draft): we do NOT null `agent_id`.** "Global" comes from user-scoped reads + a user-scoped unique index, not from emptying `agent_id`. Keeping `agent_id` on lifted rows costs nothing (reads ignore it), keeps the migration trivially reversible, and matches Seb exactly. New connections insert with `agent_id NULL` (the service omits it). This is lower-risk than a bulk null-update.

`up()` steps (port Seb's `LiftProvidersToUserLevel`, dropping only the two junction statements):
1. Drop the old agent-scoped unique index `IDX_user_providers_agent_provider_auth_label`.
2. `ALTER COLUMN agent_id DROP NOT NULL` (so new global rows can omit it).
3. **Relabel** rows that would collide on the new user-scoped key, **never deleting** (AES-256-GCM keys with random IV can't be proven equal in SQL, so "duplicates" may hold distinct secrets): `label='Default'` → `<agent display/name>`; custom → `"<custom> - <agent>"`; still-colliding → deterministic `[<row-id>]` suffix. (CTE JOINs `agents ON agents.id = user_providers.agent_id`; safe because we never null `agent_id`.)
4. Create user-scoped unique index `IDX_user_providers_user_provider_auth_label` on `(user_id, provider, auth_type, LOWER(label))`.

**Dropped from Seb's `up()`** (out of scope): the `CREATE TABLE agent_provider_access` + its index, and the `INSERT INTO agent_provider_access … SELECT agent_id, id …` backfill.

`down()` (best-effort, schema-reversing): drop the user-scoped unique index; recreate the agent-scoped one. **Do not** re-add `NOT NULL` — post-migration global rows legitimately have `agent_id NULL`. Documented inline as a standard lossy-down. No junction to drop, no `agent_id` to restore (we never moved it).

## 6. Backend

> **Key correction from the code map:** Seb makes connections "global" entirely in the **service layer** — `user_providers` rows are written **user-scoped** (insert omits `agent_id` → NULL) and every read is `user_id`-keyed. The connect **API stays agent-scoped** (`POST /api/v1/routing/:agentName/providers`, and the OAuth controllers keep `agentName`); the resolved agent is used only as *tier-recompute context*, not for row identity. So **we do NOT change the connect API surface or add any `scope` flag** — we re-key the service and thread `user.id` into it.

### 6.1 Service-layer user re-keying (the core of the PR)
Port Seb's user-scoped versions of (agent_id → user_id reads; `userId` threaded):
`routing-core/provider.service.ts`, `provider-key.service.ts`, `model-discovery/model-discovery.service.ts`, `routing-core/tier-auto-assign.service.ts`, `routing-core/tier.service.ts`, `routing/resolve/resolve.service.ts`, `routing/proxy/proxy.service.ts`, `routing/proxy/proxy-fallback.service.ts`, `routing-core/routing-cache.service.ts` (split agent- vs user-scoped caches + new `invalidateUser`), `routing-core/routing-invalidation.service.ts` (Set→Map<agentId,userId>), and `oauth/core/oauth-refresh-coordinator.ts` (`oauthRefreshKey` drops the `agentId` segment → `${provider}:${userId}:${label}`).
- New helpers to port: `recalculateTiersForUser(userId)`, `listOwnedAgentIds(userId)`, `afterProviderChange(agentId|null, userId)`.
- **Behavior to keep:** `upsertProviderWithLabel` now *updates in place* on a same-value duplicate key instead of throwing (needed for OAuth reconnect).
- **Connect endpoints (`provider.controller.ts`):** keep routes; swap each service call from `agent.id` → `user.id` (and add `user.id` as the 2nd arg to `removeProvider`/`recalculateTiers`). **Strip** the `AgentProviderAccess` import + optional `accessRepo` + the junction-write block in the connect handler.

### 6.2 DROP the access-control layer (out of scope, must be stripped on port)
Both copies of `private filterProvidersForAgent(providers, agentId?)` (in `provider-key.service.ts` and `model-discovery.service.ts`), their `@Optional() accessRepo` injections, the trailing optional `agentId?` params on the provider-key/discovery read methods, `invalidateProviderAccess`, and the discovery custom-provider `if (agentId && !customAuthTypes.has(cpKey)) continue;` gate. **Realization:** consumption callers simply **omit `agentId`** so every read returns *all* of the user's providers. Do **not** import the `agent_provider_access` entity/table/controller.

### 6.3 OAuth controllers (minimal call-site edits)
Controllers/services keep `agentName`/`@Query`; only the downstream call sites change: `getProviderKeys`/`nextOAuthLabel`/`getFreshSubscriptionCredential` take `user.id`; `oauthRefreshKey` drops the `agentId` arg; `removeProvider`/`recalculateTiers` gain `user.id`. Files: `redirect-pkce-oauth.base.ts` (shared), `openai-oauth.controller.ts`, `xai/*`, `gemini-oauth.controller.ts`, `anthropic/*`, `kiro-oauth.*`, `minimax-oauth.*`, `copilot.controller.ts`. **Bug to fix on port:** `copilot.controller.ts` must pass `user.id` (not `agent.id`) to `nextOAuthLabel`. No `scope` flag (the abandoned #2131 approach) anywhere.

### 6.4 Slim user-scoped list endpoint
Add `GET /api/v1/providers` returning the user's connections for the management pages. Seb's `user-providers.controller.ts` is analytics-heavy (30-day token/cost aggregates, 7-day sparkline) — **out of scope**. Build a **slim** controller that returns connection rows only (id, provider, auth_type, label, key_prefix, priority, region, is_active, connected_at, cached_model_count, models_fetched_at), grouped/shaped for the pages. No `agent_messages`/`Tenant`/pricing deps.

### 6.5 available-models filter removal
`model.controller.getAvailableModels` calls `getModelsForAgent(user.id)` (drop the `agent.id` 2nd arg) → returns models for all the user's providers. This is the one explicit per-agent narrowing to remove.

> Each agent, resolving providers, now sees the user's full global pool. No access filtering (deferred, not promised).

## 7. Frontend

> **Correction from the code map:** Seb's frontend connect pages do **not** use a user-scoped connect API or a `scope` flag — they call the existing **agent-scoped** endpoints passing `firstAgentName()`, and the backend (now user-scoped) makes the row global. We follow that: **connect components stay unchanged on the agentName front**, and the list side uses the new slim `GET /api/v1/providers`. Seb's `index.tsx`/`Sidebar.tsx` are on a much newer base and **cannot be cherry-picked wholesale** — we surgically add routes/nav into main's existing structure.

- **Pages:** add `pages/providers/{Subscriptions,Byok,Local}.tsx` (category hardcoded per file — there is no shared `category=` prop component). Port Seb's pages **stripped** of: usage charts, sparklines, `getOverview`/savings/cost/last-used cells, custom-provider management (the "Add custom provider" button + branch on BYOK), and the row→`ConnectionDetail` navigation. The connect+list core (`connectedRows`/`connectedMap`/`getModelCount` + Supported-providers table + `<ProviderSelectModal>`) survives cleanly. **Do not** port `ConnectionDetail.tsx` (1115 lines, analytics-saturated).
- **Routes (`index.tsx`):** add `/providers/{subscriptions,byok,local}` + `/providers` → `<Navigate href="/providers/subscriptions" />` (add `Navigate` import). Do **not** add the `ConnectionDetail` route.
- **Sidebar:** add a `PROVIDERS` section (Subscriptions / BYOK / Local) + the `isGlobalActive` helper into main's existing `Sidebar.tsx`. Strip Seb's broader sidebar rewrite (TOOLS/Playground, global Overview/Messages, HARNESSES list).
- **Connect components (small additive props to port):** `ProviderSelectModal` (+`initialTab`), `ProviderSelectContent` (+`initialTab`, deeplink `authType`/`addKey`/`closeOnBack`, `detailBack`), `ProviderDetailView` (+`local` mode), `services/routing-params.ts` `ProviderDeepLink` (+`authType?`,`closeOnBack?`,`addKey?`). Optional: `ProviderKeyForm` focus fix. `OAuthDetailView`, `services/api/oauth.ts`, `services/api/routing.ts` connect fns, `services/providers.ts`, and the provider CSS are **byte-identical to main** — no changes.

## 8. Reuse strategy (porting source)

Primary source is **Seb's #2061** (`upstream/coal-borogovia`, head `c3dd81b0`) — it's the coherent, working version of this design. We take its user-scoped controller/service/OAuth/routing pieces and its migration relabel logic, and we **drop** everything in §3. We do **not** build on #2131's `scope`-flag implementation.

## 9. Testing

**Hard constraint (CLAUDE.md): 100% line coverage on every changed/new file.** Every ported file's re-keyed branches and every new file must be covered. Run `cd packages/backend && npx jest --coverage` and `cd packages/frontend && npx vitest run --coverage` before the PR.

- **Migration:** unit-test relabel on fixtures — two agents same provider+`Default` (relabel to agent names), custom labels (`"<custom> - <agent>"`), distinct encrypted keys preserved (row count unchanged; no deletions), user-scoped unique index enforced, new rows insert with `agent_id NULL`. Add a `*.spec.ts` next to the migration (port Seb's spec, drop junction assertions).
- **Backend:** connect (API-key + ≥1 OAuth provider) writes a `user_id`-scoped row; `GET /api/v1/providers` returns the user pool; rename/reorder/remove are user-scoped; routing/`available-models` for an agent resolve the user's full pool (no access filter); `recalculateTiersForUser` fans across owned agents; cache `invalidateUser` clears the user pool. Register the migration in `database.module.ts` + the e2e entities helper if any entity changes.
- **Frontend:** Vitest for each page (connected list renders, Supported-providers table, modal opens with correct `initialTab`); sidebar `PROVIDERS` entries + `isGlobalActive`; component prop additions. **Regression:** connecting a provider works end-to-end (the failure that motivated the rebuild).
- **Regression guard:** an agent that had a provider pre-migration still routes after (now via the global pool).

## 10. Risks

- **Credential duplication (avoided):** we **move**, never copy. Copying would put the same rotating OAuth refresh token in two rows and brick accounts on refresh (cf. PR #2113 single-flight fix). Single row per connection eliminates this.
- **OAuth controllers:** small call-site edits across all of them; mitigated by porting Seb's proven versions. Includes fixing the `copilot.controller.ts` `nextOAuthLabel(agent.id)` bug → `user.id`.
- **Routing cache correctness:** switching provider reads to user scope requires the cache split (`invalidateUser`) + dual invalidation; a missed invalidation = stale provider list. Covered by porting Seb's cache split + tests.
- **Migration reversibility:** trivial now — we never null `agent_id`, so `down()` only reverses the index swap (documented lossy on `NOT NULL` because post-migration global rows exist). No junction, no mapping to stash.
- **Coverage gate:** the wide file surface must all hit 100% line coverage; budget test time accordingly.

## 11. Out of scope / future (not committed)

Per-agent access scoping (junction + toggle), analytics/charts, rate-limits, Playground, custom-provider lifting. **No follow-up PR is promised or planned as part of this work.**
