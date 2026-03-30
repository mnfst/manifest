# Manifest — Open-Source Model Router & LLM Observability

Manifest is an open-source **model router** and **LLM observability** platform for AI agents. Route requests across providers, track costs, tokens, and performance — all from a single dashboard.

## Use Cases

- **LLM Router / Model Router** — Route AI requests to the best model based on cost, quality, and latency. Automatically tier and score models across providers.
- **AI Agent Observability** — Monitor your AI agents in real-time. Track token usage, costs, messages, and performance with OpenTelemetry-compatible ingestion.
- **LLM Proxy** — OpenAI-compatible proxy endpoint (`/v1/chat/completions`) that routes to any provider: OpenAI, Anthropic, Google Gemini, Mistral, xAI, Ollama, and more.
- **Cost Tracking** — Know exactly how much your AI agents spend. Per-model, per-agent cost breakdowns with alerting thresholds.

## Installation

### Option 1: Docker Compose (recommended)

This is the easiest way to get started. It runs Manifest with a PostgreSQL database in a single command.

**1. Download the compose file:**

```bash
curl -O https://raw.githubusercontent.com/mnfst/manifest/main/docker-compose.yml
```

**2. Start the services:**

```bash
docker compose up -d
```

**3. Open the dashboard:**

Go to [http://localhost:3001](http://localhost:3001)

**4. Log in with the demo account:**

- Email: `admin@manifest.build`
- Password: `manifest`

That's it! You can now connect your LLM providers and start routing.

**To stop:**

```bash
docker compose down       # Stop services (keeps data)
docker compose down -v    # Stop and delete all data
```

### Option 2: Docker Run (bring your own PostgreSQL)

If you already have a PostgreSQL instance, you can run Manifest standalone:

```bash
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/manifest \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e BETTER_AUTH_URL=http://localhost:3001 \
  -e NODE_ENV=development \
  -e MANIFEST_TRUST_LAN=true \
  manifestdotbuild/manifest
```

> Set `NODE_ENV=development` so database migrations run automatically on startup.

### Option 3: Local mode (no database required)

For quick testing without PostgreSQL. Uses SQLite in-memory — data is lost when the container stops unless you mount a volume.

```bash
docker run -d \
  -p 3001:3001 \
  -e MANIFEST_MODE=local \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e MANIFEST_TRUST_LAN=true \
  -v manifest-data:/home/node/.openclaw/manifest \
  manifestdotbuild/manifest
```

> Local mode has no login page — the dashboard is accessible directly.

### Custom port

To run on a different port (e.g. 8080), set both the port mapping and `BETTER_AUTH_URL`:

```bash
docker run -d \
  -p 8080:3001 \
  -e BETTER_AUTH_URL=http://localhost:8080 \
  ...
```

Or in docker-compose.yml:

```yaml
ports:
  - "8080:3001"
environment:
  - BETTER_AUTH_URL=http://localhost:8080
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
| `BETTER_AUTH_URL` | No | `http://localhost:3001` | Public URL of the app (set when using a custom port) |
| `PORT` | No | `3001` | Internal server port |
| `NODE_ENV` | No | `production` | Set `development` for auto-migrations |
| `MANIFEST_MODE` | No | `cloud` | `cloud` (PostgreSQL) or `local` (SQLite) |
| `SEED_DATA` | No | `false` | Seed demo data on startup |
| `MANIFEST_TRUST_LAN` | No | `false` | Trust private network IPs (required for Docker) |
| `MANIFEST_DB_PATH` | No | `~/.openclaw/manifest/manifest.db` | SQLite path (local mode) |

See the [full environment variable reference](https://github.com/mnfst/manifest) for OAuth, email, and advanced configuration.

## Links

- [GitHub](https://github.com/mnfst/manifest)
- [Website](https://manifest.build)
- [Documentation](https://manifest.build)

## Tags

`model-router` `llm-router` `llm-routing` `ai-routing` `ai-agent-router` `llm-proxy` `ai-observability` `ai-monitoring` `llm-cost-tracking` `opentelemetry` `otlp` `ai-agent` `model-routing` `llm-gateway` `ai-gateway`
