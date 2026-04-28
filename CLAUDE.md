# Manifest Development Guidelines

Last updated: 2026-04-12

## What Manifest Is

Manifest is a smart model router for **personal AI agents**. It sits between an agent and its LLM providers, scores each request, and routes it to the cheapest model that can handle it. The dashboard tracks costs, tokens, and messages across any agent that speaks OpenAI-compatible HTTP.

**Supported agents** (configured in `packages/shared/src/agent-type.ts`): OpenClaw, Hermes, OpenAI SDK, Vercel AI SDK, LangChain, cURL, and a generic `other` slot. OpenClaw remains the deepest integration, but no new code or copy should frame Manifest as OpenClaw-only. When adding examples, prefer "personal AI agent" as the noun and pick OpenClaw as the worked example rather than the sole target. Manifest is consumed as a generic OpenAI-compatible HTTP endpoint — there are no first-party OpenClaw plugins in this repo anymore.

## IMPORTANT: Cloud Mode Always

When starting the app for development or testing (e.g. `/serve`), **always use `MANIFEST_MODE=cloud`** (the default). Every dev session must use a **fresh PostgreSQL database** via Docker — multiple concurrent dev instances sharing one DB cause cross-run data pollution and intermittent test failures:

```bash
# 1. Ensure the postgres_db container is running
docker start postgres_db 2>/dev/null || \
  docker run -d --name postgres_db -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=mydatabase -p 5432:5432 postgres:16

# 2. Create a pristine database with a unique name
DB_NAME="manifest_$(openssl rand -hex 4)"
docker exec postgres_db psql -U myuser -d postgres -c "CREATE DATABASE $DB_NAME;"

# 3. Update DATABASE_URL in packages/backend/.env to use the new database
# DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/$DB_NAME

# 4. Ensure SEED_DATA=true in .env so the database is populated on startup
```

This guarantees each session starts with a clean, isolated database and avoids all cross-instance conflicts.

## Testing OpenClaw Integration

To test routing from an OpenClaw agent against a local Manifest dev server, point OpenClaw at the dev server's OpenAI-compatible proxy directly — there is no plugin anymore:

```bash
# 1. Build and start the backend in cloud mode
npm run build
PORT=38238 BIND_ADDRESS=127.0.0.1 \
  node -r dotenv/config packages/backend/dist/main.js

# 2. Configure OpenClaw to use the dev server as a generic OpenAI-compatible provider
openclaw config set models.providers.manifest '{"baseUrl":"http://localhost:38238/v1","api":"openai-completions","apiKey":"mnfst_YOUR_KEY","models":[{"id":"auto","name":"Manifest Auto"}]}'
openclaw config set agents.defaults.model.primary manifest/auto

# 3. Restart the gateway
openclaw gateway restart
```

The `AgentKeyAuthGuard` accepts any non-`mnfst_*` token from loopback IPs in the self-hosted version, so loopback-only testing works even without a valid key. After restarting the backend, also restart the OpenClaw gateway — it doesn't reconnect automatically.

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
│   │   │   ├── database-seeder.service.ts   # Seeds demo data (users, agents, security events)
│   │   │   ├── datasource.ts               # CLI DataSource for migration commands
│   │   │   ├── pricing-sync.service.ts      # OpenRouter pricing data sync
│   │   │   ├── ollama-sync.service.ts       # Ollama model sync
│   │   │   ├── quality-score.util.ts        # Model quality scoring
│   │   │   └── seed-messages.ts             # Demo agent message seed data
│   │   ├── entities/                        # TypeORM entities (17 files)
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
│   │   │   ├── constants/                   # api-key, cache, ollama, providers
│   │   │   ├── services/                    # ingest-event-bus, manifest-runtime, tenant-cache
│   │   │   ├── utils/range.util.ts
│   │   │   ├── utils/hash.util.ts           # API key hashing (scrypt KDF)
│   │   │   ├── utils/crypto.util.ts         # AES-256-GCM encryption
│   │   │   ├── utils/postgres-sql.ts        # Postgres SQL helpers (column types, bucket/cast expressions)
│   │   │   ├── utils/slugify.ts             # Name slugification
│   │   │   ├── utils/url-validation.ts      # URL validation
│   │   │   ├── utils/provider-inference.ts  # Provider detection from model names
│   │   │   └── utils/period.util.ts         # Time period utilities
│   │   ├── health/                          # @Public() health check
│   │   ├── analytics/                       # Dashboard analytics
│   │   │   ├── controllers/                 # overview, tokens, costs, messages, agents
│   │   │   └── services/                    # aggregation + timeseries-queries + query-helpers
│   │   ├── otlp/                            # Agent key auth + onboarding
│   │   │   ├── guards/agent-key-auth.guard.ts # Bearer token auth (agent API keys)
│   │   │   └── services/api-key.service.ts  # Agent onboarding (creates tenant+agent+key)
│   │   ├── routing/                         # LLM routing (providers, tiers, proxy, scorer)
│   │   │   ├── proxy/                       # OpenAI-compatible proxy (anthropic/google adapters)
│   │   │   ├── routing-core/               # Tier, provider, specificity services + cache
│   │   │   ├── specificity.controller.ts   # Specificity routing CRUD endpoints
│   │   │   └── resolve/                     # Scoring-based tier + specificity resolution
│   │   ├── scoring/                         # Request complexity scoring engine
│   │   │   ├── keywords.ts                 # Keyword lists for all dimensions (complexity + specificity)
│   │   │   ├── specificity-detector.ts     # Task-type detection (coding, trading, etc.)
│   │   │   └── scan-messages.ts            # Message scanner for specificity detection
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
│   │   │   └── toast-store.ts               # Toast notification state
│   │   ├── layouts/                         # Layout components
│   │   └── styles/
│   └── tests/
└── shared/                           # Shared TypeScript types + helpers (consumed by backend and frontend)
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
```

**Note:** `npm run dev` (turbo) starts the frontend but NOT the backend, because the backend's script is `start:dev` not `dev`. Start the backend separately as shown above.

### Seeding Dev Data

Set `SEED_DATA=true` in `packages/backend/.env` to seed on startup (dev/test only). This creates:

- **Admin user**: `admin@manifest.build` / `manifest` (email verification email is skipped if Mailgun is not configured — user is created but unverified)
- **Tenant**: `seed-tenant-001` linked to the admin user
- **Agent**: `demo-agent` with OTLP key `dev-otlp-key-001`
- **API key**: `dev-api-key-manifest-001`
- **Security events**: 12 sample events for the security dashboard
- **Agent messages**: Sample telemetry messages for the demo agent

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
| GET | `/api/v1/overview` | Session/API Key | Dashboard summary |
| GET | `/api/v1/tokens` | Session/API Key | Token usage analytics |
| GET | `/api/v1/costs` | Session/API Key | Cost analytics |
| GET | `/api/v1/messages` | Session/API Key | Paginated message log |
| GET | `/api/v1/agents` | Session/API Key | Agent list with sparklines |
| POST | `/api/v1/agents` | Session/API Key | Create agent + API key |
| DELETE | `/api/v1/agents/:name` | Session/API Key | Delete agent |
| GET | `/api/v1/agents/:name/key` | Session/API Key | Get agent API key |
| POST | `/api/v1/agents/:name/rotate-key` | Session/API Key | Rotate API key |
| PATCH | `/api/v1/agents/:name` | Session/API Key | Rename agent |
| GET | `/api/v1/security` | Session/API Key | Security score + events |
| GET | `/api/v1/model-prices` | Session/API Key | Model pricing list |
| GET | `/api/v1/agent/:agentName/usage` | Session/API Key | Per-agent token usage |
| GET | `/api/v1/agent/:agentName/costs` | Session/API Key | Per-agent cost data |
| GET/POST/PATCH/DELETE | `/api/v1/notifications` | Session/API Key | Notification rules CRUD |
| GET/POST/DELETE | `/api/v1/notifications/email-provider` | Session/API Key | Email provider config |
| GET/POST/PUT/DELETE | `/api/v1/routing/*` | Session/API Key | Routing config (tiers + providers) |
| GET/PUT/POST/DELETE | `/api/v1/routing/:agent/specificity/*` | Session/API Key | Specificity routing config |
| POST | `/api/v1/routing/subscription-providers` | Session/API Key | Subscription provider config |
| POST | `/api/v1/routing/:agentName/ollama/sync` | Session/API Key | Sync Ollama models |
| POST | `/api/v1/routing/resolve` | Bearer (mnfst_*) | Model resolution |
| POST | `/v1/chat/completions` | Bearer (mnfst_*) | LLM proxy (OpenAI-compatible) |
| GET | `/api/v1/events` | Session | SSE real-time events |
| GET | `/api/v1/github/stars` | Public | GitHub star count |

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
- `SEED_DATA` — Set `true` to seed demo data on startup.
- `MANIFEST_MODE` — `selfhosted` or `cloud` (default: `cloud`; auto-`selfhosted` inside Docker via `/.dockerenv`). Self-hosted mode enables loopback auth shortcuts and allows custom-provider URLs with `http://` / private IPs. `local` is accepted as a legacy alias for `selfhosted`.
- `OLLAMA_HOST` — Ollama endpoint for the built-in tile. Defaults to `http://localhost:11434` outside Docker and `http://host.docker.internal:11434` inside the bundled `docker/docker-compose.yml`.

## Domain Terminology

- **Message**: The primary entity in the system. Every row in `agent_messages` is a Message. The UI labels them "Messages" everywhere. Key routing columns: `routing_tier` (complexity tier used), `routing_reason` (why — `scored`, `specificity`, `heartbeat`, etc.), `specificity_category` (which task-type category, null if complexity-routed).
- **Tenant**: A user's data boundary. Created from `user.id` on first agent creation.
- **Agent**: An AI agent owned by a tenant. Has a unique OTLP ingest key.

### Message list endpoints (shared projection contract)

Any backend endpoint that returns rows rendered by the frontend `MessageTable` / `ModelCell` component **must** project its SELECT through `selectMessageRowColumns()` in `packages/backend/src/analytics/services/query-helpers.ts`. The helper is the single source of truth for the columns the shared badge/provider/auth rendering reads (including `specificity_category`, `routing_tier`, `routing_reason`, `auth_type`, `fallback_from_model`).

- Adding a new column the UI needs → edit the helper once, never duplicate the projection across query services.
- Endpoint-specific fields that don't belong to the shared `MessageRow` contract (e.g. `description`, `service_type`, `cache_read_tokens`, `duration_ms` for the full Messages log) stay as explicit `.addSelect` chained after the helper call.
- Current call sites: `getRecentActivity()` in `timeseries-queries.service.ts` (Overview "Recent Messages") and `getMessages()` in `messages-query.service.ts` (Messages log).
- A `query-helpers.spec.ts` test pins the required alias set — it fails loudly if anyone drops a field from the helper. Don't bypass it by hand-rolling a new SELECT chain.

This rule exists because the Overview and Messages pages previously drifted and the Recent Messages badge read `STANDARD` instead of the specificity category (`CODING` etc.) — the frontend already shares the rendering code, so the divergence was purely backend projection drift.

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

## Anonymous Usage Telemetry (self-hosted)

Self-hosted installs (Docker / `node dist/main.js` with `NODE_ENV=production`)
send one aggregate usage report per 24h to `TELEMETRY_ENDPOINT` (default
`https://telemetry.manifest.build/v1/report`). The module lives at
`packages/backend/src/telemetry/`.

**Payload fields (v1) — keep this list minimal**:

- `schema_version`, `install_id` (random UUIDv4, persisted once in
  `install_metadata`), `manifest_version`
- Last 24h aggregates from `agent_messages`: `messages_total`,
  `messages_by_provider` (bucketed via `PROVIDER_BY_ID_OR_ALIAS` — unknown
  values collapse to `"custom"`, NULL to `"unknown"`), `messages_by_tier`
  (`simple` / `standard` / `complex` / `reasoning`, NULL → `"unknown"`),
  `messages_by_auth_type` (`api_key` / `subscription`), `tokens_input_total`,
  `tokens_output_total`
- Configuration: `agents_total`, `agents_by_platform`
- Runtime: `platform` (`process.platform`), `arch` (`process.arch`)

User-facing spec: https://manifest.build/docs/self-hosted#telemetry

**Explicitly never sent**: tenant/user IDs, emails, API keys, prompts,
message contents, model names, custom provider URLs, OAuth client IDs,
raw IPs.

**Opt-out**: `MANIFEST_TELEMETRY_DISABLED=1`. Also auto-disabled when
`NODE_ENV !== 'production'` so dev instances never report.

**Cadence**: `@Cron(CronExpression.EVERY_HOUR)` fires once an hour but
short-circuits unless the last send was ≥24h ago (and the first-send jitter
window has elapsed). Hourly tick + timestamp check beats a daily cron
because it survives restarts without missing windows.

**Extending the payload**: bump `TELEMETRY_SCHEMA_VERSION` and add fields
additively — the ingest (peacock-backend) rejects unknown `schema_version`
values with 400, so downgrades stay safe.

## Architecture Notes

- **Single-service**: In production, `@nestjs/serve-static` serves `frontend/dist/` with SPA fallback. API routes (`/api/*`, `/otlp/*`) are excluded.
- **Dev mode**: Vite dev server on `:3000` proxies `/api` and `/otlp` to backend on `:3001`. CORS enabled only in dev.
- **Body parsing**: Disabled at NestJS level (`bodyParser: false`). Better Auth mounted first (needs raw body), then `express.json()` and `express.urlencoded()`.
- **QueryBuilder API**: Analytics and ingestion services use TypeORM `Repository.createQueryBuilder()` instead of raw SQL. The `addTenantFilter()` helper in `query-helpers.ts` applies multi-tenant WHERE clauses. Only the database seeder and notification cron still use `DataSource.query()` with numbered `$1, $2, ...` placeholders.
- **PostgreSQL time functions**: `NOW() - CAST(:interval AS interval)`, `to_char(date_trunc('hour', timestamp), ...)`, `timestamp::date`.
- **Better Auth database**: Uses a `pg.Pool` instance passed directly to `betterAuth({ database: pool })`. See `packages/backend/src/auth/auth.instance.ts`.
- **PostgreSQL container**: `docker run -d --name postgres_db -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=mydatabase -p 5432:5432 postgres:16`
- **Validation**: Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`. Explicit `@Type()` decorators on numeric DTO fields.
- **Agent key auth caching**: `AgentKeyAuthGuard` caches valid API keys in-memory for 5 minutes to avoid repeated DB lookups.
- **Database migrations**: TypeORM migrations are version-controlled in `src/database/migrations/`. `synchronize` is permanently `false`. Migrations auto-run on boot (`migrationsRun: true`) wrapped in a single transaction. The CLI DataSource is at `src/database/datasource.ts`. Better Auth manages its own tables separately via `ctx.runMigrations()`.
- **SSE**: `SseController` provides `/api/v1/events` for real-time dashboard updates.
- **Notifications**: Cron-based threshold checking, supports Mailgun + Resend + SMTP email providers.
- **LLM Routing**: Two-layer routing system with provider key management (AES-256-GCM encrypted) and OpenAI-compatible proxy at `/v1/chat/completions`:
  - **Complexity tiers** (always active): 4 tiers (simple/standard/complex/reasoning) based on request content scoring with 23 weighted keyword dimensions.
  - **Specificity routing** (opt-in): 9 task-type categories (coding, web_browsing, data_analysis, image_generation, video_generation, social_media, email_management, calendar_management, trading). When enabled, overrides complexity tiers. Detection uses keyword analysis on the last user message + tool name heuristics. Categories defined in `shared/src/specificity.ts`, keywords in `scoring/keywords.ts`, detection in `scoring/specificity-detector.ts`.
  - **Resolution order**: specificity check (if any category active) → complexity scoring → tier assignment → provider/model resolution → proxy forward.

## Providers & Models

### Provider Registry (Single Source of Truth)

All provider definitions live in `common/constants/providers.ts` (`PROVIDER_REGISTRY`). This is the **only** place to define provider IDs, display names, aliases, and OpenRouter prefix mappings. Never hardcode provider names elsewhere — always import from the registry.

The registry exports derived maps used throughout the codebase:
- `PROVIDER_BY_ID` — lookup by canonical ID (e.g. `anthropic`, `gemini`)
- `PROVIDER_BY_ID_OR_ALIAS` — lookup by ID or alias (e.g. `google` → gemini entry)
- `OPENROUTER_PREFIX_TO_PROVIDER` — OpenRouter vendor prefix → display name (e.g. `openai` → `OpenAI`)
- `expandProviderNames()` — expands a set of names to include aliases

**Do NOT duplicate the provider list here.** Read `PROVIDER_REGISTRY` in `common/constants/providers.ts` for the current list of supported providers, their IDs, aliases, and OpenRouter prefix mappings.

### Adding a New Specificity Category

1. Add the category ID to `SPECIFICITY_CATEGORIES` in `packages/shared/src/specificity.ts`
2. Add keywords to `DEFAULT_KEYWORDS` in `packages/backend/src/scoring/keywords.ts` (new dimension with weight 0)
3. Add the dimension to `DEFAULT_CONFIG.dimensions` in `packages/backend/src/scoring/config.ts`
4. Add the category → dimensions mapping in `DIMENSION_MAP` in `packages/backend/src/scoring/specificity-detector.ts`
5. Optionally add tool name prefixes in `TOOL_NAME_PATTERNS` in the same file
6. Add a `StageDef` entry to `SPECIFICITY_STAGES` in `packages/frontend/src/services/providers.ts`
7. Add test prompts to `packages/backend/src/scoring/__tests__/specificity-coverage.spec.ts`

The `specificity_assignments` table and UI components handle new categories automatically — no migrations or frontend changes needed beyond the stage definition.

### Adding a New Provider

1. Add entry to `PROVIDER_REGISTRY` in `common/constants/providers.ts`
2. Add `FetcherConfig` in `routing/model-discovery/provider-model-fetcher.service.ts`
3. Add `ProviderEndpoint` in `routing/proxy/provider-endpoints.ts`
4. Add `ProviderDef` in `frontend/src/services/providers.ts`

### Model Discovery

Each provider's model list is fetched from **that provider's own API first**. If the native API fails or returns no models (some providers like MiniMax don't have a `/models` endpoint), the system falls back to building a model list from the OpenRouter pricing cache for that provider.

```
User connects provider (POST /routing/:agent/providers)
  → ProviderModelFetcherService.fetch(providerId, apiKey)
    → calls provider's /models endpoint (e.g. api.anthropic.com/v1/models)
    → if 0 models returned: buildFallbackModels() from OpenRouter cache
  → ModelDiscoveryService.enrichModel()
    → looks up pricing from OpenRouter cache (PricingSyncService)
    → computes quality score
  → saves to user_providers.cached_models (JSONB column)
  → recalculates tier assignments
```

- `ProviderModelFetcherService` — config-driven fetcher with parsers for each provider API format (OpenAI-compatible, Anthropic, Gemini, OpenRouter, Ollama)
- `ModelDiscoveryService` — orchestrator that decrypts keys, fetches, enriches with pricing, caches results. Falls back to OpenRouter cache when native API is unavailable.
- `cached_models` — per-provider, per-agent JSONB column on `user_providers` table
- Discovery runs synchronously on provider connect (user sees models immediately)
- "Refresh models" button triggers `POST /routing/:agent/refresh-models`

### Model Pricing

All pricing comes from a single source:

- **OpenRouter API** (public, no key needed, fetched daily via cron + on startup) — provides pricing for all providers. Stored in-memory by `PricingSyncService`. No hardcoded pricing data anywhere.

`ModelPricingCacheService` reads from the OpenRouter cache and attributes models to their real provider using OpenRouter vendor prefixes (via `OPENROUTER_PREFIX_TO_PROVIDER`). Unsupported community vendors stay under "OpenRouter".

**Priority order for model lists**: (1) Provider's native `/models` API, (2) OpenRouter cache filtered by vendor prefix. OpenRouter is the fallback, not the primary source. When a provider's native API works, its model list takes precedence.

### Where Models Appear

| Page | Source | What's shown |
|------|--------|-------------|
| **Model Prices** | `ModelPricingCacheService.getAll()` | All models from OpenRouter cache, attributed to real providers |
| **Routing (available models)** | `ModelDiscoveryService.getModelsForAgent()` | Only models from user's connected providers (discovered via native API) |
| **Routing (tier assignments)** | `TierAutoAssignService.recalculate()` | Auto-assigned from discovered models based on quality/price scoring |
| **Messages / Overview** | Stored in `agent_messages.model` column | Raw model name from telemetry, display name resolved via `model-display.ts` cache |

## Releases

There are **no publishable npm packages** in this repo. `packages/backend`, `packages/frontend`, `packages/shared`, and `packages/manifest` are all `private: true`. Manifest ships exclusively as the Docker image at `manifestdotbuild/manifest` (built from `docker/Dockerfile`).

### `packages/manifest/` is the canonical version

`packages/manifest/` is a **code-free shell package** that exists only to hold the canonical "Manifest version". It has no `src/`, no tests, no dependencies — just `package.json`, `README.md`, and (after the first release) a `CHANGELOG.md`. The real backend and frontend live under `packages/backend/` and `packages/frontend/` as before.

`.changeset/config.json` has `"ignore": ["manifest-backend", "manifest-frontend", "manifest-shared"]`, so when a contributor runs `npx changeset`, **only `manifest` is a selectable target**. Bumps to `manifest-backend` / `manifest-frontend` / `manifest-shared` are silently discarded. Always target `manifest` regardless of which files you actually changed.

### Adding a changeset

```bash
npx changeset
# → select "manifest"
# → choose patch / minor / major
# → write a one-line summary (this becomes the CHANGELOG entry)
```

Commit the generated `.changeset/*.md` file alongside your code. On merge to `main`, `release.yml` runs `changesets/action`, which opens (or updates) a `chore: version packages` PR bumping `packages/manifest/package.json` and appending to `packages/manifest/CHANGELOG.md`.

Changesets are **not** required on every PR — they're optional and only meaningful for changes you want in the changelog. Use `npx changeset add --empty` for purely internal work if you want an explicit "no release" marker.

### Cutting a Docker release

Merging the `chore: version packages` PR to `main` automatically publishes a new Docker image — no manual step required.

1. Merge the pending `chore: version packages` PR. `release.yml` detects the version bump in `packages/manifest/package.json` (by diffing `HEAD~1` against `HEAD`) and calls `docker.yml` as a reusable workflow.
2. The `publish` job reads `packages/manifest/package.json`, resolves the version automatically, and pushes `manifestdotbuild/manifest:{version}` + `{major}.{minor}` + `{major}` + `sha-<short>` to Docker Hub. The image is multi-arch (amd64 + arm64) and cosign-signed.
3. **Manually update the Docker Hub description** on hub.docker.com by copy-pasting the current contents of `docker/DOCKER_README.md`. (Automating this sync hit a wall because `docker-pushrm` and the Docker Hub web API need a personal-user PAT and the existing secrets are scoped to the org — tracked as a follow-up, not blocking releases.)

**Manual override:** `workflow_dispatch` on `Docker → Run workflow` still works for hotfixes and retags. Leave the `version` input blank to use `packages/manifest/package.json`, or pass a semver string to retag an older commit / publish a hotfix version.

### Summary of what CI does on each trigger

| Trigger | What happens |
|---------|--------------|
| PR opened/updated (runtime files) | `ci.yml` runs tests, lint, typecheck, coverage. `docker.yml` validates the Docker build (no push). `changeset-check` warns softly if no changeset is present. |
| Merge to `main` | `release.yml` runs `changesets/action` to open or update the `chore: version packages` PR. No publish — the version on `main` hasn't changed yet. |
| Merge of `chore: version packages` PR | `release.yml` runs again, detects the version bump in `packages/manifest/package.json`, and calls `docker.yml` as a reusable workflow. This pushes a new image tag to Docker Hub automatically. |
| Manual `workflow_dispatch` on `Docker` workflow | Reads `packages/manifest/package.json` (or the `version` input override) and pushes a new image tag to Docker Hub. Used for hotfixes and retags. |

## Code Coverage (Codecov)

Codecov runs on every PR via the `codecov/patch` and `codecov/project` checks. Configuration is in `codecov.yml`.

### Thresholds

- **Project coverage** (`codecov/project`): Must not drop more than **1%** below the base branch (`target: auto`, `threshold: 1%`).
- **Patch coverage** (`codecov/patch`): New/changed lines must have at least **auto - 5%** coverage (`target: auto`, `threshold: 5%`).

### CRITICAL: 100% Line Coverage Required

**Every PR must maintain 100% line coverage across all packages.** The codebase currently has full line coverage and every PR must preserve it. This means:

- All new source files must have corresponding tests with 100% line coverage
- All modified functions must have tests covering every line, including error paths
- **Patch coverage must be 100%** — no new uncovered lines allowed
- Run coverage locally before creating a PR:
  - `cd packages/backend && npx jest --coverage`
  - `cd packages/frontend && npx vitest run --coverage`
  - `cd packages/shared && npx jest --coverage`

This applies to:

- New services, guards, controllers, or utilities in `packages/backend/src/`
- New components or functions in `packages/frontend/src/`
- New modules in `packages/shared/src/`

### Coverage Flags

| Flag | Paths | CI Job |
|------|-------|--------|
| `backend` | `packages/backend/src/` | Backend (PostgreSQL) |
| `frontend` | `packages/frontend/src/` | frontend |
| `shared` | `packages/shared/src/` | shared |

### E2E Test Entities

When adding new TypeORM entities to `database.module.ts`, also add them to the E2E test helper (`packages/backend/test/helpers.ts`) entities array. Missing entities cause `EntityMetadataNotFoundError` in services that depend on them.
