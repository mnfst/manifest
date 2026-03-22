---
name: manifest
description: Model Router for OpenClaw. Save up to 70% by routing requests to the right model. Choose LLM fallback to avoid API rate limits, set thresholds and reduce token consumption.
metadata: {"openclaw":{"requires":{"bins":["openclaw"]},"primaryEnv":"MANIFEST_API_KEY","homepage":"https://github.com/mnfst/manifest"}}
---

# Manifest — LLM Router & Observability for OpenClaw

Manifest is an OpenClaw plugin that:

- **Routes every request** to the most cost-effective model via a 23-dimension scoring algorithm (<2ms latency)
- **Tracks costs and tokens** in a real-time dashboard with soft limits and hard spending caps
- **Configures model fallback** to retry on a different provider on rate limits or errors

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

## Model Fallback

Configure fallback chains per tier so requests automatically retry on a different model if the primary provider hits rate limits or errors. Set up in the dashboard under **Routing → Fallbacks**.

- Avoid API rate limit failures with automatic provider failover
- Define fallback order per tier (simple, standard, complex, reasoning)
- Mix providers for resilience (e.g. Anthropic → OpenAI → DeepSeek)

## Supported Providers

**Subscription (OAuth / token)** — use your existing plan, no API key needed:

- Anthropic (Claude Max / Pro)
- OpenAI (ChatGPT Plus / Pro / Team)
- MiniMax (Coding Plan)

**API Key** — bring your own key:

- Anthropic, OpenAI, Google Gemini, DeepSeek, Mistral, xAI, Qwen (Alibaba), MiniMax, Moonshot (Kimi), Z.ai, OpenRouter, Ollama (local, no key needed)

**Also compatible with** any OpenAI-compatible API endpoint and Ollama local models.

300+ models total across all providers.

## Uninstall

```bash
openclaw plugins uninstall manifest
openclaw gateway restart
```

This removes the plugin, provider config, and auth profiles.

## Documentation

For detailed security & privacy documentation, routing configuration, configuration changes, and troubleshooting, see the [full documentation](https://github.com/mnfst/manifest).
