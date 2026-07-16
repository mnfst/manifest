# Manifest Analytics Glossary

This glossary defines the vocabulary used in Manifest analytics and code. The main distinction is the direction of the request.

## Core concepts

### Manifest Request

One logical request from an agent to Manifest.

- Direction: agent → Manifest
- Database table: `requests`
- Primary key: `requests.id`
- Outcome: `requests.status`
- A Request has one caller-visible outcome and may have zero, one, or many Manifest Attempts.

A zero-attempt Request is valid when Manifest rejects it before contacting an AI provider.

### Manifest Attempt

One request from Manifest to an AI provider while serving a Manifest Request.

- Direction: Manifest → AI provider
- Database table: `provider_attempts`
- Parent Request: `provider_attempts.request_id → requests.id`
- Outcome: `provider_attempts.status`

Every provider call counts as an Attempt, including failed calls, fallback attempts, and Auto-fix retries.

### Last Attempt

The final provider Attempt made for a Request.

The Last Attempt is derived from the attempt chain; there is no dedicated database column. A zero-attempt Request has no Last Attempt. The authoritative outcome remains `requests.status`, not the Last Attempt's status.

### Recovered Request

A Request that succeeds after a fallback or Auto-fix attempt.

Recovery belongs to Requests only. Providers, connections, models, and Attempts are never “recovered.” Applying a recovery method is not enough: the Request must ultimately succeed.

- **Recovered by Auto-fix:** `requests.autofix_status = 'retry_succeeded'`.
- **Recovered by fallback:** the successful Last Attempt has a non-null `provider_attempts.fallback_from_model`.
- **Recovered Requests:** the union of the two groups, counted once per Request.

If an Auto-fix retry fails and a fallback succeeds, the Request is recovered by fallback. Auto-fix was applied but did not recover the Request.

### Applied method

A recovery method that Manifest tried during a Request, whether or not it succeeded. Auto-fix and fallback fields on Attempts describe what happened in the chain; they do not replace the Request's outcome.

## Request and Attempt data

| Data                            | Canonical source                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Request identity and scope      | `requests.id`, `requests.tenant_id`, `requests.agent_id`                                        |
| Caller-visible outcome          | `requests.status` and the `requests.error_*` columns                                            |
| End-to-end duration             | `requests.duration_ms`                                                                          |
| Model requested by the agent    | `requests.requested_model`                                                                      |
| Auto-fix outcome                | `requests.autofix_status`                                                                       |
| Attempt identity and parent     | `provider_attempts.id`, `provider_attempts.request_id`                                          |
| Attempt outcome                 | `provider_attempts.status` and the `provider_attempts.error_*` columns                          |
| Provider, model, and connection | `provider_attempts.provider`, `provider_attempts.model`, `provider_attempts.tenant_provider_id` |
| Attempt usage                   | Token and cost columns on `provider_attempts`                                                   |
| Routing and recovery context    | `provider_attempts.routing_*`, `fallback_*`, `superseded`, and `autofix_*`                      |

## Metrics

| Metric               | Definition                                                                       |
| -------------------- | -------------------------------------------------------------------------------- |
| Total Requests       | Count `requests.id` once.                                                        |
| Request success rate | Successful Requests divided by all Requests. No traffic means no rate, not 100%. |
| Total Attempts       | Count every `provider_attempts.id`; do not deduplicate by Request.               |
| Attempt success rate | Successful Attempts divided by all Attempts.                                     |

Request-level surfaces such as the global Overview, agent Overview, and Requests log count Requests. Provider, connection, and model surfaces count Attempts. The two totals answer different questions and are not expected to match.

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

| Scenario                                       | Requests | Attempts | Request outcome | Recovery |
| ---------------------------------------------- | -------: | -------: | --------------- | -------- |
| Primary provider succeeds                      |        1 |        1 | Success         | None     |
| Manifest rejects before contacting a provider  |        1 |        0 | Failure         | None     |
| Primary attempt fails, fallback succeeds       |        1 |        2 | Success         | Fallback |
| Primary attempt fails, Auto-fix retry succeeds |        1 |        2 | Success         | Auto-fix |
| Auto-fix retry fails, fallback succeeds        |        1 |        3 | Success         | Fallback |
| Every provider attempt fails                   |        1 |        N | Failure         | None     |

## Legacy naming

- `agent_messages` is a temporary compatibility view over `provider_attempts`. New code uses `requests` and `provider_attempts` directly.
- `AgentMessage`, `/api/v1/messages`, and frontend `Message*` names are legacy code and API names; they do not define the analytics unit.
- The compatibility view exposes `autofix_phoenix`; the canonical column for new code is `provider_attempts.autofix_decision`.
