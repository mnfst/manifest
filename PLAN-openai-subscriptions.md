# Implementation Plan: OpenAI Subscription Routing

## Overview

Add OpenAI subscription (ChatGPT/Codex OAuth) support to the routing proxy, mirroring the pattern established by PR #1026 for Anthropic subscriptions. Users can connect their OpenAI account via OAuth tokens (from OpenClaw) instead of API keys, enabling flat-rate subscription usage with zero-cost billing.

OpenClaw natively handles OpenAI OAuth (PKCE flow with `auth.openai.com`), storing `{ access, refresh, expires, accountId }` in auth profiles. The Manifest integration needs to accept these tokens, forward them correctly to OpenAI's API, and track subscription vs API key usage throughout the system.

---

## Phase 1: Database Schema Changes

### 1.1 Add `auth_type` column to `user_providers`

**File:** `packages/backend/src/entities/user-provider.entity.ts`

Add a new column:
```typescript
@Column('varchar', { default: 'api_key' })
auth_type!: 'api_key' | 'subscription';
```

This distinguishes whether a provider connection uses a traditional API key or a subscription/OAuth token.

### 1.2 Expand unique constraint on `user_providers`

**File:** New migration `packages/backend/src/database/migrations/AddProviderAuthType<timestamp>.ts`

The current unique index is `[agent_id, provider]`. This must change to `[agent_id, provider, auth_type]` so a user can have both an API key connection AND a subscription connection for the same provider (e.g., OpenAI API key for one agent, OpenAI subscription for another use case).

Migration steps:
1. Add `auth_type` column with default `'api_key'`
2. Drop existing unique index on `[agent_id, provider]`
3. Create new unique index on `[agent_id, provider, auth_type]`

### 1.3 Add `auth_type` column to `agent_messages`

**File:** `packages/backend/src/entities/agent-message.entity.ts`

Add:
```typescript
@Column('varchar', { nullable: true })
auth_type!: string | null;
```

This enables the dashboard to show subscription badges and enforce zero-cost billing for subscription messages.

### 1.4 Migration file

**File:** New migration `packages/backend/src/database/migrations/AddMessageAuthType<timestamp>.ts`

Add `auth_type` varchar column (nullable) to `agent_messages`.

### 1.5 Add `override_auth_type` to `tier_assignments`

**File:** `packages/backend/src/entities/tier-assignment.entity.ts`

Add:
```typescript
@Column('varchar', { nullable: true, default: null })
override_auth_type!: string | null;
```

When a user manually overrides a tier to use a subscription model, this tracks which auth_type should be used for that override.

### 1.6 Migration for `override_auth_type`

**File:** New migration `packages/backend/src/database/migrations/AddOverrideAuthType<timestamp>.ts`

Add `override_auth_type` varchar column (nullable) to `tier_assignments`.

### 1.7 Register migrations

**File:** `packages/backend/src/database/database.module.ts`

Import and add all new migration classes to the `migrations` array.

### 1.8 E2E test helper

**File:** `packages/backend/test/helpers.ts`

Ensure all entities remain registered correctly (no new entities are added, just new columns on existing ones, so this should be fine — verify only).

---

## Phase 2: Backend — Routing Service Changes

### 2.1 Update `ConnectProviderDto`

**File:** `packages/backend/src/routing/dto/routing.dto.ts`

Add optional `authType` field:
```typescript
@IsOptional()
@IsIn(['api_key', 'subscription'])
authType?: 'api_key' | 'subscription';
```

### 2.2 Update `SetOverrideDto`

**File:** `packages/backend/src/routing/dto/routing.dto.ts`

Add optional `authType` field so tier overrides can specify subscription vs API key:
```typescript
@IsOptional()
@IsIn(['api_key', 'subscription'])
authType?: 'api_key' | 'subscription';
```

### 2.3 Update `RoutingService.upsertProvider()`

**File:** `packages/backend/src/routing/routing.service.ts`

- Accept `authType` parameter (default: `'api_key'`)
- Store `auth_type` on the `UserProvider` record
- For subscription auth_type: store the OAuth token in `api_key_encrypted` (encrypted the same way as API keys)
- Don't require `key_prefix` for subscription tokens (or use first 8 chars of the token)
- Update the find query to match on `[agent_id, provider, auth_type]` since the unique constraint now includes auth_type

### 2.4 Update `RoutingService.removeProvider()`

**File:** `packages/backend/src/routing/routing.service.ts`

- Accept `authType` parameter to correctly identify which provider connection to remove
- Update find query to match on auth_type

### 2.5 Update `RoutingService.getProviderApiKey()`

**File:** `packages/backend/src/routing/routing.service.ts`

- Return both the API key/token AND the auth_type so the proxy knows how to format the request
- Change return type from `string | null` to `{ key: string; authType: string } | null` (or add a parallel method `getProviderAuthContext()`)
- The caller (ProxyService) needs auth_type to decide header format

### 2.6 Update `RoutingService.setOverride()`

**File:** `packages/backend/src/routing/routing.service.ts`

- Accept optional `authType` parameter
- Store `override_auth_type` on the tier assignment
- Clear `override_auth_type` in `clearOverride()` and `resetAllOverrides()`

### 2.7 Update `RoutingCacheService`

**File:** `packages/backend/src/routing/routing-cache.service.ts`

- Cache entries must account for auth_type in the key (e.g., `agentId:provider:auth_type` for API key cache)
- Invalidation remains the same (per-agent)

### 2.8 Update `RoutingController`

**File:** `packages/backend/src/routing/routing.controller.ts`

- Pass `authType` from `ConnectProviderDto` through to `upsertProvider()`
- Pass `authType` from `SetOverrideDto` through to `setOverride()`
- Include `auth_type` in provider list responses
- Accept `authType` query param on DELETE provider endpoint

### 2.9 Update `TierAutoAssignService`

**File:** `packages/backend/src/routing/tier-auto-assign.service.ts`

- When auto-assigning models to tiers, prefer API key providers over subscription (subscription has rate limits)
- Track the chosen auth_type alongside the auto-assigned model
- Store `auto_assigned_auth_type` alongside `auto_assigned_model` (may need new column or derive from provider)

---

## Phase 3: Backend — Proxy Changes

### 3.1 Update `ProviderEndpoints` for OpenAI subscription

**File:** `packages/backend/src/routing/proxy/provider-endpoints.ts`

Add a subscription-aware header builder for OpenAI:
```typescript
const openaiSubscriptionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  // OpenAI subscription tokens use the same Bearer auth format as API keys
  // but may require additional headers for OAuth tokens
});
```

OpenAI OAuth tokens use the same `Authorization: Bearer <token>` format as API keys, so the existing `openaiHeaders` function works. No endpoint URL changes needed — subscription tokens hit the same `api.openai.com/v1/chat/completions` endpoint.

**Key difference from Anthropic:** Anthropic subscriptions use a special `anthropic-beta: oauth-2025-04-20` header. OpenAI subscriptions use standard Bearer auth with no special headers. The token itself is the differentiator.

### 3.2 Update `ProxyService.proxyRequest()`

**File:** `packages/backend/src/routing/proxy/proxy.service.ts`

- Get auth context (key + auth_type) instead of just key
- Pass auth_type through to `RoutingMeta` so it can be used for message recording
- Add `authType` field to `RoutingMeta` interface

### 3.3 Update `ProxyService.forwardToProvider()`

**File:** `packages/backend/src/routing/proxy/proxy.service.ts`

- Accept auth_type parameter
- For OpenAI subscription: use same headers (Bearer token) — no change needed for OpenAI specifically
- For Anthropic subscription: add `anthropic-beta` header (already handled by PR #1026)
- Future-proof: switch on `provider + authType` to determine header format

### 3.4 Update `ProviderClient.forward()`

**File:** `packages/backend/src/routing/proxy/provider-client.ts`

- Accept optional `authType` parameter
- When `authType === 'subscription'` and provider is `'openai'`: use standard Bearer auth (same as API key, no changes needed)
- When `authType === 'subscription'` and provider is `'anthropic'`: add `anthropic-beta: oauth-2025-04-20` header

### 3.5 Update `ProxyController` message recording

**File:** `packages/backend/src/routing/proxy/proxy.controller.ts`

- Pass `auth_type` from `RoutingMeta` to all message insert operations
- For subscription auth_type: set `cost_usd = 0` (subscription users pay flat rate, no per-token billing)
- Add `auth_type` field to all `messageRepo.insert()` calls:
  - `recordSuccessMessage()` — set `cost_usd = 0` when auth_type is `'subscription'`
  - `recordProviderError()`
  - `recordFailedFallbacks()`
  - `recordPrimaryFailure()`
  - `recordFallbackSuccess()`

### 3.6 Track fallback auth_type

**File:** `packages/backend/src/routing/proxy/proxy.service.ts`

When a fallback model is tried, it may use a different auth_type than the primary. Track `fallbackAuthType` in the `FailedFallback` interface and the success result so the proxy controller records the correct auth_type for each message.

---

## Phase 4: Backend — Analytics & OTLP Changes

### 4.1 OTLP deduplication with auth_type

**File:** `packages/backend/src/otlp/services/trace-ingest.service.ts` (or equivalent)

When deduplicating OTLP spans against existing proxy messages (matched by `trace_id`), preserve the `auth_type` from the proxy-recorded message. Don't overwrite it with null from OTLP data.

### 4.2 Analytics queries — subscription filtering

**Files:**
- `packages/backend/src/analytics/services/aggregation.service.ts`
- `packages/backend/src/analytics/services/timeseries-queries.service.ts`
- `packages/backend/src/analytics/services/messages-query.service.ts`

- Include `auth_type` in message query results so the frontend can display subscription badges
- Cost aggregation should respect `auth_type`: subscription messages have `cost_usd = 0`, so they won't inflate cost metrics
- Consider adding an auth_type filter to analytics endpoints (e.g., "show only subscription usage")

### 4.3 Overview controller

**File:** `packages/backend/src/analytics/controllers/overview.controller.ts`

No changes needed if cost_usd is already 0 for subscription messages — existing aggregation will naturally show correct costs.

---

## Phase 5: Frontend — Provider Connection UI

### 5.1 Update `ProviderDef` type

**File:** `packages/frontend/src/services/providers.ts`

Add subscription support metadata to the OpenAI provider definition:
```typescript
{
  id: 'openai',
  // ... existing fields ...
  supportsSubscription: true,
  subscriptionTokenPrefix: '',  // OpenAI OAuth tokens don't have a fixed prefix
  subscriptionMinLength: 10,
  subscriptionPlaceholder: 'Paste your OpenAI OAuth token...',
}
```

Also update the Anthropic provider definition similarly (for parity).

### 5.2 Update `ProviderSelectModal`

**File:** `packages/frontend/src/components/ProviderSelectModal.tsx`

- For providers that `supportsSubscription`, show two connection options:
  1. "API Key" — existing flow
  2. "Subscription" — token input with subscription-specific instructions
- Add a tab or toggle between API Key and Subscription modes
- Subscription mode shows:
  - Token input field (masked)
  - Help text: "Paste your OpenAI OAuth token from OpenClaw"
  - Link to OpenClaw setup instructions

### 5.3 Update `ModelPickerModal`

**File:** `packages/frontend/src/components/ModelPickerModal.tsx`

- Show two tabs: "Subscription" and "API Keys" (when both auth types are connected for a provider)
- Models available via subscription should show a subscription badge
- Subscription models show "$0.00" pricing (flat rate)

### 5.4 Update API service

**File:** `packages/frontend/src/services/api.ts`

- Update `connectProvider()` to accept `authType` parameter
- Update `overrideTier()` to accept `authType` parameter
- Include `auth_type` in response types (`TierAssignment`, provider list)

### 5.5 Routing page — Subscription badges

**File:** `packages/frontend/src/pages/Routing.tsx`

- Show subscription badge on tier cards when the effective model uses subscription auth
- Display "$0.00 / 1M tokens" for subscription models
- Show "Subscription" label instead of pricing in tier card details

### 5.6 Provider icon — Subscription overlay

**File:** `packages/frontend/src/components/ProviderIcon.tsx` (or wherever provider icons are rendered)

- Add a small subscription badge overlay on provider icons in the connected providers bar
- Differentiate subscription vs API key connections visually

### 5.7 Message log — Subscription indicator

**Files:**
- `packages/frontend/src/pages/MessageLog.tsx`
- `packages/frontend/src/pages/Overview.tsx`

- Show subscription badge on messages that used subscription auth
- Cost column shows "$0.00" or "Subscription" for subscription messages

### 5.8 Provider validation

**File:** `packages/frontend/src/services/provider-utils.ts`

- Add validation for OpenAI subscription tokens
- OpenAI OAuth tokens are standard JWT-like tokens — validate minimum length
- Distinguish from API keys: OpenAI API keys start with `sk-`, OAuth tokens don't (typically start with `eyJ` for JWT)

---

## Phase 6: OpenClaw Plugin Integration

### 6.1 Plugin subscription tab

**File:** `packages/openclaw-plugin/src/` (relevant plugin files)

- Add OpenAI subscription tab to the plugin setup UI
- Token input for OpenAI OAuth tokens
- The plugin reads tokens from OpenClaw's auth profile (`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`)
- Map `'openai-codex'` provider to `'openai'` for the Manifest backend

### 6.2 Plugin provider mapping

**File:** `packages/openclaw-plugin/src/` (provider mapping)

Ensure the mapping handles:
- `'openai-codex'` → `'openai'` (subscription auth_type)
- `'openai'` → `'openai'` (API key auth_type)

### 6.3 Token refresh awareness

The plugin should be aware that OpenAI OAuth tokens expire. OpenClaw handles refresh automatically, but the plugin should:
- Not cache tokens for longer than their remaining TTL
- Handle 401 responses by suggesting the user refresh their OpenClaw auth

---

## Phase 7: Proxy Header Handling

### 7.1 Response headers

**File:** `packages/backend/src/routing/proxy/proxy.controller.ts`

Add new response header:
```
X-Manifest-Auth-Type: subscription | api_key
```

This lets clients know which auth method was used for the request.

### 7.2 OpenAI-specific subscription headers

Unlike Anthropic (which requires `anthropic-beta: oauth-2025-04-20`), OpenAI subscription tokens use standard Bearer auth. **No special headers needed** for OpenAI subscription — the same `Authorization: Bearer <token>` format works for both API keys and OAuth tokens.

This is a key simplification compared to Anthropic subscription routing.

---

## Phase 8: Testing

### 8.1 Backend unit tests

**New/Modified test files:**

1. **`routing.service.spec.ts`** — Test:
   - `upsertProvider()` with `authType: 'subscription'`
   - `removeProvider()` with auth_type matching
   - `getProviderApiKey()` returning auth context
   - `setOverride()` with `authType`
   - Provider deduplication with different auth_types

2. **`proxy.service.spec.ts`** — Test:
   - `proxyRequest()` passes auth_type through to forwarding
   - Fallback auth_type tracking
   - Subscription vs API key header selection

3. **`proxy.controller.spec.ts`** — Test:
   - `recordSuccessMessage()` with `auth_type: 'subscription'` sets `cost_usd = 0`
   - All message recording methods include auth_type
   - `X-Manifest-Auth-Type` response header

4. **`provider-client.spec.ts`** — Test:
   - OpenAI subscription uses standard Bearer auth (no special headers)
   - Anthropic subscription adds `anthropic-beta` header

5. **`tier-auto-assign.service.spec.ts`** — Test:
   - Auto-assignment preference for API key over subscription
   - Correct auth_type association with assigned models

6. **`routing-cache.service.spec.ts`** — Test:
   - Cache key includes auth_type

7. **Migration tests** — Verify:
   - Column additions are backward-compatible (nullable/default values)
   - Unique constraint change doesn't break existing data

### 8.2 Frontend tests

1. **`ProviderSelectModal.test.tsx`** — Test:
   - Subscription tab renders for OpenAI/Anthropic
   - Token validation for subscription tokens
   - Correct `authType` sent to API

2. **`ModelPickerModal.test.tsx`** — Test:
   - Subscription/API Key tabs
   - Subscription badge rendering
   - Zero-cost display for subscription models

3. **`Routing.test.tsx`** — Test:
   - Subscription badges on tier cards
   - Override with subscription auth_type

4. **`MessageLog.test.tsx`** — Test:
   - Subscription badge display
   - Cost display for subscription messages

### 8.3 E2E tests

**File:** `packages/backend/test/`

- Connect OpenAI provider with subscription auth_type
- Proxy request using subscription token
- Verify `cost_usd = 0` on recorded message
- Verify auth_type persisted correctly
- Verify fallback with mixed auth_types

### 8.4 Plugin tests

- Subscription token input and storage
- Provider mapping (openai-codex → openai)
- Token refresh handling

---

## Phase 9: Changeset & Documentation

### 9.1 Changeset

```bash
npx changeset
# Select: manifest (minor bump)
# Summary: "Add OpenAI subscription routing support"
```

### 9.2 Seed data update

**File:** `packages/backend/src/database/database-seeder.service.ts`

Optionally add a subscription provider to seed data for testing.

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `packages/backend/src/database/migrations/AddProviderAuthType*.ts` | Add auth_type to user_providers, expand unique constraint |
| `packages/backend/src/database/migrations/AddMessageAuthType*.ts` | Add auth_type to agent_messages |
| `packages/backend/src/database/migrations/AddOverrideAuthType*.ts` | Add override_auth_type to tier_assignments |

### Modified Files — Backend
| File | Changes |
|------|---------|
| `entities/user-provider.entity.ts` | Add `auth_type` column |
| `entities/agent-message.entity.ts` | Add `auth_type` column |
| `entities/tier-assignment.entity.ts` | Add `override_auth_type` column |
| `database/database.module.ts` | Register new migrations |
| `routing/dto/routing.dto.ts` | Add `authType` to DTOs |
| `routing/routing.service.ts` | auth_type in upsert/remove/getKey/setOverride |
| `routing/routing.controller.ts` | Pass auth_type through API |
| `routing/routing-cache.service.ts` | auth_type-aware cache keys |
| `routing/tier-auto-assign.service.ts` | Subscription-aware auto-assignment |
| `routing/proxy/proxy.service.ts` | auth_type in RoutingMeta, forwarding |
| `routing/proxy/proxy.controller.ts` | auth_type in message recording, zero-cost billing |
| `routing/proxy/provider-client.ts` | auth_type-aware header building |
| `routing/proxy/provider-endpoints.ts` | (minimal — OpenAI uses same headers) |
| `analytics/services/*.ts` | Include auth_type in query results |

### Modified Files — Frontend
| File | Changes |
|------|---------|
| `services/providers.ts` | `supportsSubscription` on OpenAI provider def |
| `services/api.ts` | auth_type in API calls and response types |
| `services/provider-utils.ts` | Subscription token validation |
| `components/ProviderSelectModal.tsx` | Subscription connection tab |
| `components/ModelPickerModal.tsx` | Subscription/API Key tabs |
| `pages/Routing.tsx` | Subscription badges on tier cards |
| `pages/MessageLog.tsx` | Subscription badge on messages |
| `pages/Overview.tsx` | Subscription indicator |

### Modified Files — Plugin
| File | Changes |
|------|---------|
| `packages/openclaw-plugin/src/*.ts` | OpenAI subscription tab, provider mapping |

---

## Key Design Decisions

1. **Same endpoint for subscription and API key**: OpenAI uses `api.openai.com/v1/chat/completions` for both. No endpoint bifurcation needed (unlike Anthropic which needed `anthropic-beta` header).

2. **Zero-cost billing for subscription**: Messages proxied with subscription auth_type always have `cost_usd = 0`. This is enforced at the proxy controller level when recording messages.

3. **Dual provider connections**: The expanded unique constraint `[agent_id, provider, auth_type]` allows connecting OpenAI with both API key and subscription simultaneously. The tier system can then choose which to use.

4. **Auth_type preference in auto-assign**: API key providers are preferred over subscription for auto-assignment because subscription tokens have stricter rate limits. Users can manually override to subscription.

5. **Token format**: OpenAI OAuth tokens use standard JWT format (`eyJ...`). API keys use `sk-...` prefix. Frontend validation distinguishes between them automatically.

6. **Fallback auth_type tracking**: Each fallback model independently tracks its auth_type, so a fallback chain can mix subscription and API key providers.

---

## Implementation Order

1. **Phase 1** (Database) — Foundation, must be first
2. **Phase 2** (Routing Service) — Core backend logic
3. **Phase 3** (Proxy) — Request forwarding and recording
4. **Phase 4** (Analytics) — Dashboard data
5. **Phase 5** (Frontend) — UI components
6. **Phase 6** (Plugin) — OpenClaw integration
7. **Phase 7** (Headers) — Response metadata
8. **Phase 8** (Testing) — Full coverage (should be done alongside each phase)
9. **Phase 9** (Changeset) — Release prep

Estimated scope: ~40-50 files modified/created across all phases.
