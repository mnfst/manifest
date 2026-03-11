# Implementation Plan: OpenAI Subscription Routing

## Overview

Add OpenAI subscription (ChatGPT Plus/Pro/Team OAuth) support to the routing proxy, mirroring the Anthropic subscription pattern from PR #1026. Users connect their OpenAI account via OAuth tokens (from OpenClaw), enabling flat-rate subscription usage with `cost_usd = 0` billing.

OpenClaw handles the OAuth PKCE flow with `auth.openai.com`, storing `{ access, refresh, expires, accountId }` in auth profiles. Manifest accepts these tokens, forwards them as standard `Authorization: Bearer <token>` to `api.openai.com`, and tracks subscription vs API key usage throughout the system.

**Key simplification vs Anthropic:** OpenAI subscription tokens use the same `Authorization: Bearer` header format as API keys. No special headers needed (Anthropic requires `anthropic-beta: oauth-2025-04-20`).

---

## Critical Requirements (from CLAUDE.md)

- **100% line coverage** on all new/modified code
- **Changeset required** — minor bump for `manifest` package
- **Migrations auto-run** on startup — use unique timestamps, register in `database.module.ts`
- **E2E test entities** — if any new entities added, register in `packages/backend/test/helpers.ts`
- **No external CDNs** — all assets self-hosted
- **CSP strict** — no new external domains

---

## Phase 1: Database Schema (3 migrations + 3 entity changes)

### Step 1.1: Migration — Add `auth_type` to `user_providers`

**Create:** `packages/backend/src/database/migrations/1773300000000-AddProviderAuthType.ts`

```typescript
import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddProviderAuthType1773300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add auth_type column with default 'api_key'
    await queryRunner.addColumn('user_providers', new TableColumn({
      name: 'auth_type',
      type: 'varchar',
      default: "'api_key'",
    }));

    // 2. Drop existing unique index on [agent_id, provider]
    //    The index name comes from the @Index decorator in user-provider.entity.ts
    //    Check the actual index name by looking at the entity or InitialSchema migration
    const table = await queryRunner.getTable('user_providers');
    const existingIndex = table?.indices.find(
      idx => idx.columnNames.includes('agent_id') && idx.columnNames.includes('provider') && idx.isUnique,
    );
    if (existingIndex) {
      await queryRunner.dropIndex('user_providers', existingIndex);
    }

    // 3. Create new unique index on [agent_id, provider, auth_type]
    await queryRunner.createIndex('user_providers', new TableIndex({
      name: 'IDX_user_providers_agent_provider_authtype',
      columnNames: ['agent_id', 'provider', 'auth_type'],
      isUnique: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('user_providers', 'IDX_user_providers_agent_provider_authtype');
    await queryRunner.createIndex('user_providers', new TableIndex({
      columnNames: ['agent_id', 'provider'],
      isUnique: true,
    }));
    await queryRunner.dropColumn('user_providers', 'auth_type');
  }
}
```

**Write test:** `1773300000000-AddProviderAuthType.spec.ts` — mock QueryRunner, verify `addColumn`, `dropIndex`, `createIndex` calls and down() reversal.

### Step 1.2: Migration — Add `auth_type` to `agent_messages`

**Create:** `packages/backend/src/database/migrations/1773310000000-AddMessageAuthType.ts`

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMessageAuthType1773310000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('agent_messages', new TableColumn({
      name: 'auth_type',
      type: 'varchar',
      isNullable: true,
      default: null,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('agent_messages', 'auth_type');
  }
}
```

**Write test:** `1773310000000-AddMessageAuthType.spec.ts`

### Step 1.3: Migration — Add `override_auth_type` to `tier_assignments`

**Create:** `packages/backend/src/database/migrations/1773320000000-AddOverrideAuthType.ts`

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOverrideAuthType1773320000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('tier_assignments', new TableColumn({
      name: 'override_auth_type',
      type: 'varchar',
      isNullable: true,
      default: null,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tier_assignments', 'override_auth_type');
  }
}
```

**Write test:** `1773320000000-AddOverrideAuthType.spec.ts`

### Step 1.4: Entity changes

**File:** `packages/backend/src/entities/user-provider.entity.ts`

Add column after `provider`:
```typescript
@Column('varchar', { default: 'api_key' })
auth_type!: 'api_key' | 'subscription';
```

Change the `@Index` decorator from `['agent_id', 'provider']` to `['agent_id', 'provider', 'auth_type']` with `{ unique: true }`.

**File:** `packages/backend/src/entities/agent-message.entity.ts`

Add column (at the end, near `user_id`):
```typescript
@Column('varchar', { nullable: true })
auth_type!: string | null;
```

**File:** `packages/backend/src/entities/tier-assignment.entity.ts`

Add column after `fallback_models`:
```typescript
@Column('varchar', { nullable: true, default: null })
override_auth_type!: string | null;
```

### Step 1.5: Register migrations

**File:** `packages/backend/src/database/database.module.ts`

Import all 3 new migration classes and add them to the `migrations` array.

**File:** `packages/backend/src/database/datasource.ts`

Import and add same 3 migrations to the CLI DataSource `migrations` array.

### Step 1.6: Verify E2E helpers

**File:** `packages/backend/test/helpers.ts`

No new entities — just new columns on existing entities. Verify the existing entity registration is sufficient (it should be, no changes needed).

---

## Phase 2: Backend — Routing DTOs & Service

### Step 2.1: Update DTOs

**File:** `packages/backend/src/routing/dto/routing.dto.ts`

Add to `ConnectProviderDto`:
```typescript
@IsOptional()
@IsIn(['api_key', 'subscription'])
authType?: 'api_key' | 'subscription';
```

Add to `SetOverrideDto`:
```typescript
@IsOptional()
@IsIn(['api_key', 'subscription'])
authType?: 'api_key' | 'subscription';
```

Add a new DTO for removing a provider with auth_type:
```typescript
export class RemoveProviderQueryDto {
  @IsOptional()
  @IsIn(['api_key', 'subscription'])
  authType?: 'api_key' | 'subscription';
}
```

### Step 2.2: Update `ResolveResponse`

**File:** `packages/backend/src/routing/dto/resolve-response.ts`

Add `AuthType` type and `auth_type` field:
```typescript
export type AuthType = 'api_key' | 'subscription';

// Add to ResolveResponse interface/class:
auth_type?: AuthType;
```

### Step 2.3: Update `RoutingService`

**File:** `packages/backend/src/routing/routing.service.ts`

**Method: `upsertProvider()`** — Add `authType` parameter (default `'api_key'`):
- Change find query: `{ agent_id: agentId, provider, auth_type: authType }` instead of just `{ agent_id, provider }`
- Set `auth_type` on the new/updated record
- For subscription: store OAuth token in `api_key_encrypted` (same encryption)
- For subscription: set `key_prefix` to first 8 chars of token (or `'oauth'`)

**Method: `removeProvider()`** — Add `authType` parameter:
- Change find query: include `auth_type: authType` in the where clause
- If `authType` not provided, fall back to finding by `[agent_id, provider]` only (backward compat)

**Method: `getProviderApiKey()`** — Change return type:
- Current: `Promise<string | null>`
- New: `Promise<{ key: string; authType: 'api_key' | 'subscription' } | null>`
- Return both the decrypted key/token AND the auth_type from the UserProvider record
- Update cache key format: `${agentId}:${provider}` → `${agentId}:${provider}:${authType}` (or cache the full object)

**Method: `getAuthType()`** — New method:
```typescript
async getAuthType(agentId: string, provider: string): Promise<'api_key' | 'subscription'> {
  const providers = await this.getProviders(agentId);
  const match = providers.find(p => p.provider === provider && p.is_active);
  return match?.auth_type ?? 'api_key';
}
```

Or better: when there are BOTH auth types for a provider, determine which to use based on the tier's `override_auth_type` or default preference (API key preferred).

**Method: `setOverride()`** — Add `authType` parameter:
- Store `override_auth_type` on the tier assignment
- Clear it in `clearOverride()` and `resetAllOverrides()`

**Method: `getEffectiveModel()`** — Existing logic stays, but also return the effective auth_type:
- If `override_auth_type` is set on the tier → use that
- Else → derive from the provider's auth_type

**Update tests:** `routing.service.spec.ts` — add test cases for all auth_type-related scenarios.

### Step 2.4: Update `RoutingController`

**File:** `packages/backend/src/routing/routing.controller.ts`

- **POST providers:** Pass `dto.authType` to `upsertProvider()`
- **DELETE providers:** Accept `authType` as query param using `@Query() query: RemoveProviderQueryDto`, pass to `removeProvider()`
- **GET providers:** Include `auth_type` in response objects
- **PUT tiers/:tier:** Pass `dto.authType` to `setOverride()`
- **GET tiers:** Include `override_auth_type` in response

**Update tests:** `routing.controller.spec.ts`

### Step 2.5: Update `RoutingCacheService`

**File:** `packages/backend/src/routing/routing-cache.service.ts`

The API key cache currently uses `${agentId}:${provider}` as key. If both auth_types exist for the same provider, the cache needs to distinguish them. Options:
1. Cache the full list of providers per agent (already done via `providers` cache) and derive from there
2. Change API key cache key to `${agentId}:${provider}:${authType}`

Go with option 2 — it's simpler and more explicit.

**Update tests:** `routing-cache.service.spec.ts`

### Step 2.6: Update `TierAutoAssignService`

**File:** `packages/backend/src/routing/tier-auto-assign.service.ts`

- When auto-assigning, if a provider has both API key and subscription connections, prefer API key (better rate limits)
- The `pickBest()` method receives models with provider info — no change to signature needed
- Add logic: if multiple providers are active for the same model, prefer `auth_type: 'api_key'`

**Update tests:** `tier-auto-assign.service.spec.ts`

### Step 2.7: Update `ResolveService`

**File:** `packages/backend/src/routing/resolve.service.ts`

- After resolving the model/provider, determine auth_type via `routingService.getAuthType()`
- Include `auth_type` in the `ResolveResponse`

**Update tests:** `resolve.service.spec.ts`

### Step 2.8: Update `ResolveController`

**File:** `packages/backend/src/routing/resolve.controller.ts`

- Include `auth_type` in the response (it's already part of `ResolveResponse` after Step 2.2)

**Update tests:** `resolve.controller.spec.ts`

---

## Phase 3: Backend — Proxy Changes

### Step 3.1: Update `ProviderEndpoints`

**File:** `packages/backend/src/routing/proxy/provider-endpoints.ts`

Modify the `buildHeaders` function for providers to accept an optional `authType` parameter:

```typescript
// For OpenAI: subscription uses same Bearer header — no changes needed to the header builder
// For Anthropic: subscription needs anthropic-beta header
const ENDPOINTS: Record<string, ProviderEndpoint> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    buildHeaders: (apiKey: string, authType?: string) => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    // ... existing
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    buildHeaders: (apiKey: string, authType?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };
      if (authType === 'subscription') {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['anthropic-beta'] = 'oauth-2025-04-20';
      } else {
        headers['x-api-key'] = apiKey;
      }
      return headers;
    },
    // ... existing
  },
  // ... other providers unchanged
};
```

**Update `ProviderEndpoint` interface:**
```typescript
interface ProviderEndpoint {
  baseUrl: string;
  buildHeaders: (apiKey: string, authType?: string) => Record<string, string>;
  buildPath: (model: string) => string;
  format: 'openai' | 'google' | 'anthropic';
}
```

**Update tests:** `provider-endpoints.spec.ts` — test OpenAI headers with both auth types, test Anthropic headers with subscription.

### Step 3.2: Update `ProviderClient.forward()`

**File:** `packages/backend/src/routing/proxy/provider-client.ts`

Add `authType` parameter:
```typescript
async forward(
  provider: string,
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  stream: boolean,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
  customEndpoint?: ProviderEndpoint,
  authType?: string,  // NEW
): Promise<ForwardResult>
```

Pass `authType` to `endpoint.buildHeaders(apiKey, authType)`.

**Update tests:** `provider-client.spec.ts`

### Step 3.3: Update `RoutingMeta` interface

**File:** `packages/backend/src/routing/proxy/proxy.service.ts`

Add to `RoutingMeta`:
```typescript
authType?: 'api_key' | 'subscription';
```

Add to `FailedFallback`:
```typescript
authType?: 'api_key' | 'subscription';
```

### Step 3.4: Update `ProxyService.proxyRequest()`

**File:** `packages/backend/src/routing/proxy/proxy.service.ts`

- After resolving model, get auth context: `const authCtx = await this.routingService.getProviderApiKey(agentId, provider);`
- The return is now `{ key, authType }` instead of just `string`
- Set `meta.authType = authCtx.authType`
- Pass `authType` to `forward()` call

For fallback chain:
- Each fallback attempt gets its own auth context (may differ if fallback uses different provider)
- Track `authType` per fallback in `FailedFallback`

**Update tests:** `proxy.service.spec.ts`

### Step 3.5: Update `ProxyController` message recording

**File:** `packages/backend/src/routing/proxy/proxy.controller.ts`

**In all message recording methods**, add `auth_type` field:

```typescript
// recordSuccessMessage:
await this.messageRepo.insert({
  // ... existing fields ...
  auth_type: meta.authType ?? null,
  cost_usd: meta.authType === 'subscription' ? 0 : computedCost,
});
```

Apply the same pattern to:
- `recordSuccessMessage()` — `cost_usd = 0` for subscription, include `auth_type`
- `recordProviderError()` — include `auth_type`
- `recordFailedFallbacks()` — include per-fallback `authType`
- `recordPrimaryFailure()` — include `auth_type`
- `recordFallbackSuccess()` — include `auth_type` from successful fallback

**Add response header:**
```typescript
if (meta.authType) {
  res.setHeader('X-Manifest-Auth-Type', meta.authType);
}
```

**Update tests:** `proxy.controller.spec.ts` — test zero-cost for subscription, auth_type on all record methods, response header.

---

## Phase 4: Backend — OTLP & Analytics

### Step 4.1: OTLP trace ingestion — preserve auth_type

**File:** `packages/backend/src/otlp/services/trace-ingest.service.ts`

In `remapProxyDuplicates` (or wherever proxy-recorded messages are matched with OTLP spans):
- When an OTLP span matches an existing proxy-recorded message by `trace_id`, preserve the `auth_type` from the existing message
- Don't overwrite `auth_type` with null from OTLP data

In `rollUpMessageAggregates`:
- Use `CASE WHEN` to preserve auth_type: if existing `auth_type IS NOT NULL`, keep it; else set from OTLP data (which is null anyway)
- Subscription messages: `cost_usd` stays 0 — add `CASE WHEN auth_type = 'subscription' THEN 0 ELSE computed_cost END`

In `computeCost`:
- Accept auth_type parameter. If `'subscription'`, return 0

**Update tests:** `trace-ingest.service.spec.ts`

### Step 4.2: Analytics — include auth_type in queries

**File:** `packages/backend/src/analytics/services/messages-query.service.ts`

- Add `auth_type` to the SELECT fields in message list queries
- No filtering changes needed — subscription messages naturally have `cost_usd = 0`

**File:** `packages/backend/src/analytics/services/aggregation.service.ts`

- Include `auth_type` in aggregation groupings where relevant
- Add `auth_type` to the agent summary response

**File:** `packages/backend/src/analytics/services/timeseries-queries.service.ts`

- Include `auth_type` in timeseries data points (optional — only if frontend needs to chart by auth_type)

**Update tests:** Corresponding `.spec.ts` files for each service.

### Step 4.3: Analytics controllers

**Files:** `packages/backend/src/analytics/controllers/*.ts`

- Include `auth_type` in message response DTOs
- No new endpoints needed — existing ones return the data with the new field

**Update tests:** Corresponding `.spec.ts` files.

---

## Phase 5: Frontend — UI Changes

### Step 5.1: Provider definitions

**File:** `packages/frontend/src/services/providers.ts`

Add subscription metadata to the `ProviderDef` interface:
```typescript
interface ProviderDef {
  // ... existing fields ...
  supportsSubscription?: boolean;
  subscriptionLabel?: string;    // e.g., "ChatGPT Plus/Pro"
  subscriptionHint?: string;     // Setup instructions
}
```

Add to OpenAI provider definition:
```typescript
{
  id: 'openai',
  // ... existing ...
  supportsSubscription: true,
  subscriptionLabel: 'ChatGPT Plus/Pro/Team',
  subscriptionHint: 'Connect via OpenClaw to use your ChatGPT subscription',
}
```

Add to Anthropic provider definition (for parity):
```typescript
{
  id: 'anthropic',
  // ... existing ...
  supportsSubscription: true,
  subscriptionLabel: 'Claude Max/Pro',
  subscriptionHint: 'Connect via OpenClaw to use your Claude subscription',
}
```

**Update tests:** `providers.test.ts` (if exists)

### Step 5.2: API service types

**File:** `packages/frontend/src/services/api.ts`

Update `RoutingProvider` interface:
```typescript
interface RoutingProvider {
  // ... existing fields ...
  auth_type: 'api_key' | 'subscription';
}
```

Update `TierAssignment` interface:
```typescript
interface TierAssignment {
  // ... existing fields ...
  override_auth_type: string | null;
}
```

Update `connectProvider()`:
```typescript
export async function connectProvider(
  agentName: string,
  data: { provider: string; apiKey?: string; authType?: string },
): Promise<void> {
  // POST body includes authType
}
```

Update `disconnectProvider()`:
```typescript
export async function disconnectProvider(
  agentName: string,
  provider: string,
  authType?: string,
): Promise<void> {
  // DELETE with ?authType=... query param
  const params = authType ? `?authType=${authType}` : '';
  // ...
}
```

Update `overrideTier()`:
```typescript
export async function overrideTier(
  agentName: string,
  tier: string,
  model: string,
  authType?: string,
): Promise<TierAssignment> {
  // PUT body includes authType
}
```

**Update tests:** `api.test.ts`

### Step 5.3: Provider validation

**File:** `packages/frontend/src/services/provider-utils.ts`

Add subscription token validation:
```typescript
export function validateSubscriptionToken(provider: ProviderDef, token: string): { valid: boolean; error?: string } {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: 'Token is required' };
  }
  if (token.length < 10) {
    return { valid: false, error: 'Token is too short' };
  }
  // OpenAI API keys start with 'sk-' — subscription tokens should NOT
  if (provider.id === 'openai' && token.startsWith('sk-')) {
    return { valid: false, error: 'This looks like an API key. Use the API Key tab instead.' };
  }
  // Anthropic API keys start with 'sk-ant-' — subscription tokens start with 'sk-ant-oat'
  if (provider.id === 'anthropic' && token.startsWith('sk-ant-api')) {
    return { valid: false, error: 'This looks like an API key. Use the API Key tab instead.' };
  }
  return { valid: true };
}
```

**Update tests:** `provider-utils.test.ts`

### Step 5.4: ProviderSelectModal — Subscription tab

**File:** `packages/frontend/src/components/ProviderSelectModal.tsx`

When a provider has `supportsSubscription: true`, show two tabs in the detail view:

**Tab 1 — "API Key"** (existing flow):
- API key input with existing validation
- Connect/Disconnect buttons

**Tab 2 — "Subscription"**:
- Token input (masked, like API key input)
- Help text from `provider.subscriptionHint`
- "Connect Subscription" button
- On connect: call `connectProvider(agentName, { provider: provId, apiKey: token, authType: 'subscription' })`

In the provider list view:
- Show subscription badge next to providers that have a subscription connection
- Show both connection statuses (API key connected + subscription connected)

**Update tests:** `ProviderSelectModal.test.tsx`

### Step 5.5: ModelPickerModal — Subscription/API Key tabs

**File:** `packages/frontend/src/components/ModelPickerModal.tsx`

When the user has both subscription and API key connections for any provider:
- Show two tabs at the top: "All Models" | "Subscription" | "API Keys"
- "Subscription" tab: filter to models from providers where subscription is connected
- "API Keys" tab: filter to models from providers where API key is connected
- "All Models" (default): show everything

Subscription models show "$0.00" pricing badge.

**Update tests:** `ModelPickerModal.test.tsx`

### Step 5.6: Routing page — Subscription badges

**File:** `packages/frontend/src/pages/Routing.tsx`

On tier cards:
- If the effective model's provider has `override_auth_type === 'subscription'`, show a "Subscription" badge
- Replace pricing display with "$0.00 / 1M tokens" or "Subscription — flat rate"
- Use a distinct visual style (e.g., green/teal badge) to differentiate from API key usage

In the connected providers bar:
- Show dual badges when a provider has both connection types
- E.g., OpenAI icon with both "API" and "Sub" mini-badges

**Update tests:** `Routing.test.tsx`

### Step 5.7: MessageLog — Subscription badge

**File:** `packages/frontend/src/pages/MessageLog.tsx`

- When a message has `auth_type === 'subscription'`, show a small "Sub" badge
- Cost column shows "$0.00" for subscription messages
- Optional: filter by auth_type in the message list

**Update tests:** `MessageLog.test.tsx`

### Step 5.8: Overview page — Subscription indicator

**File:** `packages/frontend/src/pages/Overview.tsx`

- In cost summaries, subscription messages contribute $0.00 (already works via `cost_usd = 0`)
- Optional: show a "Subscription messages" count in the overview stats

**Update tests:** `Overview.test.tsx`

### Step 5.9: Styles

**Files under:** `packages/frontend/src/styles/`

Add CSS for:
- `.subscription-badge` — small teal/green badge
- `.subscription-tab` — tab styling for subscription/API key tabs in modals
- `.subscription-tier-card` — tier card variant when using subscription
- `.subscription-price` — "$0.00" price display styling

---

## Phase 6: OpenClaw Plugin

### Step 6.1: Subscription module

**Create:** `packages/openclaw-plugin/src/subscription.ts`

Handle OpenAI subscription token forwarding:
- Read tokens from OpenClaw auth profiles
- Map `'openai-codex'` provider → `'openai'` for Manifest backend
- Handle token refresh awareness (don't cache past expiry)

### Step 6.2: Plugin hooks

**File:** `packages/openclaw-plugin/src/hooks.ts`

- Add subscription-aware hook handling
- When routing resolves to a subscription provider, use the OAuth token

### Step 6.3: Plugin routing

**File:** `packages/openclaw-plugin/src/routing.ts`

- Add subscription provider support
- Pass `authType: 'subscription'` when connecting subscription providers

### Step 6.4: Plugin UI

**File:** `packages/openclaw-plugin/public/index.html`

- Add OpenAI subscription tab to the setup UI
- Show connection status for subscription vs API key

**Write tests:** `packages/openclaw-plugin/__tests__/subscription.test.ts` — comprehensive tests for all subscription logic.

**Update tests:** `packages/openclaw-plugin/__tests__/hooks.test.ts`, `routing.test.ts`

---

## Phase 7: Seed Data & Local Mode

### Step 7.1: Seed data

**File:** `packages/backend/src/database/database-seeder.service.ts`

Add a subscription provider to seed data (when `SEED_DATA=true`):
```typescript
// Seed a subscription provider for demo agent
await providerRepo.save({
  id: 'seed-sub-openai-001',
  user_id: adminUser.id,
  agent_id: demoAgent.id,
  provider: 'openai',
  auth_type: 'subscription',
  api_key_encrypted: encrypt('fake-openai-oauth-token-for-dev'),
  key_prefix: 'eyJhbGci',
  is_active: true,
});
```

Also seed some `agent_messages` with `auth_type: 'subscription'` and `cost_usd: 0` for dashboard testing.

**Update tests:** `database-seeder.service.spec.ts`

### Step 7.2: Local bootstrap

**File:** `packages/backend/src/database/local-bootstrap.service.ts`

- Ensure local mode handles the new `auth_type` column gracefully
- SQLite migration compatibility (varchar columns, nullable)

**Update tests:** `local-bootstrap.service.spec.ts`

---

## Phase 8: Changeset

**Run:**
```bash
npx changeset
# Select: manifest
# Bump: minor
# Summary: Add OpenAI subscription routing with zero-cost billing and dual auth_type support
```

Commit the generated `.changeset/*.md` file.

---

## File Change Summary

### New Files (estimated ~15)
| File | Purpose |
|------|---------|
| `migrations/1773300000000-AddProviderAuthType.ts` | auth_type on user_providers + unique constraint |
| `migrations/1773300000000-AddProviderAuthType.spec.ts` | Migration test |
| `migrations/1773310000000-AddMessageAuthType.ts` | auth_type on agent_messages |
| `migrations/1773310000000-AddMessageAuthType.spec.ts` | Migration test |
| `migrations/1773320000000-AddOverrideAuthType.ts` | override_auth_type on tier_assignments |
| `migrations/1773320000000-AddOverrideAuthType.spec.ts` | Migration test |
| `packages/openclaw-plugin/src/subscription.ts` | Plugin subscription handling |
| `packages/openclaw-plugin/__tests__/subscription.test.ts` | Plugin subscription tests |
| `.changeset/openai-subscription-routing.md` | Changeset |

### Modified Files — Backend (estimated ~25)
| File | Changes |
|------|---------|
| `entities/user-provider.entity.ts` | `auth_type` column + updated unique index |
| `entities/agent-message.entity.ts` | `auth_type` column |
| `entities/tier-assignment.entity.ts` | `override_auth_type` column |
| `database/database.module.ts` | Register 3 migrations |
| `database/datasource.ts` | Register 3 migrations |
| `database/database-seeder.service.ts` | Seed subscription provider + messages |
| `database/local-bootstrap.service.ts` | Handle auth_type in local mode |
| `routing/dto/routing.dto.ts` | `authType` on DTOs |
| `routing/dto/resolve-response.ts` | `AuthType` type + field |
| `routing/routing.service.ts` | auth_type in upsert/remove/getKey/setOverride |
| `routing/routing.controller.ts` | Pass auth_type through endpoints |
| `routing/routing-cache.service.ts` | auth_type-aware cache keys |
| `routing/resolve.service.ts` | auth_type in resolution |
| `routing/resolve.controller.ts` | auth_type in response |
| `routing/tier-auto-assign.service.ts` | Prefer API key over subscription |
| `routing/proxy/proxy.service.ts` | auth_type in RoutingMeta + forwarding |
| `routing/proxy/proxy.controller.ts` | auth_type in message recording + zero-cost + header |
| `routing/proxy/provider-client.ts` | auth_type parameter on forward() |
| `routing/proxy/provider-endpoints.ts` | auth_type on buildHeaders(), Anthropic subscription headers |
| `otlp/services/trace-ingest.service.ts` | Preserve auth_type, subscription cost=0 |
| `analytics/services/messages-query.service.ts` | auth_type in SELECT |
| `analytics/services/aggregation.service.ts` | auth_type grouping |
| + all corresponding `.spec.ts` files | Test updates |

### Modified Files — Frontend (estimated ~15)
| File | Changes |
|------|---------|
| `services/providers.ts` | `supportsSubscription` on provider defs |
| `services/api.ts` | auth_type in types + API calls |
| `services/provider-utils.ts` | Subscription token validation |
| `components/ProviderSelectModal.tsx` | Subscription connection tab |
| `components/ModelPickerModal.tsx` | Subscription/API Key tabs |
| `pages/Routing.tsx` | Subscription badges on tier cards |
| `pages/MessageLog.tsx` | Subscription badge on messages |
| `pages/Overview.tsx` | Subscription indicator |
| `styles/*.css` | Subscription badge styles |
| + all corresponding test files | Test updates |

### Modified Files — Plugin (estimated ~5)
| File | Changes |
|------|---------|
| `src/hooks.ts` | Subscription hook handling |
| `src/routing.ts` | Subscription provider support |
| `src/index.ts` | Subscription module registration |
| `public/index.html` | Subscription tab UI |
| + test files | Test updates |

---

## Implementation Order (dependency chain)

```
Phase 1 (Schema) → Phase 2 (Service) → Phase 3 (Proxy) → Phase 4 (OTLP/Analytics)
                                                         ↘ Phase 5 (Frontend)
                                                         ↘ Phase 6 (Plugin)
Phase 7 (Seed) can run after Phase 1
Phase 8 (Changeset) runs last
```

**Suggested execution order:**
1. Phase 1 — All 3 migrations + entity changes + registration
2. Phase 2 — DTOs, RoutingService, RoutingController, ResolveService, cache, auto-assign
3. Phase 3 — Provider endpoints, ProviderClient, ProxyService, ProxyController
4. Phase 4 — OTLP trace ingestion, analytics services
5. Phase 7 — Seed data + local mode
6. Phase 5 — Frontend UI (can be done in parallel with Phase 4/7)
7. Phase 6 — Plugin (can be done in parallel with Phase 5)
8. Phase 8 — Changeset

**Testing:** Write tests alongside each phase, not as a separate phase. Every modified/created file must have 100% line coverage.

---

## Key Design Decisions

1. **Same endpoint for OpenAI subscription and API key** — Both use `api.openai.com/v1/chat/completions` with `Authorization: Bearer`. No endpoint changes needed.

2. **Zero-cost billing** — Subscription messages always have `cost_usd = 0`. Enforced in 3 places:
   - `proxy.controller.ts` — `recordSuccessMessage()`
   - `trace-ingest.service.ts` — `computeCost()` returns 0 for subscription
   - `trace-ingest.service.ts` — `rollUpMessageAggregates()` preserves 0 for subscription

3. **Dual connections** — Unique constraint `[agent_id, provider, auth_type]` allows same provider with both auth types.

4. **API key preferred for auto-assign** — Subscription has stricter rate limits. Users can manually override to subscription.

5. **Token format detection** — OpenAI: API keys start `sk-`, OAuth tokens are JWTs (`eyJ...`). Frontend validates appropriately.

6. **Anthropic parity** — Although this plan focuses on OpenAI, the changes support Anthropic subscription too (different header handling via `buildHeaders` auth_type parameter).

7. **Backward compatibility** — All new columns have defaults (`'api_key'`) or are nullable. Existing data continues to work without changes.
