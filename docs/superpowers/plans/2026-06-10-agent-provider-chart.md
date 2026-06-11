# Per-agent Provider Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Seb's provider-grouped usage chart on the per-agent Overview: `ProviderChartCard` grouped by provider + a provider multiselect filter, scoped to the one agent.

**Architecture:** Reuse `ProviderChartCard` + `MultiAgentTokenChart` (already used by the global Overview). Feed them three per-agent/per-provider timeseries (tokens/messages/cost). Add the one missing frontend API client fn (`getPerProviderCostTimeseries`); the backend endpoint already exists. Port Seb's provider-multiselect + filter/color logic from `AgentOverview.tsx` @ `fix/pr2061-migration-dedup-and-access` into the current `Overview.tsx`.

**Tech Stack:** SolidJS, vitest. Worktree `/Users/guillaumegay/Documents/Projects/manifest/worktrees/dashboard-fixes`, branch `feat/agent-provider-chart` (off `fix/remove-subscription-savings` #2200). node_modules symlinked from `pr10-analytics-ui`.

**Spec:** `docs/superpowers/specs/2026-06-10-agent-provider-chart-design.md`

**Verify:** `cd packages/frontend && npx vitest run <path>` ; `npx tsc --noEmit`.

---

### Task 1: add `getPerProviderCostTimeseries` to the API client

**Files:**
- Modify: `packages/frontend/src/services/api/analytics.ts` (after `getPerProviderMessageTimeseries`, ends line ~127)
- Test: `packages/frontend/tests/services/api/analytics.test.ts` (the `agent-scoped per-provider timeseries` test, line ~134)

- [ ] **Step 1: failing test.** In `analytics.test.ts`, extend the `fns` array in the `agent-scoped per-provider timeseries endpoints forward agent_name + range` test:

```typescript
    const fns: Array<[(a: string, r?: string) => unknown, string]> = [
      [analytics.getPerProviderTimeseries, 'per-provider-timeseries'],
      [analytics.getPerProviderMessageTimeseries, 'per-provider-message-timeseries'],
      [analytics.getPerProviderCostTimeseries, 'per-provider-cost-timeseries'],
    ];
```

- [ ] **Step 2: run, verify FAIL.**
Run: `cd packages/frontend && npx vitest run tests/services/api/analytics.test.ts`
Expected: FAIL — `getPerProviderCostTimeseries` is undefined.

- [ ] **Step 3: implement.** In `analytics.ts`, immediately after the `getPerProviderMessageTimeseries` function (before `getRateLimits`):

```typescript
export function getPerProviderCostTimeseries(
  agentName: string,
  range = '24h',
): PivotedTimeseries {
  return fetchJson('/overview/per-provider-cost-timeseries', {
    agent_name: agentName,
    range,
  }) as PivotedTimeseries;
}
```

- [ ] **Step 4: run, verify PASS.** Same command. Expected: PASS.

- [ ] **Step 5: commit.**

```bash
git add packages/frontend/src/services/api/analytics.ts packages/frontend/tests/services/api/analytics.test.ts
git commit -m "feat(api): add per-agent per-provider cost timeseries client fn"
```

---

### Task 2: render the provider-grouped chart on the per-agent Overview

**Files:**
- Modify: `packages/frontend/src/pages/Overview.tsx`
- Test: `packages/frontend/tests/pages/Overview.test.tsx`

This swaps `ChartCard` for `ProviderChartCard`, adds the provider multiselect, and wires three per-provider resources + filter/color memos (ported from Seb).

- [ ] **Step 1: imports.** In `Overview.tsx`, replace the `ChartCard` import (line 12) and add the new deps. Change:

```typescript
import ChartCard from '../components/ChartCard.jsx';
```
to:
```typescript
import ProviderChartCard from '../components/ProviderChartCard.jsx';
import { AGENT_COLORS } from '../components/MultiAgentTokenChart.jsx';
import { PROVIDERS } from '../services/providers.js';
```

Add `For` and `onCleanup` to the `solid-js` import (line 3-11 block); add the three per-provider client fns to the `../services/api.js` import OR import from `../services/api/analytics.js`. **Check first** whether `getOverview` in `Overview.tsx` comes from `../services/api.js` (it does — line 23). The per-provider fns live in `../services/api/analytics.js`; add a new import line:

```typescript
import {
  getPerProviderTimeseries,
  getPerProviderMessageTimeseries,
  getPerProviderCostTimeseries,
} from '../services/api/analytics.js';
```

Add `import '../styles/charts.css';` after the existing `'../styles/overview.css'` import (ProviderChartCard/MultiAgentTokenChart need chart styles).

- [ ] **Step 2: type for pivoted series.** After the `OverviewData` interface (line ~73), add:

```typescript
type PivotedTimeseries = {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
};
```

- [ ] **Step 3: state + resources + memos.** Inside the component, after the `messageChartData` memo (line ~210), add the provider chart machinery (ported from Seb, adapted to use `params.agentName` and the existing `range()` signal). Note: the existing page already has `range()`/`activeView()`; reuse them — do NOT add a second range signal.

```typescript
  // ── Provider breakdown (per-agent, grouped by provider) ─────────────
  const providerFilterKey = () => `agent-overview-providers:${params.agentName}`;
  const loadSavedProviders = (): Set<string> => {
    try {
      const saved = sessionStorage.getItem(providerFilterKey());
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  };
  const [selectedProviders, setSelectedProviders] = createSignal<Set<string>>(loadSavedProviders());
  const [providerFilterOpen, setProviderFilterOpen] = createSignal(false);
  let providerFilterRef: HTMLDivElement | undefined;
  if (typeof document !== 'undefined') {
    const onClickOutside = (e: MouseEvent) => {
      if (providerFilterRef && !providerFilterRef.contains(e.target as Node))
        setProviderFilterOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProviderFilterOpen(false);
    };
    document.addEventListener('click', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => {
      document.removeEventListener('click', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    });
  }

  const tsKey = () => ({ range: range(), agent: params.agentName, _ping: messagePing() });
  const [providerTokenTs] = createResource(tsKey, (p) =>
    p.agent ? (getPerProviderTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>) : undefined,
  );
  const [providerMessageTs] = createResource(tsKey, (p) =>
    p.agent
      ? (getPerProviderMessageTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>)
      : undefined,
  );
  const [providerCostTs] = createResource(tsKey, (p) =>
    p.agent
      ? (getPerProviderCostTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>)
      : undefined,
  );

  const allProviders = createMemo(() => {
    const set = new Set<string>([
      ...(providerTokenTs()?.agents ?? []),
      ...(providerMessageTs()?.agents ?? []),
      ...(providerCostTs()?.agents ?? []),
    ]);
    return [...set].sort();
  });

  const providerColorMap = createMemo(() => {
    const map: Record<string, string> = {};
    const list = allProviders();
    for (let i = 0; i < list.length; i++) map[list[i]!] = AGENT_COLORS[i % AGENT_COLORS.length]!;
    return map;
  });

  const effectiveSelected = () => {
    const sel = selectedProviders();
    if (sel.size === 0 && allProviders().length > 0) return new Set(allProviders());
    return sel;
  };
  const selectedProviderCount = () => effectiveSelected().size;

  const toggleProvider = (provider: string) => {
    const next = new Set(effectiveSelected());
    if (next.has(provider)) next.delete(provider);
    else next.add(provider);
    setSelectedProviders(next);
    try {
      sessionStorage.setItem(providerFilterKey(), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };
  const setAllProviders = (on: boolean) => {
    const next = on ? new Set(allProviders()) : new Set<string>();
    setSelectedProviders(next);
    try {
      sessionStorage.setItem(providerFilterKey(), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const filterTs = (raw: PivotedTimeseries | undefined): PivotedTimeseries | undefined => {
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    return {
      agents: raw.agents.filter((a) => sel.has(a)),
      timeseries: raw.timeseries.map((row) => {
        const out: Record<string, number | string> = {};
        for (const [k, v] of Object.entries(row)) {
          if (k === 'hour' || k === 'date' || sel.has(k)) out[k] = v;
        }
        return out;
      }),
    };
  };
  const filteredTokenTs = createMemo(() => filterTs(providerTokenTs()));
  const filteredMessageTs = createMemo(() => filterTs(providerMessageTs()));
  const filteredCostTs = createMemo(() => filterTs(providerCostTs()));

  const providerDisplayName = (provId: string): string =>
    PROVIDERS.find((p) => p.id === provId)?.name ?? provId;
```

- [ ] **Step 4: header — add the provider multiselect + right-align.** Replace the page-header block (lines 221-240) with the right-aligned version that adds the provider multiselect before the range select. (This also folds in the "range on the right" cosmetic.)

```tsx
      <div class="page-header" style="justify-content: flex-end;">
        <div class="header-controls">
          <Show when={showDashboard() && allProviders().length > 1}>
            <div class="agent-filter-select" ref={providerFilterRef}>
              <button
                class="agent-filter-select__trigger"
                onClick={() => setProviderFilterOpen(!providerFilterOpen())}
                type="button"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {selectedProviderCount() === allProviders().length
                  ? `All providers (${allProviders().length})`
                  : `${selectedProviderCount()} of ${allProviders().length} providers`}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <Show when={providerFilterOpen()}>
                <div class="agent-filter-select__dropdown">
                  <div class="agent-filter-select__actions">
                    <button
                      class="agent-filter-select__action-btn"
                      type="button"
                      disabled={selectedProviderCount() === allProviders().length}
                      onClick={() => setAllProviders(true)}
                    >
                      Select all
                    </button>
                    <button
                      class="agent-filter-select__action-btn"
                      type="button"
                      disabled={selectedProviderCount() === 0}
                      onClick={() => setAllProviders(false)}
                    >
                      Unselect all
                    </button>
                  </div>
                  <For each={allProviders()}>
                    {(provider) => {
                      const isOn = () => effectiveSelected().has(provider);
                      return (
                        <button
                          class="agent-filter-select__item"
                          onClick={() => toggleProvider(provider)}
                          type="button"
                        >
                          <span
                            class="agent-filter-select__swatch"
                            style={{ background: providerColorMap()[provider] }}
                          />
                          <span class="agent-filter-select__name">
                            {providerDisplayName(provider)}
                          </span>
                          <span
                            class="agent-filter-select__toggle"
                            classList={{ 'agent-filter-select__toggle--on': isOn() }}
                          >
                            <span class="agent-filter-select__toggle-thumb" />
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
          <Show when={showDashboard()}>
            <Select
              value={range()}
              onChange={handleRangeChange}
              options={[
                { label: 'Last 24 hours', value: '24h' },
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
              ]}
            />
          </Show>
          <Show when={showEmptyState() && !setupCompleted()}>
            <button class="btn btn--primary btn--sm" onClick={() => setSetupOpen(true)}>
              Set up harness
            </button>
          </Show>
        </div>
      </div>
```

- [ ] **Step 5: swap ChartCard → ProviderChartCard.** Replace the `<ChartCard .../>` block (lines 307-320) with:

```tsx
                  <ProviderChartCard
                    activeView={activeView()}
                    onViewChange={setActiveView}
                    costValue={d().summary?.cost_today?.value ?? 0}
                    costTrendPct={d().summary?.cost_today?.trend_pct ?? 0}
                    tokensValue={d().summary?.tokens_today?.value ?? 0}
                    tokensTrendPct={d().summary?.tokens_today?.trend_pct ?? 0}
                    messagesValue={d().summary?.messages?.value ?? 0}
                    messagesTrendPct={d().summary?.messages?.trend_pct ?? 0}
                    costInfoTooltip="Actual API key costs only. Subscription usage is not included."
                    range={range()}
                    agentTimeseries={filteredTokenTs() ?? undefined}
                    agentMessageTimeseries={filteredMessageTs() ?? undefined}
                    agentCostTimeseries={filteredCostTs() ?? undefined}
                    colorMap={providerColorMap()}
                  />
```

Note: `messageChartData` (the old `ChartCard` `messageChartData` prop source) is now unused by the chart — but verify it's not referenced elsewhere before deleting its memo. `grep -n messageChartData packages/frontend/src/pages/Overview.tsx`; if the only use was the ChartCard prop, delete the memo (lines 207-210) to avoid an unused-var lint error.

- [ ] **Step 6: update Overview.test.tsx.** The test currently mocks `CostChart`/`TokenChart`/`SingleTokenChart` (ChartCard's children) and stripped the `api/analytics` mock during the savings removal. Now the page renders `ProviderChartCard` → `MultiAgentTokenChart`, and calls the three per-provider client fns. Add:

```typescript
const mockPerProvider = vi.fn(() => Promise.resolve({ agents: [], timeseries: [] }));
vi.mock("../../src/services/api/analytics.js", () => ({
  getPerProviderTimeseries: (...a: unknown[]) => mockPerProvider(...a),
  getPerProviderMessageTimeseries: (...a: unknown[]) => mockPerProvider(...a),
  getPerProviderCostTimeseries: (...a: unknown[]) => mockPerProvider(...a),
}));
vi.mock("../../src/components/MultiAgentTokenChart.jsx", () => ({
  AGENT_COLORS: ['#111111', '#222222'],
  default: (props: any) => (
    <div data-testid="multi-agent-chart" data-series={(props.data?.agents ?? []).join(',')} />
  ),
}));
```

Keep the existing `CostChart`/`TokenChart`/`SingleTokenChart` mocks (harmless; no longer rendered). Then fix assertions that depended on ChartCard internals:
- The test `switches chart view when stat header clicked` (clicks `.chart-card__stat--clickable` and expects `[data-testid="cost-chart"]`): ProviderChartCard reuses the same `.chart-card__stat--clickable` classes and Cost/Messages/Tokens order (Cost = index 0). Update it to assert the active stat class toggles instead of the old per-view chart testids — e.g. click `stats[0]` → expect `.chart-card__stat--active` contains "Cost"; click `stats[1]` → "Messages". (ProviderChartCard renders `multi-agent-chart` for whichever view; assert the active-stat label, not a per-view testid.)
- Any assertion referencing `single-token-chart`/`cost-chart`/`token-chart` as the agent-overview chart must change to `multi-agent-chart` or the active-stat check.
- Add a test: with `mockPerProvider` resolving `{ agents: ['openai','anthropic'], timeseries: [{hour:'1', openai:5, anthropic:3}] }`, the provider multiselect renders ("All providers (2)") and `multi-agent-chart` shows both series; clicking "Unselect all" then a single provider filters the series.

Run iteratively: `cd packages/frontend && npx vitest run tests/pages/Overview.test.tsx` until green.

- [ ] **Step 7: typecheck + format.**
Run: `cd packages/frontend && npx tsc --noEmit && npx prettier --write src/pages/Overview.tsx src/services/api/analytics.ts tests/pages/Overview.test.tsx`
Expected: clean.

- [ ] **Step 8: commit.**

```bash
git add packages/frontend/src/pages/Overview.tsx packages/frontend/tests/pages/Overview.test.tsx
git commit -m "feat(overview): provider-grouped usage chart on the per-agent overview"
```

---

### Task 3: full verification + changeset + PR

- [ ] **Step 1: full suites.**
Run: `cd packages/frontend && npx tsc --noEmit && npx vitest run --coverage`
Expected: all green; 100% line coverage on `Overview.tsx` and the new client fn. Add tests for any uncovered branch (e.g. the `setAllProviders(false)` path, the sessionStorage catch).

- [ ] **Step 2: lint.** Run from repo root: `npm run lint` (expect 0 errors; warnings pre-exist).

- [ ] **Step 3: grep guard.** `grep -n "ChartCard" packages/frontend/src/pages/Overview.tsx` → no match (now uses ProviderChartCard). Confirm `ChartCard` itself still has its other consumers: `grep -rln "import ChartCard" packages/frontend/src` → GlobalOverview, ConnectionDetail still present.

- [ ] **Step 4: live check.** The dev server (`:3010`) hot-reloads. Confirm the agent Overview chart shows per-provider series + the "All providers (N)" filter on the right next to "Last 30 days". (Backend on `:3011`, login admin@manifest.build/manifest.)

- [ ] **Step 5: changeset.**

```bash
# create .changeset/agent-provider-chart.md targeting "manifest", patch
```
Content: `The per-agent Overview now breaks usage down by provider (chart + provider filter), matching the global Overview.`

- [ ] **Step 6: commit + push + PR.**

```bash
git add .changeset/agent-provider-chart.md
git commit -m "chore: changeset for per-agent provider chart"
git push -u origin feat/agent-provider-chart
git push upstream fix/remove-subscription-savings   # base must be on upstream
```
PR base = `fix/remove-subscription-savings` (#2200), head = `guillaumegay13:feat/agent-provider-chart`.

---

## Self-review notes

- Spec coverage: ProviderChartCard swap (Task 2 step 5), provider multiselect (step 4), three timeseries incl. new cost fn (Task 1 + step 3), color map + filter (step 3), range-on-right fold-in (step 4), no backend change, ChartCard kept. ✓
- The cosmetic ChartCard reorder is intentionally NOT carried (moot — agent page uses ProviderChartCard now, already Cost-first). The stash on `fix/remove-subscription-savings` can be dropped after this lands.
- ProviderChartCard prop names verified against `components/ProviderChartCard.tsx`: `activeView`, `onViewChange`, `messagesValue`, `messagesTrendPct`, `tokensValue`, `tokensTrendPct`, `costValue`, `costTrendPct`, `costInfoTooltip`, `range`, `agentTimeseries`, `agentMessageTimeseries`, `agentCostTimeseries`, `colorMap`.
