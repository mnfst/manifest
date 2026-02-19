<p align="center">
  <img src="home-gh.png" alt="Manifest" />
</p>

# Manifest

AI agent observability platform. Monitor costs, tokens, messages, and performance of your AI agents in real time.

## Tech Stack

| Layer     | Technology                                       |
| --------- | ------------------------------------------------ |
| Frontend  | SolidJS, uPlot, custom CSS tokens                |
| Backend   | NestJS 11, TypeORM, PostgreSQL 16                |
| Auth      | Better Auth (email/password + 3 OAuth providers) |
| Telemetry | OTLP HTTP (JSON + Protobuf)                      |
| Monorepo  | Turborepo + npm workspaces                       |

## Getting Started

### Prerequisites

- Node.js 22.x (LTS)
- npm 10.x
- Docker (for PostgreSQL)

### PostgreSQL

Start a local PostgreSQL 16 instance. The easiest way is Docker:

```bash
docker run -d --name postgres_db \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=mydatabase \
  -p 5432:5432 \
  postgres:16
```

The `DATABASE_URL` in your `.env` must match these credentials:

```
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mydatabase
```

> **Format:** `postgresql://<user>:<password>@<host>:<port>/<database>`

If you use a managed PostgreSQL instance (e.g. Railway, Supabase, Neon), set `DATABASE_URL` to the connection string provided by your provider.

### Install & Run

```bash
git clone <repo-url> && cd manifest
npm install
cp packages/backend/.env.example packages/backend/.env    # edit with your secrets
npm run dev
```

The frontend starts on `http://localhost:3000` and the backend on `http://localhost:3001`.

### Environment Variables

Copy `packages/backend/.env.example` to `packages/backend/.env` and fill in the required values.

#### Core

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes | — | Secret for session signing. Must be at least 32 characters. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL` | Yes* | `postgresql://myuser:mypassword@localhost:5432/mydatabase` | PostgreSQL connection string. Format: `postgresql://user:password@host:port/database`. The default matches the Docker command above — override in production. |
| `PORT` | No | `3001` | Server port. |
| `BIND_ADDRESS` | No | `127.0.0.1` | Bind address. Use `0.0.0.0` for Docker/Railway. |
| `NODE_ENV` | No | `development` | Set `production` to disable CORS and serve frontend static files. |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed CORS origin (dev mode only). |
| `API_KEY` | No | — | Secret for programmatic API access via `X-API-Key` header. |
| `BETTER_AUTH_URL` | No | `http://localhost:{PORT}` | Base URL for Better Auth (set to your public URL in production). |
| `FRONTEND_PORT` | No | — | Extra trusted origin port for Better Auth (added to trusted origins list). |
| `THROTTLE_TTL` | No | `60000` | Rate limit window in milliseconds. |
| `THROTTLE_LIMIT` | No | `100` | Max requests per rate limit window. |
| `SEED_DATA` | No | — | Set `true` to seed demo data on startup. |

*The default `DATABASE_URL` matches the Docker command in the PostgreSQL section above. For production, you must set this to your actual PostgreSQL connection string.

#### Email (Mailgun)

Required for email verification and password reset to work. Without these, users can register but won't receive verification or reset emails.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MAILGUN_API_KEY` | Yes* | — | Mailgun API key (starts with `key-`). Found in Mailgun dashboard under API Keys. |
| `MAILGUN_DOMAIN` | Yes* | — | Mailgun sending domain (e.g. `mg.yourdomain.com`). Must be verified in Mailgun. |
| `NOTIFICATION_FROM_EMAIL` | No | `noreply@manifest.build` | Sender email address for all outgoing emails. |

*If not set, the app runs normally but email verification and password reset emails are silently skipped.

#### OAuth Providers (all optional)

Each provider requires both `CLIENT_ID` and `CLIENT_SECRET` to be set. If either is missing, that provider is disabled.

| Variable | Description |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth |

#### Plugin (optional)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PLUGIN_OTLP_ENDPOINT` | No | — | Custom OTLP endpoint URL shown in the plugin setup UI. |

## Authentication

Manifest uses [Better Auth](https://www.better-auth.com/) for user authentication. Two auth methods are supported:

### Session-Based (UI)

Users sign in via the web UI using email/password or one of three OAuth providers (Google, GitHub, Discord). Sessions are cookie-based and managed by Better Auth at `/api/auth/*`.

### API Key (Programmatic)

For CLI/script access, set the `API_KEY` env var and pass it via `X-API-Key` header. This bypasses session auth and is useful for automation.

### OTLP Ingest Keys

Each agent gets a unique ingest key (`mnfst_*` format) for sending telemetry. Pass it via `Authorization: Bearer <key>` to OTLP endpoints. Keys are created automatically when onboarding a new agent.

## Multi-Tenancy

Each authenticated user is mapped to a **tenant**. Agents belong to tenants, and all data is filtered by tenant ownership:

```
User (Better Auth) ──→ Tenant ──→ Agent ──→ AgentApiKey (mnfst_*)
                                    │
                                    └──→ agent_messages (telemetry data)
```

- Users only see their own agents and telemetry data
- Creating an agent via the UI auto-creates the tenant, agent, and OTLP ingest key
- The `user.id` from Better Auth is used as the tenant `name`

## Connecting OpenTelemetry

Manifest accepts standard OTLP HTTP signals (traces, metrics, logs). Any OpenTelemetry SDK exporter can send data directly to the platform.

### Endpoints

| Signal  | Endpoint                | Auth                                    |
| ------- | ----------------------- | --------------------------------------- |
| Traces  | `POST /otlp/v1/traces`  | `Authorization: Bearer <agent-api-key>` |
| Metrics | `POST /otlp/v1/metrics` | `Authorization: Bearer <agent-api-key>` |
| Logs    | `POST /otlp/v1/logs`    | `Authorization: Bearer <agent-api-key>` |

Both `application/json` and `application/x-protobuf` content types are supported.

### Node.js / TypeScript Example

```bash
npm install @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/exporter-logs-otlp-http
```

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

const headers = { Authorization: 'Bearer mnfst_your-agent-api-key' }
const baseUrl = 'http://localhost:3001'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: `${baseUrl}/otlp/v1/traces`,
    headers,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${baseUrl}/otlp/v1/metrics`,
      headers,
    }),
  }),
  logRecordProcessor: new OTLPLogExporter({
    url: `${baseUrl}/otlp/v1/logs`,
    headers,
  }),
  serviceName: 'my-agent',
  resource: { 'agent.name': 'my-agent' },
})

sdk.start()
```

### Python Example

```bash
pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http
```

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
exporter = OTLPSpanExporter(
    endpoint="http://localhost:3001/otlp/v1/traces",
    headers={"Authorization": "Bearer mnfst_your-agent-api-key"},
)
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("my-agent")
with tracer.start_as_current_span("process-request"):
    pass  # your agent logic
```

### Using the OpenTelemetry Collector

If you run the OTel Collector, add Manifest as an OTLP HTTP exporter:

```yaml
# otel-collector-config.yaml
exporters:
  otlphttp/manifest:
    endpoint: http://localhost:3001
    headers:
      Authorization: 'Bearer mnfst_your-agent-api-key'

service:
  pipelines:
    traces:
      exporters: [otlphttp/manifest]
    metrics:
      exporters: [otlphttp/manifest]
    logs:
      exporters: [otlphttp/manifest]
```

### Semantic Conventions

Manifest classifies OTLP trace spans using these attributes:

| Attribute                    | Maps to               | Purpose                           |
| ---------------------------- | --------------------- | --------------------------------- |
| `agent.name`                 | Agent name            | Groups data per agent             |
| `gen_ai.system`              | LLM call record       | Identifies spans as LLM API calls |
| `gen_ai.request.model`       | Model name            | Tracks which model was used       |
| `gen_ai.usage.input_tokens`  | Input tokens          | Token usage tracking              |
| `gen_ai.usage.output_tokens` | Output tokens         | Token usage tracking              |
| `tool.name`                  | Tool execution record | Identifies spans as tool calls    |
| `session.key`                | Session key           | Groups messages by session        |

## API Reference

### Agent Management

| Method | Route                       | Auth            | Purpose                            |
| ------ | --------------------------- | --------------- | ---------------------------------- |
| GET    | `/api/v1/agents`            | Session/API Key | List user's agents with sparklines |
| POST   | `/api/v1/agents`            | Session/API Key | Create agent + OTLP ingest key     |
| DELETE | `/api/v1/agents/:agentName` | Session/API Key | Delete an agent                    |

### Analytics

| Method | Route                        | Auth            | Purpose               |
| ------ | ---------------------------- | --------------- | --------------------- |
| GET    | `/api/v1/overview?range=24h` | Session/API Key | Dashboard summary     |
| GET    | `/api/v1/tokens?range=24h`   | Session/API Key | Token usage analytics |
| GET    | `/api/v1/costs?range=24h`    | Session/API Key | Cost breakdown        |
| GET    | `/api/v1/messages?range=24h` | Session/API Key | Paginated message log |
| GET    | `/api/v1/security?range=24h` | Session/API Key | Security events       |

### Telemetry Ingestion

| Method | Route               | Auth    | Purpose                           |
| ------ | ------------------- | ------- | --------------------------------- |
| POST   | `/api/v1/telemetry` | API Key | Ingest events (JSON, returns 202) |
| POST   | `/otlp/v1/traces`   | Bearer  | OTLP trace ingestion              |
| POST   | `/otlp/v1/metrics`  | Bearer  | OTLP metric ingestion             |
| POST   | `/otlp/v1/logs`     | Bearer  | OTLP log ingestion                |

### Other

| Method | Route            | Auth   | Purpose                                        |
| ------ | ---------------- | ------ | ---------------------------------------------- |
| GET    | `/api/v1/health` | Public | Health check                                   |
| ALL    | `/api/auth/*`    | Public | Better Auth (login, register, OAuth, sessions) |

## Frontend Pages

| Route                    | Page           | Description                                            |
| ------------------------ | -------------- | ------------------------------------------------------ |
| `/login`                 | Login          | Email/password + social OAuth                          |
| `/register`              | Register       | Create new account                                     |
| `/reset-password`        | Reset Password | Password recovery                                      |
| `/`                      | Workspace      | Agent grid (auto-opens "Add Agent" modal if no agents) |
| `/agents/:name`          | Overview       | Agent dashboard with charts                            |
| `/agents/:name/messages` | Message Log    | Paginated message history                              |
| `/agents/:name/settings` | Settings       | Agent configuration                                    |
| `/account`               | Account        | User profile and workspace ID                          |

## Deployment

### Single-Service Architecture

The app deploys as a single service. In production, NestJS serves both the API and frontend static files from the same port via `@nestjs/serve-static`.

```bash
npm run build     # Turborepo: frontend (Vite) then backend (Nest)
npm start         # Starts single server serving everything
```

### Railway

Set these environment variables in Railway:

| Variable              | Value        | Notes                                  |
| --------------------- | ------------ | -------------------------------------- |
| `DATABASE_URL`        | (from addon) | Add a PostgreSQL addon, use its URL    |
| `BETTER_AUTH_SECRET`  | (generate)   | `openssl rand -hex 32`                 |
| `PORT`                | (auto)       | Railway sets this automatically        |
| `BIND_ADDRESS`        | `0.0.0.0`    | Required for Railway                   |
| `NODE_ENV`            | `production` | Disables CORS, serves frontend static  |

Build command: `npm run build`
Start command: `npm start`

## Database Migrations

TypeORM migrations are version-controlled and run automatically on app startup (`migrationsRun: true`). Schema sync (`synchronize`) is permanently disabled.

### Dev Workflow

1. Modify an entity in `packages/backend/src/entities/`
2. Generate a migration: `npm run migration:generate --workspace=packages/backend -- src/database/migrations/DescriptiveName`
3. Commit both the entity change and the migration file

### Migration Commands

Run from the repo root with `--workspace=packages/backend`, or `cd packages/backend` first.

| Command | Description |
| --- | --- |
| `npm run migration:generate -- src/database/migrations/Name` | Generate migration from entity diff |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert the last migration |
| `npm run migration:show` | Show migration status (`[X]` = applied) |
| `npm run migration:create -- src/database/migrations/Name` | Create an empty migration file |

## Testing

```bash
# All tests
npm test --workspace=packages/backend && npm run test:e2e --workspace=packages/backend && npm test --workspace=packages/frontend

# Individual
npm test --workspace=packages/backend          # Jest unit tests (250 tests)
npm run test:e2e --workspace=packages/backend  # Jest e2e tests (45 tests)
npm test --workspace=packages/frontend         # Vitest tests (51 tests)
npm run build                         # Verify TypeScript compilation
```

## License

[MIT](LICENSE)
