# Manifest Development Guidelines

Last updated: 2026-07-20

## What Manifest Is

Manifest is a smart model router for **AI agents**. It sits between an agent and its LLM providers, scores each request, and routes it to the cheapest model that can handle it. The dashboard tracks logical requests and their provider attempts, costs, and tokens across any agent that speaks OpenAI-compatible HTTP.

**Supported agents**: see `AGENT_PLATFORMS` in `packages/shared/src/agent-type.ts` for the current list (OpenClaw, Hermes, Claude Code, OpenCode, generic OpenAI/Anthropic SDK slots, and others — don't duplicate the list here, it grows independently of this doc). OpenClaw remains the deepest integration, but no new code or copy should frame Manifest as OpenClaw-only. When adding examples, prefer "AI agent" as the noun and pick OpenClaw as the worked example rather than the sole target. Manifest is consumed as a generic OpenAI-compatible HTTP endpoint — there are no first-party OpenClaw plugins in this repo anymore.

Wingman — the gateway tester for sending requests against a Manifest backend while impersonating any of the supported agents (useful for routing/header-classifier reproductions) — lives in its own repo at [`mnfst/wingman`](https://github.com/mnfst/wingman) and is hosted at [`wingman.manifest.build`](https://wingman.manifest.build). The dashboard embeds it as an iframe drawer **in dev mode only** — it is dead-code-eliminated from production / self-hosted bundles via `__DEV_MODE__`. The backend allows the hosted Wingman origin through CORS in both dev and production (production also honors `WINGMAN_CORS_ORIGINS`), while the CSP `frame-src` that permits the drawer iframe stays dev-only; both are wired in `packages/backend/src/cors-csp-config.ts`.

**Whenever working in dev mode (`/serve`, `npm run dev`, etc.), the Wingman drawer is expected to be available** — open the FAB at the bottom-right of the dashboard (or hit ⌘/Ctrl+Shift+W) and confirm the iframe loads `https://wingman.manifest.build` cleanly. The drawer is part of the dev surface area, so a broken iframe means the dev environment is broken. `/serve` is **dev-only** — never use it to validate production behavior.

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
- **Runtime**: TypeScript 5.x (strict mode). CI pins Node.js 24 (`.github/workflows/release.yml`); no `engines` field enforces this locally.
- **Monorepo**: npm workspaces + Turborepo
- **Release**: Changesets for version management + GitHub Actions for Docker image release

## Project Structure

```text
packages/
├── backend/
│   ├── src/
│   │   ├── instrument.ts                    # Sentry init, imported first (before any other import)
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
│   │   │   └── seed-messages.ts             # Demo request/provider-attempt seed data
│   │   ├── entities/                        # TypeORM entities (22 files)
│   │   │   ├── tenant.entity.ts             # Multi-tenant root
│   │   │   ├── agent.entity.ts              # Agent (belongs to tenant)
│   │   │   ├── agent-api-key.entity.ts      # OTLP ingest keys (mnfst_*)
│   │   │   └── ...                          # request, agent-message (provider attempt), tenant-provider, tier-assignment, header-tier, etc.
│   │   ├── common/
│   │   │   ├── guards/api-key.guard.ts      # X-API-Key header auth (timing-safe)
│   │   │   ├── decorators/public.decorator.ts
│   │   │   ├── dto/                         # create-agent, range-query, rename-agent DTOs
│   │   │   ├── filters/spa-fallback.filter.ts
│   │   │   ├── interceptors/               # agent-cache, user-cache
│   │   │   ├── constants/                   # api-key, cache, ollama, providers, openai-models, xai-models, subscription-clients
│   │   │   ├── services/                    # ingest-event-bus, manifest-runtime, tenant-cache
│   │   │   └── utils/                       # crypto, hash, range, period, slugify, url-validation, provider-inference, postgres-sql, cost-calculator, detect-self-hosted, frontend-path, og-rewrite, secret-scrub, ttl-cache, local-ip, etc.
│   │   ├── health/                          # @Public() health check
│   │   ├── analytics/                       # Dashboard analytics
│   │   │   ├── controllers/                 # overview, tokens, costs, messages, agents
│   │   │   └── services/                    # aggregation + timeseries-queries + query-helpers
│   │   ├── otlp/                            # Agent key auth + onboarding
│   │   │   ├── guards/agent-key-auth.guard.ts # Bearer token auth (agent API keys)
│   │   │   └── services/api-key.service.ts  # Agent onboarding (creates tenant+agent+key)
│   │   ├── routing/                         # LLM routing (providers, tiers, proxy, scorer)
│   │   │   ├── proxy/                       # OpenAI-compatible proxy (anthropic/google adapters)
│   │   │   ├── autofix/                     # Auto-fix self-healing (Phoenix client + heal-once flow)
│   │   │   ├── routing-core/               # Tier, provider, specificity services + cache
│   │   │   ├── resolve/                     # Scoring-based tier + specificity resolution
│   │   │   ├── custom-provider/             # Custom provider CRUD
│   │   │   ├── header-tiers/               # Header-based tier overrides
│   │   │   ├── oauth/                       # OAuth flows (Gemini, OpenAI, Kiro, MiniMax)
│   │   │   └── specificity.controller.ts   # Specificity routing CRUD endpoints
│   │   ├── scoring/                         # Request complexity scoring engine
│   │   │   ├── keywords.ts                 # Keyword lists for all dimensions (complexity + specificity)
│   │   │   ├── specificity-detector.ts     # Task-type detection (coding, trading, etc.)
│   │   │   └── scan-messages.ts            # Message scanner for specificity detection
│   │   ├── model-prices/                    # Model pricing management + sync
│   │   ├── notifications/                   # Alert rules, email providers, cron
│   │   ├── playground/                      # Prompt playground (runs, columns, starred/best)
│   │   ├── github/                          # GitHub stars endpoint
│   │   ├── sse/                             # Server-Sent Events for real-time updates
│   │   ├── setup/                           # First-run admin setup wizard
│   │   ├── public-stats/                    # Public aggregate usage endpoints (opt-in)
│   │   ├── free-models/                     # Free LLM model catalog
│   │   ├── model-discovery/                 # Per-provider model fetching + fallback
│   │   ├── billing/                         # Stripe billing status + plan limits
│   │   ├── error-pages/                     # Custom error-page config (internal + public)
│   │   ├── waitlist/                        # Early-access waitlist signup (e.g. Auto-fix)
│   │   ├── cors-csp-config.ts               # Wingman CORS/CSP origin allowlists
│   │   ├── sentry/                          # Sentry init-options builder (SENTRY_DSN-gated)
│   │   └── telemetry/                       # Anonymous self-hosted telemetry
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
│   │   │   ├── GlobalOverview.tsx, AgentOverview.tsx # Cross-agent + per-agent dashboards (split from one Overview.tsx)
│   │   │   ├── AgentDetail.tsx, AgentProviders.tsx   # Per-agent detail + provider connections
│   │   │   ├── MessageLog.tsx               # Paginated Requests log (legacy filename)
│   │   │   ├── Account.tsx                  # User profile (session data)
│   │   │   ├── Settings.tsx, SettingsAutofixSection.tsx # Agent settings + Auto-fix toggle
│   │   │   ├── Routing.tsx, RoutingPanels.tsx, RoutingActions.tsx, RoutingDefaultTierSection.tsx, RoutingHeaderTiersSection.tsx, RoutingSpecificitySection.tsx, RoutingTierCard.tsx # LLM routing config (split by concern)
│   │   │   ├── Limits.tsx                   # Alert rule management (token/cost thresholds)
│   │   │   ├── ModelPrices.tsx              # Model pricing table
│   │   │   ├── Playground.tsx               # Prompt playground
│   │   │   ├── ConnectProvider.tsx, providers/       # Provider connection flow
│   │   │   ├── FreeModels.tsx               # Free model catalog
│   │   │   ├── Setup.tsx                    # First-run setup wizard
│   │   │   ├── Upgrade.tsx                  # Billing/plan upgrade page
│   │   │   ├── Help.tsx                     # Help page
│   │   │   └── NotFound.tsx                 # 404 page
│   │   ├── services/
│   │   │   ├── auth-client.ts               # Better Auth SolidJS client
│   │   │   ├── api.ts                       # API functions (credentials: include)
│   │   │   ├── providers.ts                 # ProviderDef list + SPECIFICITY_STAGES + STAGES
│   │   │   ├── model-display.ts             # Model display-name cache
│   │   │   ├── formatters.ts               # Number/cost formatting
│   │   │   ├── provider-utils.ts            # LLM provider helpers
│   │   │   ├── routing.ts, routing-utils.ts # Routing config helpers
│   │   │   ├── theme.ts                     # Theme management
│   │   │   ├── toast-store.ts               # Toast notification state
│   │   │   └── ...                          # setup-status, playground-store, pagination, sse, oauth-popup, etc.
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
- **Requests and provider attempts**: Sample telemetry for the demo agent

Seeding is idempotent — it checks for existing records before inserting.

**Dev-login shortcut:** when running under the Vite dev server the login page shows a
prominent one-click **⚡ Sign in as dev** button that submits the seeded
`admin@manifest.build` / `manifest` credentials — no copy-paste. It's gated by
`import.meta.env.DEV`, so Vite strips the button and the credential literals from
production builds, and no password ever rides in a URL. See
`packages/frontend/src/pages/Login.tsx`.

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

TypeORM migrations run automatically on app startup by default (gated by `RUN_MIGRATIONS_ON_BOOT`, default `true`). Schema sync (`synchronize`) is permanently disabled — all schema changes must go through migrations.

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
2. **ApiKeyGuard** (`common/guards/api-key.guard.ts`) — Falls through if session already set. Otherwise reads the `X-API-Key` header and first looks it up against the tenant-scoped `ApiKey` entity (`api_keys` table, hashed with scrypt) — this is the primary multi-tenant credential path. Only if no DB match is found does it fall back to a timing-safe compare against the single `API_KEY` env var. Use `@Public()` to skip both guards.
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
                                    └──→ requests ──→ agent_messages (telemetry data)
```

- **Tenant** (`tenants` table): Created automatically on first agent creation. `tenant.owner_user_id` = `user.id` is the ONLY user→tenant link (resolved through `TenantCacheService`); `tenant.name` mirrors it for display until repurposed as a slug.
- **Agent** (`agents` table): Belongs to a tenant. Unique constraint on `[tenant_id, name]`.
- **AgentApiKey** (`agent_api_keys` table): One-to-one with agent. `mnfst_*` format key for OTLP ingestion.
- **ApiKey** (`api_keys` table): A separate, tenant-scoped credential (not per-agent) used for dashboard/API access — the primary key `ApiKeyGuard` checks. Distinct from `AgentApiKey`.
- **Onboarding flow**: `ApiKeyGeneratorService.onboardAgent()` creates tenant (if new) + agent + API key via three sequential inserts.

### Data Isolation

Every resource belongs to a tenant; users only authenticate and (optionally) appear as `created_by_user_id` audit metadata. Guards (SessionGuard/ApiKeyGuard) resolve the tenant once per request and attach a `TenantContext` (`{ tenantId, userId }`), injected in controllers via `@TenantCtx()`. All analytics queries filter by tenant via `addTenantFilter(qb, tenantId)` from `query-helpers.ts`. Never scope, key, cache, or authorize by user id.

## API Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/v1/health` | Public | Health check |
| ALL | `/api/auth/*` | Public | Better Auth (login, register, OAuth, sessions) |
| GET | `/api/v1/overview` | Session/API Key | Dashboard summary |
| GET | `/api/v1/tokens` | Session/API Key | Token usage analytics |
| GET | `/api/v1/costs` | Session/API Key | Cost analytics |
| GET | `/api/v1/agents` | Session/API Key | Agent list with sparklines |
| POST | `/api/v1/agents` | Session/API Key | Create agent + API key |
| GET | `/api/v1/agents/:agentName` | Session/API Key | Single agent detail |
| GET/POST | `/api/v1/agents/:agentName/duplicate*` | Session/API Key | Duplicate agent (preview + confirm) |
| DELETE | `/api/v1/agents/:agentName` | Session/API Key | Delete agent |
| GET | `/api/v1/agents/:agentName/key` | Session/API Key | Get agent API key |
| POST | `/api/v1/agents/:agentName/rotate-key` | Session/API Key | Rotate API key |
| PATCH | `/api/v1/agents/:agentName` | Session/API Key | Rename agent |
| GET | `/api/v1/messages` | Session/API Key | Paginated Requests log (legacy route name) |
| GET/PATCH/DELETE | `/api/v1/messages/:id/*` | Session/API Key | Request details, feedback, miscategorized flag (legacy route name) |
| GET | `/api/v1/security` | Session/API Key | Security score + events |
| GET | `/api/v1/model-prices` | Session/API Key | Model pricing list |
| GET | `/api/v1/free-models` | Session/API Key | Free LLM model catalog |
| GET | `/api/v1/agent/usage` | Bearer (mnfst_*) | Token usage for the calling agent |
| GET | `/api/v1/agent/costs` | Bearer (mnfst_*) | Cost data for the calling agent |
| GET | `/api/v1/overview/*` | Session/API Key | Overview timeseries/breakdown sub-endpoints |
| GET | `/api/v1/providers` / `/api/v1/providers/usage` | Session/API Key | Connected provider list + usage |
| GET | `/api/v1/provider-analytics/*` | Session/API Key | Per-provider analytics |
| GET | `/api/v1/errors/breakdown` | Session/API Key | Error breakdown analytics |
| GET/PATCH | `/api/v1/billing/*` | Session/API Key | Billing status + email preferences (Stripe) |
| GET/POST | `/api/v1/waitlist/autofix*` | Session/API Key (GET/POST), Public (`/claim`) | Auto-fix early-access waitlist |
| GET/POST/DELETE | `/api/v1/internal/error-pages*` | Public (`x-internal-secret` header) | Custom error-page config (Peacock CMS push API) |
| GET/PUT/DELETE | `/api/v1/agents/:agentName/enabled-providers*` | Session/API Key | Per-agent provider enable/disable + impact preview |
| GET/POST/PATCH/DELETE | `/api/v1/notifications/*` | Session/API Key | Notification rules CRUD + email provider config |
| GET/POST/PUT/PATCH/DELETE | `/api/v1/routing/:agentName/*` | Session/API Key | Routing config (tiers, providers, model-params, header-tiers, custom-providers, specificity, autofix, etc.) |
| POST | `/api/v1/routing/ollama/sync` | Session/API Key | Sync Ollama models |
| GET | `/api/v1/routing/pricing-health` | Session/API Key | OpenRouter pricing sync health |
| POST | `/api/v1/routing/pricing/refresh` | Session/API Key | Force pricing cache refresh |
| GET/POST/DELETE | `/api/v1/oauth/:provider/*` | Session/API Key | OAuth flows (Gemini, OpenAI, Anthropic, xAI, Kiro, MiniMax) |
| POST | `/api/v1/routing/resolve` | Bearer (mnfst_*) | Model resolution |
| POST | `/api/v1/routing/subscription-providers` | Bearer (mnfst_*) | Subscription provider config |
| GET | `/api/v1/setup/status` | Public | First-run setup status |
| POST | `/api/v1/setup/admin` | Public | Create initial admin user |
| GET | `/api/v1/public/*` | Public (opt-in) | Aggregate public stats (controlled by `MANIFEST_PUBLIC_STATS`) |
| GET | `/v1/models` | Bearer (mnfst_*) | Available model list (proxy) |
| POST | `/v1/chat/completions` | Bearer (mnfst_*) | LLM proxy (OpenAI-compatible) |
| POST | `/v1/responses` | Bearer (mnfst_*) | LLM proxy (OpenAI Responses API) |
| POST | `/v1/messages` | Bearer (mnfst_*) | LLM proxy (Anthropic Messages API) |
| POST | `/chat/completions` | Bearer (mnfst_*) | Legacy root-level OTLP-compatible proxy alias |
| GET/POST/PATCH | `/api/v1/playground/*` | Session/API Key | Playground runs (run, list, star, mark best) |
| GET | `/api/v1/events` | Session | SSE real-time events |
| GET | `/api/v1/github/stars` | Public | GitHub star count |

## Environment Variables

See `packages/backend/.env.example` for all variables. Key ones:

- `BETTER_AUTH_SECRET` — **Required.** Secret for Better Auth session signing (min 32 chars). Generate with `openssl rand -hex 32`.
- `DATABASE_URL` — **Required** in every environment except `NODE_ENV=test` (which falls back to `postgresql://myuser:mypassword@localhost:5432/mydatabase`, matching the local Docker command). Dev and production both throw on boot if unset. Format: `postgresql://user:password@host:port/database`.
- `MANIFEST_ENCRYPTION_KEY` — Recommended. AES-256-GCM key (min 32 chars) for encrypting stored provider API keys and OAuth tokens. Defaults to `BETTER_AUTH_SECRET` if unset — set this independently so a session-cookie leak doesn't also expose provider credentials.
- `PORT` — Server port. Default: `3001`
- `BIND_ADDRESS` — Bind address. Default: `127.0.0.1` (use `0.0.0.0` for Railway/Docker)
- `NODE_ENV` — `development` or `production`. Dev allows broad CORS (local dashboard + Wingman); production allows the hosted Wingman origin plus any `WINGMAN_CORS_ORIGINS` entries.
- `CORS_ORIGIN` — Allowed CORS origin (dev). Default: `http://localhost:3000`
- `WINGMAN_CORS_ORIGINS` — Production only. Extra browser origins allowed to call the gateway (comma-separated). The hosted Wingman (`https://wingman.manifest.build`) is always allowed.
- `BETTER_AUTH_URL` — Base URL for Better Auth. Default: `http://localhost:{PORT}`
- `FRONTEND_PORT` — Extra trusted origin port for Better Auth.
- `API_KEY` — Secret for programmatic API access (X-API-Key header).
- `THROTTLE_TTL` — Rate limit window in ms. Default: `60000`
- `THROTTLE_LIMIT` — Max requests per window. Default: `100`
- `DB_POOL_MAX` — PostgreSQL connection pool size. Default: `30`
- `RUN_MIGRATIONS_ON_BOOT` — Whether the app runs pending migrations at startup. Default: `true`; set `false` for multi-replica deploys where only one instance should migrate.
- `PROVIDER_TIMEOUT_MS` — Per-attempt timeout (ms) for upstream provider requests. Default: `180000`
- `STREAM_WARMUP_MS` — Timeout (ms) to wait for the first chunk of a streaming response before trying a fallback. Default: `15000`
- `CODEX_SEMANTIC_OUTPUT_TIMEOUT_MS` — Timeout (ms) to wait for deliverable ChatGPT Codex text or tool output. Default: `60000`
- `EMAIL_PROVIDER` — Unified email provider: `resend` (recommended), `mailgun`, or `sendgrid`. Used for Better Auth transactional emails and threshold alerts.
- `EMAIL_API_KEY` — API key for the configured `EMAIL_PROVIDER`.
- `EMAIL_DOMAIN` — Sending domain (required for Mailgun).
- `EMAIL_FROM` — Sender address. Default: `noreply@manifest.build`
- `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `NOTIFICATION_FROM_EMAIL` — Legacy Mailgun-only variables. Deprecated; use `EMAIL_*` instead. Still honored for backward compatibility.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth (optional)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth (optional)
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — Discord OAuth (optional)
- `SEED_DATA` — Set `true` to seed demo data on startup. Dev/test only — ignored when `NODE_ENV=production` (use the first-run setup wizard instead).
- `MANIFEST_MODE` — `selfhosted` or `cloud` (default: `cloud`; auto-detected as `selfhosted` inside Docker via `/.dockerenv` or Podman via `/run/.containerenv`). Self-hosted mode enables loopback auth shortcuts and allows custom-provider URLs with `http://` / private IPs. `local` is accepted as a legacy alias for `selfhosted`.
- `MANIFEST_TELEMETRY_DISABLED` — Set `1` to opt out of anonymous telemetry (self-hosted only).
- `MANIFEST_PUBLIC_STATS` — Set `true` to expose `/api/v1/public/*` aggregate stats without auth (cloud-only marketing use).
- `TELEMETRY_ENDPOINT` — Where self-hosted installs POST the anonymous usage report. Default: `https://telemetry.manifest.build/v1/report`. See [Telemetry](#anonymous-usage-telemetry-self-hosted).
- `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE` — Opt-in Sentry error monitoring. Unset `SENTRY_DSN` disables Sentry entirely; `SENTRY_ENVIRONMENT` defaults to `NODE_ENV`. See [Error Monitoring](#error-monitoring-sentry-opt-in).
- `WINGMAN_PORT` — Dev-only. Port a locally-running Wingman build listens on, allowed through CSP `frame-src` and CORS alongside the hosted Wingman origin. Default: backend `PORT` + 1.
- `AUTH_DB_POOL_MAX` — Connection pool size for Better Auth's own `pg.Pool`, separate from `DB_POOL_MAX`. Default: `10`.
- `OLLAMA_HOST` — Ollama endpoint for the built-in tile. Defaults to `http://localhost:11434` outside Docker and `http://host.docker.internal:11434` inside the bundled `docker/docker-compose.yml`.
- `AUTOFIX_HEALING_URL` — Base URL of the Phoenix healing service for Auto-fix. Unset → inert Noop client in production (never mutates traffic), in-process mock in dev/test. See [Auto-fix](#auto-fix-self-healing-via-phoenix).
- `AUTOFIX_HEALING_API_KEY` — Sent as `x-api-key` on every call to Phoenix. Phoenix guards `/api/heal*` and fails closed in production, so this is required when `AUTOFIX_HEALING_URL` points at a production Phoenix; omit it for a keyless dev/test Phoenix.
- `AUTOFIX_GLOBAL_ENABLED` — Set `false` to disable Auto-fix for all agents (default on). Companions: `AUTOFIX_TIMEOUT_MS` (per heal call, default `10000`), `AUTOFIX_REPAIRABLE_STATUSES` (default `400,404,422`).
- `AUTOFIX_ROLLOUT` — Three-phase early-access gate: `selected` (default — only tenants we hand-picked via `tenants.autofix_access_granted_at`), `waitlist` (+ anyone who joined `tenants.autofix_waitlist_at`), or `everyone` (GA). See [Auto-fix](#auto-fix-self-healing-via-phoenix).
- `AUTOFIX_REPORT_ALL_4XX` — Set `true` to stream an agent's request-side 4xx (4xx except 401/402/403/429) to Phoenix's `POST /api/heal/observe` as evidence, carrying the full request body. Serves no fix and creates no heal attempt; it only lets Phoenix see the body that failed. Wider than the heal path in scope (not limited to `AUTOFIX_REPAIRABLE_STATUSES`, and it catches fallback-model failures the heal path never reports) but **gated to agents with Auto-fix on** — `AutofixService.isActiveFor()`, the same tenant early-access + per-agent flag that healing clears. Turning Auto-fix on is what consents to sending failing requests to the healing service; the gate fails closed. Off by default: a second, deployment-level switch on top. Manifest persists nothing; the body is secret-scrubbed, capped at 256 KB, batched, and dropped under backpressure. Skipped when Auto-fix already reported the same failure via `/api/heal`. See `routing/autofix/observation-reporter.ts`.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` — Billing (cloud only). See `packages/backend/src/billing/`.
- `PLAN_LIMIT_FREE_REQUESTS` / `PLAN_LIMIT_PRO_REQUESTS` / `PLAN_REQUEST_QUOTA_RESET_AT` — Per-plan request quotas enforced by `plan.service.ts`.

## Domain Terminology

Manifest terminology is directional:

- A **Manifest Request** is one logical request from an agent to Manifest and lives in `requests`.
- A **Provider Attempt** is one request from Manifest to an AI provider and lives in `agent_messages`.
- A **Tenant** is a user's data boundary. It is created from `user.id` on first agent creation.
- An **Agent** is an AI agent owned by a tenant. It has a unique OTLP ingest key.

[`docs/glossary.md`](docs/glossary.md) is the canonical contract for statuses, ordering, recovery, database mapping, and counting rules. Do not duplicate those definitions in agent guides.

### Legacy message/attempt projection contract

Any backend endpoint that returns provider-attempt fields rendered by the frontend `MessageTable` / `ModelCell` component **must** project its SELECT through `selectMessageRowColumns()` in `packages/backend/src/analytics/services/query-helpers.ts`. The helper assumes the `agent_messages` alias `at` and is the single source of truth for the columns the shared badge/provider/auth rendering reads (including `specificity_category`, `routing_tier`, `routing_reason`, `auth_type`, `fallback_from_model`). Request-level fields still come from `requests`; do not copy attempt fields onto requests to satisfy this legacy UI contract.

- Adding a new column the UI needs → edit the helper once, never duplicate the projection across query services.
- Endpoint-specific fields that don't belong to the shared `MessageRow` contract (e.g. `description`, `service_type`, `cache_read_tokens`, `duration_ms` for the full Messages log) stay as explicit `.addSelect` chained after the helper call.
- Current call sites: `getRecentActivity()` in `timeseries-queries.service.ts` (Overview "Recent Messages"), `getMessages()` in `messages-query.service.ts` (Messages log), and `provider-analytics.controller.ts` (provider-scoped message list).
- A `query-helpers.spec.ts` test pins the required alias set — it fails loudly if anyone drops a field from the helper. Don't bypass it by hand-rolling a new SELECT chain.

This rule exists because the Overview and Messages pages previously drifted and the Recent Messages badge read `STANDARD` instead of the specificity category (`CODING` etc.) — the frontend already shares the rendering code, so the divergence was purely backend projection drift.

## Manifest's own errors (`M###`)

Every failure Manifest itself produces — as opposed to one a provider returned — carries a documented code from `MANIFEST_ERRORS` in `packages/backend/src/common/errors/error-codes.ts`, published at `https://manifest.build/docs/errors/<code>`.

**Raise them with `ManifestError`** (`common/errors/manifest-error.ts`), never a bare `HttpException`. The type is what lets `proxy.controller.ts` tell "Manifest refused this request" from "the provider returned a 4xx". Before it existed, a malformed body (M300) and a Manifest bug (M500) were both recorded as *provider* errors and counted against `provider_error_rate`.

**Every code is recorded on a Manifest Request**, with four exceptions. `M001`, `M002`, `M003`, and `M005` are raised by `AgentKeyAuthGuard` before a key resolves to a tenant, so there is no agent to attribute a row to — they're listed in `UNRECORDABLE_MANIFEST_CODES` and write nothing. (`M004`, an expired key, *does* resolve an agent, so the guard stashes it on `request.manifestErrorContext` and `ProxyExceptionFilter` records it.) `__tests__/manifest-error.spec.ts` fails if a new code is neither mapped in `MANIFEST_CODE_TO_REASON` nor declared unrecordable.

**`ProxyMessageRecorder.recordManifestBlockedRequest()` is the only writer of Manifest-authored rejected requests.** It creates one `requests` row, stamps `requests.error_code` plus the *rendered* message (the `[🦚 Manifest M100] No anthropic API key yet. Add one here: …` text the caller saw — not a generic stand-in), and creates zero `agent_messages` rows because no provider was contacted. Do not route these through `recordSuccessMessage` or manufacture a `provider='manifest'` attempt.

`M500` is the deliberate exception to "store what the caller saw": the caller gets the friendly "Something broke on our end", while the row stores the raw internal error message. The dashboard is where you go to find out what actually broke, so don't "fix" it to match.

**The Requests log hides no origin.** The legacy `getMessages()` API method applies an origin filter only when the caller passes `?origin=`. It previously hid `config` requests by default while the Overview showed them — so a user who saw a "Failed: Setup" request and clicked through found nothing, with no filter anywhere to bring it back. `messages-manifest-errors.e2e-spec.ts` pins the fix.

### The `request` error origin

`ERROR_ORIGINS` (in `packages/shared/src/error-taxonomy.ts`) has six values. `request` means the caller sent a body Manifest could not route — not the operator's setup (`config`), not a limit they set (`policy`), and not a Manifest bug (`internal`).

`request` is a member of `MANIFEST_ERROR_ORIGINS`. Do not confuse the error-origin value with the `requests` table: it classifies who caused an error. That membership is load-bearing because it keeps caller-caused failures out of provider reliability metrics and inside the `origin=manifest` filter shorthand. Any new origin that is not a provider round-trip belongs there too.

## Content Security Policy (CSP)

Helmet enforces a strict CSP in `main.ts`. The policy only allows `'self'` origins — **no external CDNs are permitted**.

**Rule: Never load external resources from CDNs.** All assets (fonts, icons, stylesheets) must be self-hosted under `packages/frontend/public/`. This keeps the CSP strict and avoids third-party dependencies at runtime.

Current self-hosted assets:
- **Boxicons Duotone** — `public/fonts/boxicons/` (CSS + `.woff2` font file)
- **DM Sans**, **Bricolage Grotesque**, **JetBrains Mono** — individual `.woff2` files in `public/fonts/`

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
- Last 24h aggregates from `agent_messages` (payload field names remain legacy for protocol compatibility): `messages_total`,
  `messages_by_provider` (bucketed via `PROVIDER_BY_ID_OR_ALIAS` — unknown
  values collapse to `"custom"`, NULL to `"unknown"`), `messages_by_tier`
  (`simple` / `standard` / `complex` / `reasoning`, NULL → `"unknown"`),
  `messages_by_auth_type` (`api_key` / `subscription`), `tokens_input_total`,
  `tokens_output_total`, `cost_usd_total`, `cost_usd_by_provider` (rounded to
  cents)
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

## Error Monitoring (Sentry, opt-in)

The backend integrates the Sentry NestJS SDK for optional error monitoring. It
is disabled unless the process environment provides `SENTRY_DSN`. This applies
equally to Cloud and self-hosted deployments; the bundled self-hosted
configuration simply leaves it unset by default.

- **Init**: `packages/backend/src/instrument.ts` is imported on the very first
  line of `main.ts` (before any other import). It calls
  `Sentry.init(buildSentryInitOptions(process.env))` only when the builder
  returns non-null. The option-building logic lives in
  `src/sentry/sentry-options.ts` (fully unit-tested); `instrument.ts` is a thin
  boot shell excluded from coverage like `main.ts`.
- **Scope**: error monitoring only. Performance tracing is explicitly disabled
  and the profiling package is not installed. Request headers, cookies, query
  parameters, bodies, user data, GenAI inputs/outputs, local variables, and
  breadcrumbs are disabled through the SDK's `dataCollection` options.
- **Error capture**: when enabled, `SentryModule.forRoot()` and
  `SentryGlobalFilter` are registered in `app.module.ts` for otherwise-unhandled
  errors. When disabled, neither is part of the Nest application.
- **Setup check**: when Sentry is enabled outside production,
  `GET /api/v1/debug-sentry` throws a test error. The controller is not
  registered in production.
- **Optional tags**: `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` may be supplied
  alongside `SENTRY_DSN`.

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
- **Database migrations**: TypeORM migrations are version-controlled in `src/database/migrations/`. `synchronize` is permanently `false`. Migrations auto-run on boot by default, gated by `RUN_MIGRATIONS_ON_BOOT` (default `true`; disable for multi-replica deploys). `migrationsTransactionMode` is `'each'` (one transaction per migration, not one for the whole run) because some `agent_messages` index migrations run `CONCURRENTLY`, which PostgreSQL forbids inside a shared transaction. The CLI DataSource is at `src/database/datasource.ts`. Better Auth manages its own tables separately via `ctx.runMigrations()`.
- **SSE**: `SseController` provides `/api/v1/events` for real-time dashboard updates.
- **Notifications**: Cron-based threshold checking, supports Mailgun + Resend + SendGrid email providers.
- **LLM Routing**: Two-layer routing system with provider key management (AES-256-GCM encrypted) and OpenAI-compatible proxy at `/v1/chat/completions`:
  - **Complexity tiers** (_being retired_ — see [Routing deprecation](#routing-deprecation-legacy-vs-clean-cohorts)): 4 tiers (simple/standard/complex/reasoning) based on request content scoring with 31 weighted keyword dimensions. Per-agent, gated by `complexity_routing_enabled`; agents with it off route everything to the `default` tier.
  - **Specificity routing** (opt-in; _being retired_): 9 task-type categories (coding, web_browsing, data_analysis, image_generation, video_generation, social_media, email_management, calendar_management, trading). When enabled, overrides complexity tiers. Detection uses keyword analysis on the last user message + tool name heuristics. Categories defined in `shared/src/specificity.ts`, keywords in `scoring/keywords.ts`, detection in `scoring/specificity-detector.ts`.
  - **Resolution order**: header tier (if a rule matches) → explicit `model` from the request body → specificity check (if any category active) → complexity scoring → tier assignment → provider/model resolution → proxy forward.
  - **Explicit `model` in the body** (OpenAI-compatible surfaces only — the Anthropic Messages API takes a provider-native model, never a route override): `auto` means "route me". Any other value resolves against the agent's discovered models — first the provider-qualified id `/v1/models` publishes (`openai/gpt-5.4-nano`), then the bare provider-native name (`gpt-5.4-nano`) when exactly one connection carries it. A name matching nothing, or one that two connections share, **falls through to configured routing** instead of failing. It must never hard-fail on its own: doing so turned every SDK sending an unrecognized name into an M101 "no providers configured" on agents whose providers *were* connected. A matching **header tier outranks it** — that rule is an override the operator configured on purpose, and the `model` field is mandatory in every OpenAI SDK, so most agents send a name they cannot change.
  - **Kept long-term**: **default routing** (one model + up to 5 fallbacks) and **custom routing** (header-triggered tiers).

### Routing deprecation: legacy vs clean cohorts

Complexity routing (simple/standard/complex/reasoning) and task-specific / specificity routing (the 9 categories) are **being retired**. We are keeping **default routing** and **custom (header) routing**. In this phase the routing _engine_ is unchanged — nothing is migrated or deleted — but the dashboard **hides the retiring surfaces from agents that never used them**.

**The gate is per-agent and keyed off config-presence, _not_ per-user signup date.** An agent is **legacy** (still sees the deprecated surfaces) if _any_ of these is true:

- complexity routing is enabled for it (`complexity_routing_enabled`), **or**
- a non-`default` tier has an `override_route`, **or**
- a specificity category is active or has an override.

Otherwise the agent is **clean** and gets the simplified view. The signals live in `packages/frontend/src/pages/Routing.tsx` (`legacyComplexityVisible` / `legacySpecificityVisible` / `isCleanAgent`) and are **sticky per agent** within a session — once a surface is revealed for an agent we keep it (so toggling complexity off mid-session doesn't yank the control away), but the stickiness compares the remembered agent against the current one, so switching agents re-evaluates from the new agent's own config and never carries a legacy reveal onto a clean agent.

| | Clean agent | Legacy agent |
|---|---|---|
| Routing page | One unified view, **no tabs** | Tabbed view (Default / Task-specific / Custom) |
| "Route by complexity" toggle | Hidden | Shown |
| Task-specific tab | Hidden | Shown |
| Custom (header) routing | Shown (cards + "Create custom tier") | Shown |
| Deprecation banners | None | Shown on each retiring surface (`RoutingDeprecationNotice`) |

**This is by _agent_, not by user.** "Old users keep routing, new users don't see it" is the right intuition but imprecise — the real axis is each agent's own config:

- **New user** → every agent is clean (nothing was ever configured) → simplified view everywhere.
- **Old user, existing agent that used complexity/task-specific** → stays legacy → full surfaces + banners, behavior untouched.
- **Old user creating a _new_ agent** → the new agent is **clean** (it has no complexity/specificity config of its own), so it gets the **simplified view** — even though the user is "old". An old user whose agent long ago stopped using these (no active config left) is likewise treated as clean.

Dev seeding (`packages/backend/src/database/seed-cohorts.ts`, `seedRoutingCohorts`) creates two demo logins so both states are visible side by side: `admin@manifest.build` (clean — Default + Custom only) and `olduser@manifest.build` (legacy — complexity + task-specific visible). Both passwords are `manifest`. Seeding is idempotent.

Still to come (not in this phase): a migration assistant (task-specific → header rules, complexity → collapse to default) and a committed end date.

## Auto-fix (self-healing via Phoenix)

**Auto-fix** repairs a failing request before the fallback chain runs. When an agent request fails with a **repairable request-side 4xx** (default allow-list `400,404,422` — never 401/403/429/5xx), Manifest hands the failed request + normalized provider error to an external healing service (**Phoenix**), gets back a patched request, and resends it **once**. It runs **before** `shouldTriggerFallback`, so the fallback chain is the safety net if healing doesn't clear the error. Toggled **per agent** (`agents.autofix_enabled`) and gated to **early-access tenants** (the waitlist gate below) — not tied to the routing cohort.

**Per-agent default is deployment-mode-dependent.** `agents.autofix_enabled` is **nullable**: `NULL` means "no explicit choice — inherit the mode default", which is **ON in cloud, OFF in self-hosted** (resolved by `AutofixService.resolveEnabled()` via `isSelfHosted()`, computed once at boot). An explicit `true`/`false` (the user flipping the Settings toggle) always wins. The `GET/PATCH …/autofix` endpoints return the *resolved* effective value, so the UI shows the right default state without persisting one. Migration `1799000300000` drops the old blanket `false` default and resets pre-feature `false` rows to `NULL` so they inherit the mode default.

**Three-phase early-access gate.** A per-**tenant** gate sits ABOVE the per-agent default, driven by `AUTOFIX_ROLLOUT` (`selected` → `waitlist` → `everyone`):
- **`selected`** (default, most restrictive) — only tenants **we hand-picked**: `tenants.autofix_access_granted_at != null` (set it manually, e.g. `UPDATE tenants SET autofix_access_granted_at = now() WHERE id = (SELECT t.id FROM tenants t JOIN "user" u ON u.id = t.owner_user_id WHERE u.email = '…')`).
- **`waitlist`** — granted tenants **plus** anyone who joined the waitlist (`tenants.autofix_waitlist_at`, set via `POST /api/v1/waitlist/autofix` — the "Get early access" card).
- **`everyone`** — general availability, no gate.

`AutofixService.hasAccess(tenantId)` (cached 30s; invalidated on waitlist join) computes `granted || (rollout==='waitlist' && joined)`, short-circuiting to `true` under `everyone`. `maybeHeal` requires it, so a non-access tenant **never heals even when the cloud default would enable it**; `GET/PATCH …/autofix` return `available` so the Settings toggle shows only to access tenants (everyone else keeps the "Get early access" card). Advance the rollout by bumping `AUTOFIX_ROLLOUT`; at `everyone`, retire the gate.

**Scope:** non-streaming responses + streaming that fails before the first byte (a repairable 4xx makes `providerResponse.ok=false` before any client bytes are sent). **One attempt only — there is no retry budget.** If the single patched retry still fails, Manifest reports the outcome to Phoenix and hands off to fallback.

**Manifest-blocked M302s are healable too.** An explicit `model` that resolves to no connected model never reaches a provider — historically it returned the friendly M302 without Phoenix ever seeing it. Now `healOrRejectUnavailableModel` (`proxy.service.ts`) synthesizes the 404 a provider would return (`code: model_not_found`, `param: model`, fingerprint provider inferred from the model prefix, `manifest` for bare names) and runs it through the same `maybeHeal` gates; a patch that renames the model re-resolves routing from scratch and serves the repaired request. Recording keeps one caller Request with the original requested model and the Auto-fix outcome, plus the real healed provider retry as its sole Provider Attempt — no attempt is fabricated for the Manifest-blocked original. Agents without Auto-fix (or a failed heal) get the friendly M302 exactly as before; an uncleared block remains a failed M302 Request with zero Provider Attempts.

**Code:** `packages/backend/src/routing/autofix/`
- `autofix.service.ts` — `maybeHeal()` gates on (globally enabled + repairable status + circuit breaker closed + agent opted in), then `runHealOnce()` does one heal + one reforward. Any throw degrades to the original provider error (never a Manifest 500). Per-agent config is cached 30s; `invalidateConfig()` is called on toggle. **Circuit breaker:** after 3 consecutive heal-call transport failures the breaker opens for 30s and `maybeHeal()` skips healing (returns null → straight to fallback), so a slow/down Phoenix stops adding latency to every repairable 4xx; any successful round-trip clears the streak.
- `healing-client.ts` — the `HealingClient` port + `HEALING_CLIENT` DI token. Chosen at boot in `autofix.module.ts`: `HttpHealingClient` when `AUTOFIX_HEALING_URL` is set; otherwise **`NoopHealingClient` in production** (inert — never mutates traffic) and the in-process **`MockHealingClient` only in dev/test** (so the flow can be exercised without an external Phoenix). This keeps the dev mock's hardcoded catalog off real traffic when a healer isn't wired.
- `phoenix.types.ts` — the wire contract. `provider-error-normalizer.ts` — turns a raw 4xx body into `{message,type,param,code}`. `autofix.types.ts` — internal `AutofixRecord` / `AutofixChainEntry`.
- `autofix-health-probe.ts` — on boot (`OnApplicationBootstrap`), if `AUTOFIX_HEALING_URL` is set, pings Phoenix `GET /api/health` once (fire-and-forget, never blocks/fails boot) and warns if unreachable — so a wrong URL / missing key / down Phoenix surfaces at deploy, not on the first repairable 4xx.
- **Contract guardrail (anti-drift):** `phoenix.types.ts` is kept in lockstep with Phoenix's OpenAPI, vendored at `contract/phoenix-openapi.yaml`. `__tests__/phoenix-contract.spec.ts` (ajv) fails CI if the status enums or required fields drift — the status unions live as `as const` arrays (`HEAL_STATUSES`/`ISSUE_STATUSES`/`OUTCOME_STATUSES`) so they're compared to the spec at runtime. Refresh with `npm run contract:refresh --workspace=packages/backend` (uses `gh`; needs read access to the private `mnfst/phoenix`). `.github/workflows/phoenix-contract-drift.yml` flags weekly when the vendored copy falls behind Phoenix `main` (needs a `PHOENIX_CONTRACT_TOKEN` secret).
- **Hook:** `proxy.service.ts`, after the primary forward and *before* `shouldTriggerFallback`. `ProxyResult.autofix` threads the record to the recorder.

**Phoenix = [`mnfst/phoenix`](https://github.com/mnfst/phoenix)** (separate repo). Contract (v2):
- `POST /api/heal` — body `{traceId, provider, api, url?, request, response:{statusCode, error:{message,type?,param?,code?}}}`. **`traceId` is required** (Phoenix rejects a body without it) and **the provider error is nested under `response`** (a flat `providerError` is rejected), and `api` is the proxy `apiMode` verbatim (`chat_completions` | `responses` | `messages`). The response is discriminated on `status`: `patched` / `unverified` (both carry `healedBody` + `healAttemptId` → apply the patch and resend; `patched` = verified issue, `unverified` = fresh patch) | `resolving` (Phoenix is still authoring a fix — nothing to resend) | `no_patch`. Also returns `issueId`, `patchId?`, `operations?`.
- `PATCH /api/heal-attempts/{healAttemptId}` — report the retry outcome `{retryStatusCode, error?}` (`error` required when ≥400). Fire-and-forget; Phoenix decides succeeded/failed. Only possible when a patch handed out a `healAttemptId` — `no_patch`/`resolving` carry none, so those outcomes are **not** reported.
- `traceId` is stable across the logical request (Manifest reuses the internal `groupId`).

**Recording separates the request verdict from attempt audit.** `requests.autofix_status` is the one outcome for the logical request; only `retry_succeeded` means the request was recovered by Auto-fix. Actual provider calls remain `agent_messages` rows with their own `status`. When Manifest sends a patched retry, the related attempt rows use `autofix_applied`, `autofix_group_id`, `autofix_role`, and `autofix_operations`; Phoenix's decision metadata is exposed by the entity as `autofix_decision` (`{status,issueId,patchId,healAttemptId,explanation}`) and mapped to the retained physical column `autofix_phoenix`. A Phoenix consultation that produces no patched retry must not create a fake provider attempt.

**Frontend:** `pages/SettingsAutofixSection.tsx` — a single on/off toggle in the per-agent **Settings** page (shown for every agent; `services/api/routing.ts` `getAutofix`/`updateAutofix`; `.settings-switch` styling). `components/MessageDetails.tsx` renders the Auto-fix panel + sibling link.

**Endpoints:** `GET/PATCH /api/v1/routing/:agentName/autofix` → `{ enabled }`.

**Env:** `AUTOFIX_HEALING_URL` (unset → inert Noop in production, in-process mock in dev/test), `AUTOFIX_HEALING_API_KEY` (sent as `x-api-key`; required for a production Phoenix, which fails closed without it), `AUTOFIX_GLOBAL_ENABLED` (`false` disables Auto-fix everywhere; default on), `AUTOFIX_ROLLOUT` (`selected` [default] / `waitlist` / `everyone` — the early-access phase), `AUTOFIX_TIMEOUT_MS` (per heal call, default `10000`), `AUTOFIX_REPAIRABLE_STATUSES` (default `400,404,422`).

## Providers & Models

### Provider Registry (Single Source of Truth)

All provider definitions live in `packages/shared/src/` (`SHARED_PROVIDERS`); `common/constants/providers.ts` (`PROVIDER_REGISTRY`) re-exports it for backend use. This is the **only** place to define provider IDs, display names, aliases, and OpenRouter prefix mappings. Never hardcode provider names elsewhere — always import from the registry.

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

1. Add entry to `SHARED_PROVIDERS` in `packages/shared/src/` (re-exported to the backend as `PROVIDER_REGISTRY` in `common/constants/providers.ts`)
2. Add `FetcherConfig` in `model-discovery/provider-model-fetcher.service.ts`
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
  → saves to tenant_providers.cached_models (JSONB column)
  → recalculates tier assignments
```

- `ProviderModelFetcherService` — config-driven fetcher with parsers for each provider API format (OpenAI-compatible, Anthropic, Gemini, OpenRouter, Ollama)
- `ModelDiscoveryService` — orchestrator that decrypts keys, fetches, enriches with pricing, caches results. Falls back to OpenRouter cache when native API is unavailable.
- `cached_models` — per-provider JSONB column on `tenant_providers` table
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
| **Routing (tier assignments)** | `TierService` (`routing-core/route-helpers.ts` `effectiveRoute`/`unambiguousRoute`) | Auto-assigned from discovered models based on quality/price scoring |
| **Requests / Overview attempt details** | Stored in `agent_messages.model` column | Raw model name from telemetry, display name resolved via `model-display.ts` cache |

## Releases

There are **no publishable npm packages** in this repo. `packages/backend`, `packages/frontend`, `packages/shared`, and `packages/manifest` are all `private: true`. Manifest ships exclusively as the Docker image at `manifestdotbuild/manifest` (built from `docker/Dockerfile`).

### `packages/manifest/` is the canonical version

`packages/manifest/` is a **code-free shell package** that exists only to hold the canonical "Manifest version". It has no `src/`, no tests, no dependencies — just `package.json`, `README.md`, and (after the first release) a `CHANGELOG.md`. The real backend and frontend live under `packages/backend/` and `packages/frontend/` as before.

`.changeset/config.json` has `"ignore": ["manifest-backend", "manifest-frontend", "manifest-shared"]`, so when a contributor runs `npx changeset`, **only `manifest` is a selectable target**. Bumps to `manifest-backend` / `manifest-frontend` / `manifest-shared` are silently discarded. Always target `manifest` regardless of which files you actually changed. A CI check (`scripts/check-changesets.js`, wired into the `changeset-check` job) enforces this: a changeset that targets an ignored package fails the PR, because it makes `changeset version` a no-op and breaks the Release workflow with "No commits between main and changeset-release/main".

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

When adding new TypeORM entities to `database/data-source-definitions.ts` (the entities array `database.module.ts` imports from), also add them to the E2E test helper (`packages/backend/test/helpers.ts`) entities array. Missing entities cause `EntityMetadataNotFoundError` in services that depend on them.
