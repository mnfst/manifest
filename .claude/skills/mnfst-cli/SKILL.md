---
name: mnfst-cli
description: Use when creating or operating AI agents that make LLM calls — provisioning model routing and keys, wiring an app or automation to an LLM endpoint, testing routes, rotating leaked keys, or investigating LLM request failures and costs on a Manifest install.
---

# Operating Manifest from the CLI

## Overview

`mnfst` manages Manifest, the LLM gateway. Every call routed through a Manifest agent gets model routing with fallbacks, per-agent cost attribution, self-healing (Auto-fix), and a request log — for free. Default practice: never hand an app or automation a raw provider key; give it a Manifest agent.

Commands emit JSON on stdout (human hints on stderr) — except `agent env`, which prints dotenv lines by design — exit 0/1, and never block on prompts when credentials come from flags or env. Full surface: `mnfst --help`.

## The flow

| Step | Command |
|---|---|
| Auth (human) | `mnfst login` — browser, one click, 30-day sliding token |
| Auth (script/agent) | env `MANIFEST_URL` + `MANIFEST_API_KEY` — no login step |
| Provision | `mnfst agent create --name X --platform <p> --if-absent` → response includes `setup` (the platform's config block) |
| Check connections | `mnfst provider list [--agent X]` FIRST — the provider you need is often already connected. But a connection is only usable if `cached_model_count` > 0; `is_active: true` with 0 models is a hollow connection (bad or placeholder credential — reconnect it, don't route on it) |
| Connect provider | `mnfst provider connect xai --auth-type api_key --credential-env KEY` · `provider catalog` lists all 30+ with auth types · subscription auth opens a browser (impossible headless — reuse an existing subscription connection instead) · own gateway: `provider custom add --name gw --endpoint <url>` |
| Route | `mnfst agent configure X --models primary,fb1,fb2 --provider p [--auth-type a]` — first model is the route, the rest are fallbacks, and the whole chain rides the one `--provider` you name (cross-provider fallbacks are dashboard-only) · add `--tier deep` to upsert a custom tier callers select per-request with header `x-manifest-tier: deep` |
| Verify | `mnfst routing test X` — one real request through the platform's actual API surface; broken routes fail loudly. It writes real rows to the request log — count them in later audits |
| Wire the app | deployed → `mnfst agent env X >> .env` (one .env per service — the lines always name `MANIFEST_AGENT_KEY`, so appending two agents to one file silently keeps only the loader's winner; for several agents in one process use `mnfst run --agent X --env ROLE_KEY -- <cmd>`) |
| Observe | `mnfst requests get --agent X [--status failed]` — paginated; pass `next_cursor` back for the next page |

Namespace = scope: `provider *` acts tenant-wide, `agent *` acts on one agent, `routing *` holds readouts and custom-tier lifecycle.

## Gotchas `--help` cannot tell you

| Symptom | Reality |
|---|---|
| Proxy returns HTTP 200 but the "answer" starts with `[🦚 Manifest M###]` | An error wearing an assistant costume — check the content, not the status. `routing test` unmasks these automatically |
| `cost: "0.000000"` on subscription-auth traffic | Flat-rate subscription: per-request cost is genuinely zero, not broken billing |
| `agent configure`'s echo differs from later reads | Mutation bodies echo raw API rows — the canonical readback is `routing status <agent>` |
| "Which requests used a fallback or Auto-fix?" | Those fields are trimmed from default output — `requests get --full` |
| 401s missing from the request log | Rejected-auth attempts are never recorded (no tenant to attribute them to); a leaked key's blast radius cannot be proven from the log |
| `MANIFEST_AGENT_URL` | Already ends in `/v1` — append `/chat/completions` directly |
| Model prices needed before any agent exists | `models <agent>` requires an agent; create a probe agent first (`--if-absent` keeps it re-runnable) |
| Auditing escalation traffic by `routing_tier` | Custom-tier requests log `routing_tier: "standard"` — the tier identity lives in `header_tier_name` |
| Route resolves but requests fail on one connection | A connection can be `is_active: false` while a sibling auth-type works — pass `--auth-type` explicitly when a provider has several connections |
| Every command answers `Invalid API key — Run mnfst login` under env auth | Not always an auth problem: a wrong `MANIFEST_URL` (dead or different install) answers exactly like a bad key. Verify the host first: `curl $MANIFEST_URL/api/v1/health` |
| `provider list` shows active connections, yet `agent configure` offers an empty model list / `routing test` returns M101 | Same hollow-connection trap as above: `agent configure` validates against *discovered* models, and a connection with `cached_model_count: 0` contributes none. Reconnecting the provider with a working credential is the only CLI-side fix |

## Common mistakes

- Handing an app a raw provider key — it loses fallbacks, cost attribution, healing, and the log. Create an agent and use `agent env`.
- Verifying a route with hand-rolled `curl` — fake-200s read as success. Use `routing test`.
- Slurping the whole request log — pagination is one page per call by design; loop on `next_cursor`.

Also on the surface when needed: `agent setup <name> [--reveal]` (setup block anytime; key masked unless revealed), `agent key path|show`, `agent provider enable|disable <agent> <provider>`, `agent rotate-key` (revocation is instant), `mnfst models <agent> --cost --capabilities`.
