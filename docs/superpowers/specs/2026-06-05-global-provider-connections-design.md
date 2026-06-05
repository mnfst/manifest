# Global Provider Connections — Design (PR 1)

- **Date:** 2026-06-05
- **Status:** Draft — awaiting approval
- **Author:** Guillaume (with Claude)
- **Slice of:** Seb's PR #2061 (`coal-borogovia`, "subscription maximization pivot"), decomposed into small PRs.
- **Target branch:** new branch off `upstream/main` (fresh worktree). The existing `feat/global-provider-connections` / PR #2131 worktree is abandoned — it reimplemented the connection layer with a `scope` flag threaded through every OAuth controller and kept breaking. This design replaces that approach.

---

## 1. Motivation

Today every provider connection is **agent-scoped**: a row in `user_providers` is keyed to one `agent_id`, and the whole connect flow (`POST /api/v1/routing/:agentName/providers`, every OAuth controller, `provider.service`) resolves an agent first. The same subscription/API key connected to three agents is three independent rows.

Seb's pivot reframes providers as a **user-level resource shared across agents**. This PR ships the first, foundational slice of that: a **global (user-level) connection pool**. Existing agent connections are migrated up into it. Every agent then draws from the shared pool.

## 2. Goals

1. Introduce **global provider connections**: `user_providers` rows with `agent_id IS NULL`, owned by the user, managed in a dedicated sidebar area.
2. **Migrate** existing agent-scoped connections into the global pool — **moving** them (one row each, single credential), relabeled by source agent to disambiguate.
3. Reuse the **existing, proven connect components and OAuth flows** (no `scope`-flag rewrite). Connection mechanics are unchanged; only the *target* of a connection becomes "the user" instead of "an agent."
4. Make connected global providers **usable by all of the user's agents** at routing time.
5. Keep the migration **non-destructive and reversible**.

## 3. Non-goals (explicitly deferred — NOT in this PR)

- **Per-agent provider scoping / access control** (the `agent_provider_access` junction and the agent "Providers" ON/OFF toggle). **This PR ships without per-agent scoping — every agent can use every global provider.** This is the accepted trade-off; the junction is a *possible* future PR but is **not committed and not part of this work**.
- Provider analytics endpoints, usage charts, sparklines.
- Rate-limit snapshot capture / display.
- Global Playground.
- Custom-provider lifting to user level.
- Disable-impact preview.

## 4. Accepted consequence

Because connections are **moved** to a single shared pool and the access junction is **not** added, **every agent uses every connected provider**. There is no per-agent on/off in this PR. This is intentional and approved.

## 5. Data model

Single schema change:

```
user_providers.agent_id : varchar NOT NULL  →  varchar NULL
```

- `agent_id IS NULL`  ⇒ **global** connection (the only kind created going forward).
- The column is **retained** (not dropped) so the migration is reversible and we keep source-agent context during the transition.
- New user-scoped uniqueness: `UNIQUE (user_id, provider, auth_type, LOWER(label))` (replaces the old agent-scoped unique index).

### Migration `LiftAgentProvidersToGlobal`

Port Seb's `LiftProvidersToUserLevel` relabel logic, **minus** the `agent_provider_access` junction (out of scope). Steps:

1. Drop the old agent-scoped unique index `IDX_user_providers_agent_provider_auth_label`.
2. `ALTER COLUMN agent_id DROP NOT NULL`.
3. **Relabel** rows that would collide on the new user-scoped key, **never deleting** (AES-256-GCM keys with random IV can't be proven equal in SQL, so "duplicates" may hold distinct secrets):
   - `label = 'Default'` → `<agent display name or name>`
   - custom label → `"<custom label> - <agent display name>"`
   - still-colliding → append a deterministic `[<row-id>]` suffix.
4. **Move** rows to global: `UPDATE user_providers SET agent_id = NULL`.
5. Create user-scoped unique index `IDX_user_providers_user_provider_auth_label`.
6. `down()`: restore `agent_id` from the original mapping (kept via a temp table captured in `up()`), drop the user-scoped index, recreate the agent-scoped one.

> **Open item for planning:** Seb captures the agent→provider mapping in the junction. Since we skip the junction, `up()` must stash the original `(id → agent_id)` mapping (temp table or a retained column snapshot) so `down()` can reverse the move. Resolve exact mechanism in the plan.

## 6. Backend

### 6.1 Connection management (reuse Seb's user-scoped controller)
- `GET/POST /api/v1/providers` — list/upsert global connections (port `GlobalProvidersController` shape; user-scoped, no `agentName`).
- `PATCH/PUT/DELETE` for rename / reorder / remove keys, user-scoped.
- `provider.service`: the connection path keys on `userId` with `agent_id = NULL` writes. Reuse the existing upsert/rename/reorder/remove logic; the only change is the scope key (user vs agent), not the mechanics.

### 6.2 OAuth (user-scoped target)
Every subscription OAuth controller (openai, anthropic, gemini, kiro, minimax, xai, copilot device) must accept a **user-scoped** connection target so a subscription can be connected globally. Port Seb's user-scoped versions. **Do not** reintroduce the `#2131` `scope: 'agent' | 'global'` dual-flag — global is the only target now, so the controllers simply key on the authenticated user.

### 6.3 Routing consumption (the one unavoidable rewire)
Provider reads switch from agent-scoped to the user's global pool:
- `provider.service.getProviders(agentId)` → read the **user's** providers (`user_id = …, agent_id IS NULL`).
- Update the read paths that consume it: proxy provider resolution, tier auto-assign / recalculation, `available-models`. Port Seb's user-scoped versions of these (`user_id`-threaded).
- Routing/tier caches: key by user instead of agent where they hold provider data; invalidate on global connect/disconnect.

> Each agent, when resolving providers, now sees the user's full global pool. No access filtering (deferred).

## 7. Frontend

- **Sidebar:** add the global provider area — Subscriptions / BYOK / Local entries (port `Sidebar` + routes from Seb/#2131: `/providers`, `/providers/subscriptions`, `/providers/byok`, `/providers/local`).
- **Pages:** `GlobalProviders` + `providers/{Subscriptions,Byok,Local}` rendering the category page. Prefer porting **Seb's** working `GlobalProviderCategory` over #2131's (which is the broken 505-line variant) — confirm during planning which is healthier.
- **Connect UI:** reuse existing `ProviderSelectModal`, `ProviderKeyForm`, `OAuthDetailView`, `ProviderDetailView`. Connect calls target the user-scoped endpoints (drop `agentName`); **no `scope` param**.
- **Agent flow:** the per-agent "connect a provider" affordance now points at the **global** connect surface (you connect once, globally). The agent's provider list reflects the shared pool (read-only view of what the agent will use). Exact placement confirmed in planning.

## 8. Reuse strategy (porting source)

Primary source is **Seb's #2061** (`upstream/coal-borogovia`, head `c3dd81b0`) — it's the coherent, working version of this design. We take its user-scoped controller/service/OAuth/routing pieces and its migration relabel logic, and we **drop** everything in §3. We do **not** build on #2131's `scope`-flag implementation.

## 9. Testing

- **Migration:** unit test the relabel/move on fixtures — collisions (two agents, same provider+`Default`), custom labels, distinct keys preserved (count rows before/after; assert no deletions), `down()` restores `agent_id`.
- **Backend:** global connect (API key + at least one OAuth provider) creates `agent_id IS NULL` rows; list returns user pool; rename/reorder/remove user-scoped; routing for an agent resolves the user's global providers.
- **Frontend:** sidebar entries render; category pages list connected providers; connect flow (reusing existing components) succeeds against user-scoped endpoints; **regression**: connecting a provider actually works end-to-end (the failure that motivated the rebuild).
- **Regression guard:** existing agent that had a provider still routes after migration (now via the global pool).

## 10. Risks

- **Credential duplication (avoided):** we **move**, never copy. Copying would put the same rotating OAuth refresh token in two rows and brick accounts on refresh (cf. PR #2113 single-flight fix). Single row per connection eliminates this.
- **OAuth controller blast radius:** every subscription OAuth controller changes. Mitigated by porting Seb's proven user-scoped versions verbatim rather than re-deriving.
- **Routing cache correctness:** switching provider reads to user scope requires matching cache key/invalidation changes; a missed invalidation = stale provider list. Covered by porting Seb's cache split + tests.
- **Migration reversibility without the junction:** `down()` needs the original `agent_id` mapping; must be captured in `up()` (see §5 open item).

## 11. Out of scope / future (not committed)

Per-agent access scoping (junction + toggle), analytics/charts, rate-limits, Playground, custom-provider lifting. **No follow-up PR is promised or planned as part of this work.**
