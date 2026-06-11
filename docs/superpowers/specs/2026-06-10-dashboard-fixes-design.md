# Dashboard fixes: agent-filter redirect, local-in-cloud gating, savings removal

**Date:** 2026-06-10
**Status:** Approved
**Shape:** Three stacked PRs on top of `fix/custom-provider-display` (#2197):
`fix/agent-messages-filter-redirect` → `fix/hide-local-in-cloud` → `fix/remove-subscription-savings`.

## PR A — Agent Messages "View more" applies the agent filter

**Problem.** The agent Overview's Recent Messages "View more" link goes to
`/harnesses/:agentName/messages`, which `AgentMessagesRedirect`
(`packages/frontend/src/pages/AgentMessagesRedirect.tsx`) rewrites to plain
`/messages` — the agent is dropped and the global log shows all harnesses.

**Fix.** Carry the agent as a query param:

- `AgentMessagesRedirect` navigates to
  `/messages?agent=<encodeURIComponent(params.agentName)>`.
- `MessageLog.tsx` seeds the `agentFilter` signal from the `agent` search
  param (global mode only — when `params.agentName` is set the route itself
  scopes the query). The harness dropdown arrives pre-selected; changing or
  clearing it behaves exactly as today. Deep-linkable, refresh-safe; no
  router state.

## PR B — Local tab and models hidden in cloud

Cloud (hosted) installs cannot reach a user's localhost, so local providers
(Ollama, LM Studio) are meaningless there. Gate every "local" surface behind
the existing `checkIsSelfHosted()` (`services/setup-status.ts`), the same
pattern `MessageLog` uses for feedback columns. In **cloud**:

- **Sidebar** (`components/Sidebar.tsx:108`): the Local nav entry is not
  rendered.
- **Route**: `/providers/local` redirects to `/providers/byok`.
- **GlobalOverview**: the Local stat card is not rendered; the stats grid
  drops from `repeat(4, 1fr)` to `repeat(3, 1fr)`.
- **Provider-select modal / pickers**: `localOnly` provider tiles are hidden
  so local providers cannot be connected; with no local connections, local
  models never reach model pickers.

Self-hosted behavior is unchanged. No backend change (the backend already
exposes `isSelfHosted` via setup status; cloud users simply have no UI path
to create local connections — defense-in-depth API rejection is out of
scope).

## PR C — Remove Subscription Savings (full removal)

**Frontend — delete:** `components/SavingsCard.tsx`,
`components/SavingsExplainer.tsx`, `components/SavingsChart.tsx`,
`styles/savings.css`; the `'savings'` member of `ChartCard`'s `ActiveView`
union plus its tab and render branches; the savings signals
(`activeView`'s savings arm, `savedCost`, `savedPct`, `savingsTimeseries`),
imports, mounts, and ChartCard props in `pages/Overview.tsx`;
`getSavings`/`getSavingsTimeseries` in `services/api/analytics.ts`; all
their tests.

**Backend — delete:** `analytics/controllers/savings.controller.ts`
(`GET /api/v1/savings`, `/savings/timeseries`, `/savings/baseline-candidates`),
`analytics/services/savings-query.service.ts`,
`common/dto/savings-query.dto.ts`, their spec files, and module
registrations.

**Kept:** `common/utils/baseline-cost.ts`, the
`agent_messages.baseline_cost_usd` column, and its ingest-side precompute —
no migration, nothing breaks. Exception: if inspection shows savings was
baseline-cost's only consumer (no ingest-side usage), delete it too. Removal
of the column is a separate cleanup if ever wanted.

## Testing (each PR)

Unit tests pinning the new behavior (redirect preserves the agent; local
surfaces hidden in cloud and visible self-hosted; no savings references
remain), full jest/vitest suites green, `tsc --noEmit` clean, 100% patch
coverage, one changeset per PR.
