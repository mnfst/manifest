# Auto-fix (self-healing requests) — POC specification

**Status:** Backend + frontend implemented, green, verified live · **Last updated:** 2026-07-01

> **⚠️ This spec describes the original aspirational design and has diverged from
> what shipped. Where they disagree, the code is the source of truth.** Known
> divergences:
>
> - **No multi-attempt loop, no budget.** Healing is a **single attempt**
>   (`runHealOnce` — one heal, one reforward). There is no retry budget, so
>   `autofix_max_attempts`, the `maxAttempts` endpoint field, and the
>   `AUTOFIX_DEFAULT_MAX_ATTEMPTS` env var referenced below **do not exist**.
> - **`agents.autofix_enabled` is nullable** (`boolean | null`, not
>   `default: false`). `NULL` inherits the deployment-mode default (ON in cloud,
>   OFF in self-hosted); an explicit `true`/`false` wins.
> - **Production default client is `NoopHealingClient`** (inert), not the mock —
>   the mock runs only in dev/test. See §4.
> - **The current request/provider-attempt model records the logical outcome in
>   nullable `requests.autofix_status`** and the Phoenix response in
>   `provider_attempts.autofix_decision`. The legacy `agent_messages` view exposes
>   that decision as `autofix_phoenix` for old replicas during rolling deploys.
> - A per-**tenant** early-access gate (`AUTOFIX_ROLLOUT` + `autofix_access_granted_at`
>   / `autofix_waitlist_at`) sits above the per-agent toggle.

> **Implementation status.** Full stack built against the real **Phoenix**
> contract (§4) and passing: backend unit suite green (6900 tests), frontend suite
> green (3877 tests), every new `routing/autofix/*` file + the new UI at 100%
> coverage on changed lines. The healing client defaults to an in-process mock
> (implements the MVP `max_tokens` rename) until `AUTOFIX_HEALING_URL` points at a
> real Phoenix.
>
> **Verified live** (`/serve`, cloud mode): migrations applied, the Routing-page
> Auto-fix toggle persists to the DB, and the real
> `AutofixService` + mock Phoenix heal the MVP `max_tokens` case end-to-end
> (400 → `rename_param` → resend `max_output_tokens` → 200 healed, chain recorded).
>
> **Not yet:** backend e2e (needs Postgres); a live *HTTP* heal needs a provider
> that actually rejects `max_tokens` (real OpenAI Responses key, or a localhost
> mock provider in self-hosted mode). Nothing committed.

> Manifest intercepts a request that failed with a *repairable* error, ships the
> failed request + full provider response to an external **healing service**, gets a
> patched request back, and re-sends it **once** — **before**
> the normal fallback chain runs. The attempt is recorded on the
> message so you can see the first error, every request Auto-fix sent, what changed,
> and the final result.

This is a **proof of concept**. The goal is to stand the loop up end-to-end against
a mock (then the real healing service) and see what comes out of it — not to ship a
hardened feature. Decisions favour the smallest contained change over generality.

---

## 1. What already exists (important)

"Auto-fix" is **already a named, marketed feature** in this repo — but only as a
*waitlist shell*. The engine described here does not exist yet.

| Surface | File | What it is |
|---|---|---|
| Waitlist API | `packages/backend/src/waitlist/waitlist.controller.ts` | `GET/POST /api/v1/waitlist/autofix` — join / check status |
| Tenant column | `packages/backend/src/entities/tenant.entity.ts:43` | `autofix_waitlist_at` timestamp |
| Modal | `packages/frontend/src/components/AutofixModal.tsx` | "Early Access" modal, CTAs: Book a demo / Claim my spot |
| Sidebar card | `packages/frontend/src/components/Sidebar.tsx` | `.sidebar-autofix` "Get early access" promo |

The marketing copy is the product promise we're now building the engine for:

> **"Auto-fix repairs failing requests before they reach the model"**
> Real-time fix · Zero downtime · Observability · Notifications
> — <https://manifest.build/autofix/>

**Naming:** display name is **"Auto-fix"**; backend prefix is `autofix_` (matches
`autofix_waitlist_at`). The waitlist shell stays as-is and is independent of the
per-agent toggle below (POC is **open to all** — see §2).

---

## 2. Scope (locked for the POC)

| Decision | Choice | Rationale |
|---|---|---|
| **Streaming** | Non-streaming **+** streaming requests that fail *before the first byte* | A repairable 4xx returns a non-200 status inside `proxyRequest()`, before the controller streams anything — healing is transparent. Mid-stream is out of scope. |
| **Which errors** | **Request-side 4xx only** (`400`, `404`, `422` by default) | Malformed params, wrong format, unknown model. Explicitly **not** `401/403` (auth), `429` (rate limit), `408` (timeout), or `5xx` (provider availability — owned by fallback). |
| **Order vs. fallback** | **Auto-fix runs FIRST, fallback is the safety net** | Healing a fixable 400 beats spraying the same broken body across every fallback provider. Only if healing is exhausted/unfixable does the existing fallback chain run. |
| **Budget** | **Per-agent**, default **3**, next to the toggle on the Routing page | One entity (`agents`), one UI location. |
| **Availability** | **Open to all** (cloud + self-hosted), no entitlement gate | Simplest for the POC; revisit gating later. |
| **Healing contract** | **Simple, self-authored** (§4): full request + full response in, patched request out | Real repo's OpenAPI isn't available yet; we build to a stable internal port + mock and reconcile the HTTP adapter later. |
| **Recording** | **One row per client request + full `autofix_chain` JSONB** capturing every attempt, each tagged `original` vs `autofix` | "Track all requests, see the full chain, know which Auto-fix sent" — without distorting message-count KPIs. |

**Why 4xx-only is safe to retry:** a 4xx means the provider *rejected* the request —
no tokens generated, no tool calls executed, no side effects. Re-sending a patched
version is idempotent-safe. (This is why we do **not** heal 200-but-bad responses.)

---

## 3. Flow

```
agent ──► POST /v1/chat/completions (or /messages, /responses)
            │
            ▼
   proxyService.proxyRequest(body)          ← Auto-fix lives HERE, not the controller
            │
   route    = resolve(body)
   forward  = forwardToPrimary(route, body) ──► provider
            │
   ┌───────────────── AUTO-FIX LOOP (before fallback) ──────────────────┐
   │ while !forward.ok AND autofix_enabled                               │
   │       AND status ∈ repairable(4xx) AND attempt < autofix_max_attempts:
   │   errorBody = await forward.response.text()   // full response      │
   │   chain.push({ origin, attempt, request: body, status, errorBody }) │
   │   heal = healingClient.heal({ request: body, response, context, chain })
   │   if heal.outcome == 'unfixable': break                             │
   │   body   = heal.patched_request                                     │
   │   route  = resolve(body)          // model may have changed         │
   │   forward = forwardToPrimary(route, body) ──► provider              │
   │   attempt++                                                         │
   └────────────────────────────────────────────────────────────────────┘
            │
   still !forward.ok AND shouldTriggerFallback(status)?
            │   yes → existing FALLBACK CHAIN (unchanged safety net)
            ▼
   return { forward, meta, autofix_chain }
            │
            ▼
   controller: ok? → stream / json to client, recordSuccess(+chain)
              !ok? → handleProviderError(+chain), return last error
```

**Integration point:** inside `packages/backend/src/routing/proxy/proxy.service.ts`,
right after the **primary** forward and **before** the `shouldTriggerFallback(...)`
check (~line 315). The controller (`proxy.controller.ts:187`) barely changes — it
just receives an `autofix_chain` alongside `forward`/`meta` and threads it into
recording. Because `proxyRequest()` returns before the controller streams, we're
always in the "pre-first-byte" zone — the streaming-safety constraint is automatic.

**Re-send mechanism:** each heal attempt re-resolves the route for the patched body
(so an unknown-model → known-model fix actually changes provider/model) and forwards
to the **primary** only. The fallback chain is deliberately *not* run per-attempt —
it's the single safety net after Auto-fix gives up.

---

## 4. The healing service (external, mocked first)

Manifest talks to the healing service through a **stable internal port** so proxy
code never depends on the wire format:

```ts
interface HealingClient {
  heal(input: HealRequest): Promise<HealResult>;
}
```

Three implementations, selected by config at boot:

- **`HttpHealingClient`** — used whenever `AUTOFIX_HEALING_URL` is set. POSTs to that
  URL, maps response → `HealResult`.
- **`NoopHealingClient`** — the **production default when `AUTOFIX_HEALING_URL` is
  unset**. Inert: never heals, never mutates traffic. Keeps the dev mock off real
  traffic when no healer is wired.
- **`MockHealingClient`** — the **dev/test default when `AUTOFIX_HEALING_URL` is
  unset**. In-process, deterministic (implements the MVP `max_tokens` rename) so the
  heal → resend → confirm flow can be exercised without an external Phoenix.

### Phoenix contract (implemented)

The real service is **Phoenix** (`mnfst/phoenix`). Two endpoints, mapped 1:1 in
`packages/backend/src/routing/autofix/phoenix.types.ts` (that + the OpenAPI draft
are the source of truth):

- **`POST /api/heal`** — send the full failed request + the normalised provider
  error; get back a decision discriminated on `status`:
  `patched` / `unverified` (both carry a `healedBody` to resend, plus a
  `healAttemptId`; `patched` = the issue is already verified, `unverified` = a
  fresh patch) · `resolving` (Phoenix is authoring a patch; nothing to resend
  this round) · `no_patch`.
- **`PATCH /api/heal-attempts/{healAttemptId}`** — after resending the `healedBody`,
  report the retry outcome `{ retryStatusCode, error? }` (`error` required on ≥400).
  Phoenix decides succeeded/failed itself (cleared target vs. same error recurring) —
  we don't send a verdict. Manifest fires this **fire-and-forget** so it never
  delays the client.

`provider` + `api` (`chat_completions|responses|messages` — exactly Manifest's
`apiMode`) are the fingerprint dimensions. `traceId` (**required**) is the stable
per-logical-request id — Manifest reuses the message-link group id and sends it as
Phoenix's `traceId` so Phoenix can group the heal-attempt timeline across retries.
The provider error is normalised to `{ message, type, param, code }` by
`provider-error-normalizer.ts`.

`POST /api/heal` request (Manifest → Phoenix):

```jsonc
{
  "traceId": "…",                          // REQUIRED — stable per logical request (group id)
  "provider": "openai",
  "api": "responses",                      // | "chat_completions" | "messages"
  "url": "https://api.openai.com/v1/responses",   // optional, must be an absolute URL
  "request":  { /* FULL failed request body */ },
  "response": { "statusCode": 400, "error": { "message": "…", "type": "…", "param": "…", "code": "…" } }
}
```

`POST /api/heal` response (Phoenix → Manifest), discriminated on `status`:

```jsonc
{
  "status": "patched",                     // | unverified | resolving | no_patch
  "issueId": "…",
  "patchId": "…",                          // nullable
  "healAttemptId": "…",                    // present on patched / unverified
  "operations": [{ "type": "rename_param", "from": "max_tokens", "to": "max_output_tokens" }],
  "healedBody": { /* FULL body to resend */ },
  "retryAfterMs": 2000                     // present only on resolving
}
```

`PATCH /api/heal-attempts/{healAttemptId}` — report the retry outcome:

```jsonc
{ "retryStatusCode": 200 }                          // cleared → Phoenix marks succeeded
{ "retryStatusCode": 400, "error": { "code": "…" } } // error present & required on ≥400
```

`no_patch` / `resolving` let the service stop the loop early instead of burning the
whole budget.

---

## 5. Data model changes

### 5.1 `agents` (toggle) — mirrors `complexity_routing_enabled`

```ts
// Nullable: NULL inherits the mode default (ON in cloud, OFF in self-hosted);
// an explicit true/false wins. There is no max-attempts column — healing is a
// single attempt.
@Column('boolean', { nullable: true }) autofix_enabled!: boolean | null;
```

### 5.2 `agent_messages` — two linked rows per healed request

> **Revised per user feedback (2026-07-01).** A healed request is recorded as **two
> rows in the log**, not one: the **failed original** and the **successful retry**,
> so each real upstream request is its own line. They're linked by a shared
> `autofix_group_id` (in the DB) and by a clickable link in the UI.

```ts
@Column('boolean', { default: false }) autofix_applied!: boolean;       // part of an Auto-fix flow?
@Column('varchar', { nullable: true })  autofix_group_id!: string | null; // links original ↔ retry (indexed)
@Column('varchar', { nullable: true })  autofix_role!: string | null;     // 'original' | 'retry'
@Column('jsonb',   { nullable: true })  autofix_operations!: object | null; // the Phoenix edits that fixed it
@Column('jsonb',   { nullable: true })  autofix_decision!: object | null;   // Phoenix decision + ids
```

The parent `requests` row has nullable `autofix_status`; non-null values are
`no_patch`, `resolving`, `retry_succeeded`, `retry_failed`, or `service_error`.

| Row | `status` | `autofix_role` | Notes |
|---|---|---|---|
| Failed original | **`auto_fixed`** (new, orange) | `original` | carries the error + `autofix_operations`; 0 tokens; timestamped ~1s before the retry so they sort adjacently |
| Successful retry | `ok` | `retry` | the real completion (tokens/cost) |

- **KPI consistency:** `auto_fixed` is added to `ERROR_MESSAGE_STATUSES`, so the
  failed original is **excluded** from message-count KPIs (the retry `ok` row is the
  single counted success — no double-counting) and is included in the Messages-log
  "errors"/"failed" filter. The Messages-log *total* (unfiltered) shows both rows —
  the two lines the user asked for.
- **The link.** `autofix_group_id` is the DB link. The message-detail endpoint
  resolves the paired row (`autofix_sibling { id, role, status }`) so the UI renders
  "→ View the successful auto-fix retry" / "← View the original failed request",
  which scrolls+highlights the sibling (mirrors `scrollToFallbackSuccess`).

Recorder: `recordSuccessMessage` tags the retry row (`autofixColumns(autofix,'retry')`);
a new `recordAutofixOriginals()` inserts the failed original row(s), called from
`recordSuccess` when `outcome==='healed'`.

Migrations: two `ALTER TABLE` migrations (agents, agent_messages, + a
`(tenant_id, autofix_group_id)` index) with fresh unique timestamps, registered in
`data-source-definitions.ts`. No new entities.

---

## 6. Backend components

| Component | Location | Responsibility |
|---|---|---|
| `AutofixModule` | `packages/backend/src/routing/autofix/` | Wires client + config |
| `HealingClient` port + `Mock`/`Http` impls | same | Talk to the healing service |
| `AutofixService` | same | The loop: repairable check, budget, re-route, chain building |
| Repairable classifier | reuse `proxy-error-sanitizer.ts` (`classifyProviderError`) + status allow-list | Decide if an error is healable |
| Loop hook | `proxy.service.ts` (~L315, before `shouldTriggerFallback`) | Run `AutofixService` on the primary forward |
| Recorder changes | `proxy-message-recorder.ts` | Accept optional `autofix_chain` on success/error recording |
| Toggle+budget endpoints | `routing/tier.controller.ts` (or new `autofix.controller.ts`) | `GET`/`PATCH /api/v1/routing/:agentName/autofix` |

Endpoint shape (mirrors the complexity toggle; PATCH since there are two fields):

```
GET   /api/v1/routing/:agentName/autofix   → { enabled, maxAttempts }
PATCH /api/v1/routing/:agentName/autofix   { enabled?, maxAttempts? } → { enabled, maxAttempts }
```

Scope via `@TenantCtx()` + `resolveAgentService.resolve(tenantId, agentName)`, and
invalidate the agent cache on write (same as `toggleComplexity`).

---

## 7. Frontend

- **Routing page** — add an "Auto-fix" control next to "Route by complexity" in
  `RoutingDefaultTierSection.tsx` (same `routing-switch` styling): toggle +, when on, a
  small number input for max attempts. New api fns `getAutofix()` / `updateAutofix()`
  in `services/api/routing.ts`.
- **Message detail** (`MessageDetails.tsx`) — when `autofix_applied`, render an
  **"Auto-fix"** section: outcome badge, then the `autofix_chain` as a visible timeline
  — each attempt showing origin (agent vs Auto-fix), the request that was sent, the
  status/response, and what changed (`patch_summary` / `changed_fields`).
- **Message list** — small "Auto-fixed" badge on healed rows. If shown in the table,
  add the scalar columns to `selectMessageRowColumns()` + `MESSAGE_ROW_SELECT_ALIASES`
  + `MessageRow` (keep the shared projection contract intact — CLAUDE.md).

---

## 8. Configuration (env)

| Var | Default | Purpose |
|---|---|---|
| `AUTOFIX_HEALING_URL` | *(unset → mock)* | External healing service endpoint |
| `AUTOFIX_HEALING_API_KEY` | *(unset)* | Sent as `x-api-key` to Phoenix (Phoenix fails closed in production without a key; omit for a keyless dev/test Phoenix) |
| `AUTOFIX_DEFAULT_MAX_ATTEMPTS` | `3` | Fallback budget when an agent has none set |
| `AUTOFIX_TIMEOUT_MS` | `10000` | Per heal round-trip timeout |
| `AUTOFIX_REPAIRABLE_STATUSES` | `400,404,422` | Allow-list of healable statuses |
| `AUTOFIX_GLOBAL_ENABLED` | `true` | Kill switch independent of per-agent toggles |

---

## 9. Explicitly out of scope (POC)

- Mid-stream healing (after bytes are sent).
- Healing `401/403/429/408/5xx` / transport errors (owned by auth refresh, rate-limit
  cooldown, model fallback).
- Healing 200-but-semantically-bad responses.
- Hardened scrubbing/PII controls on request/response bodies (basic scrub only — §11).
- Pre-emptive fixing *before* the first attempt (the marketing "before they reach the
  model" — POC is reactive).
- Entitlement/rollout gating beyond the existing waitlist (POC is open to all).

---

## 10. Open questions / decisions still needed

1. **Chain modeling — RESOLVED (2026-07-01):** the user chose **one row per attempt**
   (failed original + successful retry as sibling log rows, linked by `autofix_group_id`
   + a UI link), matching the `recordFailedFallbacks` pattern. Implemented in §5.2.
2. **Fallback body after Auto-fix fails.** When healing is exhausted and the safety-net
   fallback chain runs, forward the **original** body or the **last patched** body?
   *My lean:* original (fallbacks are a separate axis; patched guesses were for the
   primary). Minor.
3. **Real healing schema** — no OpenAPI yet; building to §4. When it lands, reconcile
   the `HttpHealingClient` adapter. Not a blocker for the POC.

*(Resolved from discussion: streaming = non-stream + pre-first-byte · errors = 4xx only
· Auto-fix before fallback · per-agent budget default 3 · open to all · full req+resp to
the healer · track the full chain and label Auto-fix requests.)*

---

## 11. Risks & considerations

- **Data footprint / trust boundary.** We now (a) send full request + response bodies
  to an external service and (b) store them on Auto-fix messages — both new for
  Manifest. Fine against an in-process/same-infra mock; before the real external
  service, this needs the care of the error-cluster CMS boundary (scrub + consent +
  retention). Scope storage to Auto-fix messages only; scrub + truncate. Flagging, not
  hardening, for the POC.
- **Latency.** Worst case ≈ `budget × (heal round-trip + provider re-send)` before
  success/failure. Transparent for non-streaming but slow; bounded by
  `AUTOFIX_TIMEOUT_MS` and the budget.
- **Loop safety.** Budget is a hard cap; `unfixable` short-circuits; only runs while
  no bytes have been sent. No unbounded retry.
- **Observability parity.** The message + its `autofix_chain` is the single source of
  truth for "how it went" — matches the "Observability" pillar the Auto-fix modal
  already advertises.

---

## 12. Rough build order

1. Entities + 2 migrations (`agents`, `agent_messages`) + `helpers.ts` sync.
2. `AutofixModule` + `HealingClient` port + `MockHealingClient` + `AutofixService`
   (loop, repairable classifier, re-route, chain).
3. Hook into `proxy.service.ts` before the fallback trigger; thread `autofix_chain`
   through `proxyRequest` → controller → recorder.
4. Toggle + budget endpoints + Routing UI control.
5. Message-detail "Auto-fix" timeline (+ optional list badge).
6. `HttpHealingClient` once the real schema lands.
7. Tests (100% line coverage — CLAUDE.md): loop paths (healed / exhausted / unfixable /
   disabled / non-repairable / re-route-on-model-change), before-fallback ordering,
   classifier, endpoints, UI, recorder.
```
