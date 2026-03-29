---
name: manifest
description: Model Router for OpenClaw. Save up to 70% by routing requests to the right model. Choose LLM fallback to avoid API rate limits, set thresholds and reduce token consumption.
metadata: {"openclaw":{"requires":{"bins":["openclaw"]},"homepage":"https://github.com/mnfst/manifest"}}
---

# Manifest — LLM Router & Observability for OpenClaw

Manifest is an OpenClaw plugin that:

- **Routes every request** to the most cost-effective model via a 23-dimension scoring algorithm (<2ms latency)
- **Tracks costs and tokens** in a real-time dashboard
- **Sets limits** with email alerts and hard spending caps

Source: [github.com/mnfst/manifest](https://github.com/mnfst/manifest) — MIT licensed. Homepage: [manifest.build](https://manifest.build)

## Security & Privacy

> **TL;DR** — The plugin registers Manifest as a standard OpenAI-compatible provider and exposes three read-only agent tools. It does not export telemetry or make background network calls. When you select `manifest/auto` as your model, OpenClaw routes requests through the Manifest backend — the same way it routes to any other provider like Anthropic or OpenAI. In local mode, all data stays on your machine and no API key is needed.

### What the plugin does

1. **Registers a provider** — adds `manifest` as an OpenAI-compatible provider with the `auto` model
2. **Injects config** — writes provider entry to `~/.openclaw/openclaw.json` and auth profiles (standard plugin registration, reversed on uninstall)
3. **Exposes 3 read-only tools** — `manifest_usage`, `manifest_costs`, `manifest_health` (query your own usage data via the Manifest API)
4. **Registers `/manifest` command** — shows connection status

### What the plugin does NOT do

- Does not export telemetry, traces, or metrics — the plugin has no OTLP or telemetry code
- Does not make background or periodic network calls — network calls happen only at startup (connection verification) and when agent tools are invoked by the user
- Does not change your default model — `manifest/auto` is added to the allowlist only, you must switch to it manually

### How routing works

When you manually select `manifest/auto` as your model, OpenClaw sends requests to the Manifest backend's `/v1/chat/completions` endpoint — the same way it sends requests to any provider (Anthropic, OpenAI, etc.). The backend picks the optimal model based on conversation complexity. This is standard OpenClaw provider behavior, not a special plugin data flow.

### Credential storage

- **Cloud mode** (`manifest-model-router` plugin): API key provided via `openclaw providers setup manifest-model-router` or `MANIFEST_API_KEY` env var. The key authenticates with the Manifest backend — standard provider auth.
- **Local mode** (`manifest` plugin): auto-generated key stored in `~/.openclaw/manifest/config.json` with file mode `0600`. No external service contacted.

### Local mode

All data stays on your machine. The embedded server runs locally and no external calls are made.

## Install Provenance

`openclaw plugins install manifest` installs the [`manifest`](https://www.npmjs.com/package/manifest) npm package.

- **Source**: [github.com/mnfst/manifest](https://github.com/mnfst/manifest) (`packages/openclaw-plugins/manifest`)
- **License**: MIT
- **Author**: MNFST Inc.

Verify before installing:

```bash
npm view manifest repository.url
npm view manifest dist.integrity
```

The package is published with [npm provenance attestations](https://docs.npmjs.com/generating-provenance-statements). Verify with:
```bash
npm audit signatures
```

## Setup (Local — recommended for evaluation)

No account or API key required. Dashboard data stays local; LLM requests still go to your configured providers.

```bash
openclaw plugins install manifest
openclaw gateway restart
```

Dashboard opens at **http://127.0.0.1:2099**. Data stored locally in `~/.openclaw/manifest/manifest.db`. No account or API key needed.

To expose over Tailscale (requires Tailscale on both devices, only accessible within your Tailnet): `tailscale serve --bg 2099`

## Setup (Cloud)

Two commands:

```bash
openclaw plugins install manifest-model-router
openclaw providers setup manifest-model-router
openclaw gateway restart
```

The setup wizard prompts for your API key from [app.manifest.build](https://app.manifest.build) → create an account → create an agent → copy the `mnfst_*` key. You can also set `MANIFEST_API_KEY` env var for CI/CD.

After restart, the plugin registers itself via standard OpenClaw plugin APIs:

- Adds `manifest/auto` to the model allowlist — **your current default model is not changed**
- Registers the `manifest` provider in `~/.openclaw/openclaw.json` (reversed on uninstall)
- Exposes three read-only agent tools: `manifest_usage`, `manifest_costs`, `manifest_health`

Dashboard at [app.manifest.build](https://app.manifest.build).

### Verify connection

```bash
openclaw manifest
```

Shows: mode, endpoint reachability, auth validity, agent name.

## Configuration Changes

On plugin registration, Manifest writes to these files using standard OpenClaw plugin APIs. All changes are reversed by `openclaw plugins uninstall manifest`:

| File                                            | Change                                                                                                      | Reversible                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `~/.openclaw/openclaw.json`                     | Adds `models.providers.manifest` provider entry; adds `manifest/auto` to `agents.defaults.models` allowlist | Yes — `openclaw plugins uninstall manifest` |
| `~/.openclaw/agents/*/agent/auth-profiles.json` | Adds `manifest:default` auth profile                                                                        | Yes — uninstall removes it                  |
| `~/.openclaw/manifest/config.json`              | Stores auto-generated API key (local mode only, file mode 0600)                                             | Yes — delete `~/.openclaw/manifest/`        |
| `~/.openclaw/manifest/manifest.db`              | SQLite database (local mode only)                                                                           | Yes — delete the file                       |

No other files are modified. The plugin does not change your current default model.

## What Manifest Answers

Manifest answers these questions about your OpenClaw agents — via the dashboard or directly in-conversation via agent tools:

**Spending & budget**

- How much have I spent today / this week / this month?
- What's my cost breakdown by model?
- Which model consumes the biggest share of my budget?
- Am I approaching my spending limit?

**Token consumption**

- How many tokens has my agent used (input vs. output)?
- What's my token trend compared to the previous period?
- How much cache am I reading vs. writing?

**Activity & performance**

- How many LLM calls has my agent made?
- How long do LLM calls take (latency)?
- Are there errors or rate limits occurring? What are the error messages?
- Which skills/tools are running and how often?

**Routing intelligence**

- What routing tier (simple/standard/complex/reasoning) was each request assigned?
- Why was a specific tier chosen?
- What model pricing is available across all providers?

**Connectivity**

- Is Manifest connected and healthy?

## Agent Tools

Three read-only tools are available to the agent in-conversation:

| Tool              | Trigger phrases                                 | What it returns                                                             |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `manifest_usage`  | "how many tokens", "token usage", "consumption" | Total, input, output, cache-read tokens + action count for today/week/month |
| `manifest_costs`  | "how much spent", "costs", "money burned"       | Cost breakdown by model in USD for today/week/month                         |
| `manifest_health` | "is monitoring working", "connectivity test"    | Endpoint reachable, auth valid, agent name, status                          |

Each accepts a `period` parameter: `"today"`, `"week"`, or `"month"`.

All three tools are read-only — they query the agent's own usage data and never send message content.

## LLM Routing

Routing only activates when you manually set your model to `manifest/auto`. When active, the Manifest backend scores each conversation across 23 dimensions and assigns one of 4 tiers:

| Tier          | Use case                                | Examples                                                |
| ------------- | --------------------------------------- | ------------------------------------------------------- |
| **Simple**    | Greetings, confirmations, short lookups | "hi", "yes", "what time is it"                          |
| **Standard**  | General tasks, balanced quality/cost    | "summarize this", "write a test"                        |
| **Complex**   | Multi-step reasoning, nuanced analysis  | "compare these architectures", "debug this stack trace" |
| **Reasoning** | Formal logic, proofs, critical planning | "prove this theorem", "design a migration strategy"     |

Each tier maps to a model. Default models are auto-assigned per provider, but overridable in the dashboard under **Routing**.

Short-circuit rules:

- Messages <50 chars with no tools → **Simple**
- Formal logic keywords → **Reasoning**
- Tools present → floor at **Standard**
- Context >50k tokens → floor at **Complex**

## Dashboard Pages

| Page             | What it shows                                                                 |
| ---------------- | ----------------------------------------------------------------------------- |
| **Workspace**    | All connected agents as cards with sparkline activity charts                  |
| **Overview**     | Per-agent cost, tokens, messages with trend badges and time-series charts     |
| **Messages**     | Full paginated message log with filters (status, model, cost range)           |
| **Routing**      | 4-tier model config, provider connections, enable/disable routing             |
| **Limits**       | Email alerts and hard spending caps (tokens or cost, per hour/day/week/month) |
| **Settings**     | Agent rename, delete, key management                                          |
| **Model Prices** | Sortable table of 300+ model prices across all providers                      |

## Supported Providers

Anthropic, OpenAI, Google Gemini, DeepSeek, xAI, Mistral AI, Qwen, MiniMax, Kimi, Amazon Nova, Z.ai, OpenRouter, Ollama. 300+ models total.

## Uninstall

```bash
openclaw plugins uninstall manifest
openclaw gateway restart
```

This removes the plugin, provider config, and auth profiles. After uninstalling, `manifest/auto` is no longer available. If any agent uses it, switch to another model.

## Troubleshooting

**Auth errors in cloud mode**: Verify the API key starts with `mnfst_` and matches the key in the dashboard under Settings → Agent setup.

**Port conflict in local mode**: If port 2099 is busy, the plugin checks if the existing process is Manifest and reuses it. To change the port: `openclaw config set plugins.entries.manifest.config.port <PORT>`.

**Plugin conflicts**: Manifest conflicts with the built-in `diagnostics-otel` plugin. Disable it before enabling Manifest.

**After backend restart**: Always restart the gateway too (`openclaw gateway restart`).
