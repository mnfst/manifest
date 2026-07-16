# Analytics dashboards: concepts and per-page specification

This document defines the vocabulary of the Manifest dashboards and what each
page shows. The goal: when the team discusses a number, everyone knows which
definition it carries.

## The two worlds

Manifest analytics live in two distinct worlds. Mixing them is what created
the confusion this spec resolves.

**The request world (agent side).** A caller (a harness/agent) makes one
logical request to Manifest. Manifest may try several providers to serve it.
The caller only ever sees ONE outcome. Requests belong to agents and to the
global Overview. Healing (auto-fix, fallback) is a request-level story: a
request was rescued.

**The attempt world (provider side).** Every actual provider call is an
attempt. A request has 0..N attempts. Attempts belong to providers,
connections and models. A provider never heals anything: it receives a call
and answers, success or failure. An attempt may have been *triggered* by a
fallback or an auto-fix, but that is its origin, not its nature.

## Glossary

**Request.** One logical call from a harness to Manifest. It concludes
exactly once: success or failure, whatever the number of attempts underneath.
A request with zero attempts is valid (Manifest rejected it before contacting
any provider, e.g. a setup error).

**Attempt.** One provider call. Every attempt counts in the provider world,
including failed ones, fallback attempts and auto-fix retries. Example: a
request tries DeepSeek (fails), falls back to OpenAI (succeeds). That is ONE
request (successful, healed via fallback) and TWO attempts: one failed
DeepSeek attempt, one successful OpenAI attempt. The DeepSeek dashboard shows
its failed attempt; the OpenAI dashboard shows its successful one.

**Terminal attempt.** The attempt that concluded a request: the successful
one when it exists, otherwise the last real failure. Used to attribute a
request in request-world charts (e.g. which harness, which final status).

**Healed request.** A successful request that needed rescue: auto-fix
(Manifest repaired the request and retried) or fallback (Manifest rerouted to
another model). Healed is a REQUEST concept only. Attempts and providers are
never "healed"; at most an attempt was *triggered by* auto-fix or fallback.

**Applied methods.** On a request row: which rescue methods were applied
during its lifetime (auto-fix, fallback). Method, not result.

**Request success rate (agent / Overview).** Successful requests divided by
all requests, over the filtered period. Recovered requests count as
successful: the caller got an answer. A brand-new agent with no traffic has
no rate (not 100%).

**Attempt success rate (provider / connection / model).** Successful attempts
divided by all attempts, over the filtered period. Example: a connection
served 100 attempts, 90 returned success: 90%. No healing notion enters this
number.

**Total attempts (provider / connection / model rows).** Every provider call
counted where it ran. Not deduplicated per request: a request that retried 3
times on a model contributes 3.

## Per-page specification

### Overview (global)

- KPI cards: request world. Success rate (requests, recovered included),
  Healed requests, Healed via Auto-fix, Healed via Fallback.
- Requests chart: logical requests, one count per request. Views: **By
  request status** (Success / healed via Auto-fix / healed via Fallback /
  Error) and **By harness**. There is NO by-provider view: a request may
  touch several providers, so "the request's provider" is not a sound
  grouping.
- Healed requests chart tab: the rescued subset (request world).
- Model usage table: attempt world. Columns: Total attempts, Success rate
  (attempts). No Healed column: a model is not healed, it acts.
- Provider connections table: attempt world. Total attempts, Success rate
  (attempts).
- Harnesses table: request world. Total requests, Healed, Success rate
  (requests).

### Agent overview (one harness)

- Same request-world KPI cards, scoped strictly to the agent. A fresh agent
  reads zero traffic.
- Requests chart: **By request status only** (the agent is the harness; a
  provider grouping is not meaningful here either).
- Healed requests tab: the agent's rescued subset.
- Model usage table: attempt world (same columns as Overview).
- Recent requests: clicking a row navigates to the Requests page with that
  request opened in the side panel. No inline accordion.

### Connection detail (one provider connection)

Attempt world, exclusively.

- Single KPI card: **Success rate (attempts)** over the filtered period.
- Chart tabs: **Attempts** (views: By attempt status, default, and By
  harness), Cost, Token usage. No Requests tab, no Healed tab: this page
  counts provider calls, and healing belongs to requests.
- Attempt status series: Success / Failed. An auto-fix retry or a fallback
  attempt is just an attempt here; its trigger is visible on the request's
  own page.
- Tokens and cost: everything this connection burned, failed attempts
  included.
- Harness breakdown table: Total attempts, Success rate (attempts) per
  harness on this connection.

### Usage-based / Subscriptions (connection lists)

Attempt world. Per connection: Total attempts (30d), Success rate (30d,
attempts), usage sparkline, cost where applicable. No Healed column, no
self-healed KPI card.

### Requests page (the log)

Request world. Every request, including failures and zero-attempt
rejections. The side panel shows the full attempt chain of a request: each
attempt with its own status, and the auto-fix / fallback context cards
telling how the chain unfolded.

## Reading rules (the invariants)

1. **Grouping is a lens, never a filter.** Within one chart, switching the
   view never changes the total height.
2. A request counts once in request-world surfaces; an attempt counts once in
   attempt-world surfaces. The two totals are NOT comparable numbers.
3. "Healed" only ever qualifies requests. Providers, connections, models and
   attempts have no healed metric.
4. Auto-fix / fallback on an attempt describe its trigger (method), never its
   result. Success or failure is the attempt's own status.
