---
'manifest': patch
---

Code quality audit cleanup across backend, frontend, and shared packages:

- Consolidate the provider registry into a single source of truth at `packages/shared/src/providers.ts` that the backend `PROVIDER_REGISTRY` and frontend `PROVIDERS` both consume, eliminating drift.
- Drop the vestigial `DbDialect` / `detectDialect` / `portableSql` helpers and the `_dialect` parameter threaded through seven services; Manifest has been Postgres-only for some time.
- Port `NotificationRulesService` off raw `DataSource.query()` onto TypeORM repositories + QueryBuilder.
- Remove the unused `TokenUsageSnapshot` / `CostSnapshot` entities (tables remain; no data migration).
- Extract scattered `if (provider === 'xai' | 'copilot' | ...)` branches into data-driven hooks (`provider-hooks.ts`).
- Split `scoring/keywords.ts` (949 lines) into one file per specificity category under `scoring/keywords/`.
- Split `ProxyService.proxyRequest`, `ProxyController.chatCompletions`, `MessagesQueryService.getMessages`, and `ProviderClient.forward` into focused helpers (all previously 130+ lines).
- Consolidate the frontend API layer: `fetchMutate` now takes a path, and a `routingPath(agentName, suffix)` helper replaces 30+ duplicated `${BASE_URL}/routing/${encodeURIComponent(...)}` literals.
- Add `recordSafely()` and `buildMessageRow()` helpers in the proxy write path to dedupe seven fire-and-forget `.catch(logger.warn)` blocks and five near-identical message inserts.
- Remove the deprecated `subscriptionOAuth` flag (use `subscriptionAuthMode === 'popup_oauth'`).
- Drop the identity `sql()` wrapper in `EmailProviderConfigService` and helpers.
