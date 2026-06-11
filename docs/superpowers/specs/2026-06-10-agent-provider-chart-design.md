# Per-agent Overview: provider-grouped usage chart (restore Seb's design)

**Date:** 2026-06-10
**Status:** Approved
**Branch:** `feat/agent-provider-chart`, stacked on `fix/remove-subscription-savings` (#2200).

## Problem

The per-agent Overview (`packages/frontend/src/pages/Overview.tsx`, route
`/harnesses/:agentName`) renders a single-series `ChartCard` (one line for the
whole agent's cost/tokens/messages). The global Overview shows the same data
**broken down by provider** via `ProviderChartCard` plus a provider filter.
That provider breakdown existed on the per-agent page in Seb's #2061 design
(`AgentOverview.tsx` at ref `fix/pr2061-migration-dedup-and-access`) and was
dropped in the re-slice. Restore it.

## Decision

Replace the single-series `ChartCard` on the per-agent Overview with
`ProviderChartCard` (the global Overview's component), grouped **by provider**,
plus Seb's **provider multiselect** filter. Provider-only — no "By model"
toggle (YAGNI; Seb didn't have one), no "By harness" (meaningless for one
agent).

## Design

### Components (reuse, no new components)

- **`ProviderChartCard`** (`components/ProviderChartCard.tsx`) — unchanged. It
  already has the Cost / Messages / Token usage view toggle (Cost first) and
  renders `MultiAgentTokenChart` for whatever series it's given. Feed it
  provider-keyed series and it draws one line per provider.
- **Provider multiselect** — Seb's header control: an "All providers (N) ▾"
  dropdown with *Select all* / *Unselect all* and per-provider rows (color
  swatch + display name + toggle), selection persisted in `sessionStorage` per
  agent. Reuses the existing `agent-filter-select` CSS classes.

### Header layout

Page header right side: `[ provider multiselect ] [ Last 30 days ]`. The range
`Select` stays on the right (the cosmetic "range on the right" move folds in
here). The simple `ChartCard`'s old header (range-only) is replaced.

### Data flow (mirrors global, scoped to the agent)

Three resources keyed on `(agentName, range)`:
- `getPerProviderTimeseries(agentName, range)` — tokens. **exists**
- `getPerProviderMessageTimeseries(agentName, range)` — messages. **exists**
- `getPerProviderCostTimeseries(agentName, range)` — cost. **MISSING from the
  frontend API client; add it.** Backend endpoint
  `GET /api/v1/overview/per-provider-cost-timeseries` (takes `agent_name`)
  already exists (`overview.controller.ts`). Including cost is what makes the
  page match global (Seb's version omitted cost).

Each returns `{ agents: string[]; timeseries: Array<Record<string, number |
string>> }` where `agents` is the list of provider series keys. Custom-provider
keys already arrive resolved to display names (PR #2197 `PROVIDER_SERIES_KEY_EXPR`,
in this stack's base).

The page filters series to the selected providers (drop unselected columns from
each timeseries row + the `agents` array) and builds a `providerColorMap` from
the existing `AGENT_COLORS` palette (`MultiAgentTokenChart.tsx`), assigned over
the full provider list so colors are stable as the filter changes.

Summary stat values (the Cost/Messages/Tokens numbers above the chart) keep
coming from the existing `/overview` endpoint response (`data().summary`).

### Provider display names

The series keys from the backend are already display-ready (built-in provider
names + resolved custom names). The multiselect labels reuse the same keys, so
no extra resolution is needed beyond what the timeseries returns. The full
provider set = union of `agents` arrays across the three timeseries (so a
provider that has cost but no tokens still appears).

### What does NOT change

- `ChartCard` component stays (still used by `GlobalOverview` and
  `ConnectionDetail`). The earlier cosmetic ChartCard stat reorder is dropped —
  moot now that the agent page uses `ProviderChartCard` (already Cost-first).
- Recent Messages, Cost-by-model, setup modal, feedback, range smart-cascade —
  all unchanged.
- Backend — no change (endpoints already exist; only the frontend API client
  gains one function).

## Testing

- `services/api/analytics.test.ts`: `getPerProviderCostTimeseries` forwards
  `agent_name` + `range` to `/overview/per-provider-cost-timeseries`.
- `Overview.test.tsx`: renders `ProviderChartCard` with provider series;
  provider multiselect shows the providers, Select all / Unselect all toggles
  the rendered series; range select present on the right; switching the
  Cost/Messages/Tokens view renders the matching chart. Mock the three
  per-provider timeseries API calls.
- Full vitest + `tsc` clean, 100% patch coverage, one changeset.

## Out of scope

- A "By model" breakdown toggle.
- Any backend change.
- Touching the global Overview or Connection detail.
