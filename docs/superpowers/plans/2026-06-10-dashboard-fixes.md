# Dashboard Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three stacked PRs: (A) agent Messages "View more" carries the agent filter, (B) Local tab/models hidden in cloud, (C) Subscription Savings fully removed.

**Architecture:** Stack on `fix/custom-provider-display` (#2197). PR A = query-param redirect + `MessageLog` seeding. PR B = `checkIsSelfHosted()` gating on Sidebar/route/GlobalOverview (the provider-select modal is ALREADY gated — verified `ProviderSelectContent.tsx:393` wraps the Local tab button in `<Show when={isSelfHosted()}>`). PR C = delete savings UI + backend endpoints; keep `baseline-cost.ts` (verified consumer: `routing/proxy/proxy-message-recorder.ts`) and the `baseline_cost_usd` column.

**Tech Stack:** SolidJS (`@solidjs/router` `useSearchParams`), NestJS, vitest/jest. 100% patch coverage. Worktree: `/Users/guillaumegay/Documents/Projects/manifest/worktrees/dashboard-fixes` (node_modules symlinked from `pr10-analytics-ui`).

---

## PR A — branch `fix/agent-messages-filter-redirect`

### Task A1: redirect carries the agent + MessageLog seeds the filter

**Files:**
- Modify: `packages/frontend/src/pages/AgentMessagesRedirect.tsx`
- Modify: `packages/frontend/src/pages/MessageLog.tsx:77` (agentFilter init)
- Test: `packages/frontend/tests/pages/AgentRedirects.test.tsx` (existing redirect tests), `packages/frontend/tests/pages/MessageLog.test.tsx`

- [ ] **Step 1: failing tests.** In `AgentRedirects.test.tsx`, find the existing `AgentMessagesRedirect` test and update/add: the redirect target must be `/messages?agent=my%20agent` for route param `my agent`. In `MessageLog.test.tsx`, add a test in global mode (no `agentName` route param) mounting with search param `?agent=demo-agent` asserting the harness filter Select value is `demo-agent` and `getMessages` is called with `agent_name: 'demo-agent'`. (Follow the file's existing router-mocking convention — check how `useParams` is mocked and extend the same mock factory with `useSearchParams`.)

- [ ] **Step 2: run, verify FAIL.**
Run: `cd packages/frontend && npx vitest run tests/pages/AgentRedirects.test.tsx tests/pages/MessageLog.test.tsx`

- [ ] **Step 3: implement.**

`AgentMessagesRedirect.tsx` (whole file):

```tsx
import { Navigate, useParams } from '@solidjs/router';
import type { Component } from 'solid-js';

/**
 * Redirects /harnesses/:agentName/messages → /messages?agent=<name> so the
 * global message log opens pre-filtered to the harness the user came from.
 */
const AgentMessagesRedirect: Component = () => {
  const params = useParams<{ agentName: string }>();
  return (
    <Navigate
      href={`/messages?agent=${encodeURIComponent(decodeURIComponent(params.agentName))}`}
    />
  );
};

export default AgentMessagesRedirect;
```

`MessageLog.tsx`: import `useSearchParams` from `@solidjs/router` (extend the existing import on line 2) and seed the filter:

```tsx
  const [searchParams] = useSearchParams<{ agent?: string }>();
  // Seed from ?agent= (set by AgentMessagesRedirect) so "View more" on a
  // harness overview lands pre-filtered; only meaningful in global mode.
  const [agentFilter, setAgentFilter] = createSignal(
    !params.agentName && typeof searchParams.agent === 'string' ? searchParams.agent : '',
  );
```

- [ ] **Step 4: run, verify PASS** (same command), plus `npx tsc --noEmit`.

- [ ] **Step 5: changeset + commit.** Changeset (patch, `manifest`): `"View more" on a harness's recent messages now opens the global Messages log pre-filtered to that harness.` Then:

```bash
git add packages/frontend/src/pages/AgentMessagesRedirect.tsx packages/frontend/src/pages/MessageLog.tsx packages/frontend/tests/pages/AgentRedirects.test.tsx packages/frontend/tests/pages/MessageLog.test.tsx .changeset/
git commit -m "fix(messages): carry agent filter through the messages redirect"
```

- [ ] **Step 6: push + PR** to `mnfst/manifest`, base `fix/custom-provider-display`... **NO** — cross-repo PRs need the base on upstream. Base on the SAME branch name pushed to upstream? #2197's head is on the fork. GitHub stacked PRs across forks can't base on a fork branch. **Resolution:** push `fix/custom-provider-display` is already on origin (fork) — so base PR A on `feat/analytics-ui` (upstream) and note in the body it stacks on #2197 (diff shows both until #2197 merges), OR push the base branch to upstream. Decide at execution: prefer pushing `fix/custom-provider-display` to upstream (memory: "Cross-repo PR base branches must be pushed to upstream first") and base PR A on it.

---

## PR B — branch `fix/hide-local-in-cloud` (off PR A)

### Task B1: Sidebar + route + GlobalOverview gating

**Files:**
- Modify: `packages/frontend/src/components/Sidebar.tsx` (Local link, lines ~107-114)
- Modify: `packages/frontend/src/pages/providers/Local.tsx` (route guard)
- Modify: `packages/frontend/src/pages/GlobalOverview.tsx` (Local stat card ~791-851 + grid line 665)
- Test: `packages/frontend/tests/components/Sidebar.test.tsx`, `packages/frontend/tests/pages/ProviderPages.test.tsx` (or wherever Local.tsx is covered — `grep -rln "providers/Local" packages/frontend/tests`), `packages/frontend/tests/pages/ProviderOverviewPages.test.tsx`

- [ ] **Step 1: failing tests.**
  - Sidebar: with `checkIsSelfHosted` mocked → `false` (cloud), the link `href="/providers/local"` is absent; mocked → `true`, present. (Check how Sidebar tests mock services; add a `vi.mock` for `setup-status.js` if absent.)
  - Local page: in cloud, rendering `<LocalProviders/>` navigates to `/providers/byok`; self-hosted renders the connections page.
  - GlobalOverview: in cloud, no "Local" stat card text and the stats grid style contains `repeat(3, 1fr)`; self-hosted keeps 4 columns and the card.

- [ ] **Step 2: run, verify FAIL.**

- [ ] **Step 3: implement.**

`Sidebar.tsx`: add near the top of the component:

```tsx
  const [selfHosted] = createResource(checkIsSelfHosted);
```

(import `checkIsSelfHosted` from `../services/setup-status.js`; `createResource` already imported). Wrap the Local `<A>` block:

```tsx
      <Show when={selfHosted()}>
        <A
          href="/providers/local"
          class="sidebar__link"
          classList={{ active: isGlobalActive('/providers/local') }}
          aria-current={isGlobalActive('/providers/local') ? 'page' : undefined}
        >
          Local
        </A>
      </Show>
```

`pages/providers/Local.tsx` (whole file — currently a one-line wrapper):

```tsx
import { Navigate } from '@solidjs/router';
import { createResource, Show, type Component } from 'solid-js';
import ProviderConnectionsPage from './ProviderConnectionsPage.jsx';
import { checkIsSelfHosted } from '../../services/setup-status.js';

/**
 * Local providers (Ollama, LM Studio) only exist on self-hosted installs —
 * a cloud backend can't reach the user's localhost. In cloud the route
 * redirects to BYOK instead of showing an unusable page.
 */
const Local: Component = () => {
  const [selfHosted] = createResource(checkIsSelfHosted);
  return (
    <Show when={selfHosted.loading === false && selfHosted() === false} fallback={
      <Show when={selfHosted()}>
        <ProviderConnectionsPage kind="local" />
      </Show>
    }>
      <Navigate href="/providers/byok" />
    </Show>
  );
};

export default Local;
```

(Adapt to the actual current file shape; preserve any props it passes today.)

`GlobalOverview.tsx`: add a `selfHosted` resource (same one-liner as Sidebar; `checkIsSelfHosted` may already be imported — check), make the grid conditional:

```tsx
              style={`grid-template-columns: repeat(${selfHosted() ? 4 : 3}, 1fr); align-items: stretch;`}
```

and wrap the whole Local stat card `<div class="overview-stat-card" …>` (the one whose label is `Local`) in `<Show when={selfHosted()}>…</Show>`.

- [ ] **Step 4: run, verify PASS** + `npx tsc --noEmit` + full `npx vitest run` for regressions.

- [ ] **Step 5: changeset + commit + push + PR** (base = PR A's branch on upstream). Changeset: `Local providers (tab, page, overview card) are hidden on cloud — they only apply to self-hosted installs.`

```bash
git add packages/frontend/src/components/Sidebar.tsx packages/frontend/src/pages/providers/Local.tsx packages/frontend/src/pages/GlobalOverview.tsx packages/frontend/tests .changeset/
git commit -m "fix(providers): hide local tab, route and overview card in cloud"
```

---

## PR C — branch `fix/remove-subscription-savings` (off PR B)

### Task C1: frontend removal

**Files:**
- Delete: `packages/frontend/src/components/SavingsCard.tsx`, `SavingsExplainer.tsx`, `SavingsChart.tsx`, `packages/frontend/src/styles/savings.css`, `packages/frontend/tests/components/SavingsCard.test.tsx`, `SavingsExplainer.test.tsx`
- Modify: `packages/frontend/src/components/ChartCard.tsx` (drop `'savings'` from `ActiveView` line 15, the `SavingsChart` lazy import line 11, `SavingsTimeseriesRow` import, the Savings stat block ~lines 100-117, the savings render block ~167-180, and the 4 savings props from `ChartCardProps`)
- Modify: `packages/frontend/src/pages/Overview.tsx` (imports lines 33-36 keep `overview.css` only; signals 92-100: `activeView` union loses `'savings'`, delete `explainerOpen`/`savedCost`/`savedPct`/`savingsTimeseries`; delete the `SavingsExplainer` mount 225-228 — unwrap the `<Show when={!explainerOpen()}>` wrapper; delete ChartCard savings props 335-352 incl. the `SavingsCard` mount)
- Modify: `packages/frontend/src/services/api/analytics.ts` (delete `SavingsData`, `getSavings`, `getBaselineCandidates` + `BaselineCandidateData` if savings-only, `SavingsTimeseriesRow`, `getSavingsTimeseries`)
- Test: update `tests/components/ChartCard.test.tsx`, `tests/pages/Overview.test.tsx`, `tests/services/` analytics API tests (grep for `getSavings`)

- [ ] **Step 1:** delete files, strip references per list above. Grep guard: `grep -rni "savings" packages/frontend/src` → no hits (except none).
- [ ] **Step 2:** update tests: remove savings cases from ChartCard/Overview tests; run `npx vitest run` + `npx tsc --noEmit` until green.
- [ ] **Step 3: commit** `refactor(frontend): remove subscription savings UI`.

### Task C2: backend removal

**Files:**
- Delete: `packages/backend/src/analytics/controllers/savings.controller.ts` + `.spec.ts`, `packages/backend/src/analytics/services/savings-query.service.ts` + `.spec.ts`, `packages/backend/src/common/dto/savings-query.dto.ts` + `.spec.ts`
- Modify: `packages/backend/src/analytics/analytics.module.ts` (remove imports lines 36-37, `SavingsController` line 72, `SavingsQueryService` line 87)
- Keep: `packages/backend/src/common/utils/baseline-cost.ts` + spec (consumer: `routing/proxy/proxy-message-recorder.ts`)

- [ ] **Step 1:** delete + deregister. Grep guard: `grep -rn "Savings" packages/backend/src --include="*.ts" | grep -v baseline` → empty. If `baseline-cost.ts` exports anything ONLY savings used (`pickMostExpensiveRoutedModel`, `collectRoutedModelIds`, `getBaselineCandidates` helpers), check `proxy-message-recorder.ts` usage and prune unused exports + their spec blocks (keep what the recorder uses).
- [ ] **Step 2:** `npx jest --silent` + `npx tsc --noEmit -p tsconfig.json` green. Also grep e2e: `grep -rn "savings" packages/backend/test` and fix/remove.
- [ ] **Step 3: changeset + commit + push + PR** (base = PR B's branch on upstream). Changeset (minor? UI feature removal → patch per repo habit; use patch): `Removed the Subscription Savings card, chart and API endpoints.`

```bash
git commit -m "refactor: remove subscription savings backend endpoints"
```

### Task C3: full verification

- [ ] backend `npx jest --coverage --silent` green; frontend `npx vitest run --coverage` green; both `tsc` clean; lint clean; grep guards empty.

---

## Self-review notes

- Spec coverage: A→Task A1, B→Task B1 (modal already gated — documented), C→C1+C2. ✓
- PR bases: push each branch to upstream so the next can target it (memory rule). At PR-creation time for A: push `fix/custom-provider-display` to upstream and base A on it; B bases on A's upstream branch; C on B's.
