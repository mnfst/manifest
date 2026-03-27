---
name: manifest
description: Model Router for OpenClaw. Save up to 70% by routing requests to the right model. Choose LLM fallback to avoid API rate limits, set thresholds and reduce token consumption.
metadata: {"openclaw":{"requires":{"bins":["openclaw"]},"homepage":"https://github.com/mnfst/manifest"}}
---

# Manifest -- LLM Router for OpenClaw

Manifest sits between your agent and your LLM providers. It scores each request, picks the cheapest model that can handle it, and records everything in a dashboard.

- **Routes every request** to the right model via a 23-dimension scoring algorithm (<2ms)
- **Tracks costs and tokens** in a real-time dashboard
- **Sets limits** with email alerts and hard spending caps

Source: [github.com/mnfst/manifest](https://github.com/mnfst/manifest) -- MIT licensed

## Setup (Cloud -- recommended)

No plugin needed. Add Manifest as a model provider directly in your OpenClaw config.

1. Sign up at [app.manifest.build](https://app.manifest.build), create an agent, copy the `mnfst_*` API key
2. Run:

```bash
openclaw config set models.providers.manifest '{"baseUrl":"https://app.manifest.build/v1","api":"openai-completions","apiKey":"mnfst_YOUR_KEY","models":[{"id":"auto","name":"Manifest Auto"}]}'
openclaw config set agents.defaults.model.primary manifest/auto
openclaw gateway restart
```

3. Connect at least one LLM provider in the dashboard (Routing page)
4. Send a message -- it routes through Manifest and shows up in the dashboard

## Setup (Local)

For a self-contained setup where everything stays on your machine. Install the plugin:

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.mode local
openclaw gateway restart
```

Dashboard at **http://127.0.0.1:2099**. Data stored in `~/.openclaw/manifest/manifest.db`. No account or API key needed.

To expose over Tailscale: `tailscale serve --bg 2099`

## Security & Privacy

**Cloud mode**: Manifest proxies your request to the LLM provider. It records metadata (model name, token counts, latency, cost) but never stores prompt or response content. When `manifest/auto` routing is active, the last 10 non-system messages are scored for tier assignment; set a fixed model to skip this.

**Local mode**: All data stays on your machine. No external calls.

### Credential storage

- **Cloud mode**: API key in OpenClaw config at `models.providers.manifest.apiKey`
- **Local mode**: auto-generated key in `~/.openclaw/manifest/config.json` (file mode `0600`)

## Agent Tools

Three read-only tools available in-conversation:

| Tool | Trigger phrases | Returns |
|------|----------------|---------|
| `manifest_usage` | "how many tokens", "token usage" | Total, input, output, cache tokens for today/week/month |
| `manifest_costs` | "how much spent", "costs" | Cost breakdown by model in USD |
| `manifest_health` | "is monitoring working" | Endpoint reachable, auth valid, agent name |

Each accepts a `period` parameter: `"today"`, `"week"`, or `"month"`.

## LLM Routing

When model is `manifest/auto`, the router scores each conversation across 23 dimensions and assigns a tier:

| Tier | Use case | Examples |
|------|----------|---------|
| **Simple** | Greetings, short lookups | "hi", "what time is it" |
| **Standard** | General tasks | "summarize this", "write a test" |
| **Complex** | Multi-step reasoning | "compare these architectures" |
| **Reasoning** | Formal logic, proofs | "prove this theorem" |

Default models are auto-assigned per provider, overridable in the dashboard under Routing.

Short-circuit rules:
- Messages <50 chars with no tools -> Simple
- Formal logic keywords -> Reasoning
- Tools present -> floor at Standard
- Context >50k tokens -> floor at Complex

## Dashboard Pages

| Page | What it shows |
|------|--------------|
| **Workspace** | All agents with sparkline activity charts |
| **Overview** | Cost, tokens, messages with trend badges and charts |
| **Messages** | Full paginated log with filters (status, model, cost range) |
| **Routing** | 4-tier model config, provider connections |
| **Limits** | Alerts and spending caps |
| **Settings** | Agent rename, delete, API key management |
| **Model Prices** | 300+ model prices across all providers |

## Supported Providers

Anthropic, OpenAI, Google Gemini, DeepSeek, xAI, Mistral AI, Qwen, MiniMax, Kimi, Amazon Nova, Z.ai, OpenRouter, Ollama. 300+ models total.

## Uninstall

**Cloud users** (no plugin): Remove the provider from your OpenClaw config:

```bash
openclaw config set models.providers.manifest null
openclaw config set agents.defaults.model.primary <your-preferred-model>
openclaw gateway restart
```

**Local users** (plugin installed):

```bash
openclaw plugins uninstall manifest
openclaw gateway restart
```

## Troubleshooting

**401 errors**: Check that the API key in your OpenClaw config matches the key in the Manifest dashboard (Settings -> Agent setup). Keys start with `mnfst_`.

**No messages in dashboard**: Make sure you have at least one provider connected in the Routing page. Without a provider, requests to `manifest/auto` fail with a 400 error.

**Port conflict in local mode**: If port 2099 is busy, change it: `openclaw config set plugins.entries.manifest.config.port <PORT>`.

**After backend restart**: Restart the gateway too (`openclaw gateway restart`).
