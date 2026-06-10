# Custom provider display: resolve names in the backend, render like built-in providers

**Date:** 2026-06-10
**Branch:** `fix/custom-provider-display` (based on `feat/analytics-ui`)
**Status:** Approved

## Problem

Messages store the model as `custom:<uuid>/<model>` and the provider as
`custom:<uuid>`. The dashboard resolves the custom provider's display name by
fetching the custom-providers list in the frontend and matching the uuid. This
breaks in three ways:

1. **Global Messages page** (`MessageLog.tsx`): the `customProviders` resource
   is keyed on `params.agentName`. In global mode there is no agent name, the
   resource never fetches, and every custom row falls back to the placeholder
   name `Custom`.
2. **GlobalOverview** (`GlobalOverview.tsx`): works around the agent-scoped
   endpoint by fetching custom providers via the *first agent's* name — a
   fragile hack (empty agent list → no names).
3. **Hardcoded literal** at `message-table-cells.tsx` (ModelCell) and
   `CostByModelTable.tsx`: the display string is
   `` `custom:${name ?? 'Custom'}/${model}` `` — so even when the lookup
   succeeds the UI shows `custom:MyLLM/openai/gpt-oss-120b`.

The name resolution is duplicated in three pages (`Overview.tsx`,
`MessageLog.tsx`, `GlobalOverview.tsx`) and threaded as a prop through
`MessageTable` — every new view must remember to wire it, which is exactly how
the global views broke.

Note: `stripCustomPrefix()` (`routing-utils.ts`) already parses
`custom:<uuid>/` unambiguously — uuids contain no slash, so model ids with
slashes (`openai/gpt-oss-120b`) survive intact. No "split at last slash"
heuristics are needed; the bug is purely name resolution + display formatting.

## Decision

**Resolve the custom provider name at the backend query layer** and render
custom rows exactly like built-in provider rows. (Chosen over a
frontend-global lookup store, which keeps the wire-it-everywhere failure mode,
and over write-time denormalization, which goes stale on rename.)

## Design

### 1. Backend — resolve names in analytics responses

- `selectMessageRowColumns()` in
  `packages/backend/src/analytics/services/query-helpers.ts` gains a
  `LEFT JOIN custom_providers cp ON at.provider = 'custom:' || cp.id::text`
  and a new alias `custom_provider_name` (`cp.name`). NULL for built-in
  providers and for deleted custom providers. Both call sites (Messages log
  `getMessages()`, Overview Recent Messages `getRecentActivity()`) inherit the
  column via the shared-projection contract. The join is added by the helper
  (or a sibling helper called alongside it) so call sites cannot forget it.
- `getCostByModel()` in `timeseries-queries.service.ts`: same join; rows carry
  `custom_provider_name`.
- Per-provider timeseries (token + message variants, agent-scoped and global):
  series keys of the form `custom:<uuid>` are resolved to the provider's name
  in the pivoted output, so chart legends arrive pre-resolved. Unresolvable
  uuids (deleted provider) keep a stable fallback label derived from the model
  (never the literal `custom:<uuid>`).
- The pinned alias test `query-helpers.spec.ts` is updated to include
  `custom_provider_name`.

### 2. Frontend — render custom rows like built-in rows

- `ModelCell` (`message-table-cells.tsx`): text is just
  `stripCustomPrefix(item.model)`; the icon is the custom provider logo or
  letter avatar with the provider name in the tooltip — identical structure to
  built-in rows. The `` `custom:${…}` `` literal is deleted.
- `CostByModelTable.tsx`: same treatment, reads the backend-resolved name from
  the row.
- Remove the `customProviderName` prop chain entirely: the three duplicated
  lookup implementations (`Overview.tsx`, `MessageLog.tsx`,
  `GlobalOverview.tsx` incl. the first-agent hack and `resolveCustomName`) and
  the prop threading through `MessageTable`. Components read
  `item.custom_provider_name`.
- Routing config UI (`ModelPickerModal`, `FallbackList`) is untouched — it has
  agent context and already displays correctly.

### 3. The generic display rule

Applies everywhere (messages, recent messages, overviews, graphs, cost
tables), agent-scoped or global:

- **Text** = raw model id (`stripCustomPrefix(model)`), always — same as
  built-in rows showing `gpt-4o`, not `OpenAI/gpt-4o`.
- **Provider identity** = icon + tooltip from the backend-resolved name.
- **Deleted provider fallback**: NULL name → letter avatar from the model's
  first character; no crash, no `Custom` placeholder text.
- The word "custom" never appears in any rendered string.

### 4. Tests

- Backend: updated pinned alias spec; unit/e2e asserting
  `custom_provider_name` resolves for a live custom provider and is NULL for a
  deleted one; timeseries/cost-by-model assertions for resolved series keys.
- Frontend: vitest asserting a custom row renders without the `custom:`
  literal, with the raw model text and resolved tooltip; fallback rendering
  when `custom_provider_name` is null.
- 100% patch coverage per repo policy.

### 5. PR placement

New PR, branch `fix/custom-provider-display`, base **`feat/analytics-ui`**
(deepest real PR tip on the main fork; the integration branch #2174 is
preview-only/do-not-merge so it cannot be the base). Base branch must exist on
`upstream` (it does — the capstone targets it).

## Out of scope

- Provider modal changes (tracked separately, spec TBD).
- Routing config UI changes.
- Renaming/migrating the agent-scoped `GET :agentName/custom-providers`
  endpoint — it becomes unused by these views but removal is a separate
  cleanup.
