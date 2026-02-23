# Manifest Development Guidelines

Last updated: 2026-02-20

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
│   │   │   └── database-seeder.service.ts   # Seeds model_pricing + demo data
│   │   ├── entities/                        # TypeORM entities (14 files)
│   │   │   ├── tenant.entity.ts             # Multi-tenant root
│   │   │   ├── agent.entity.ts              # Agent (belongs to tenant)
│   │   │   ├── agent-api-key.entity.ts      # OTLP ingest keys (mnfst_*)
│   │   │   └── ...                          # agent-message, llm-call, security-event, etc.
│   │   ├── common/
│   │   │   ├── guards/api-key.guard.ts      # X-API-Key header auth (timing-safe)
│   │   │   ├── decorators/public.decorator.ts
│   │   │   ├── dto/range-query.dto.ts
│   │   │   └── utils/range.util.ts
│   │   ├── health/                          # @Public() health check
│   │   ├── telemetry/                       # POST /api/v1/telemetry (JSON ingestion)
│   │   ├── analytics/                       # Dashboard analytics
│   │   │   ├── controllers/                 # overview, tokens, costs, messages, agents
│   │   │   └── services/                    # aggregation + timeseries-queries + query-helpers
│   │   ├── otlp/                            # OTLP ingestion (traces, metrics, logs)
│   │   │   ├── guards/otlp-auth.guard.ts    # Bearer token auth (agent API keys)
│   │   │   └── services/api-key.service.ts  # Agent onboarding (creates tenant+agent+key)
│   │   └── security/                        # GET /api/v1/security
│   └── test/                                # E2E tests (supertest)
├── frontend/
│   ├── src/
│   │   ├── index.tsx                        # Router setup (App + AuthLayout)
│   │   ├── components/
│   │   │   ├── AuthGuard.tsx                # Session check, redirect to /login
│   │   │   ├── SocialButtons.tsx            # 3 OAuth provider buttons
│   │   │   ├── Header.tsx                   # User session data, logout
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Login.tsx, Register.tsx       # Auth pages
│   │   │   ├── Workspace.tsx                # Agent grid + create agent
│   │   │   ├── Overview.tsx                 # Agent dashboard
│   │   │   ├── MessageLog.tsx               # Paginated messages
│   │   │   ├── Account.tsx                  # User profile (session data)
│   │   │   └── Settings.tsx                 # Agent settings
│   │   ├── services/
│   │   │   ├── auth-client.ts               # Better Auth SolidJS client
│   │   │   ├── api.ts                       # API functions (credentials: include)
│   │   │   └── formatters.ts               # Number/cost formatting
│   │   └── styles/
│   └── tests/
├── openclaw-plugin/               # npm: `manifest` — OpenClaw observability plugin
└── manifest-server/               # npm: `@mnfst/server` — embedded server for local mode
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
- **Model pricing**: 28 models seeded (Anthropic, OpenAI, Google, DeepSeek, etc.)

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
| GET | `/api/v1/security` | Session/API Key | Security score + events |
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
- **Better Auth database**: Uses a `pg.Pool` instance (from the `pg` driver) passed directly to `betterAuth({ database: pool })`. Better Auth auto-detects the PostgreSQL dialect via Kysely.
- **PostgreSQL container**: `docker run -d --name postgres_db -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=mydatabase -p 5432:5432 postgres:16`
- **Validation**: Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`. Explicit `@Type()` decorators on numeric DTO fields.
- **OTLP auth caching**: `OtlpAuthGuard` caches valid API keys in-memory for 5 minutes to avoid repeated DB lookups.
- **Database migrations**: TypeORM migrations are version-controlled in `src/database/migrations/`. `synchronize` is permanently `false`. Migrations auto-run on boot (`migrationsRun: true`) wrapped in a single transaction. The CLI DataSource is at `src/database/datasource.ts`. Better Auth manages its own tables separately via `ctx.runMigrations()`.

## Releases & Changesets

Version management and npm publishing use [Changesets](https://github.com/changesets/changesets). Config is in `.changeset/config.json`.

### Publishable Packages

| Package | npm name | Published |
|---------|----------|-----------|
| `packages/openclaw-plugin` | `manifest` | Yes |
| `packages/manifest-server` | `@mnfst/server` | Yes |
| `packages/backend` | `manifest-backend` | No (`private: true`) |
| `packages/frontend` | `manifest-frontend` | No (`private: true`) |

The two publishable packages are **linked** in changesets config — a major/minor bump to one bumps the other.

### CRITICAL: Every PR Needs a Changeset

**Before creating any PR, you MUST add a changeset.** The `changeset-check` CI job will fail without one.

- If the PR changes a **publishable package** (`openclaw-plugin` or `manifest-server`): run `npx changeset` and follow the prompts to describe the change and select a bump level.
- If the PR **only touches internal packages** (backend, frontend, CI, docs, tests): run `npx changeset add --empty` to create an empty changeset.
- Commit the generated `.changeset/*.md` file as part of the PR.

### Workflow

1. When changing a publishable package, run `npx changeset` and commit the generated file
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

The `changeset-check` job in `.github/workflows/ci.yml` runs `npx changeset status --since=origin/main` on PRs. It warns when publishable packages changed without a changeset. If a PR only touches internal packages (backend, frontend, CI, docs), use `npx changeset add --empty`.
