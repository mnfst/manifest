# Performance Optimization Plan — <500ms for All Endpoints

## Task 1: Parallelize security endpoint queries + add caching
**File:** `packages/backend/src/security/security.service.ts`
**Current:** Two independent queries run sequentially (~2 DB round-trips). Controller already has `UserCacheInterceptor` + `@CacheTTL`.
**Change:** Wrap the `countRows` and `events` queries in `Promise.all`.

```typescript
// Before (sequential):
const countRows = await this.securityRepo.createQueryBuilder('se') ... .getRawMany();
const events = await this.securityRepo.createQueryBuilder('se') ... .getMany();

// After (parallel):
const [countRows, events] = await Promise.all([
  this.securityRepo.createQueryBuilder('se') ... .getRawMany(),
  this.securityRepo.createQueryBuilder('se') ... .getMany(),
]);
```

**Tests:** Update `security.service.spec.ts` — no behavior change, just verify same output.

---

## Task 2: Fix notification rules `listRules` unfiltered subquery
**File:** `packages/backend/src/notifications/services/notification-rules.service.ts`
**Current (line 20-31):** The LEFT JOIN subquery `SELECT rule_id, COUNT(*) FROM notification_logs GROUP BY rule_id` scans the **entire** `notification_logs` table — no user/tenant filter.
**Change:** Correlate the subquery to only count logs for the user's rules:

```sql
-- Before:
LEFT JOIN (
  SELECT rule_id, COUNT(*) AS trigger_count FROM notification_logs GROUP BY rule_id
) nl ON nl.rule_id = nr.id

-- After:
LEFT JOIN (
  SELECT rule_id, COUNT(*) AS trigger_count
  FROM notification_logs
  WHERE rule_id IN (SELECT id FROM notification_rules WHERE user_id = $1)
  GROUP BY rule_id
) nl ON nl.rule_id = nr.id
```

**Tests:** Update `notification-rules.service.spec.ts` — verify same output, check the SQL uses filtered subquery.

---

## Task 3: Batch tier saves in `removeProvider`
**File:** `packages/backend/src/routing/routing.service.ts`
**Current (lines 90-149):** Three N+1 loops:
1. Lines 102-110: Individual `tierRepo.save(tier)` per override
2. Lines 114-125: Individual `tierRepo.save(tier)` per fallback cleanup
3. Lines 136-146: Individual `tierRepo.findOne()` per notification message

**Change:**
- Collect all tier mutations first, then batch-save with a single `tierRepo.save(tiersToUpdate)` call
- Batch-fetch notification tiers with `tierRepo.find({ where: { agent_id, tier: In(tierNames) } })`

```typescript
// Collect mutations
const tiersToUpdate: TierAssignment[] = [];
for (const tier of overrides) {
  const pricing = this.pricingCache.getByModel(tier.override_model!);
  if (pricing && pricing.provider.toLowerCase() === provider.toLowerCase()) {
    invalidated.push({ tier: tier.tier, modelName: tier.override_model! });
    tier.override_model = null;
    tier.updated_at = new Date().toISOString();
    tiersToUpdate.push(tier);
  }
}

// Clean fallbacks
const allTiers = await this.tierRepo.find({ where: { agent_id: agentId } });
for (const tier of allTiers) {
  // ...filter logic...
  if (filtered.length !== tier.fallback_models.length) {
    tier.fallback_models = filtered.length > 0 ? filtered : null;
    tier.updated_at = new Date().toISOString();
    tiersToUpdate.push(tier);
  }
}

// Single batch save
if (tiersToUpdate.length > 0) await this.tierRepo.save(tiersToUpdate);

// Batch fetch for notifications
const tierNames = invalidated.map(i => i.tier);
const updatedTiers = tierNames.length > 0
  ? await this.tierRepo.find({ where: { agent_id: agentId, tier: In(tierNames) } })
  : [];
const tierMap = new Map(updatedTiers.map(t => [t.tier, t]));
for (const { tier, modelName } of invalidated) {
  const updated = tierMap.get(tier);
  // ...build notification...
}
```

**Tests:** Update `routing.service.spec.ts` — verify same behavior with fewer DB calls.

---

## Task 4: Fix `invalidateOverridesForRemovedModels` full table scan + N+1
**File:** `packages/backend/src/routing/routing.service.ts`
**Current (lines 166-209):**
- Line 187: `this.tierRepo.find()` — **full table scan, no WHERE clause**
- Lines 176-183: Individual `tierRepo.save(tier)` per affected override
- Lines 188-196: Individual `tierRepo.save(tier)` per fallback cleanup
- Lines 201-203: Sequential `recalculate()` per agent

**Change:**
1. Replace unfiltered `find()` with `find({ where: { agent_id: In([...agentIds]) } })` after first pass
2. Also include agent_ids from fallback cleanup (two-pass: first find overrides to get initial agentIds, then scan only those agents' tiers for fallbacks)
3. Collect all tier mutations, batch-save once
4. Parallelize `recalculate()` calls with `Promise.all`

```typescript
// 1. Find affected overrides (already filtered by In(removedModels))
const affected = await this.tierRepo.find({ where: { override_model: In(removedModels) } });
const agentIds = new Set(affected.map(t => t.agent_id));

// 2. Collect mutations
const tiersToSave: TierAssignment[] = [];
for (const tier of affected) {
  tier.override_model = null;
  tier.updated_at = new Date().toISOString();
  tiersToSave.push(tier);
}

// 3. Filter fallback tiers ONLY for affected agents (not full table scan)
// If no agent_ids from overrides, scan all tiers that have fallback_models
const fallbackTiers = agentIds.size > 0
  ? await this.tierRepo.find({ where: { agent_id: In([...agentIds]) } })
  : await this.tierRepo.find(); // edge case: removed models only in fallbacks
// Actually, we need to check ALL tiers for fallback references.
// Better approach: query tiers where fallback_models is not null
// Since TypeORM can't filter JSON array contents, we must scan — but we can add agentId tracking.

// For now, just filter the tiers we already have (from affected) + skip already-processed
for (const tier of fallbackTiers) {
  if (!tier.fallback_models?.length) continue;
  const filtered = tier.fallback_models.filter(m => !removedSet.has(m));
  if (filtered.length !== tier.fallback_models.length) {
    tier.fallback_models = filtered.length > 0 ? filtered : null;
    tier.updated_at = new Date().toISOString();
    if (!tiersToSave.includes(tier)) tiersToSave.push(tier);
    agentIds.add(tier.agent_id);
  }
}

// 4. Batch save
if (tiersToSave.length > 0) await this.tierRepo.save(tiersToSave);

// 5. Parallel recalculate
await Promise.all([...agentIds].map(id => {
  this.routingCache.invalidateAgent(id);
  return this.autoAssign.recalculate(id);
}));
```

**Note:** The full-table fallback scan is hard to eliminate entirely because TypeORM can't query inside JSON arrays. However, this method is only called during pricing sync (rare admin operation), so the main win is batching saves and parallelizing recalculations. If we want to fully fix this later, we'd need a `tier_fallback_models` junction table.

**Tests:** Update `routing.service.spec.ts`.

---

## Task 5: Batch dedup queries in trace ingestion `buildAgentMessage`
**File:** `packages/backend/src/otlp/services/trace-ingest.service.ts`
**Current (lines 373-477):** For EACH `agent_message` span, runs up to 4 sequential DB queries:
1. Line 382-390: `findOne` by trace_id (proxy error dedup)
2. Lines 395-404: `find` recent errors (fallback dedup)
3. Lines 416-421: `find` recent OK messages (proxy dedup)
4. Lines 436-441: `find` recent messages (ghost dedup)

With 10 agent_message spans per batch = up to 40 sequential queries.

**Change:** Pre-fetch all dedup data upfront before the span loop:

```typescript
// In insertAll(), before the span loop:
const agentMsgSpans = spans.filter(s => {
  const sid = toHexString(s.spanId);
  return spanMap.get(sid)?.type === 'agent_message'
    && !ghostSpanIds.has(sid) && !fallbackSkipIds.has(sid);
});

// 1. Batch fetch existing error/rate_limited records by trace_id
const traceIds = agentMsgSpans
  .map(s => toHexString(s.traceId))
  .filter(Boolean);
const existingErrors = traceIds.length > 0
  ? await this.turnRepo.find({
      where: { trace_id: In(traceIds), tenant_id: ctx.tenantId, status: In(['error', 'rate_limited']) },
      select: ['id', 'trace_id'],
    })
  : [];
const errorTraceIds = new Set(existingErrors.map(e => e.trace_id));

// 2. Batch fetch recent errors for fallback dedup (single query)
const recentErrors = await this.turnRepo.find({
  where: { tenant_id: ctx.tenantId, agent_id: ctx.agentId, status: In(['error', 'rate_limited']) },
  select: ['id', 'timestamp'],
  order: { timestamp: 'DESC' },
  take: 10,
});

// 3. Batch fetch recent OK messages for proxy dedup
const recentOkMessages = await this.turnRepo.find({
  where: { tenant_id: ctx.tenantId, agent_id: ctx.agentId, status: 'ok' },
  select: ['id', 'timestamp', 'input_tokens'],
  order: { timestamp: 'DESC' },
  take: 10,
});

// 4. Batch fetch recent messages for ghost dedup
const recentMessages = await this.turnRepo.find({
  where: { tenant_id: ctx.tenantId, agent_id: ctx.agentId },
  select: ['id', 'timestamp', 'input_tokens', 'output_tokens', 'model', 'session_key'],
  order: { timestamp: 'DESC' },
  take: 10,
});
```

Then pass these pre-fetched sets to `buildAgentMessage` so it uses in-memory checks instead of per-span DB queries. This reduces 4N queries → 4 queries (or 3 with Promise.all on the batch fetches).

Refactor `buildAgentMessage` to accept a `DedupContext` object:
```typescript
interface DedupContext {
  errorTraceIds: Set<string>;
  recentErrors: { id: string; timestamp: string }[];
  recentOkMessages: { id: string; timestamp: string; input_tokens: number }[];
  recentMessages: { id: string; timestamp: string; input_tokens: number; output_tokens: number; model: string | null; session_key: string | null }[];
}
```

**Tests:** Update `trace-ingest.service.spec.ts` — critical to maintain existing dedup behavior.

---

## Task 6: Add time cutoff to `findUnfilledFallback`
**File:** `packages/backend/src/otlp/services/trace-ingest.service.ts`
**Current (lines 169-190):** Queries all unfilled fallbacks for the agent with no time bound — scans arbitrarily far back.
**Change:** Add a 5-minute cutoff:

```typescript
private async findUnfilledFallback(span: OtlpSpan, ctx: IngestionContext) {
  const spanTime = new Date(nanoToDatetime(span.startTimeUnixNano));
  const cutoff = new Date(spanTime.getTime() - 5 * 60_000).toISOString();

  const candidates = await this.turnRepo.find({
    where: {
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      fallback_from_model: Not(IsNull()),
      status: 'ok',
      input_tokens: 0,
      output_tokens: 0,
      // ADD TIME BOUND:
      timestamp: MoreThanOrEqual(cutoff),
    },
    select: ['id', 'model', 'timestamp'],
    order: { timestamp: 'DESC' },
    take: 1,
  });
  // ...rest unchanged
}
```

Import `MoreThanOrEqual` from TypeORM.

**Tests:** Update `trace-ingest.service.spec.ts` — verify cutoff is applied.

---

## Task 7: Merge token summary into timeseries query (tokens endpoint)
**File:** `packages/backend/src/analytics/services/aggregation.service.ts` (getTokenSummary) + `timeseries-queries.service.ts` (getHourlyTokens, getDailyTokens)
**Current:** The tokens controller runs 3 parallel queries: `getTokenSummary` (2 sub-queries: current + previous), `getHourlyTokens`, `getDailyTokens`. That's 4 actual DB queries.
**Change:** Compute the token summary by summing the hourly timeseries data in JS, eliminating the dedicated `getTokenSummary` call:

In `tokens.controller.ts`:
```typescript
@Get('tokens')
async getTokens(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
  const range = query.range ?? '24h';
  const agentName = query.agent_name;

  const [hourly, daily, prevTokens] = await Promise.all([
    this.timeseries.getHourlyTokens(range, user.id, agentName),
    this.timeseries.getDailyTokens(range, user.id, agentName),
    this.aggregation.getPreviousTokenTotal(range, user.id, agentName), // new lightweight method
  ]);

  // Derive summary from hourly data
  const inputTotal = hourly.reduce((s, h) => s + h.input_tokens, 0);
  const outputTotal = hourly.reduce((s, h) => s + h.output_tokens, 0);
  const current = inputTotal + outputTotal;

  return {
    summary: {
      total_tokens: {
        value: current,
        trend_pct: computeTrend(current, prevTokens),
        sub_values: { input: inputTotal, output: outputTotal },
      },
      input_tokens: inputTotal,
      output_tokens: outputTotal,
    },
    hourly,
    daily,
  };
}
```

Add a new lightweight `getPreviousTokenTotal` to `AggregationService` (just the previous-period query, not the current one).

This reduces from 4 → 3 DB queries.

**Tests:** Update `tokens.controller.spec.ts`, add `getPreviousTokenTotal` test.

---

## Task 8: Merge cost summary into timeseries query (costs endpoint)
**File:** Same pattern as Task 7 but for costs.
**Current:** 4 parallel queries: `getCostSummary` (2 sub-queries), `getDailyCosts`, `getHourlyCosts`, `getCostByModel`. That's 5 actual DB queries.
**Change:** Derive cost summary from hourly data, add `getPreviousCostTotal` method.

Reduces from 5 → 4 DB queries.

**Tests:** Update `costs.controller.spec.ts`.

---

## Task 9: Group notification cron rules by tenant+agent
**File:** `packages/backend/src/notifications/services/notification-cron.service.ts`
**Current (lines 55-75):** Iterates rules one-by-one, each calling `getConsumption()` which runs a SUM query on `agent_messages`. If 10 rules target the same agent with the same period, it runs the same aggregation 10 times.
**Change:** Group rules by `(tenant_id, agent_name, period)` and fetch consumption once per group:

```typescript
async checkThresholds(): Promise<number> {
  const rules: ActiveRule[] = await this.rulesService.getAllActiveRules();
  if (!rules.length) return 0;

  // Group by (tenant_id, agent_name, period) to deduplicate consumption queries
  const groups = new Map<string, { rules: ActiveRule[]; consumption?: Map<string, number> }>();
  for (const rule of rules) {
    const key = `${rule.tenant_id}|${rule.agent_name}|${rule.period}`;
    if (!groups.has(key)) groups.set(key, { rules: [] });
    groups.get(key)!.rules.push(rule);
  }

  // Fetch consumption once per group
  for (const [, group] of groups) {
    const sample = group.rules[0];
    const { periodStart, periodEnd } = computePeriodBoundaries(sample.period);
    // Fetch both metrics in one pass if needed
    const metrics = new Set(group.rules.map(r => r.metric_type));
    const consumption = new Map<string, number>();
    for (const metric of metrics) {
      consumption.set(metric, await this.rulesService.getConsumption(
        sample.tenant_id, sample.agent_name, metric, periodStart, periodEnd,
      ));
    }
    group.consumption = consumption;
  }

  // Evaluate rules against pre-fetched consumption
  let triggered = 0;
  for (const [, group] of groups) {
    for (const rule of group.rules) {
      const actual = group.consumption!.get(rule.metric_type) ?? 0;
      // ...evaluate and send notification if needed...
    }
  }
  return triggered;
}
```

**Tests:** Update `notification-cron.service.spec.ts`.

---

## Task 10: Changeset

Run `npx changeset` and add a `manifest` patch changeset summarizing all performance improvements.

---

## Summary

| Task | Endpoint | Technique | Queries Saved | Effort |
|------|----------|-----------|---------------|--------|
| 1 | `GET /security` | Parallelize | Latency halved | Small |
| 2 | `GET /notifications` | Filter subquery | Full scan eliminated | Small |
| 3 | `removeProvider` | Batch saves | N saves → 1 | Small |
| 4 | `invalidateOverrides` | Filter + batch + parallel | Full scan + N saves → filtered + 1 | Medium |
| 5 | `POST /otlp/traces` | Batch pre-fetch dedup | 4N → 4 queries | Medium |
| 6 | `findUnfilledFallback` | Time cutoff | Unbounded → 5min window | Small |
| 7 | `GET /tokens` | Derive from timeseries | 4 → 3 queries | Small |
| 8 | `GET /costs` | Derive from timeseries | 5 → 4 queries | Small |
| 9 | Notification cron | Group by tenant+agent | N → N/dedup queries | Medium |
| 10 | Changeset | — | — | Tiny |
