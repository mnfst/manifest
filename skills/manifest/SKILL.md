---
name: manifest
description: Smart LLM Router for OpenClaw. Save up to 70% by routing every request to the right model. No coding required.
metadata: {"openclaw":{"requires":{"bins":["openclaw"]},"primaryEnv":"MANIFEST_API_KEY","homepage":"https://github.com/mnfst/manifest"}}
---

# Manifest — LLM Router & Observability for OpenClaw

Manifest is an OpenClaw plugin that:

- **Routes every request** to the most cost-effective model via a 23-dimension scoring algorithm (<2ms latency)
- **Tracks costs and tokens** in a real-time dashboard
- **Sets limits** with email alerts and hard spending caps

Source: [github.com/mnfst/manifest](https://github.com/mnfst/manifest) — MIT licensed. Homepage: [manifest.build](https://manifest.build)

## Setup (Local — recommended for evaluation)

No account, no API key needed.

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.mode local
openclaw gateway restart
```

Dashboard opens at **http://127.0.0.1:2099**. Data stored locally in `~/.openclaw/manifest/manifest.db`.

## Setup (Cloud)

```bash
openclaw plugins install manifest
openclaw config set plugins.entries.manifest.config.apiKey "mnfst_YOUR_KEY"
openclaw gateway restart
```

Get the API key at [app.manifest.build](https://app.manifest.build) → create an account → create an agent → copy the key.

### Verify connection

```bash
openclaw manifest
```

## Agent Tools

Three tools are available to the agent in-conversation:

| Tool              | Trigger phrases                                 | What it returns                                                             |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `manifest_usage`  | "how many tokens", "token usage", "consumption" | Total, input, output, cache-read tokens + action count for today/week/month |
| `manifest_costs`  | "how much spent", "costs", "money burned"       | Cost breakdown by model in USD for today/week/month                         |
| `manifest_health` | "is monitoring working", "connectivity test"    | Endpoint reachable, auth valid, agent name, status                          |

Each accepts a `period` parameter: `"today"`, `"week"`, or `"month"`.

## Supported Providers

Anthropic, OpenAI, Google Gemini, DeepSeek, xAI, Mistral AI, Qwen, MiniMax, Kimi, Amazon Nova, Z.ai, OpenRouter, Ollama. 300+ models total.

## Uninstall

```bash
openclaw plugins uninstall manifest
openclaw gateway restart
```

This removes the plugin, provider config, and auth profiles.

## Documentation

For detailed security & privacy documentation, routing configuration, configuration changes, and troubleshooting, see the [full documentation](https://github.com/mnfst/manifest).
