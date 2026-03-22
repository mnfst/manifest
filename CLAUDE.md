# Manifest Development Guidelines

Last updated: 2026-03-15

## IMPORTANT: Local Mode First

When starting the app for development or testing (e.g. `/serve`), **always use `MANIFEST_MODE=local`** unless explicitly asked for cloud mode. Local mode is the primary development target — cloud mode comes second.

## Plugin Dev Mode

When testing the OpenClaw plugin integration (routing, telemetry, OTLP), use **dev mode** to connect the plugin to a local backend without API key management:

```bash
# 1. Build and start the backend in local mode
npm run build
MANIFEST_MODE=local PORT=38238 BIND_ADDRESS=127.0.0.1 \
  node -r dotenv/config packages/backend/dist/main.js

# 2. Configure the plugin
openclaw config set plugins.entries.manifest.config.mode cloud
openclaw config set plugins.entries.manifest.config.devMode true
openclaw config set plugins.entries.manifest.config.endpoint http://localhost:38238/otlp

# 3. Restart the gateway
openclaw gateway restart
```

No API key needed. The dashboard shows an orange **Dev** badge in the header when running in development environment (`NODE_ENV !== 'production'`). Dev mode uses the OTLP loopback bypass — the `OtlpAuthGuard` trusts same-machine connections without Bearer token auth. Note: `devMode` is auto-detected when the endpoint is a loopback address and no `mnfst_*` API key is provided.

### Resetting OpenClaw Plugin Settings

If the plugin gets into a bad state (stale config, wrong endpoint, cached errors), reset it fully:

```bash
# Reset plugin config to defaults
openclaw config set plugins.entries.manifest.config.mode cloud
openclaw config set plugins.entries.manifest.config.devMode true
openclaw config set plugins.entries.manifest.config.endpoint http://localhost:<PORT>/otlp

# Force restart the gateway (kills existing process and starts fresh)
openclaw gateway restart
```

**Important notes:**
- The OpenClaw config lives at `~/.openclaw/openclaw.json`. The gateway may restore certain fields (like `apiKey`) on restart — editing the file directly doesn't always stick.
- When `devMode` is true, the gateway sends `Authorization: Bearer dev-no-auth` to the proxy. The `OtlpAuthGuard` accepts any non-`mnfst_*` token from loopback IPs in local mode, so this works without real API keys.
- After restarting the backend server, **always restart the gateway too** (`openclaw gateway restart`) — the OTLP pipeline doesn't automatically reconnect.
- The gateway batches OTLP telemetry and sends it every ~10-30 seconds. New messages may take a moment to appear in the dashboard.

## Active Technologies

- **Backend**: NestJS 11, TypeORM 0.3, PostgreSQL 16, Better Auth, class-validator, class-transformer, Helmet
- **Frontend**: SolidJS, Vite, uPlot (charts), Better Auth client, custom CSS theme
- **Runtime**: TypeScript 5.x (strict mode), Node.js 22.x
- **Monorepo**: npm workspaces + Turborepo
- **Release**: Changesets for version management + GitHub Actions for npm publishing

## Project Structure

```text
packages/
├── backend/
│   ├── src/
│   │   ├── main.ts                          # Bootstrap: Helmet, ValidationPipe, Better Auth mount, CORS
│   │   ├── app.module.ts                    # Root module (guards: ApiKey, Session, Throttler)
│   │   ├── config/app.config.ts             # Environment variable config
│   │   ├── auth/
│   │   │   ├── auth.instance.ts             # Better Auth singleton (email/pass + 3 OAuth)
│   │   │   ├── auth.module.ts               # Registers SessionGuard as APP_GUARD
│   │   │   ├── session.guard.ts             # Cookie session auth via Better Auth
│   │   │   └── current-user.decorator.ts    # @CurrentUser() param decorator
│   │   ├── database/
│   │   │   ├── database.module.ts           # TypeORM PostgreSQL config
│   │   │   ├── database-seeder.service.ts   # Seeds model_pricing + demo data
│   │   │   ├── local-bootstrap.service.ts   # Seeds local mode (SQLite)
│   │   │   ├── datasource.ts               # CLI DataSource for migration commands
│   │   │   ├── pricing-sync.service.ts      # External pricing data sync
│   │   │   ├── ollama-sync.service.ts       # Ollama model sync
│   │   │   └── seed-models.ts              # Model pricing seed data
│   │   ├── entities/                        # TypeORM entities (20 files)
│   │   │   ├── tenant.entity.ts             # Multi-tenant root
│   │   │   ├── agent.entity.ts              # Agent (belongs to tenant)
│   │   │   ├── agent-api-key.entity.ts      # OTLP ingest keys (mnfst_*)
│   │   │   └── ...                          # agent-message, agent-log, llm-call, tool-execution, etc.
│   │   ├── common/
│   │   │   ├── guards/api-key.guard.ts      # X-API-Key header auth (timing-safe)
│   │   │   ├── decorators/public.decorator.ts
│   │   │   ├── dto/                         # create-agent, range-query, rename-agent DTOs
│   │   │   ├── filters/spa-fallback.filter.ts
│   │   │   ├── interceptors/               # agent-cache, user-cache
│   │   │   ├── constants/                   # api-key, cache, local-mode, ollama
│   │   │   ├── services/                    # ingest-event-bus, manifest-runtime, tenant-cache
│   │   │   ├── utils/range.util.ts
│   │   │   ├── utils/hash.util.ts           # API key hashing (scrypt KDF)
│   │   │   ├── utils/crypto.util.ts         # AES-256-GCM encryption
│   │   │   ├── utils/sql-dialect.ts         # Cross-DB SQL helpers (Postgres/SQLite)
│   │   │   ├── utils/slugify.ts             # Name slugification
│   │   │   ├── utils/url-validation.ts      # URL validation
│   │   │   ├── utils/provider-inference.ts  # Provider detection from model names
│   │   │   └── utils/period.util.ts         # Time period utilities
│   │   ├── health/                          # @Public() health check
│   │   ├── telemetry/                       # POST /api/v1/telemetry (JSON ingestion)
│   │   ├── analytics/                       # Dashboard analytics
│   │   │   ├── controllers/                 # overview, tokens, costs, messages, agents
│   │   │   └── services/                    # aggregation + timeseries-queries + query-helpers
│   │   ├── otlp/                            # OTLP ingestion (traces, metrics, logs)
│   │   │   ├── guards/otlp-auth.guard.ts    # Bearer token auth (agent API keys)
│   │   │   ├── services/api-key.service.ts  # Agent onboarding (creates tenant+agent+key)
│   │   │   └── services/                    # trace-ingest, metric-ingest, log-ingest, otlp-decoder
│   │   ├── routing/                         # LLM routing (providers, tiers, proxy, scorer)
│   │   │   ├── proxy/                       # OpenAI-compatible proxy (anthropic/google adapters)
│   │   │   └── scorer/                      # Scoring engine with dimensions
│   │   ├── model-prices/                    # Model pricing management + sync
│   │   ├── notifications/                   # Alert rules, email providers, cron
│   │   ├── github/                          # GitHub stars endpoint
│   │   ├── sse/                             # Server-Sent Events for real-time updates
│   │   └── security/                        # GET /api/v1/security
│   └── test/                                # E2E tests (supertest)
├── frontend/
│   ├── src/
│   │   ├── index.tsx                        # Router setup (App + AuthLayout)
│   │   ├── components/
│   │   │   ├── AuthGuard.tsx                # Session check, redirect to /login
│   │   │   ├── GuestGuard.tsx               # Redirect authenticated users away from auth pages
│   │   │   ├── SocialButtons.tsx            # 3 OAuth provider buttons
│   │   │   ├── Header.tsx                   # User session data, logout
│   │   │   ├── Sidebar.tsx                  # Navigation sidebar
│   │   │   ├── SetupModal.tsx               # Agent setup wizard modal
│   │   │   └── ...                          # Charts, modals, pagination, etc.
│   │   ├── pages/
│   │   │   ├── Login.tsx, Register.tsx       # Auth pages
│   │   │   ├── ResetPassword.tsx            # Password reset flow
│   │   │   ├── Workspace.tsx                # Agent grid + create agent
│   │   │   ├── Overview.tsx                 # Agent dashboard
│   │   │   ├── MessageLog.tsx               # Paginated messages
│   │   │   ├── Account.tsx                  # User profile (session data)
│   │   │   ├── Settings.tsx                 # Agent settings
│   │   │   ├── Routing.tsx                  # LLM routing config
│   │   │   ├── Limits.tsx                   # Alert rule management (token/cost thresholds)
│   │   │   ├── ModelPrices.tsx              # Model pricing table
│   │   │   ├── Help.tsx                     # Help page
│   │   │   └── NotFound.tsx                 # 404 page
│   │   ├── services/
│   │   │   ├── auth-client.ts               # Better Auth SolidJS client
│   │   │   ├── api.ts                       # API functions (credentials: include)
│   │   │   ├── formatters.ts               # Number/cost formatting
│   │   │   ├── provider-utils.ts            # LLM provider helpers
│   │   │   ├── routing.ts, routing-utils.ts # Routing config helpers
│   │   │   ├── theme.ts                     # Theme management
│   │   │   ├── toast-store.ts               # Toast notification state
│   │   │   └── local-mode.ts               # Local mode detection
│   │   ├── layouts/                         # Layout components
│   │   └── styles/
│   └── tests/
├── openclaw-plugin/               # npm: `manifest` — OpenClaw observability plugin (includes embedded server)
└── subscription-capabilities/     # Subscription provider config (not in npm workspaces)
```

## Single-Service Deployment

The app deploys as a **single service**. In production, NestJS serves both the API and the frontend static files from the same port.

```bash
npm run build     # Turborepo: frontend (Vite) then backend (Nest)
npm start         # node packages/backend/dist/main.js — serves frontend + API
```

- API routes (`/api/*`, `/otlp/*`) are excluded from static file serving.
- Dev mode: Vite on `:3000` proxies `/api` and `/otlp` to backend on `:3001`.

## Commands

### Starting the Dev Server

The backend requires a `.env` file at `packages/backend/.env` with at least `BETTER_AUTH_SECRET` (32+ chars). The `auth.instance.ts` reads `process.env` at import time, before NestJS `ConfigModule` loads `.env`, so env vars must be available to the Node process.

**Quick start (run these in parallel):**

```bash
# Backend — must preload dotenv since auth.instance.ts reads process.env at import time
cd packages/backend && NODE_OPTIONS='-r dotenv/config' npx nest start --watch

# Frontend
cd packages/frontend && npx vite

# Plugin (watch mode, optional)
cd packages/openclaw-plugin && npx tsx watch build.ts
```

**Note:** `npm run dev` (turbo) starts frontend + plugin but NOT the backend, because the backend's script is `start:dev` not `dev`. Start the backend separately as shown above.

### Seeding Dev Data

Set `SEED_DATA=true` in `packages/backend/.env` to seed on startup (dev/test only). This creates:

- **Admin user**: `admin@manifest.build` / `manifest` (email verification email is skipped if Mailgun is not configured — user is created but unverified)
- **Tenant**: `seed-tenant-001` linked to the admin user
- **Agent**: `demo-agent` with OTLP key `dev-otlp-key-001`
- **API key**: `dev-api-key-manifest-001`
- **Security events**: 12 sample events for the security dashboard
- **Model pricing**: 48 models seeded (Anthropic, OpenAI, Google, Meta, Mistral, DeepSeek, xAI, Alibaba/Qwen, etc.)

Seeding is idempotent — it checks for existing records before inserting.

**Minimal `.env` for development:**

```env
PORT=3001
BIND_ADDRESS=127.0.0.1
NODE_ENV=development
BETTER_AUTH_SECRET=<random-hex-64-chars>
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mydatabase
API_KEY=dev-api-key-12345
SEED_DATA=true
```

Generate a secret with: `openssl rand -hex 32`

**Database naming convention:** Always create uniquely-named databases to avoid overlapping other dev/test instances. Use the pattern `manifest_<context>_<random>` (e.g., `manifest_sse_49821`, `manifest_dev_83712`). Create databases via Docker:

```bash
docker exec postgres_db psql -U myuser -d postgres -c "CREATE DATABASE manifest_<name>;"
```

Then set `DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/manifest_<name>` in `.env`.

**Plugin build (one-time):**

```bash
npm run build:plugin
# or: cd packages/openclaw-plugin && npx tsx build.ts
```

```bash
# Production build + start (single server)
npm run build && npm start

# Tests
npm test --workspace=packages/backend          # Jest unit tests
npm run test:e2e --workspace=packages/backend  # Jest e2e tests
npm test --workspace=packages/frontend         # Vitest tests
```

### Database Migrations

TypeORM migrations run automatically on app startup (`migrationsRun: true`). Schema sync (`synchronize`) is permanently disabled — all schema changes must go through migrations.

**Dev workflow:** modify entity → generate migration → commit both.

```bash
# Generate a migration after changing an entity
cd packages/backend
npm run migration:generate -- src/database/migrations/DescriptiveName

# Other migration commands
npm run migration:run       # Run pending migrations
npm run migration:revert    # Revert the last migration
npm run migration:show      # Show migration status ([X] = applied)
npm run migration:create -- src/database/migrations/Name  # Create empty migration
```

New migrations must be imported in `database.module.ts` and added to the `migrations` array.

**Important**: Always use unique timestamps for new migrations. Never reuse a timestamp from an existing migration file.

## Authentication Architecture

### Guard Chain

Three global guards run on every request (order matters):

1. **SessionGuard** (`auth/session.guard.ts`) — Checks `@Public()` first. If not public, validates the Better Auth cookie session via `auth.api.getSession()`. Attaches `request.user` and `request.session`.
2. **ApiKeyGuard** (`common/guards/api-key.guard.ts`) — Falls through if session already set. Otherwise checks `X-API-Key` header against `API_KEY` env var (timing-safe compare). Use `@Public()` to skip both guards.
3. **ThrottlerGuard** — Rate limiting.

### Better Auth Setup

- **Instance**: `auth/auth.instance.ts` — `betterAuth()` with `emailAndPassword` + 3 social providers (Google, GitHub, Discord). Each provider only activates when both `CLIENT_ID` and `CLIENT_SECRET` env vars are set.
- **Mounting**: In `main.ts`, Better Auth is mounted as Express middleware at `/api/auth/*splat` **before** `express.json()` (it needs raw body control). NestJS body parsing is re-added after for all other routes.
- **Frontend client**: `services/auth-client.ts` — `createAuthClient()` from `better-auth/solid`.
- **Social login in dev**: OAuth callback URLs point to `:3001` (`BETTER_AUTH_URL`). Social login only works when accessing the app on port **3001** (production build), not on Vite's `:3000` dev server.

### Auth Types

```typescript
// backend/src/auth/auth.instance.ts
export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;

// Use in controllers:
@Get('something')
async handler(@CurrentUser() user: AuthUser) {
  // user.id, user.name, user.email
}
```

## Multi-Tenancy Model

```
User (Better Auth) ──→ Tenant ──→ Agent ──→ AgentApiKey (mnfst_*)
                                    │
                                    └──→ agent_messages (telemetry data)
```

- **Tenant** (`tenants` table): Created automatically on first agent creation. `tenant.name` = `user.id`.
- **Agent** (`agents` table): Belongs to a tenant. Unique constraint on `[tenant_id, name]`.
- **AgentApiKey** (`agent_api_keys` table): One-to-one with agent. `mnfst_*` format key for OTLP ingestion.
- **Onboarding flow**: `ApiKeyGeneratorService.onboardAgent()` creates tenant (if new) + agent + API key in one transaction.

### Data Isolation

All analytics queries filter by user via `addTenantFilter(qb, userId)` from `query-helpers.ts`. The `userId` comes from the `@CurrentUser()` decorator.

## API Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/v1/health` | Public | Health check |
| ALL | `/api/auth/*` | Public | Better Auth (login, register, OAuth, sessions) |
| POST | `/api/v1/telemetry` | API Key | Ingest events (returns 202) |
| GET | `/api/v1/overview` | Session/API Key | Dashboard summary |
| GET | `/api/v1/tokens` | Session/API Key | Token usage analytics |
| GET | `/api/v1/costs` | Session/API Key | Cost analytics |
| GET | `/api/v1/messages` | Session/API Key | Paginated message log |
| GET | `/api/v1/agents` | Session/API Key | Agent list with sparklines |
| POST | `/api/v1/agents` | Session/API Key | Create agent + OTLP key |
| DELETE | `/api/v1/agents/:name` | Session/API Key | Delete agent |
| GET | `/api/v1/agents/:name/key` | Session/API Key | Get agent OTLP key |
| POST | `/api/v1/agents/:name/rotate-key` | Session/API Key | Rotate OTLP key |
| PATCH | `/api/v1/agents/:name` | Session/API Key | Rename agent |
| GET | `/api/v1/security` | Session/API Key | Security score + events |
| GET | `/api/v1/model-prices` | Session/API Key | Model pricing list |
| GET | `/api/v1/agent/:agentName/usage` | Session/API Key | Per-agent token usage |
| GET | `/api/v1/agent/:agentName/costs` | Session/API Key | Per-agent cost data |
| GET/POST/PATCH/DELETE | `/api/v1/notifications` | Session/API Key | Notification rules CRUD |
| GET/POST/DELETE | `/api/v1/notifications/email-provider` | Session/API Key | Email provider config |
| GET/POST/PUT/DELETE | `/api/v1/routing/*` | Session/API Key | Routing config |
| POST | `/api/v1/routing/subscription-providers` | Session/API Key | Subscription provider config |
| POST | `/api/v1/routing/:agentName/ollama/sync` | Session/API Key | Sync Ollama models |
| POST | `/api/v1/routing/resolve` | Bearer (mnfst_*) | Model resolution |
| POST | `/v1/chat/completions` | Bearer (mnfst_*) | LLM proxy (OpenAI-compatible) |
| GET | `/api/v1/events` | Session | SSE real-time events |
| GET | `/api/v1/github/stars` | Public | GitHub star count |
| POST | `/otlp/v1/traces` | Bearer (mnfst_*) | OTLP trace ingestion |
| POST | `/otlp/v1/metrics` | Bearer (mnfst_*) | OTLP metric ingestion |
| POST | `/otlp/v1/logs` | Bearer (mnfst_*) | OTLP log ingestion |

## Environment Variables

See `packages/backend/.env.example` for all variables. Key ones:

- `BETTER_AUTH_SECRET` — **Required.** Secret for Better Auth session signing (min 32 chars). Generate with `openssl rand -hex 32`.
- `DATABASE_URL` — **Required in production.** PostgreSQL connection string. Format: `postgresql://user:password@host:port/database`. Defaults to `postgresql://myuser:mypassword@localhost:5432/mydatabase` (matches the local Docker command).
- `PORT` — Server port. Default: `3001`
- `BIND_ADDRESS` — Bind address. Default: `127.0.0.1` (use `0.0.0.0` for Railway/Docker)
- `NODE_ENV` — `development` or `production`. CORS only enabled in dev.
- `CORS_ORIGIN` — Allowed CORS origin. Default: `http://localhost:3000`
- `BETTER_AUTH_URL` — Base URL for Better Auth. Default: `http://localhost:{PORT}`
- `FRONTEND_PORT` — Extra trusted origin port for Better Auth.
- `API_KEY` — Secret for programmatic API access (X-API-Key header).
- `THROTTLE_TTL` — Rate limit window in ms. Default: `60000`
- `THROTTLE_LIMIT` — Max requests per window. Default: `100`
- `MAILGUN_API_KEY` — Mailgun API key for email verification/password reset.
- `MAILGUN_DOMAIN` — Mailgun sending domain (e.g. `mg.manifest.build`).
- `NOTIFICATION_FROM_EMAIL` — Sender email. Default: `noreply@manifest.build`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth (optional)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth (optional)
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — Discord OAuth (optional)
- `PLUGIN_OTLP_ENDPOINT` — Custom OTLP endpoint for plugin setup UI.
- `SEED_DATA` — Set `true` to seed demo data on startup.
- `MANIFEST_MODE` — `local` or `cloud` (default: `cloud`). Switches between SQLite/loopback auth and PostgreSQL/Better Auth.
- `MANIFEST_DB_PATH` — SQLite file path for local mode (default: in-memory).
- `MANIFEST_TELEMETRY_OPTOUT` — Set `1` to disable local-mode npm version checks.

## Domain Terminology

- **Message**: The primary entity in the system. Every row in `agent_messages` is a Message. The UI labels them "Messages" everywhere.
- **Tenant**: A user's data boundary. Created from `user.id` on first agent creation.
- **Agent**: An AI agent owned by a tenant. Has a unique OTLP ingest key.

## Content Security Policy (CSP)

Helmet enforces a strict CSP in `main.ts`. The policy only allows `'self'` origins — **no external CDNs are permitted**.

**Rule: Never load external resources from CDNs.** All assets (fonts, icons, stylesheets) must be self-hosted under `packages/frontend/public/`. This keeps the CSP strict and avoids third-party dependencies at runtime.

Current self-hosted assets:
- **Boxicons Duotone** — `public/fonts/boxicons/` (CSS + woff/ttf font files)

To add a new font or icon library:
1. Download the CSS and font files into `packages/frontend/public/`
2. Rewrite any CDN URLs inside the CSS to use relative paths (`./filename.woff`)
3. Reference the local CSS in `index.html` (e.g. `<link href="/fonts/..." />`)
4. Do **not** add external domains to the CSP directives

## Architecture Notes

- **Single-service**: In production, `@nestjs/serve-static` serves `frontend/dist/` with SPA fallback. API routes (`/api/*`, `/otlp/*`) are excluded.
- **Dev mode**: Vite dev server on `:3000` proxies `/api` and `/otlp` to backend on `:3001`. CORS enabled only in dev.
- **Body parsing**: Disabled at NestJS level (`bodyParser: false`). Better Auth mounted first (needs raw body), then `express.json()` and `express.raw()` for OTLP protobuf.
- **QueryBuilder API**: Analytics and ingestion services use TypeORM `Repository.createQueryBuilder()` instead of raw SQL. The `addTenantFilter()` helper in `query-helpers.ts` applies multi-tenant WHERE clauses. Only the database seeder and notification cron still use `DataSource.query()` with numbered `$1, $2, ...` placeholders.
- **PostgreSQL time functions**: `NOW() - CAST(:interval AS interval)`, `to_char(date_trunc('hour', timestamp), ...)`, `timestamp::date`.
- **Better Auth database**: In cloud mode, uses a `pg.Pool` instance passed directly to `betterAuth({ database: pool })`. In local mode, Better Auth is skipped entirely (`auth = null`) — `LocalAuthGuard` handles auth via loopback IP check, and simple Express handlers serve session data.
- **Local mode database**: Uses `sql.js` (WASM-based SQLite, zero native deps). TypeORM driver type is `'sqljs'` with `autoSave: true` for file persistence.
- **PostgreSQL container**: `docker run -d --name postgres_db -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=mydatabase -p 5432:5432 postgres:16`
- **Validation**: Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`. Explicit `@Type()` decorators on numeric DTO fields.
- **OTLP auth caching**: `OtlpAuthGuard` caches valid API keys in-memory for 5 minutes to avoid repeated DB lookups.
- **Database migrations**: TypeORM migrations are version-controlled in `src/database/migrations/`. `synchronize` is permanently `false`. Migrations auto-run on boot (`migrationsRun: true`) wrapped in a single transaction. The CLI DataSource is at `src/database/datasource.ts`. Better Auth manages its own tables separately via `ctx.runMigrations()`.
- **SSE**: `SseController` provides `/api/v1/events` for real-time dashboard updates.
- **Notifications**: Cron-based threshold checking, supports Mailgun + Resend + SMTP email providers.
- **LLM Routing**: Tier-based model routing with provider key management (AES-256-GCM encrypted) and OpenAI-compatible proxy at `/v1/chat/completions`.

## Providers & Models

### Provider Registry (Single Source of Truth)

All provider definitions live in `common/constants/providers.ts` (`PROVIDER_REGISTRY`). This is the **only** place to define provider IDs, display names, aliases, and OpenRouter prefix mappings. Never hardcode provider names elsewhere — always import from the registry.

The registry exports derived maps used throughout the codebase:
- `PROVIDER_BY_ID` — lookup by canonical ID (e.g. `anthropic`, `gemini`)
- `PROVIDER_BY_ID_OR_ALIAS` — lookup by ID or alias (e.g. `google` → gemini entry)
- `OPENROUTER_PREFIX_TO_PROVIDER` — OpenRouter vendor prefix → display name (e.g. `openai` → `OpenAI`)
- `expandProviderNames()` — expands a set of names to include aliases

**Supported providers (12):**

| ID | Display Name | Aliases | OpenRouter Prefixes | Notes |
|----|-------------|---------|-------------------|-------|
| `anthropic` | Anthropic | — | `anthropic` | Supports subscription auth |
| `openai` | OpenAI | — | `openai` | |
| `gemini` | Google | `google` | `google` | Key-in-URL auth for model list |
| `deepseek` | DeepSeek | — | `deepseek` | |
| `mistral` | Mistral | — | `mistralai` | |
| `moonshot` | Moonshot | `kimi` | `moonshotai` | |
| `xai` | xAI | — | `xai`, `x-ai` | |
| `minimax` | MiniMax | — | `minimax` | |
| `qwen` | Alibaba | `alibaba` | `qwen`, `alibaba` | |
| `zai` | Z.ai | `z.ai` | `z-ai`, `zhipuai` | |
| `openrouter` | OpenRouter | — | `openrouter` | Public API, no key needed for model list |
| `ollama` | Ollama | — | — | Local only, no key needed |

### Adding a New Provider

1. Add entry to `PROVIDER_REGISTRY` in `common/constants/providers.ts`
2. Add `FetcherConfig` in `routing/model-discovery/provider-model-fetcher.service.ts`
3. Add `ProviderEndpoint` in `routing/proxy/provider-endpoints.ts`
4. Add `ProviderDef` in `frontend/src/services/providers.ts`

### Model Discovery

Each provider's model list is fetched from **that provider's own API first**. If the native API fails or returns no models (some providers like MiniMax don't have a `/models` endpoint), the system falls back to building a model list from the OpenRouter pricing cache + OpenRouter pricing cache for that provider.

```
User connects provider (POST /routing/:agent/providers)
  → ProviderModelFetcherService.fetch(providerId, apiKey)
    → calls provider's /models endpoint (e.g. api.anthropic.com/v1/models)
    → if 0 models returned: buildFallbackModels() from OpenRouter cache + manual pricing
  → ModelDiscoveryService.enrichModel()
    → looks up pricing from OpenRouter cache (PricingSyncService)
    → falls back to OpenRouter pricing cache for niche providers
    → computes quality score
  → saves to user_providers.cached_models (JSONB column)
  → recalculates tier assignments
```

- `ProviderModelFetcherService` — config-driven fetcher with parsers for each provider API format (OpenAI-compatible, Anthropic, Gemini, OpenRouter, Ollama)
- `ModelDiscoveryService` — orchestrator that decrypts keys, fetches, enriches with pricing, caches results. Falls back to OpenRouter + manual pricing when native API is unavailable.
- `cached_models` — per-provider, per-agent JSONB column on `user_providers` table
- Discovery runs synchronously on provider connect (user sees models immediately)
- "Refresh models" button triggers `POST /routing/:agent/refresh-models`

### Model Pricing

The `model_pricing` database table has been **dropped**. All pricing comes from a single source:

- **OpenRouter API** (public, no key needed, fetched daily via cron + on startup) — provides pricing for all providers. Stored in-memory by `PricingSyncService`. No hardcoded pricing data anywhere.

`ModelPricingCacheService` merges both sources and attributes models to their real provider using OpenRouter vendor prefixes (via `OPENROUTER_PREFIX_TO_PROVIDER`). Unsupported community vendors stay under "OpenRouter".

**Priority order for model lists**: (1) Provider's native `/models` API, (2) OpenRouter cache filtered by vendor prefix, (3) Manual pricing reference. OpenRouter is the fallback, not the primary source. When a provider's native API works, its model list takes precedence.

### Where Models Appear

| Page | Source | What's shown |
|------|--------|-------------|
| **Model Prices** | `ModelPricingCacheService.getAll()` | All models from OpenRouter + manual pricing, attributed to real providers |
| **Routing (available models)** | `ModelDiscoveryService.getModelsForAgent()` | Only models from user's connected providers (discovered via native API) |
| **Routing (tier assignments)** | `TierAutoAssignService.recalculate()` | Auto-assigned from discovered models based on quality/price scoring |
| **Messages / Overview** | Stored in `agent_messages.model` column | Raw model name from telemetry, display name resolved via `model-display.ts` cache |

## Releases & Changesets

Version management and npm publishing use [Changesets](https://github.com/changesets/changesets). Config is in `.changeset/config.json`.

### Publishable Packages

| Package | npm name | Published |
|---------|----------|-----------|
| `packages/openclaw-plugin` | `manifest` | Yes (includes embedded server) |
| `packages/backend` | `manifest-backend` | No (`private: true`) |
| `packages/frontend` | `manifest-frontend` | No (`private: true`) |

Only `manifest` is actively published.

### CRITICAL: Every PR Needs a Changeset

**Before creating any PR, you MUST add a changeset.** The `changeset-check` CI job will fail without one.

- **Backend or frontend changes always need a `manifest` changeset.** These packages compile into `manifest`, so any change to `packages/backend/` or `packages/frontend/` must include a changeset bumping `manifest` (patch for fixes, minor for features). CI enforces this.
- If the PR changes a **publishable package** directly (`openclaw-plugin`): run `npx changeset` and select the appropriate bump level.
- **Empty changesets** (`npx changeset add --empty`) should only be used for changes that don't affect any publishable package: CI config, docs, tooling, or dev-only scripts.
- Commit the generated `.changeset/*.md` file as part of the PR.

### Workflow

1. When changing backend, frontend, or a publishable package, run `npx changeset` and select `manifest` with the appropriate bump level
2. On merge to `main`, the release workflow (`.github/workflows/release.yml`) opens a "Version Packages" PR
3. When that PR merges, the workflow publishes to npm using `NPM_TOKEN` secret

### Commands

```bash
npx changeset              # Add a changeset (interactive)
npx changeset status       # Check pending changesets
npm run version-packages   # Apply changesets (bump versions + changelogs)
npm run release             # Publish to npm (used by CI)
```

### CI Integration

The `changeset-check` job in `.github/workflows/ci.yml` runs `npx changeset status --since=origin/main` on PRs. It also enforces that any PR touching `packages/backend/` or `packages/frontend/` includes a `manifest` changeset. The job will fail if backend/frontend files changed without one.

## Code Coverage (Codecov)

Codecov runs on every PR via the `codecov/patch` and `codecov/project` checks. Configuration is in `codecov.yml`.

### Thresholds

- **Project coverage** (`codecov/project`): Must not drop more than **1%** below the base branch (`target: auto`, `threshold: 1%`).
- **Patch coverage** (`codecov/patch`): New/changed lines must have at least **auto - 5%** coverage (`target: auto`, `threshold: 5%`).

### CRITICAL: 100% Line Coverage Required

**Every PR must maintain 100% line coverage across all three packages.** The codebase currently has full line coverage and every PR must preserve it. This means:

- All new source files must have corresponding tests with 100% line coverage
- All modified functions must have tests covering every line, including error paths
- **Patch coverage must be 100%** — no new uncovered lines allowed
- Run coverage locally before creating a PR:
  - `cd packages/backend && npx jest --coverage`
  - `cd packages/frontend && npx vitest run --coverage`
  - `cd packages/openclaw-plugin && npx jest --coverage`

This applies to:

- New services, guards, controllers, or utilities in `packages/backend/src/`
- New components or functions in `packages/frontend/src/`
- New modules in `packages/openclaw-plugin/src/`

### Coverage Flags

| Flag | Paths | CI Job |
|------|-------|--------|
| `backend` | `packages/backend/src/` | Backend (PostgreSQL) |
| `frontend` | `packages/frontend/src/` | frontend |
| `plugin` | `packages/openclaw-plugin/src/` | plugin |

### E2E Test Entities

When adding new TypeORM entities to `database.module.ts`, also add them to the E2E test helper (`packages/backend/test/helpers.ts`) entities array. Missing entities cause `EntityMetadataNotFoundError` in services that depend on them.
