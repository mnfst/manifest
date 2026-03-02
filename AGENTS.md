# AGENTS.md

Agent-oriented guide for working in the Manifest monorepo.

## Project Overview

- Monorepo: npm workspaces + Turborepo
- Packages:
  - `packages/backend`: NestJS 11 + TypeORM (`postgres` in cloud, `sql.js` in local mode)
  - `packages/frontend`: SolidJS + Vite
  - `packages/openclaw-plugin`: OpenClaw plugin published to npm as `manifest`
- Node/npm baseline: Node 22.x, npm 10.x

## Core Rules

1. Default to local mode for development and testing unless explicitly asked to use cloud mode:
   - `MANIFEST_MODE=local`
2. Do not use external CDNs in frontend assets. CSP is strict (`'self'`) and runtime should stay self-hosted.
3. Backend/frontend changes require a `manifest` changeset (`npx changeset`) for PRs.
4. Add or update tests for new/changed logic. CI enforces coverage via Codecov.
5. Prefer minimal, targeted changes that preserve existing architecture and conventions.

## Repository Layout

```text
packages/
  backend/           NestJS API + auth + OTLP ingestion + analytics
  frontend/          SolidJS SPA
  openclaw-plugin/   OpenClaw extension + routing + telemetry + local mode bootstrap
.changeset/          Changeset files for release/versioning
```

## Setup

```bash
npm install
cp packages/backend/.env.example packages/backend/.env
```

Minimum backend env values:

```env
BETTER_AUTH_SECRET=<openssl rand -hex 32>
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=3001
BIND_ADDRESS=127.0.0.1
NODE_ENV=development
```

## Local Development

Run these in separate terminals:

```bash
# Backend (dotenv must be preloaded)
cd packages/backend && NODE_OPTIONS='-r dotenv/config' npx nest start --watch

# Frontend
cd packages/frontend && npx vite

# Plugin watch mode (optional)
cd packages/openclaw-plugin && npx tsx watch build.ts
```

Notes:
- Vite runs on `http://localhost:3000` and proxies `/api` + `/otlp` to backend `:3001`.
- `npm run dev` from repo root does not start backend; start backend explicitly.

## Plugin Integration (Dev Mode)

When validating plugin <-> backend integration without API-key management:

```bash
# 1) Build and run backend in local mode
npm run build
MANIFEST_MODE=local PORT=38238 BIND_ADDRESS=127.0.0.1 \
  node -r dotenv/config packages/backend/dist/main.js

# 2) Point plugin to local backend
openclaw config set plugins.entries.manifest.config.mode dev
openclaw config set plugins.entries.manifest.config.endpoint http://localhost:38238/otlp

# 3) Restart OpenClaw gateway
openclaw gateway restart
```

## Common Commands

```bash
# Root
npm run build
npm run test
npm run lint
npm run format

# Backend
npm test --workspace=packages/backend
npm run test:e2e --workspace=packages/backend
npm run build --workspace=packages/backend

# Frontend
npm test --workspace=packages/frontend
npm run build --workspace=packages/frontend

# Plugin
npm test --workspace=packages/openclaw-plugin
npm run build:plugin
```

## Database and Migrations

- TypeORM migrations are the source of truth (`synchronize` is disabled).
- After entity changes, generate and commit a migration:

```bash
cd packages/backend
npm run migration:generate -- src/database/migrations/DescriptiveName
```

- Migrations run on app startup (`migrationsRun: true`).

## CI Expectations (Before PR)

Run at least:

```bash
npm test --workspace=packages/backend
npm run test:e2e --workspace=packages/backend
npm test --workspace=packages/frontend
npm test --workspace=packages/openclaw-plugin
npm run build
```

Changeset requirements:

- If `packages/backend/**` or `packages/frontend/**` changed, add a changeset bumping `manifest`.
- For docs/CI/tooling-only changes, use an empty changeset when needed:

```bash
npx changeset
# or
npx changeset add --empty
```

Coverage expectations:

- Codecov project threshold: no more than 1% drop from base.
- Patch threshold: approximately auto - 5%.

## Implementation Notes

- Keep API validation strict (DTOs + `ValidationPipe` behavior).
- Preserve multi-tenant filtering patterns in analytics queries.
- In local mode, auth behavior differs intentionally (loopback-based local session endpoints).
- Avoid broad refactors unless required for the requested change.
