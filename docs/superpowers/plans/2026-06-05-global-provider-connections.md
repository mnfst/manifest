# Global Provider Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift provider connections from agent-scoped to user-scoped (global), so a user connects each provider/subscription once and every one of their agents can use it — shipping the first slice of Seb's PR #2061.

**Architecture:** Connections become "global" purely in the **service layer**: `user_providers` rows are written user-scoped (insert omits `agent_id`) and every read is `user_id`-keyed. A non-destructive migration relabels existing rows so they're unique per-user. The connect API and OAuth controllers keep `agentName` (used only as tier-recompute context). The per-agent access-control junction, analytics, charts, rate-limits, Playground, and custom-provider lifting from Seb's PR are explicitly **out of scope**.

**Tech Stack:** NestJS 11 + TypeORM 0.3 + PostgreSQL 16 (backend, Jest), SolidJS + Vite (frontend, Vitest), npm workspaces + Turborepo. **100% line coverage is mandatory.**

**Reference implementation:** Seb's branch at SHA `c3dd81b0ac6bce0dc4f8af1f81c6f1d889cd25cb` (also `upstream/coal-borogovia`). Read his version of any file with `git show c3dd81b0:<path>`. Diff against current `main` (this worktree, off `upstream/main`) with `git diff 4ff43b83a c3dd81b0 -- <path>`. **Always strip the out-of-scope symbols listed per task** — Seb's base is newer and his files carry the junction/analytics code we are NOT porting.

**Branch/worktree:** `feat/global-providers` at `…/worktrees/global-providers` (already created off `upstream/main`). The design spec lives at `docs/superpowers/specs/2026-06-05-global-provider-connections-design.md`.

**Dev DB for tests/e2e:** follow CLAUDE.md — fresh uniquely-named Postgres DB per run via the `postgres_db` Docker container.

**Out of scope — never import or port these:** `agent_provider_access` entity/table/controller, `provider-analytics.controller.ts`, `ProviderRateLimit`/`rate-limit-tracker.service.ts`, `pages/providers/ConnectionDetail.tsx`, custom-provider user-scope refactor, all chart/sparkline/savings code, `1791100000000-AddProviderRateLimits.ts`, `1791200000000-LiftCustomProvidersToUserLevel.ts`.

---

## Phase ordering & dependencies

1. **Phase A — Schema + migration** (entity nullable, lift migration). Foundation.
2. **Phase B — Service-layer user re-keying** (the core; large). Depends on A.
3. **Phase C — OAuth controller call-site edits**. Depends on B.
4. **Phase D — Slim `GET /api/v1/providers` list endpoint**. Depends on B.
5. **Phase E — Frontend pages, routes, sidebar, component props**. Depends on D.
6. **Phase F — Integration + e2e + changeset + coverage gate**. Depends on A–E.

Commit after every task. Run the relevant package's tests after every implementation step.

---

## Phase A — Schema + Migration

### Task A1: Make `user_providers.agent_id` nullable

**Files:**
- Modify: `packages/backend/src/entities/user-provider.entity.ts`
- Test: `packages/backend/src/entities/__tests__/user-provider.entity.spec.ts` (create if absent; otherwise add a case)

- [ ] **Step 1: Write the failing test** — assert the column metadata allows null.

```ts
// user-provider.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { UserProvider } from '../user-provider.entity';

test('agent_id column is nullable', () => {
  const col = getMetadataArgsStorage().columns.find(
    (c) => c.target === UserProvider && c.propertyName === 'agent_id',
  );
  expect(col?.options.nullable).toBe(true);
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `cd packages/backend && npx jest src/entities/__tests__/user-provider.entity.spec.ts`
Expected: FAIL (nullable is currently undefined/false).

- [ ] **Step 3: Edit the entity**

```ts
// replace the agent_id column declaration
  @Column('varchar', { nullable: true, default: null })
  agent_id!: string | null;
```

- [ ] **Step 4: Run it, expect PASS**

Run: `cd packages/backend && npx jest src/entities/__tests__/user-provider.entity.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/entities/user-provider.entity.ts packages/backend/src/entities/__tests__/user-provider.entity.spec.ts
git commit -m "feat(providers): make user_providers.agent_id nullable for global connections"
```

### Task A2: Lift migration `LiftAgentProvidersToGlobal`

**Files:**
- Create: `packages/backend/src/database/migrations/1791000000000-LiftAgentProvidersToGlobal.ts`
- Modify: `packages/backend/src/database/database.module.ts` (import + add to `migrations` array)
- Test: `packages/backend/src/database/migrations/1791000000000-LiftAgentProvidersToGlobal.spec.ts`

Reference: `git show c3dd81b0:packages/backend/src/database/migrations/1791000000000-LiftProvidersToUserLevel.ts` and its `.spec.ts`. **Port `up()` keeping steps 1, 3, 4, 5, 6 (drop old index → DROP NOT NULL → relabel CTE → create user-scoped unique index). DELETE Seb's step-1 `CREATE TABLE agent_provider_access` (+ its index) and step-2 junction `INSERT`. Do NOT add any `UPDATE … SET agent_id = NULL`.** For `down()`: drop the user-scoped unique index, recreate `IDX_user_providers_agent_provider_auth_label` on `(agent_id, provider, auth_type, LOWER(label))`; **do not** re-add `NOT NULL`; drop Seb's junction-restore `UPDATE` and the `DROP TABLE agent_provider_access`.

- [ ] **Step 1: Write the failing migration spec** (port + trim Seb's spec). Use a fresh test DB per CLAUDE.md. Cover: (a) two agents with the same provider + `Default` label → after `up()`, both rows survive (count unchanged) and are relabeled to the agents' display names; (b) a custom label `mykey` on an agent named `Bot` → becomes `mykey - Bot` only if it collides, else unchanged; (c) the user-scoped unique index rejects a duplicate `(user_id, provider, auth_type, LOWER(label))`; (d) no rows deleted.

```ts
// skeleton — fill assertions from Seb's spec, minus junction checks
import { DataSource } from 'typeorm';
import { LiftAgentProvidersToGlobal1791000000000 } from '../1791000000000-LiftAgentProvidersToGlobal';
// build a DataSource against a fresh DB, seed colliding user_providers rows, run up(), assert.
```

- [ ] **Step 2: Run it, expect FAIL** (migration file does not exist yet)

Run: `cd packages/backend && npx jest src/database/migrations/1791000000000-LiftAgentProvidersToGlobal.spec.ts`

- [ ] **Step 3: Write the migration** — port Seb's relabel CTE verbatim into `up()`, with the junction statements removed as described above. Class name `LiftAgentProvidersToGlobal1791000000000`, `name = 'LiftAgentProvidersToGlobal1791000000000'`. Add an inline comment on `down()` noting the lossy `NOT NULL` reversal.

- [ ] **Step 4: Register the migration**

In `packages/backend/src/database/database.module.ts`: add `import { LiftAgentProvidersToGlobal1791000000000 } from './migrations/1791000000000-LiftAgentProvidersToGlobal';` and append it to the `migrations: [...]` array (keep timestamp order).

- [ ] **Step 5: Run it, expect PASS**

Run: `cd packages/backend && npx jest src/database/migrations/1791000000000-LiftAgentProvidersToGlobal.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/database/migrations/1791000000000-LiftAgentProvidersToGlobal.ts packages/backend/src/database/migrations/1791000000000-LiftAgentProvidersToGlobal.spec.ts packages/backend/src/database/database.module.ts
git commit -m "feat(providers): add LiftAgentProvidersToGlobal migration (relabel + user-scoped unique index)"
```

---

## Phase B — Service-layer user re-keying (core)

> Strategy: port Seb's user-scoped version of each file (reference SHA), applying the exact signature changes below and **stripping** the access-control symbols. Existing `*.spec.ts` files call the old `agentId` signatures and will fail to compile/pass — update them to the new signatures in the same task (Seb's branch has updated specs you can diff: `git show c3dd81b0:<spec path>`, minus access-control cases). Each task ends green + 100% covered for the touched file.

### Task B1: `routing-cache.service.ts` — split agent vs user caches

**Files:**
- Modify: `packages/backend/src/routing/routing-core/routing-cache.service.ts`
- Test: `packages/backend/src/routing/routing-core/__tests__/routing-cache.service.spec.ts`

Changes (from map): re-key `getProviders/setProviders`, `getCustomProviders/setCustomProviders`, `getProviderKeys/setProviderKeys` from `agentId` → `userId` (providerKeys cache key `${userId}:${provider}:${authType}`). `invalidateAgent(agentId)` must **stop** clearing providers/customProviders/providerKeys (only `tiers`, `specificity`, `headerTiers`, `modelParams` + listeners). Add `invalidateUser(userId)` that deletes `providers[userId]`, `customProviders[userId]`, and every `providerKeys` entry with prefix `${userId}:`.

- [ ] **Step 1:** Port the test (`git show c3dd81b0:…/routing-cache.service.spec.ts`) — add `invalidateUser` clears the user caches and `invalidateAgent` no longer clears providers.
- [ ] **Step 2:** Run, expect FAIL.  `cd packages/backend && npx jest routing-cache.service`
- [ ] **Step 3:** Port the implementation per the changes above.
- [ ] **Step 4:** Run, expect PASS (+ `--coverage` on this file = 100%).
- [ ] **Step 5:** Commit `feat(routing): split routing cache into agent- and user-scoped with invalidateUser`.

### Task B2: `tier-auto-assign.service.ts` — `recalculate(agentId, userId)`

**Files:**
- Modify: `packages/backend/src/routing/routing-core/tier-auto-assign.service.ts`
- Test: its `__tests__` spec.

Change: `recalculate(agentId)` → `recalculate(agentId, userId)`; body calls `discoveryService.getModelsForAgent(userId, agentId)` → **for our slice call `getModelsForAgent(userId)` (no agentId)** so tiers compute from all user providers.

- [ ] **Step 1:** Update spec to new signature + assert it reads user-scoped models.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Port implementation (2-arg signature; call `getModelsForAgent(userId)`).
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(routing): thread userId through tier auto-assign`.

### Task B3: `model-discovery.service.ts` — user-scoped, drop access filter

**Files:**
- Modify: `packages/backend/src/model-discovery/model-discovery.service.ts`
- Test: its spec.

Changes: `getModelsForAgent(agentId)` → `getModelsForAgent(userId, agentId?)` (provider reads `where: { user_id: userId, is_active: true }`); `getModelForAgent(userId, model, agentId?)`; `discoverAllForAgent(userId)`; `refreshProvider(userId, …)`. **STRIP:** the `private filterProvidersForAgent(...)`, the `@Optional() accessRepo` injection, `invalidateProviderAccess`, and the `if (agentId && !customAuthTypes.has(cpKey)) continue;` custom gate. Keep the `if (!agentId) return this.fetchModelsForAgent(userId)` early path — our callers won't pass `agentId`, so it returns all user providers.

- [ ] **Step 1:** Port/trim the spec (drop access-filter cases; assert user-scoped reads).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Port implementation with strips.
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(discovery): user-scope model discovery, drop per-agent access filter`.

### Task B4: `provider-key.service.ts` — user-scoped, drop access filter

**Files:**
- Modify: `packages/backend/src/routing/routing-core/provider-key.service.ts`
- Test: its spec.

Changes: all read methods (`getProviderKeys`, `getDefaultKeyLabel`, `getProviderApiKey`, `getAuthType`, `hasActiveProvider`, `getProviderRegion`, `findProviderForModel`, `getEffectiveModel`, `resolveProviderKeys`, `isModelAvailable`) take `userId` first and query `where: { user_id }`. **STRIP:** the `@Optional() accessRepo`, `private filterProvidersForAgent(...)`, and the trailing optional `agentId?` param on each (callers will not pass it). Cache reads/writes go through the user-keyed `routingCache.getProviderKeys(userId, …)`.

- [ ] **Step 1:** Port/trim spec to user-scoped signatures, no access cases.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Port implementation with strips.
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(routing): user-scope provider-key lookups, drop access filter`.

### Task B5: `provider.service.ts` — user-scoped mutations + fan-out helpers

**Files:**
- Modify: `packages/backend/src/routing/routing-core/provider.service.ts`
- Test: `packages/backend/src/routing/routing-core/__tests__/provider.service.spec.ts`

Changes (verbatim target signatures from the map):
```ts
recalculateTiers(agentId: string, userId: string): Promise<void>
recalculateTiersForUser(userId: string): Promise<void>            // NEW — fans over listOwnedAgentIds
getProviders(userId: string): Promise<UserProvider[]>            // where: { user_id }
getFreshSubscriptionCredential(userId: string, provider: string, label?: string): Promise<string | null>
upsertProvider(agentId: string | null, userId: string, provider: string, apiKey?: string, authType?: AuthType, region?: string, label?: string): Promise<{ provider: UserProvider; isNew: boolean }>
renameKey(agentId: string, userId: string, provider: string, authType: AuthType, currentLabel: string, newLabel: string): Promise<UserProvider>
reorderKeys(agentId: string, userId: string, provider: string, authType: AuthType, orderedLabels: string[]): Promise<UserProvider[]>
retagAuthType(agentId: string | null, userId: string, provider: string, nextAuthType: AuthType): Promise<void>
removeProvider(agentId: string | null, userId: string, provider: string, authType?: AuthType, label?: string): Promise<{ notifications: string[] }>
deactivateAllProviders(agentId: string, userId: string): Promise<void>
nextOAuthLabel(userId: string, provider: string): Promise<string | undefined>
listOwnedAgentIds(userId: string): Promise<string[]>             // NEW — agents JOIN tenant WHERE tenant.name = userId AND deleted_at IS NULL
```
Private: `afterProviderChange(agentId: string | null, userId)` (null agentId ⇒ `recalculateTiersForUser`), `renumberPriorities(userId, …)`, `cleanupAgentAfterRemoval(agentId, userId, …)`. **Inserts omit `agent_id`** (so new rows are NULL). **Keep** the `upsertProviderWithLabel` in-place-update-on-duplicate behavior (OAuth reconnect). New constructor dep: `@InjectRepository(Agent) agentRepo`. Mutations call **both** `routingCache.invalidateAgent(agentId)` and `routingCache.invalidateUser(userId)`. **STRIP** any access-control references.

- [ ] **Step 1:** Port/trim the spec (large) to the new signatures; add cases: `getProviders` reads by user; insert sets `agent_id` NULL; `removeProvider` fans cleanup across owned agents; `recalculateTiersForUser` iterates `listOwnedAgentIds`.
- [ ] **Step 2:** Run, expect FAIL.  `cd packages/backend && npx jest provider.service`
- [ ] **Step 3:** Port the implementation per signatures above.
- [ ] **Step 4:** Run, expect PASS + coverage 100% on the file.
- [ ] **Step 5:** Commit `feat(routing): user-scope provider service with cross-agent fan-out`.

### Task B6: `tier.service.ts` + `resolve/resolve.service.ts` — thread userId

**Files:**
- Modify: `packages/backend/src/routing/routing-core/tier.service.ts`, `packages/backend/src/routing/resolve/resolve.service.ts`
- Test: their specs.

Changes: `resolve`, `resolveForTier`, `resolveHeaderTier`, `resolveSpecificity`, `buildResolvedRoute`, `enrichRouteKeyLabel`, `resolveProviderForModel` gain `userId`; downstream calls become `isModelAvailable(userId, model)`, `hasActiveProvider(userId, prefix)`, `getAuthType(userId, …)`, `getDefaultKeyLabel(userId, …)`, `getModelForAgent(userId, model)` — **omit `agentId`** (no access filter). `tier.service.ts` provider reads → `getProviders(userId)`.

- [ ] **Step 1:** Port/trim specs to new signatures.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Port implementations.
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(routing): user-scope tier + resolve services`.

### Task B7: `proxy.service.ts` + `proxy-fallback.service.ts` — thread userId (strip rate-limit)

**Files:**
- Modify: `packages/backend/src/routing/proxy/proxy.service.ts`, `packages/backend/src/routing/proxy/proxy-fallback.service.ts`
- Test: their specs.

Changes: pass `userId` into `resolveRouting`/credential lookups; calls become `getProviderApiKey(userId, provider, authType, label)` / `getProviderRegion(userId, …)` and the fallback equivalents — **omit the trailing `agentId`**. Keep the `proxy-fallback` custom-provider lookup `user_id` scoping (security). **STRIP:** `RateLimitTrackerService` injection + the `captureFromResponse(...)` block in `proxy.service.ts` (out of scope) and any related `proxy.module.ts` wiring.

- [ ] **Step 1:** Port/trim specs; assert no rate-limit capture, user-scoped credential reads.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Port implementations with rate-limit strip.
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(proxy): user-scope credential resolution`.

### Task B8: `routing-invalidation.service.ts` + `oauth-refresh-coordinator.ts`

**Files:**
- Modify: `packages/backend/src/routing/routing-core/routing-invalidation.service.ts`, `packages/backend/src/routing/oauth/core/oauth-refresh-coordinator.ts`
- Test: their specs.

Changes: invalidation collects `Map<agentId, userId>` (from `tier.user_id`) and calls `autoAssign.recalculate(agentId, userId)`. `oauthRefreshKey(providerId, userId, agentId, label?)` → `oauthRefreshKey(providerId, userId, label?)` returning `${provider}:${userId}:${label}`.

- [ ] **Step 1:** Port/trim specs.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Port implementations.
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(routing): user-keyed invalidation + oauth refresh key`.

### Task B9: `provider.controller.ts` + `model.controller.ts` + module wiring

**Files:**
- Modify: `packages/backend/src/routing/provider.controller.ts`, `packages/backend/src/routing/model.controller.ts`, `packages/backend/src/routing/routing.module.ts`, `packages/backend/src/routing/routing-core/routing-core.module.ts`
- Test: controller specs.

Changes: in `provider.controller.ts` swap each service call `agent.id` → `user.id` and add `user.id` to `removeProvider`/`recalculateTiers`. **STRIP** the `AgentProviderAccess` import + `@Optional() accessRepo` + junction-write block. In `model.controller.ts` `getAvailableModels`: call `getModelsForAgent(user.id)` (drop `agent.id`); `refreshModels` → `discoverAllForAgent(user.id)` + `recalculateTiers(agent.id, user.id)`. In `routing-core.module.ts`: add `Agent` to `forFeature` if not already present (provider.service injects it); **do not** add `AgentProviderAccess`. In `routing.module.ts`: do **not** register `AgentProviderAccessController` or the analytics controllers.

- [ ] **Step 1:** Port/trim controller specs (no junction assertions; user-scoped calls; available-models returns all user providers).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Port implementations + module edits.
- [ ] **Step 4:** Run, expect PASS + coverage.  Then `cd packages/backend && npx tsc --noEmit` to confirm the whole package compiles after the re-keying.
- [ ] **Step 5:** Commit `feat(routing): user-scope provider + model controllers`.

---

## Phase C — OAuth controller call-site edits

> One task per provider; each is a tiny, mechanical edit. Reference Seb's version per file. For every controller/service the handler signatures and `agentName` query stay the same — only the downstream calls change.

### Task C1: Shared `redirect-pkce-oauth.base.ts`

**Files:** Modify `packages/backend/src/routing/oauth/redirect-pkce-oauth.base.ts`; Test its spec.

Changes: `nextOAuthLabel(pending.userId)`; `recalculateTiers(pending.agentId, pending.userId)`; `oauthRefreshKey(providerId, userId, keyLabel)` (drop agentId); `getFreshSubscriptionCredential(pending.userId, …)`. `PendingState` already has `agentId` + `userId`.

- [ ] **Step 1:** Update spec. **Step 2:** Run→FAIL. **Step 3:** Apply edits. **Step 4:** Run→PASS + coverage. **Step 5:** Commit `feat(oauth): user-scope redirect-pkce base`.

### Task C2: OpenAI + xAI

**Files:** Modify `oauth/openai-oauth.controller.ts`, `oauth/xai/xai-oauth.controller.ts`, `oauth/xai/xai-oauth.service.ts`; Tests.

Changes: controllers `revoke`: `getProviderKeys(user.id, …)` + `removeProvider(agent.id, user.id, …)`. `xai-oauth.service.ts`: `nextOAuthLabel(pending.userId)`, `recalculateTiers(pending.agentId, pending.userId)`, `oauthRefreshKey('xai', userId, keyLabel)`, `getFreshSubscriptionCredential(userId, …)`.

- [ ] Steps 1-5 as in C1. Commit `feat(oauth): user-scope openai + xai`.

### Task C3: Gemini

**Files:** Modify `oauth/gemini-oauth.controller.ts`; Test.

Changes: `getProviderKeys(user.id, …)`, `removeProvider(agent.id, user.id, …)`.

- [ ] Steps 1-5. Commit `feat(oauth): user-scope gemini`.

### Task C4: Anthropic

**Files:** Modify `oauth/anthropic/anthropic-oauth.controller.ts`, `oauth/anthropic/anthropic-oauth.service.ts`; Tests.

Changes: controller disconnect `removeProvider(agent.id, user.id, 'anthropic', 'subscription', keyLabel)`. Service: `nextOAuthLabel(pending.userId, PROVIDER)`, `recalculateTiers(pending.agentId, pending.userId)`, `oauthRefreshKey('anthropic', userId, keyLabel)`, `getFreshSubscriptionCredential(userId, …)`.

- [ ] Steps 1-5. Commit `feat(oauth): user-scope anthropic`.

### Task C5: Kiro + MiniMax

**Files:** Modify `oauth/kiro-oauth.controller.ts`, `oauth/kiro-oauth.service.ts`, `oauth/minimax-oauth.controller.ts`, `oauth/minimax-oauth.service.ts`; Tests.

Changes: controllers `removeProvider(agent.id, user.id, …)`. Services: `nextOAuthLabel(pending.userId, '<provider>')`, `recalculateTiers(pending.agentId, pending.userId)`, `oauthRefreshKey('<provider>', userId, keyLabel)`, `getFreshSubscriptionCredential(userId, …)`.

- [ ] Steps 1-5. Commit `feat(oauth): user-scope kiro + minimax`.

### Task C6: Copilot device flow (+ bug fix)

**Files:** Modify `packages/backend/src/routing/copilot.controller.ts`; Test.

Changes: `recalculateTiers(agent.id, user.id)` AND **fix the bug** — `nextOAuthLabel(user.id, 'copilot')` (Seb left it as `agent.id`, which now resolves zero rows).

- [ ] **Step 1:** Add a spec asserting `nextOAuthLabel` is called with `user.id`. **Step 2:** Run→FAIL. **Step 3:** Apply edits. **Step 4:** Run→PASS + coverage. **Step 5:** Commit `fix(oauth): copilot nextOAuthLabel must be user-scoped`.

---

## Phase D — Slim `GET /api/v1/providers` list endpoint

### Task D1: `GlobalProvidersController` (slim, connections only)

**Files:**
- Create: `packages/backend/src/routing/global-providers.controller.ts`
- Modify: `packages/backend/src/routing/routing.module.ts` (register controller)
- Test: `packages/backend/src/routing/global-providers.controller.spec.ts`

Do **not** port Seb's analytics-heavy `user-providers.controller.ts`. Build a slim controller:

```ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { ProviderService } from './routing-core/provider.service';

@Controller('api/v1/providers')
export class GlobalProvidersController {
  constructor(private readonly providerService: ProviderService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const providers = await this.providerService.getProviders(user.id);
    return providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      auth_type: p.auth_type ?? 'api_key',
      is_active: p.is_active,
      has_api_key: !!p.api_key_encrypted,
      key_prefix: p.key_prefix ?? null,
      label: p.label,
      priority: p.priority,
      region: p.region ?? null,
      connected_at: p.connected_at,
      models_fetched_at: p.models_fetched_at ?? null,
      cached_model_count: Array.isArray(p.cached_models) ? p.cached_models.length : 0,
    }));
  }
}
```

- [ ] **Step 1:** Write the spec — mock `ProviderService.getProviders` returning two user rows; assert the projected shape and that `getProviders` is called with `user.id`.
- [ ] **Step 2:** Run, expect FAIL.  `cd packages/backend && npx jest global-providers.controller`
- [ ] **Step 3:** Create the controller (above) and register it in `routing.module.ts` controllers array.
- [ ] **Step 4:** Run, expect PASS + 100% coverage.
- [ ] **Step 5:** Commit `feat(providers): add slim GET /api/v1/providers list endpoint`.

---

## Phase E — Frontend

### Task E1: Connect-component prop additions

**Files:**
- Modify: `packages/frontend/src/services/routing-params.ts` (extend `ProviderDeepLink` with `authType?`, `closeOnBack?`, `addKey?`)
- Modify: `packages/frontend/src/components/ProviderSelectModal.tsx` (+`initialTab?: 'subscription'|'api_key'|'local'`)
- Modify: `packages/frontend/src/components/ProviderSelectContent.tsx` (+`initialTab`, read `deepLink.authType/addKey/closeOnBack`, thread `detailBack`)
- Modify: `packages/frontend/src/components/ProviderDetailView.tsx` (+`local` connected/mode branch + header restyle)
- Test: the matching `tests/components/*.test.tsx`

Reference each via `git show c3dd81b0:<path>`. These are additive (existing behavior unchanged when the new props are absent).

- [ ] **Step 1:** Port/extend the component tests asserting: modal forwards `initialTab` to content; content defaults its tab from `initialTab`; deeplink `authType` selects the detail auth type; `ProviderDetailView` shows the local branch when `provider.localOnly`.
- [ ] **Step 2:** Run, expect FAIL.  `cd packages/frontend && npx vitest run ProviderSelect`
- [ ] **Step 3:** Port the prop additions.
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(frontend): add initialTab + deeplink fields to provider connect components`.

### Task E2: Three provider pages (stripped)

**Files:**
- Create: `packages/frontend/src/pages/providers/Subscriptions.tsx`, `Byok.tsx`, `Local.tsx`
- Test: `packages/frontend/tests/pages/providers/{Subscriptions,Byok,Local}.test.tsx`

Port each from `git show c3dd81b0:packages/frontend/src/pages/providers/<Page>.tsx`, **stripping** every item in the spec §7 strip-list: `Sparkline`/`InfoTooltip`/`getOverview` imports, all chart-card/savings/cost/last-used memos + table cells, and (Byok) the custom-provider button/branch/`getCustomProviders`. Keep: `createResource(fetchJson('/providers'))`, `getAgents()`→`firstAgentName()`, the connected-list table (Provider / Models / Name / Status), the Supported-providers list with per-provider connection count + Add button, and `<ProviderSelectModal agentName={firstAgentName()} initialTab=… providerDeepLink=… />`. Drop row→`/providers/connections/:id` navigation (no ConnectionDetail). Each page's connected `interface` drops `consumption_*`/`sparkline_7d`/`last_used_at`.

- [ ] **Step 1:** Write Vitest tests per page: mocks `fetchJson('/providers')` → 2 connections; asserts the connected table renders provider + model count + status, the Supported-providers Add button opens the modal with the right `initialTab`, and that **no** chart/sparkline/savings text is present.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Create the three stripped pages.
- [ ] **Step 4:** Run, expect PASS + 100% coverage.
- [ ] **Step 5:** Commit `feat(frontend): add Subscriptions/BYOK/Local global provider pages`.

### Task E3: Routes + Sidebar

**Files:**
- Modify: `packages/frontend/src/index.tsx` (lazy imports + 3 routes + `/providers`→Navigate; import `Navigate` from `@solidjs/router`)
- Modify: `packages/frontend/src/components/Sidebar.tsx` (PROVIDERS section + `isGlobalActive` helper)
- Test: `packages/frontend/tests/components/Sidebar.test.tsx` (+ a routing test if present)

```tsx
// index.tsx — additions
const Subscriptions  = lazyReload(() => import('./pages/providers/Subscriptions.jsx'));
const Byok           = lazyReload(() => import('./pages/providers/Byok.jsx'));
const LocalProviders = lazyReload(() => import('./pages/providers/Local.jsx'));
// inside <Routes>:
<Route path="/providers/subscriptions" component={Subscriptions} />
<Route path="/providers/byok"          component={Byok} />
<Route path="/providers/local"         component={LocalProviders} />
<Route path="/providers" component={() => <Navigate href="/providers/subscriptions" />} />
```

```tsx
// Sidebar.tsx — PROVIDERS section (place per existing sidebar structure)
<div class="sidebar__section-label">PROVIDERS</div>
<A href="/providers/subscriptions" classList={{ active: isGlobalActive('/providers/subscriptions') }}>Subscriptions</A>
<A href="/providers/byok"          classList={{ active: isGlobalActive('/providers/byok') }}>BYOK</A>
<A href="/providers/local"         classList={{ active: isGlobalActive('/providers/local') }}>Local</A>
```
Add `const isGlobalActive = (route: string) => location.pathname === route;` (match Seb's helper).

- [ ] **Step 1:** Update Sidebar test asserting the 3 PROVIDERS links render with correct hrefs and active state.
- [ ] **Step 2:** Run, expect FAIL.  `cd packages/frontend && npx vitest run Sidebar`
- [ ] **Step 3:** Apply route + sidebar edits.
- [ ] **Step 4:** Run, expect PASS + coverage.
- [ ] **Step 5:** Commit `feat(frontend): add global provider routes + sidebar section`.

---

## Phase F — Integration, e2e, changeset, coverage gate

### Task F1: Backend e2e — connect once, all agents see it

**Files:**
- Create/Modify: `packages/backend/test/global-providers.e2e-spec.ts`
- Modify (if needed): `packages/backend/test/helpers.ts` (entities array — only if an entity was added; none added here beyond the modified `UserProvider`, so likely no change — verify)

- [ ] **Step 1:** Write an e2e (supertest, fresh DB): create user + two agents; connect an API-key provider via `POST /api/v1/routing/:agentA/providers`; assert `GET /api/v1/providers` returns it; assert `GET /api/v1/routing/:agentB/available-models` includes that provider's models (proves the global pool reaches a *different* agent).
- [ ] **Step 2:** Run, expect FAIL (if any wiring gap).  `cd packages/backend && npm run test:e2e`
- [ ] **Step 3:** Fix wiring surfaced by the e2e.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `test(providers): e2e global connection visible across agents`.

### Task F2: Full coverage + typecheck + lint gate

- [ ] **Step 1:** `cd packages/backend && npx jest --coverage` → 100% lines on all changed files. Fix gaps.
- [ ] **Step 2:** `cd packages/frontend && npx vitest run --coverage` → 100%. Fix gaps.
- [ ] **Step 3:** `npx tsc --noEmit` in backend and frontend; `npm run lint` at root. Fix.
- [ ] **Step 4:** Commit any test/coverage additions `test(providers): close coverage gaps`.

### Task F3: Changeset + manual smoke

**Files:** Create `.changeset/global-provider-connections.md`.

```md
---
'manifest': minor
---

Add global (user-level) provider connections: connect each provider or subscription once and every one of your agents can use it. Existing agent-scoped connections are migrated up to the global pool (relabeled per source agent, never duplicated). New Subscriptions / BYOK / Local pages in the sidebar manage connections.
```

- [ ] **Step 1:** Add the changeset (target `manifest`).
- [ ] **Step 2:** Manual smoke per CLAUDE.md (fresh cloud DB, `SEED_DATA=true`): start backend + frontend, open the Subscriptions page, connect an API-key provider, confirm it appears and that a second agent's routing sees its models. (This is the failure that motivated the rebuild — confirm it now works.)
- [ ] **Step 3:** Commit `chore: changeset for global provider connections`.
- [ ] **Step 4:** Open the PR against `upstream/main`.

---

## Self-review notes (author)

- **Spec coverage:** A (schema+migration §5) ✓; B (service re-keying §6.1, access-strip §6.2, available-models §6.5) ✓; C (OAuth §6.3 + copilot fix) ✓; D (slim list §6.4) ✓; E (frontend §7) ✓; F (testing §9, changeset §Release) ✓. Non-goals (§3) are enforced by explicit strip lists in B/C/E and the "never import" header.
- **Type consistency:** signatures for `recalculateTiers(agentId, userId)`, `getProviders(userId)`, `removeProvider(agentId, userId, …)`, `nextOAuthLabel(userId, provider)`, `oauthRefreshKey(provider, userId, label?)`, `getModelsForAgent(userId, agentId?)` are used identically across B, C, D.
- **Known residual to verify during execution:** (a) whether `routing-core.module.ts` already registers `Agent` (map said yes) — confirm before adding; (b) whether `test/helpers.ts` needs changes (no new entity, so likely not) — confirm in F1; (c) exact placement of the PROVIDERS section within main's current `Sidebar.tsx` structure.
