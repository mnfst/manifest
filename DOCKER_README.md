# Manifest — Open-Source Model Router & LLM Observability

Manifest is an open-source **model router** and **LLM observability** platform for AI agents. Route requests across providers, track costs, tokens, and performance — all from a single dashboard.

## Use Cases

- **LLM Router / Model Router** — Route AI requests to the best model based on cost, quality, and latency. Automatically tier and score models across providers.
- **AI Agent Observability** — Monitor your AI agents in real-time. Track token usage, costs, messages, and performance with OpenTelemetry-compatible ingestion.
- **LLM Proxy** — OpenAI-compatible proxy endpoint (`/v1/chat/completions`) that routes to any provider: OpenAI, Anthropic, Google Gemini, Mistral, xAI, Ollama, and more.
- **Cost Tracking** — Know exactly how much your AI agents spend. Per-model, per-agent cost breakdowns with alerting thresholds.

## Quick Start

### With Docker Compose (recommended)

```bash
curl -O https://raw.githubusercontent.com/mnfst/manifest/main/docker-compose.yml
docker compose up
```

Open [http://localhost:3001](http://localhost:3001) to access the dashboard.

### With Docker Run

```bash
# Cloud mode (PostgreSQL)
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/manifest \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e MANIFEST_TRUST_LAN=true \
  manifestdotbuild/manifest

# Local mode (SQLite, no external database)
docker run -d \
  -p 3001:3001 \
  -e MANIFEST_MODE=local \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e MANIFEST_TRUST_LAN=true \
  -v manifest-data:/home/node/.openclaw/manifest \
  manifestdotbuild/manifest
```

## Features

- **Multi-provider routing** — Connect OpenAI, Anthropic, Google, Mistral, xAI, Ollama, OpenRouter, and more
- **Tier-based model scoring** — Automatically assign models to quality/cost tiers
- **Real-time dashboard** — SolidJS frontend with live SSE updates
- **OpenTelemetry ingestion** — OTLP-compatible endpoint for agent telemetry
- **Alerting** — Token and cost threshold notifications via email (Mailgun, Resend, SMTP)
- **API key management** — Per-agent API keys with rotation support
- **Self-hosted** — Your data stays on your infrastructure

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (cloud mode) | — | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | — | Session signing secret (min 32 chars) |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `production` | Set `development` for auto-migrations |
| `MANIFEST_MODE` | No | `cloud` | `cloud` (PostgreSQL) or `local` (SQLite) |
| `SEED_DATA` | No | `false` | Seed demo data on startup |
| `MANIFEST_DB_PATH` | No | `~/.openclaw/manifest/manifest.db` | SQLite path (local mode) |
| `MANIFEST_TRUST_LAN` | No | `false` | Trust private network IPs for auth bypass (required for Docker) |

> **Docker networking note:** Set `MANIFEST_TRUST_LAN=true` when running in Docker. Docker's bridge network uses private IPs (`192.168.x.x`) which aren't recognized as loopback. This env var allows the auth guard to accept connections from the host machine.

See the [full environment variable reference](https://github.com/mnfst/manifest) for OAuth, email, and advanced configuration.

## Links

- [GitHub](https://github.com/mnfst/manifest)
- [Website](https://manifest.build)
- [Documentation](https://manifest.build)

## Tags

`model-router` `llm-router` `llm-routing` `ai-routing` `ai-agent-router` `llm-proxy` `ai-observability` `ai-monitoring` `llm-cost-tracking` `opentelemetry` `otlp` `ai-agent` `model-routing` `llm-gateway` `ai-gateway`
