# Custom Provider Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve custom provider display names at the backend query layer and render custom-provider rows exactly like built-in provider rows (icon + tooltip carry the provider; text is just the model id; no literal `custom:` anywhere).

**Architecture:** Messages store `model = custom:<uuid>/<model>` and `provider = custom:<uuid>`. Today three frontend pages each fetch the custom-providers list (agent-scoped endpoint) to resolve `uuid → name`, which breaks on global pages. This plan moves resolution into the backend: a `LEFT JOIN custom_providers` in the shared message-row projection helper (new `custom_provider_name` column), in `getCostByModel`, and a SQL `CASE` that resolves per-provider timeseries series keys. The global providers endpoint gains a `display_name` per group. The frontend then deletes all three duplicated lookups and the `customProviderName` prop chain.

**Tech Stack:** NestJS 11 + TypeORM 0.3 (QueryBuilder, no raw SQL strings outside helpers), SolidJS + vitest frontend, Jest backend. Repo demands **100% line/patch coverage**.

**Worktree:** `/Users/guillaumegay/Documents/Projects/manifest/worktrees/custom-provider-display`, branch `fix/custom-provider-display`, base `feat/analytics-ui`. `node_modules` is a symlink to the main checkout's — do not `npm install`.

**Spec:** `docs/superpowers/specs/2026-06-10-custom-provider-display-design.md`

**Verification commands** (run from the worktree root unless stated):
- Backend unit: `cd packages/backend && npx jest <path> --silent`
- Frontend unit: `cd packages/frontend && npx vitest run <path>`
- Typecheck: `cd packages/<pkg> && npx tsc --noEmit -p tsconfig.json` (frontend: `npx tsc --noEmit`)

**Key existing facts (verified against this branch):**
- `selectMessageRowColumns(qb, costExpr)` + pinned `MESSAGE_ROW_SELECT_ALIASES` live in `packages/backend/src/analytics/services/query-helpers.ts:160-216`. Spec pin test: `query-helpers.spec.ts:296-362`.
- Call sites: `getRecentActivity()` (`timeseries-queries.service.ts:123-142`) and `getMessages()` (`messages-query.service.ts:60`). The count query is built from `baseQb.clone()` BEFORE the helper runs, so the join only lands on the data query — no count skew.
- `custom_providers` entity: `packages/backend/src/entities/custom-provider.entity.ts` — `id` is a **varchar** PK (no cast needed), has `user_id`, `name`. Already registered in `analytics.module.ts` `forFeature` (line 51) and in `test/helpers.ts` entities (line 74).
- `CustomProviderService.list(userId)` exists (used in `routing/model.controller.ts:98`); `CustomProviderModule` exports it and `routing.module.ts` imports the module — `UserProvidersController` (declared in `routing.module.ts:57`) can inject it.
- Frontend: `stripCustomPrefix()` (`services/routing-utils.ts:174-177`) strips `custom:<uuid>/` safely (uuid contains no `/`). `getModelDisplayName()` does NOT strip the custom prefix (PROVIDERS has no `custom` def → `getModelLabel` is skipped → returns input verbatim), so custom rows must call `stripCustomPrefix` explicitly.
- `customProviderLogo(name, size, baseUrl?, modelName?)` in `components/ProviderIcon.tsx:651`.

---

### Task 1: Backend — `custom_provider_name` in the shared message-row projection

**Files:**
- Modify: `packages/backend/src/analytics/services/query-helpers.ts`
- Test: `packages/backend/src/analytics/services/query-helpers.spec.ts`

- [ ] **Step 1: Extend the pinned spec (failing first)**

In `query-helpers.spec.ts`, inside `describe('selectMessageRowColumns')`, the `makeMockQb` (lines 297-311) needs a `leftJoin` mock. Replace the factory with:

```typescript
  function makeMockQb() {
    const selectCalls: Array<[string, string]> = [];
    const addSelectCalls: Array<[string, string]> = [];
    const leftJoinCalls: Array<[unknown, string, string]> = [];
    const qb = {
      select: jest.fn().mockImplementation((expr: string, alias: string) => {
        selectCalls.push([expr, alias]);
        return qb;
      }),
      addSelect: jest.fn().mockImplementation((expr: string, alias: string) => {
        addSelectCalls.push([expr, alias]);
        return qb;
      }),
      leftJoin: jest
        .fn()
        .mockImplementation((entity: unknown, alias: string, condition: string) => {
          leftJoinCalls.push([entity, alias, condition]);
          return qb;
        }),
    };
    return { qb: qb as unknown as SelectQueryBuilder<never>, selectCalls, addSelectCalls, leftJoinCalls };
  }
```

Add two tests at the end of the same describe block:

```typescript
  it('left-joins custom_providers and projects custom_provider_name', () => {
    const { qb, addSelectCalls, leftJoinCalls } = makeMockQb();
    selectMessageRowColumns(qb, 'cost');

    expect(leftJoinCalls).toHaveLength(1);
    const [entity, alias, condition] = leftJoinCalls[0]!;
    expect(entity).toBe(CustomProvider);
    expect(alias).toBe('cp');
    expect(condition).toBe(CUSTOM_PROVIDER_JOIN_CONDITION);

    const nameCall = addSelectCalls.find(([, a]) => a === 'custom_provider_name');
    expect(nameCall).toEqual(['cp.name', 'custom_provider_name']);
  });

  it('keys the join on the custom:-prefixed provider id', () => {
    expect(CUSTOM_PROVIDER_JOIN_CONDITION).toBe("at.provider = 'custom:' || cp.id");
  });
```

Add to the imports at the top of the spec (extend the existing `./query-helpers` import list with `CUSTOM_PROVIDER_JOIN_CONDITION`, and add a new entity import):

```typescript
import { CustomProvider } from '../../entities/custom-provider.entity';
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && npx jest src/analytics/services/query-helpers.spec.ts --silent`
Expected: FAIL — `CUSTOM_PROVIDER_JOIN_CONDITION` not exported; alias-pin test also fails once the alias array changes (next step makes both pass together).

- [ ] **Step 3: Implement in `query-helpers.ts`**

Add the entity import at the top:

```typescript
import { CustomProvider } from '../../entities/custom-provider.entity';
```

Add the exported constants right above `MESSAGE_ROW_SELECT_ALIASES`:

```typescript
/**
 * Join `custom_providers` to resolve a custom provider's display name from a
 * stored `at.provider` of the form `custom:<uuid>`. `cp.id` is a varchar PK,
 * so plain string concatenation matches without casts. Built-in providers
 * never match (their provider ids carry no `custom:` prefix) and resolve to a
 * NULL `cp.name`.
 */
export const CUSTOM_PROVIDER_JOIN_CONDITION = "at.provider = 'custom:' || cp.id";

/**
 * Series key for per-provider aggregates: custom providers surface their
 * display name (or a stable fallback when the provider was deleted), built-in
 * providers keep their id. Requires the `cp` join above.
 */
export const PROVIDER_SERIES_KEY_EXPR =
  "CASE WHEN at.provider LIKE 'custom:%' THEN COALESCE(cp.name, 'Deleted provider') ELSE at.provider END";
```

Append `'custom_provider_name'` to `MESSAGE_ROW_SELECT_ALIASES` (after `'recorded'`).

In `selectMessageRowColumns`, add the join before the select chain and the new column at the end:

```typescript
export function selectMessageRowColumns<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  costExpr: string,
): SelectQueryBuilder<T> {
  return qb
    .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
    .select('at.id', 'id')
    /* ...existing addSelect chain unchanged... */
    .addSelect('at.recorded', 'recorded')
    .addSelect('cp.name', 'custom_provider_name');
}
```

Note for the alias-pin test (`projects exactly the columns declared in MESSAGE_ROW_SELECT_ALIASES`, line 313): it derives expectations from the array, so it passes automatically once the array and the chain agree.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/backend && npx jest src/analytics/services/query-helpers.spec.ts --silent`
Expected: PASS (all suites in the file).

- [ ] **Step 5: Check the two call-site specs still pass** (their mocks must already tolerate `leftJoin` — `timeseries-queries.service.spec.ts` mock has `leftJoin: jest.fn().mockReturnThis()` at line 50/68; `messages-query.service.spec.ts` needs checking — if its mock qb lacks `leftJoin`, add `leftJoin: jest.fn().mockReturnThis(),` to the mock factory; also note `getRecentActivity` specs asserting `leftJoin).not.toHaveBeenCalled()` at lines 469/528 of the timeseries spec — those assertions are about OTHER methods (`getTimeseries`/`getActiveSkills`); if any assertion covering `getRecentActivity` expects no join, flip it to expect the `cp` join.)

Run: `cd packages/backend && npx jest src/analytics/services/timeseries-queries.service.spec.ts src/analytics/services/messages-query.service.spec.ts --silent`
Expected: PASS after the described mock fixes only.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/analytics/services/query-helpers.ts packages/backend/src/analytics/services/query-helpers.spec.ts packages/backend/src/analytics/services/timeseries-queries.service.spec.ts packages/backend/src/analytics/services/messages-query.service.spec.ts
git commit -m "feat(analytics): resolve custom provider name in shared message-row projection"
```

---

### Task 2: Backend — `getCostByModel` carries `custom_provider_name`

**Files:**
- Modify: `packages/backend/src/analytics/services/timeseries-queries.service.ts:144-182`
- Test: `packages/backend/src/analytics/services/timeseries-queries.service.spec.ts`

- [ ] **Step 1: Write the failing test**

In the timeseries spec, find the existing `getCostByModel` tests and add:

```typescript
    it('getCostByModel resolves the custom provider display name', async () => {
      mockTurnQb.getRawMany.mockResolvedValue([
        {
          model: 'custom:u1/gpt-oss-120b',
          display_name: 'custom:u1/gpt-oss-120b',
          tokens: '10',
          estimated_cost: '0.5',
          auth_type: 'api_key',
          provider: 'custom:u1',
          custom_provider_name: 'MyLLM',
        },
      ]);
      const out = await service.getCostByModel('24h', 'u1');
      expect(mockTurnQb.leftJoin).toHaveBeenCalledWith(
        CustomProvider,
        'cp',
        CUSTOM_PROVIDER_JOIN_CONDITION,
      );
      expect(mockTurnQb.addSelect).toHaveBeenCalledWith('cp.name', 'custom_provider_name');
      expect(mockTurnQb.addGroupBy).toHaveBeenCalledWith('cp.name');
      expect(out[0]).toMatchObject({
        provider: 'custom:u1',
        custom_provider_name: 'MyLLM',
      });
    });

    it('getCostByModel returns null custom_provider_name for built-in and deleted providers', async () => {
      mockTurnQb.getRawMany.mockResolvedValue([
        { model: 'gpt-4o', tokens: '5', estimated_cost: '0.1', auth_type: null, provider: 'openai', custom_provider_name: null },
      ]);
      const out = await service.getCostByModel('24h', 'u1');
      expect(out[0]!.custom_provider_name).toBeNull();
    });
```

Add the imports to the spec's import block:

```typescript
import { CUSTOM_PROVIDER_JOIN_CONDITION } from './query-helpers';
import { CustomProvider } from '../../entities/custom-provider.entity';
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && npx jest src/analytics/services/timeseries-queries.service.spec.ts -t "getCostByModel" --silent`
Expected: FAIL (no join, no `custom_provider_name` key).

- [ ] **Step 3: Implement**

In `getCostByModel` (`timeseries-queries.service.ts`), import `CUSTOM_PROVIDER_JOIN_CONDITION` (extend the existing `./query-helpers` import) and `CustomProvider` from `../../entities/custom-provider.entity`. Change the query:

```typescript
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
      .select("COALESCE(at.model, 'unknown')", 'model')
      .addSelect('at.model', 'display_name')
      .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
      .addSelect(`COALESCE(SUM(${sqlSanitizeCost('at.cost_usd')}), 0)`, 'estimated_cost')
      .addSelect('at.auth_type', 'auth_type')
      .addSelect('at.provider', 'provider')
      .addSelect('cp.name', 'custom_provider_name')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.model IS NOT NULL')
      .andWhere("at.model != ''");
```

Add `.addGroupBy('cp.name')` after the existing `.addGroupBy('at.provider')`, and extend the mapped return object with:

```typescript
      custom_provider_name: r['custom_provider_name'] ? String(r['custom_provider_name']) : null,
```

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/backend && npx jest src/analytics/services/timeseries-queries.service.spec.ts --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analytics/services/timeseries-queries.service.ts packages/backend/src/analytics/services/timeseries-queries.service.spec.ts
git commit -m "feat(analytics): cost-by-model rows carry resolved custom provider name"
```

---

### Task 3: Backend — per-provider timeseries series keys resolve custom names

**Files:**
- Modify: `packages/backend/src/analytics/services/timeseries-queries.service.ts` — `getPerProviderTimeseries` (413-447), `getPerProviderMessageTimeseries` (449-482), `getPerProviderCostTimeseries` (555-586)
- Test: `packages/backend/src/analytics/services/timeseries-queries.service.spec.ts`

- [ ] **Step 1: Write the failing test**

The existing per-provider tests assert `leftJoin).not.toHaveBeenCalled()` (spec lines 610, 656, 687) — **flip those three assertions** to:

```typescript
      expect(mockTurnQb.leftJoin).toHaveBeenCalledWith(
        CustomProvider,
        'cp',
        CUSTOM_PROVIDER_JOIN_CONDITION,
      );
```

Add a new test next to `getPerProviderTimeseries filters by agentName and pivots tokens` (line 584):

```typescript
    it('getPerProviderTimeseries resolves custom series keys via the CASE expression', async () => {
      mockTurnQb.getRawMany.mockResolvedValue([
        { hour: '2026-06-10T10', provider: 'MyLLM', tokens: '7' },
        { hour: '2026-06-10T10', provider: 'openai', tokens: '3' },
      ]);
      const out = await service.getPerProviderTimeseries('24h', 'u1', true);
      expect(mockTurnQb.addSelect).toHaveBeenCalledWith(PROVIDER_SERIES_KEY_EXPR, 'provider');
      expect(mockTurnQb.addGroupBy).toHaveBeenCalledWith(PROVIDER_SERIES_KEY_EXPR);
      expect(out.agents).toEqual(['MyLLM', 'openai']);
    });
```

Extend the spec's `./query-helpers` import with `PROVIDER_SERIES_KEY_EXPR`.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && npx jest src/analytics/services/timeseries-queries.service.spec.ts -t "PerProvider" --silent`
Expected: FAIL.

- [ ] **Step 3: Implement (apply identically to all three methods)**

Extend the service's `./query-helpers` import with `PROVIDER_SERIES_KEY_EXPR` and `CUSTOM_PROVIDER_JOIN_CONDITION` (Task 2 already imported `CustomProvider`). In each of the three methods, change the query builder:

```typescript
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
      .select(bucketExpr, bucketAlias)
      .addSelect(PROVIDER_SERIES_KEY_EXPR, 'provider')
      /* the metric addSelect stays as-is per method: tokens / messages / cost */
```

and change the grouping from `.addGroupBy('at.provider')` to `.addGroupBy(PROVIDER_SERIES_KEY_EXPR)`. Everything else (cutoff, `at.provider IS NOT NULL`, `excludeSystemAgents`, tenant filter, live-agent filter, pivot call) stays identical.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/backend && npx jest src/analytics/services/timeseries-queries.service.spec.ts --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analytics/services/timeseries-queries.service.ts packages/backend/src/analytics/services/timeseries-queries.service.spec.ts
git commit -m "feat(analytics): per-provider chart series resolve custom provider names"
```

---

### Task 4: Backend — Messages provider-filter labels (`provider_labels`)

**Files:**
- Modify: `packages/backend/src/analytics/services/messages-query.service.ts`
- Test: `packages/backend/src/analytics/services/messages-query.service.spec.ts`

The Messages page provider dropdown gets its option ids from `getMessages().providers` — custom entries are raw `custom:<uuid>` and render verbatim. Return a label map alongside.

- [ ] **Step 1: Write the failing test**

In `messages-query.service.spec.ts`, locate the module/mock setup and register a mock for the new repository (mirror how the `AgentMessage` repo mock is provided; the CustomProvider repo only needs `find`):

```typescript
        {
          provide: getRepositoryToken(CustomProvider),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
```

with import `import { CustomProvider } from '../../entities/custom-provider.entity';`. Add a test:

```typescript
    it('returns provider_labels mapping custom provider ids to display names', async () => {
      // distinct models/providers query returns a custom provider id
      /* arrange the existing distinct-models mock so providers includes 'custom:u-1' */
      customProviderRepo.find.mockResolvedValue([{ id: 'u-1', name: 'MyLLM' }]);
      const out = await service.getMessages({ userId: 'u1', limit: 10 });
      expect(customProviderRepo.find).toHaveBeenCalledWith({ where: { id: In(['u-1']) } });
      expect(out.provider_labels).toEqual({ 'custom:u-1': 'MyLLM' });
    });

    it('omits provider_labels entries when no custom providers are stored', async () => {
      const out = await service.getMessages({ userId: 'u1', limit: 10 });
      expect(out.provider_labels).toEqual({});
    });
```

(Adapt the arrange step to the spec's existing distinct-models mock helper — the row shape is `{ model, provider }`; make one row carry `provider: 'custom:u-1'`.)

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && npx jest src/analytics/services/messages-query.service.spec.ts --silent`
Expected: FAIL (service has no CustomProvider dependency / no `provider_labels`).

- [ ] **Step 3: Implement**

In `messages-query.service.ts`:

```typescript
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CustomProvider } from '../../entities/custom-provider.entity';
```

Constructor gains:

```typescript
    @InjectRepository(CustomProvider)
    private readonly customProviderRepo: Repository<CustomProvider>,
```

In `getMessages`, after `const providers = this.deriveProviders(...)`:

```typescript
    const providerLabels = await this.resolveCustomProviderLabels(providers);

    return {
      items,
      next_cursor: nextCursor,
      total_count: totalCount,
      providers,
      provider_labels: providerLabels,
    };
```

New private method:

```typescript
  /**
   * Map `custom:<uuid>` provider ids to their display names so the Messages
   * filter dropdown can label them. Deleted providers simply have no entry
   * and fall back to the raw id in the UI.
   */
  private async resolveCustomProviderLabels(
    providers: string[],
  ): Promise<Record<string, string>> {
    const uuids = providers
      .filter((p) => p.startsWith('custom:'))
      .map((p) => p.slice('custom:'.length));
    if (uuids.length === 0) return {};
    const rows = await this.customProviderRepo.find({ where: { id: In(uuids) } });
    return Object.fromEntries(rows.map((cp) => [`custom:${cp.id}`, cp.name]));
  }
```

`CustomProvider` is already in `analytics.module.ts` `forFeature` — no module change.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/backend && npx jest src/analytics/services/messages-query.service.spec.ts --silent`
Expected: PASS.

- [ ] **Step 5: Check the messages e2e suite (it asserts response shapes)**

Run: `cd packages/backend && npx jest --config ./test/jest-e2e.json messages --silent` (requires the dev Postgres container per CLAUDE.md; if no DB is available locally, defer to CI and note it)
Expected: PASS — additive field.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/analytics/services/messages-query.service.ts packages/backend/src/analytics/services/messages-query.service.spec.ts
git commit -m "feat(analytics): messages endpoint labels custom providers for the filter dropdown"
```

---

### Task 5: Backend — global providers endpoint gains `display_name`

**Files:**
- Modify: `packages/backend/src/routing/user-providers.controller.ts`
- Test: its spec (`packages/backend/src/routing/user-providers.controller.spec.ts` — locate with `ls packages/backend/src/routing/*user-providers*`)

- [ ] **Step 1: Write the failing test**

In the controller spec, add a `CustomProviderService` mock provider (`{ list: jest.fn().mockResolvedValue([]) }`) to the testing module, and a test:

```typescript
  it('resolves display_name for custom provider groups', async () => {
    providerRepo.find.mockResolvedValue([
      makeProvider({ provider: 'custom:u-9', auth_type: 'api_key' }),
    ]);
    customProviderService.list.mockResolvedValue([{ id: 'u-9', name: 'MyLLM' }]);
    const res = await controller.listProviders(user);
    expect(res.providers[0]).toMatchObject({ provider: 'custom:u-9', display_name: 'MyLLM' });
  });

  it('returns null display_name for built-in groups and deleted custom providers', async () => {
    providerRepo.find.mockResolvedValue([
      makeProvider({ provider: 'openai', auth_type: 'api_key' }),
      makeProvider({ provider: 'custom:gone', auth_type: 'api_key' }),
    ]);
    customProviderService.list.mockResolvedValue([]);
    const res = await controller.listProviders(user);
    expect(res.providers.find((p) => p.provider === 'openai')!.display_name).toBeNull();
    expect(res.providers.find((p) => p.provider === 'custom:gone')!.display_name).toBeNull();
  });
```

(Reuse the spec's existing provider-row factory; if none exists, build the minimal `UserProvider` literal the controller reads: `id, provider, auth_type, label, key_prefix, priority, connected_at, models_fetched_at, cached_models, is_active`.)

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && npx jest src/routing/user-providers.controller --silent`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `user-providers.controller.ts`, inject the service:

```typescript
import { CustomProviderService } from './custom-provider/custom-provider.service';
```

(constructor): `private readonly customProviderService: CustomProviderService,`

In `listProviders`, before building `result`:

```typescript
    const customProviders = await this.customProviderService.list(user.id);
    const customNameById = new Map(customProviders.map((cp) => [cp.id, cp.name]));
```

and extend the mapped group object:

```typescript
        display_name: g.provider.startsWith('custom:')
          ? (customNameById.get(g.provider.slice('custom:'.length)) ?? null)
          : null,
```

Check the import path/type of `CustomProviderService.list` return (see `routing/model.controller.ts:98` for usage) and that `routing.module.ts` already provides it via `CustomProviderModule` (it does — line 46).

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/backend && npx jest src/routing/user-providers.controller --silent`
Expected: PASS.

- [ ] **Step 5: Backend-wide check + commit**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json && npx jest --silent`
Expected: clean compile, all unit suites green.

```bash
git add packages/backend/src/routing/user-providers.controller.ts packages/backend/src/routing/user-providers.controller.spec.ts
git commit -m "feat(providers): global providers endpoint resolves custom display names"
```

---

### Task 6: Frontend — `ModelCell` renders custom rows like built-in rows

**Files:**
- Modify: `packages/frontend/src/components/message-table-types.ts` (MessageRow)
- Modify: `packages/frontend/src/components/message-table-cells.tsx` (`ModelCell`, `CellRenderContext`, `renderCell`)
- Modify: `packages/frontend/src/components/MessageTable.tsx` (drop the prop)
- Test: `packages/frontend/tests/components/message-table-cells.test.tsx`, `packages/frontend/tests/components/MessageTable.test.tsx`

- [ ] **Step 1: Add the field to `MessageRow`** (`message-table-types.ts`, after `provider`):

```typescript
  custom_provider_name?: string | null;
```

- [ ] **Step 2: Write the failing tests**

`message-table-cells.test.tsx` — `ModelCell` is currently called as `ModelCell(row, noCustom)`. The new signature drops the callback: `ModelCell(row)`. Update the two existing calls (lines 128, 137) and add:

```typescript
  it('renders a custom row with just the model text and the provider name in the tooltip', () => {
    const row = makeRow({
      model: 'custom:u-1/openai/gpt-oss-120b',
      provider: 'custom:u-1',
      custom_provider_name: 'MyLLM',
    });
    const { container } = render(() => (
      <table><tbody><tr>{ModelCell(row)}</tr></tbody></table>
    ));
    expect(container.textContent).toContain('openai/gpt-oss-120b');
    expect(container.textContent).not.toContain('custom:');
    expect(container.textContent).not.toContain('Custom');
    expect(container.querySelector('[title="MyLLM"]')).toBeTruthy();
  });

  it('falls back to a letter avatar from the model when the custom provider was deleted', () => {
    const row = makeRow({
      model: 'custom:gone/my-model',
      provider: 'custom:gone',
      custom_provider_name: null,
    });
    const { container } = render(() => (
      <table><tbody><tr>{ModelCell(row)}</tr></tbody></table>
    ));
    expect(container.textContent).toContain('my-model');
    expect(container.textContent).not.toContain('custom:');
    const avatar = container.querySelector('.provider-card__logo-letter');
    expect(avatar?.textContent).toBe('M');
  });
```

(Use the file's existing row factory; if it's named differently than `makeRow`, follow the local convention.)

`MessageTable.test.tsx` — delete the `customProviderName={noopProvider}` prop from every `<MessageTable …>` render (the `noopProvider` const too), and update the custom-avatar regression test (line 398-420): rows now need `custom_provider_name` instead of relying on the callback; assertions that previously expected `custom:Custom/my-model` text must expect `my-model`.

- [ ] **Step 3: Run to verify failure**

Run: `cd packages/frontend && npx vitest run tests/components/message-table-cells.test.tsx tests/components/MessageTable.test.tsx`
Expected: FAIL (signature mismatch).

- [ ] **Step 4: Implement**

`message-table-cells.tsx` — new `ModelCell` (replaces lines 234-318's header and custom branch; badge/fallback tail unchanged):

```typescript
export function ModelCell(item: MessageRow, onOpenRecording?: (id: string) => void): JSX.Element {
  const provId = resolveMessageProvider(item);
  const provName = resolveMessageProviderName(item);
  // Custom providers are identified by either the literal 'custom' (from
  // inferProviderFromModel on a `custom:...` model name) or by a stored
  // provider column of the form `custom:<uuid>` (from resolveProviderId,
  // which returns custom-prefixed IDs unchanged). Their display name arrives
  // pre-resolved from the backend as `custom_provider_name` (null when the
  // provider was deleted).
  const isCustomProvider = provId === 'custom' || provId?.startsWith('custom:') === true;
  return (
    <td style={MONO_XS}>
      <span style="display: inline-flex; align-items: center; gap: 4px;">
        {item.model && isCustomProvider ? (
          (() => {
            const customName = item.custom_provider_name ?? undefined;
            const logo = customProviderLogo(customName ?? '', 16, undefined, item.model ?? undefined);
            if (logo) return logo;
            const letter = (customName ?? stripCustomPrefix(item.model!)).charAt(0).toUpperCase();
            return (
              <span
                class="provider-card__logo-letter"
                title={customName}
                style={{
                  background: customProviderColor(customName ?? ''),
                  width: '16px',
                  height: '16px',
                  'font-size': '9px',
                  'flex-shrink': '0',
                  'border-radius': '50%',
                }}
              >
                {letter}
              </span>
            );
          })()
        ) : provId ? (
          /* built-in branch unchanged */
        ) : null}
        {item.model
          ? item.model.startsWith('custom:')
            ? stripCustomPrefix(item.model)
            : getModelDisplayName(item.model)
          : '—'}
        {/* tier badge / fallback badge tail unchanged */}
      </span>
    </td>
  );
}
```

`CellRenderContext` (line 454-462): delete the `customProviderName: (model: string) => string | undefined;` member. `renderCell` case `'model'` (line 483): `return ModelCell(item, ctx.onOpenRecording);`.

`MessageTable.tsx`: delete `customProviderName` from `MessageTableProps` (line 10) and from both `ctx` literals (lines 70, 141).

- [ ] **Step 5: Run to verify pass**

Run: `cd packages/frontend && npx vitest run tests/components/message-table-cells.test.tsx tests/components/MessageTable.test.tsx`
Expected: PASS. (Typecheck will still fail at page call sites — fixed in Task 8; do not run tsc yet.)

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/components/message-table-types.ts packages/frontend/src/components/message-table-cells.tsx packages/frontend/src/components/MessageTable.tsx packages/frontend/tests/components/message-table-cells.test.tsx packages/frontend/tests/components/MessageTable.test.tsx
git commit -m "feat(frontend): ModelCell renders custom providers like built-in providers"
```

---

### Task 7: Frontend — `CostByModelTable` reads the backend-resolved name

**Files:**
- Modify: `packages/frontend/src/components/CostByModelTable.tsx`
- Test: `packages/frontend/tests/components/CostByModelTable.test.tsx`

- [ ] **Step 1: Write the failing tests**

Rewrite the custom-provider tests (current lines ~75-110). The component no longer takes `customProviderName`; rows carry the name:

```typescript
  it('renders a custom row with the stripped model text and tooltip from the row', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[row({ model: 'custom:abc123/gpt-custom', provider: 'custom:abc123', custom_provider_name: 'My Provider' })]}
      />
    ));
    expect(container.textContent).toContain('gpt-custom');
    expect(container.textContent).not.toContain('custom:');
    expect(container.querySelector('[title="My Provider"]')).toBeTruthy();
  });

  it('falls back to a letter avatar when the custom provider was deleted', () => {
    const { container } = render(() => (
      <CostByModelTable
        rows={[row({ model: 'custom:abc/my-model', provider: 'custom:abc', custom_provider_name: null, auth_type: null })]}
      />
    ));
    // stripCustomPrefix('custom:abc/my-model') → 'my-model' → first letter "M".
    expect(container.querySelector('.provider-card__logo-letter')?.textContent).toBe('M');
    expect(container.textContent).toContain('my-model');
    expect(container.textContent).not.toContain('Custom');
  });
```

Remove `customProviderName` from every other render in the file and from the `row` factory's prop expectations.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/frontend && npx vitest run tests/components/CostByModelTable.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`CostByModelTable.tsx`:
- `CostByModelRow` gains `custom_provider_name?: string | null;`
- `CostByModelTableProps` loses `customProviderName` (interface becomes `{ rows: CostByModelRow[] }`).
- In the icon IIFE (lines 72-118): replace `const provName = props.customProviderName(row.model);` with `const provName = row.custom_provider_name ?? undefined;` (keep the rest of the custom branch as-is).
- Text expression (lines 119-123) becomes:

```typescript
                    {row.model
                      ? row.model.startsWith('custom:')
                        ? stripCustomPrefix(row.model)
                        : row.display_name || getModelDisplayName(row.model)
                      : row.model}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/frontend && npx vitest run tests/components/CostByModelTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/CostByModelTable.tsx packages/frontend/tests/components/CostByModelTable.test.tsx
git commit -m "feat(frontend): CostByModelTable reads backend-resolved custom provider name"
```

---

### Task 8: Frontend — pages drop the duplicated lookups

**Files:**
- Modify: `packages/frontend/src/pages/Overview.tsx` (lines 120-130, 384-402)
- Modify: `packages/frontend/src/pages/MessageLog.tsx` (lines 27, 54, 158-161, 180-186, 310-321, 574-578)
- Test: `packages/frontend/tests/pages/Overview.test.tsx`, `packages/frontend/tests/pages/MessageLog.test.tsx` (exact names: `ls packages/frontend/tests/pages/ | grep -i 'overview\|message'`)

- [ ] **Step 1: Overview.tsx**

Delete the `customProviders` resource (lines 120-123) and `customProviderName` function (lines 125-130); remove `getCustomProviders` and `CustomProviderData` from imports **if** no other use remains in the file (verify with grep before deleting the import). Remove `customProviderName={customProviderName}` from the `<MessageTable>` (line 392) and `<CostByModelTable>` (line 401) usages.

- [ ] **Step 2: MessageLog.tsx**

- Delete the `customProviders` resource (158-161) and `customProviderName` (180-186); prune now-unused imports (`getCustomProviders`, `CustomProviderData`) if unreferenced elsewhere in the file.
- Remove `customProviderName={customProviderName}` from `<MessageTable>` (line 578).
- `MessagesData` interface (~line 54): add `provider_labels?: Record<string, string>;`
- `providerDisplayName` (lines 310-313) becomes:

```typescript
  const providerDisplayName = (id: string): string => {
    const prov = PROVIDERS.find((p) => p.id === id);
    if (prov) return prov.name;
    return data()?.provider_labels?.[id] ?? id;
  };
```

- [ ] **Step 3: Update page tests**

Run the two page suites; fix failures mechanically: remove mocks of `getCustomProviders` that exist solely for the deleted resources, and update any fixture rows/assertions that relied on the `custom:`-prefixed display (now expect the stripped model text). If `MessageLog` tests cover the provider dropdown, add a case: with `provider_labels: { 'custom:u-1': 'MyLLM' }` and providers `['custom:u-1']`, the option label is `MyLLM`.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/frontend && npx vitest run tests/pages/Overview.test.tsx tests/pages/MessageLog.test.tsx` (adjust to the actual file names)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pages/Overview.tsx packages/frontend/src/pages/MessageLog.tsx packages/frontend/tests/pages/
git commit -m "refactor(frontend): drop per-page custom provider name lookups"
```

---

### Task 9: Frontend — GlobalOverview uses backend-resolved names

**Files:**
- Modify: `packages/frontend/src/pages/GlobalOverview.tsx`
- Test: `packages/frontend/tests/pages/GlobalOverview.test.tsx` (verify exact name)

- [ ] **Step 1: Types and dead code**

- `ProviderGroup` (line 42): add `display_name?: string | null;`
- `CostByModelRow` (line 55): add `custom_provider_name?: string | null;`
- Delete the first-agent hack: `firstAgent` (line 194), the `customProviderData` resource (195-198), and `resolveCustomName` (199-204). Prune `getCustomProviders` (and `getAgents` ONLY if its sole use was `firstAgent` — it is also used for the agents list; check before touching) from imports.

- [ ] **Step 2: Replace usages**

- `connList` (line 655): `const customName = g.display_name ?? null;` (replaces `resolveCustomName(g.provider)`).
- Provider connections table (lines 1131-1136): `const customName = isCustom ? (group.display_name ?? null) : null;` — rest unchanged.
- Cost-by-model panel (lines 1042-1051): make the row render custom-aware:

```tsx
                        <div style="display: flex; align-items: center; gap: 6px;">
                          {(() => {
                            const isCustom = row.provider?.startsWith('custom:') === true;
                            if (isCustom) {
                              const name = row.custom_provider_name ?? undefined;
                              return (
                                customProviderLogo(name ?? '', 16, undefined, row.model) ?? (
                                  <span
                                    class="provider-card__logo-letter"
                                    title={name}
                                    style={{
                                      background: customProviderColor(name ?? ''),
                                      width: '16px',
                                      height: '16px',
                                      'font-size': '9px',
                                      'flex-shrink': '0',
                                      'border-radius': '50%',
                                    }}
                                  >
                                    {(name ?? stripCustomPrefix(row.model)).charAt(0).toUpperCase()}
                                  </span>
                                )
                              );
                            }
                            return row.provider ? (
                              <span style="position: relative; flex-shrink: 0; display: flex; align-items: center;">
                                {providerIcon(row.provider, 16)}
                                {authBadgeFor(row.auth_type, 12)}
                              </span>
                            ) : null;
                          })()}
                          <span style="font-weight: 500; color: hsl(var(--foreground));">
                            {row.model.startsWith('custom:')
                              ? stripCustomPrefix(row.model)
                              : row.display_name || row.model}
                          </span>
                        </div>
```

Add `stripCustomPrefix` to the file's `routing-utils` import if missing. (`CostByModelRow.auth_type` — confirm the field exists on the interface at line 55-…; pass `null` if absent.)

- [ ] **Step 3: Update GlobalOverview tests**

Run the suite; mechanically: drop `getCustomProviders` mocks tied to the deleted resource, add `display_name` to provider-group fixtures used by custom-provider assertions, and add one assertion that a custom cost-by-model row renders the stripped model with no `custom:` substring.

- [ ] **Step 4: Run to verify pass + frontend-wide check**

Run: `cd packages/frontend && npx vitest run tests/pages/GlobalOverview.test.tsx && npx tsc --noEmit`
Expected: PASS; compile clean (this is the first point where the whole frontend should typecheck again).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pages/GlobalOverview.tsx packages/frontend/tests/pages/
git commit -m "feat(frontend): GlobalOverview reads backend-resolved custom provider names"
```

---

### Task 10: Full verification, coverage, changeset

- [ ] **Step 1: Full test runs**

```bash
cd packages/backend && npx tsc --noEmit -p tsconfig.json && npx jest --coverage --silent
cd ../frontend && npx tsc --noEmit && npx vitest run --coverage
cd ../shared && npx jest --coverage --silent
```

Expected: all green, **100% line coverage** on every touched file (repo policy). If any new line is uncovered, add the missing test before proceeding.

- [ ] **Step 2: Lint**

Run: `npx eslint packages/backend/src packages/frontend/src --max-warnings 0` (from repo root; match the repo's lint script if it differs — check `package.json`).
Expected: clean.

- [ ] **Step 3: Grep guard — no orphaned references**

```bash
grep -rn "customProviderName" packages/frontend/src && echo "LEAK" || echo "clean"
```

Expected: `clean` (the only allowed survivors are unrelated locals in `ModelPickerModal`/`FallbackList` — those components have their own agent-scoped maps and are out of scope; if the grep hits them, confirm they are the pre-existing routing-config code paths and leave them).

- [ ] **Step 4: Changeset**

```bash
npx changeset add --empty   # then replace: create .changeset/<name>.md targeting "manifest", patch
```

Write a real changeset (patch, package `manifest`): `Custom providers now display their name and models consistently across Messages, Overview, graphs and cost tables — no more literal "custom:" prefix.`

- [ ] **Step 5: Final commit**

```bash
git add .changeset
git commit -m "chore: changeset for custom provider display fix"
```

---

## Out of scope (do not touch)

- `ModelPickerModal`, `FallbackList`, routing config UI — already correct, agent-scoped.
- The small "custom" type chip after the provider name in GlobalOverview's provider-connections table (line 1166-1170) — it is a provider-type tag, not a name prefix; flag it in the PR description for the user to decide.
- Removing the now-redundant agent-scoped `GET :agentName/custom-providers` consumers elsewhere — separate cleanup.
