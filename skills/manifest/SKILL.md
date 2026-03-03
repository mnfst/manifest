---
name: manifest
description: Set up and use Manifest — the open-source LLM router and observability plugin for OpenClaw. Use when the user asks to install Manifest, set up cost tracking, configure LLM routing, monitor agent costs/tokens, understand what Manifest does, check Manifest status, troubleshoot the plugin, or wants to reduce OpenClaw costs. Also triggers on "manifest setup", "install manifest", "how much am I spending", "track my costs", "route to cheaper models", "manifest dashboard", "manifest help".
metadata: {"openclaw":{"requires":{"bins":["openclaw"],"credentials":["mnfst_* API key (cloud mode only)"]},"configPaths":["~/.openclaw/openclaw.json","~/.openclaw/manifest/"]}}
---

# Manifest — LLM Router & Observability for OpenClaw

Manifest is an OpenClaw plugin that:

- **Routes every request** to the most cost-effective model via a 23-dimension scoring algorithm (<2ms latency)
- **Tracks costs and tokens** in a real-time dashboard
- **Sets limits** with email alerts and hard spending caps

Source: [github.com/mnfst/manifest](https://github.com/mnfst/manifest) — MIT licensed. Homepage: [manifest.build](https://manifest.build)

## Setup (Cloud — default)

Three commands, no coding:

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
openclaw gateway restart
```

Get the API key at [app.manifest.build](https://app.manifest.build) → create an account → create an agent → copy the `mnfst_*` key.

After restart, the plugin auto-configures:

- Registers `manifest/auto` as the default model
- Injects the `manifest` provider into `~/.openclaw/openclaw.json`
- Starts exporting OTLP telemetry to `app.manifest.build`
- Exposes three agent tools: `manifest_usage`, `manifest_costs`, `manifest_health`

Dashboard at [app.manifest.build](https://app.manifest.build). Telemetry arrives within 10-30 seconds (batched OTLP export).

### Verify connection

```bash
openclaw manifest
```

Shows: mode, endpoint reachability, auth validity, agent name.

## Setup (Local — offline alternative)

Use local mode only when data must never leave the machine.

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.mode local
openclaw gateway restart
```

Dashboard opens at **http://127.0.0.1:2099**. Data stored locally in `~/.openclaw/manifest/manifest.db`. No account or API key needed.

To expose over Tailscale (requires Tailscale on both devices, only accessible within your Tailnet): `tailscale serve --bg 2099`

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
- Is telemetry flowing correctly?

## Agent Tools

Three tools are available to the agent in-conversation:

| Tool              | Trigger phrases                                 | What it returns                                                             |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `manifest_usage`  | "how many tokens", "token usage", "consumption" | Total, input, output, cache-read tokens + action count for today/week/month |
| `manifest_costs`  | "how much spent", "costs", "money burned"       | Cost breakdown by model in USD for today/week/month                         |
| `manifest_health` | "is monitoring working", "connectivity test"    | Endpoint reachable, auth valid, agent name, status                          |

Each accepts a `period` parameter: `"today"`, `"week"`, or `"month"`.

All three tools are read-only — they query the agent's own usage data and never send message content.

## LLM Routing

When the model is set to `manifest/auto`, the router scores each conversation across 23 dimensions and assigns one of 4 tiers:

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
| **Settings**     | Agent rename, delete, OTLP key management                                     |
| **Model Prices** | Sortable table of 300+ model prices across all providers                      |

## Supported Providers

Anthropic, OpenAI, Google Gemini, DeepSeek, xAI, Mistral AI, Qwen, MiniMax, Kimi, Amazon Nova, Z.ai, OpenRouter, Ollama. 300+ models total.

## Uninstall

```bash
openclaw plugins uninstall manifest
openclaw gateway restart
```

This removes the plugin, provider config, and auth profiles. Set a new default model after uninstalling.

## Troubleshooting

**Telemetry not appearing**: The gateway batches OTLP data every 10-30 seconds. Wait, then check `openclaw manifest` for connection status.

**Auth errors in cloud mode**: Verify the API key starts with `mnfst_` and matches the key in the dashboard under Settings → Agent setup.

**Port conflict in local mode**: If port 2099 is busy, the plugin checks if the existing process is Manifest and reuses it. To change the port: `openclaw config set plugins.entries.manifest.config.port <PORT>`.

**Plugin conflicts**: Manifest conflicts with the built-in `diagnostics-otel` plugin. Disable it before enabling Manifest.

**After backend restart**: Always restart the gateway too (`openclaw gateway restart`) — the OTLP pipeline doesn't auto-reconnect.

## Privacy

**OTLP telemetry (sent to endpoint):**

Fields collected per LLM call: session key, agent name, model name, provider name, token counts (input, output, cache-read, cache-write), tool names, tool success/failure, tool duration, error messages (truncated to classification, no content), message channel, and service metadata. **Not collected**: user prompts, assistant responses, tool input/output, or any message content.

**Routing caveat — `manifest/auto` sends message content:**

When the model is set to `manifest/auto`, the last 10 non-system messages (including their content) are sent to `POST /api/v1/routing/resolve` for complexity scoring. This is a separate REST call used only for tier assignment — it is not part of OTLP telemetry. To avoid sending content, disable routing in the dashboard and use a fixed model instead.

**Local mode**: All data stays on your machine. No external calls are made.

**Product analytics**: Anonymous usage stats sent to PostHog (hashed machine ID only, no PII). Opt out: `MANIFEST_TELEMETRY_OPTOUT=1` or `"telemetryOptOut": true` in `~/.openclaw/manifest/config.json`.
