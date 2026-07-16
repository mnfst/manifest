# Analytics dashboards: concepts and per-page specification

This document is the canonical contract for Manifest analytics terminology and dashboard behavior. Schema, API, analytics, and UI code must use these definitions consistently.

## The two worlds

Manifest analytics live in two distinct worlds. Mixing them produces totals that answer different questions.

**The Request world (agent side).** An agent makes one logical Request to Manifest. Manifest may try several providers to serve it, but the agent sees one outcome. Requests belong to agents and to the global Overview. Recovery is a Request-level concept.

**The Attempt world (provider side).** Every provider call is a Provider Attempt. A Request has zero or more Attempts. Attempts belong to providers, Provider Connections, and models. An Attempt may be triggered by fallback or Auto-fix, but that context does not change its status.

## Glossary

### Manifest Request

One logical request from an agent to Manifest.

- Direction: agent → Manifest
- Database table: `requests`
- Primary key: `requests.id`
- Status: `requests.status`
- A Request ultimately has one caller-visible outcome and may have zero, one, or many Provider Attempts.

A zero-attempt Request is valid when Manifest rejects it before contacting an AI provider.

### Provider Attempt

One request from Manifest to an AI provider while serving a Manifest Request.

- Direction: Manifest → AI provider
- Database table: `provider_attempts`
- Parent Request: `provider_attempts.request_id → requests.id`
- Order within the Request: `provider_attempts.attempt_number`
- Status: `provider_attempts.status`

Every provider call counts as an Attempt, including failed calls, fallback attempts, and Auto-fix retries.

### Status

Requests and Provider Attempts use the same status values:

| Value     | Meaning                                     | UI label |
| --------- | ------------------------------------------- | -------- |
| `pending` | The operation has no terminal outcome yet.  | Pending  |
| `success` | The operation completed successfully.       | Success  |
| `failed`  | The operation completed without succeeding. | Failed   |

`success` and `failed` are terminal. In this document, **completed** means either terminal status; it is not a separate status value.

Manifest creates a Request with `pending` status when it accepts the Request and creates an Attempt with `pending` status when it starts the provider call. Each transitions to one terminal status. Pending records remain internal to the current analytics UI, so this contract does not require a visible UI change.

A successful Request has `requests.status = 'success'`. A successful Attempt has `provider_attempts.status = 'success'`. `requests.status` is authoritative for the caller-visible outcome.

When a Request with at least one Attempt succeeds, its Last Attempt must also be successful. A failed Request may have no Attempt at all, and `requests.status` remains authoritative if a Request-level failure happens outside the provider call.

### Last Attempt

The Last Attempt is the Provider Attempt with the highest `attempt_number` within a Request. Attempt numbers are positive, unique within their Request, and increase in the order Manifest starts provider calls.

Do not derive Attempt order from timestamps. `provider_attempts.timestamp` records the real provider-call start time, and `provider_attempts.duration_ms` records measured elapsed time once the Attempt is terminal. Neither may be fabricated to create an ordering. A zero-attempt Request has no Last Attempt.

### Superseded Attempt

A Superseded Attempt is a failed Provider Attempt after which Manifest continued the same Request with another Attempt.

It keeps `provider_attempts.status = 'failed'` and has `provider_attempts.superseded = true`. It counts in Attempt metrics, but it does not determine the Request outcome.

### Recovered Request

A Recovered Request is a successful Request after Manifest continued beyond a failed Attempt by applying Auto-fix or fallback.

Recovery belongs to Requests only. Providers, Provider Connections, models, and Attempts are never “recovered.” Applying a recovery method is not enough: the Request must ultimately succeed.

Each Request belongs to exactly one outcome category, evaluated in this order:

1. **Pending:** `requests.status = 'pending'`.
2. **Failed:** `requests.status = 'failed'`.
3. **Recovered by Auto-fix:** `requests.status = 'success'` and `requests.autofix_status = 'retry_succeeded'`.
4. **Recovered by fallback:** `requests.status = 'success'`, the Last Attempt has a non-null `provider_attempts.fallback_from_model`, and the Request was not recovered by Auto-fix.
5. **Success:** any other Request with `requests.status = 'success'`.

The ordering makes Auto-fix the tie-breaker if inconsistent or historical data satisfies both recovery criteria. If an Auto-fix retry fails and a fallback succeeds, the Request is recovered by fallback because `requests.autofix_status` is not `retry_succeeded`.

### Applied method

An applied method is a recovery method Manifest tried during a Request, whether or not it succeeded. Auto-fix and fallback fields on Attempts describe what happened in the chain; they do not replace the Request status or recovery category.

### AI Provider and Provider Connection

An **AI Provider** is an upstream platform such as OpenAI or Anthropic. Each Attempt records its Provider in `provider_attempts.provider`.

A **Provider Connection** is a tenant's configured connection to one AI Provider. It lives in `tenant_providers`; `tenant_providers.provider` identifies its Provider and `tenant_providers.auth_type` identifies its authentication method. A Provider may have several Connections, while each Connection belongs to one Provider.

An Attempt identifies the Connection it used through `provider_attempts.tenant_provider_id → tenant_providers.id`. `provider_attempts.auth_type` and `provider_attempts.provider_key_label` are historical display snapshots, not Connection identity. Authentication credentials such as API keys or access tokens remain encrypted Connection-level data and must never be copied onto Attempts.

“Connection Attempts” are Provider Attempts filtered by `tenant_provider_id`, not a separate event type or table. The reference may be null for legacy data, local providers, or paths where Manifest could not identify a Connection, so Provider totals may exceed the sum of their Connection totals.

## Request and Attempt data

| Data                            | Canonical source                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Request identity and scope      | `requests.id`, `requests.tenant_id`, `requests.agent_id`                                        |
| Caller-visible status           | `requests.status` and the `requests.error_*` columns                                            |
| End-to-end duration             | `requests.duration_ms`                                                                          |
| Model requested by the agent    | `requests.requested_model`                                                                      |
| Auto-fix outcome                | `requests.autofix_status`                                                                       |
| Attempt identity and parent     | `provider_attempts.id`, `provider_attempts.request_id`                                          |
| Attempt order                   | `provider_attempts.attempt_number`                                                              |
| Attempt status                  | `provider_attempts.status` and the `provider_attempts.error_*` columns                          |
| Provider, model, and Connection | `provider_attempts.provider`, `provider_attempts.model`, `provider_attempts.tenant_provider_id` |
| Attempt usage                   | Token and cost columns on `provider_attempts`                                                   |
| Routing and recovery context    | `provider_attempts.routing_*`, `fallback_*`, `superseded`, and `autofix_*`                      |

## Metric definitions and perimeter

Dashboard metrics use completed Requests and Attempts within the selected tenant, agent, and time filters:

- Pending Requests and Attempts are excluded from totals and success rates.
- Playground traffic is excluded.
- Completed zero-attempt Requests are included in Request metrics.
- During the historical transition, each unlinked legacy Attempt may be represented as one synthetic Request. It counts once in Request metrics and still counts normally in Attempt metrics.

| Metric               | Definition                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Total Requests       | Count each completed stored Request once, plus each eligible synthetic Request once during transition. |
| Request success rate | Requests with `status = 'success'` divided by completed Requests. No traffic means no rate, not 100%.  |
| Total Attempts       | Count each completed `provider_attempts.id`; do not deduplicate by Request.                            |
| Attempt success rate | Attempts with `status = 'success'` divided by completed Attempts.                                      |

Request-level surfaces such as the global Overview, agent Overview, and Requests log count Requests. Provider, Connection, and model surfaces count Attempts. The two totals answer different questions and are not expected to match.

## Auto-fix outcomes

`requests.autofix_status` is the single Request-level Auto-fix verdict. `NULL` means Auto-fix did not record an outcome.

| Value             | Meaning                                            |
| ----------------- | -------------------------------------------------- |
| `no_patch`        | Phoenix was consulted but returned no known patch. |
| `resolving`       | Phoenix is still investigating; no retry was sent. |
| `retry_succeeded` | Manifest applied a patch and the retry succeeded.  |
| `retry_failed`    | Manifest applied a patch but the retry failed.     |
| `service_error`   | The Phoenix service call failed.                   |

Only `retry_succeeded` means the Request was recovered by Auto-fix.

## Examples

| Scenario                                       | Counted Requests | Counted Attempts | Request status | Attempt statuses              | Recovery |
| ---------------------------------------------- | ---------------: | ---------------: | -------------- | ----------------------------- | -------- |
| Request or Attempt is still in progress        |                0 |                0 | `pending`      | `pending` where applicable    | Excluded |
| Primary Provider succeeds                      |                1 |                1 | `success`      | `success`                     | None     |
| Manifest rejects before contacting a Provider  |                1 |                0 | `failed`       | None                          | None     |
| Primary Attempt fails, fallback succeeds       |                1 |                2 | `success`      | `failed`, `success`           | Fallback |
| Primary Attempt fails, Auto-fix retry succeeds |                1 |                2 | `success`      | `failed`, `success`           | Auto-fix |
| Auto-fix retry fails, fallback succeeds        |                1 |                3 | `success`      | `failed`, `failed`, `success` | Fallback |
| Every Provider Attempt fails                   |                1 |                N | `failed`       | `failed` × N                  | None     |

The Counted Requests and Counted Attempts columns show how many rows the completed dashboard metrics count for each scenario; pending rows are excluded.

## Per-page specification

### Overview (global)

- KPI cards: Request world. Success rate, Recovered Requests, Recovered by Auto-fix, and Recovered by fallback.
- Requests chart: one count per Request. Views: **By Request status** (Success / Recovered by Auto-fix / Recovered by fallback / Failed) and **By agent**. There is no by-Provider view because one Request may touch several Providers.
- Recovered Requests chart tab: the recovered subset of Requests.
- Model usage table: Attempt world. Columns: Total Attempts and Attempt success rate. There is no recovery column because models are not recovered.
- Provider Connections table: Attempt world. Total Attempts and Attempt success rate.
- Agents table: Request world. Total Requests, Recovered Requests, and Request success rate.

### Agent Overview

- The same Request-world KPI cards, scoped to the agent. A new agent has zero traffic and no success rate.
- Requests chart: **By Request status** only. A Provider grouping is not meaningful because one Request may span Providers.
- Recovered Requests tab: the agent's recovered subset.
- Model usage table: Attempt world.
- Recent Requests: clicking a row navigates to the Requests page with that Request open in the side panel.

### Connection detail

This page is exclusively in the Attempt world.

- KPI card: **Attempt success rate** over the filtered period.
- Chart tabs: **Attempts** (By Attempt status by default, or By agent), Cost, and Token usage. There is no Requests or recovery tab.
- Attempt status series: Success / Failed. An Auto-fix retry or fallback Attempt is still an Attempt; its trigger is visible on the Request page.
- Tokens and cost: everything this Connection used, including failed Attempts.
- Agent breakdown table: Total Attempts and Attempt success rate per agent on this Connection.

### Usage-based and Subscription Connections

These lists are in the Attempt world. Each Connection shows Total Attempts, Attempt success rate, usage, and cost where applicable. They have no recovery metric.

### Requests page

The Requests page is in the Request world. It lists completed Requests, including failures and zero-attempt rejections. The side panel shows the full Attempt chain with each Attempt's own status and the Auto-fix or fallback context explaining how the chain unfolded.

## Reading rules

1. Grouping is a lens, not a filter. Switching the grouping within one chart never changes its total.
2. A Request counts once in Request-world surfaces; an Attempt counts once in Attempt-world surfaces. The totals are not expected to match.
3. “Recovered” only qualifies Requests. Providers, Connections, models, and Attempts have no recovery metric.
4. Auto-fix and fallback fields on an Attempt describe its trigger or context, never its result. The Attempt's status records its result.
5. Request totals must not be grouped by Attempt-level Provider, Connection, or model fields.

## Legacy naming and statuses

- `agent_messages` is a temporary compatibility view over `provider_attempts`. New code uses `requests` and `provider_attempts` directly.
- `AgentMessage`, `/api/v1/messages`, and frontend `Message*` names are legacy code and API names; they do not define the analytics unit.
- The compatibility view exposes `autofix_phoenix`; the canonical column for new code is `provider_attempts.autofix_decision`.
- Legacy `ok` maps to `success`. Legacy `error`, `rate_limited`, `fallback_error`, and `auto_fixed` map to `failed`; their error, fallback, supersession, and Auto-fix fields preserve the additional context.
