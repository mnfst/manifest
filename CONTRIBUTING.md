# Contributing to Manifest

Thanks for your interest in contributing to Manifest! This guide will help you get up and running.

[![codecov](https://img.shields.io/codecov/c/github/mnfst/manifest?color=brightgreen)](https://codecov.io/gh/mnfst/manifest)

## Tech Stack

| Layer     | Technology                                    |
| --------- | --------------------------------------------- |
| Frontend  | SolidJS, uPlot, custom CSS theme              |
| Backend   | NestJS 11, TypeORM, sql.js (local) / PostgreSQL (cloud) |
| Auth      | Better Auth (auto-login on localhost)          |
| Telemetry | OTLP HTTP (JSON + Protobuf)                   |
| Build     | Turborepo + npm workspaces                    |

The full NestJS + SolidJS stack runs locally backed by sql.js (WASM SQLite). The same codebase also powers the [cloud version](https://app.manifest.build) with PostgreSQL — the only differences are the database driver and auth guard.

## Prerequisites

- Node.js 22.x (LTS)
- npm 10.x

## Repository Structure

Manifest is a monorepo managed with [Turborepo](https://turbo.build/) and npm workspaces.

```
packages/
├── backend/           # NestJS API server (TypeORM, PostgreSQL, Better Auth)
├── frontend/          # SolidJS single-page app (Vite, uPlot)
└── openclaw-plugin/   # OpenClaw observability plugin (npm: manifest)
```

## Getting Started

1. Fork and clone the repository:

```bash
git clone https://github.com/<your-username>/manifest.git
cd manifest
npm install
```

2. Set up environment variables:

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env` with at least:

```env
PORT=3001
BIND_ADDRESS=127.0.0.1
NODE_ENV=development
BETTER_AUTH_SECRET=<run: openssl rand -hex 32>
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mydatabase
API_KEY=dev-api-key-12345
SEED_DATA=true
```

3. Start the development servers (in separate terminals):

```bash
# Backend (must preload dotenv)
cd packages/backend && NODE_OPTIONS='-r dotenv/config' npx nest start --watch

# Frontend
cd packages/frontend && npx vite
```

The frontend runs on `http://localhost:3000` and proxies API requests to the backend on `http://localhost:3001`.

4. With `SEED_DATA=true`, you can log in with `admin@manifest.build` / `manifest`.

## Testing with the OpenClaw Plugin (Dev Mode)

When developing features that involve the OpenClaw plugin (routing, telemetry, observability), use **dev mode** to point the plugin at your local backend without API key management.

1. Build and start the backend in local mode:

```bash
npm run build
MANIFEST_MODE=local PORT=38238 BIND_ADDRESS=127.0.0.1 \
  node -r dotenv/config packages/backend/dist/main.js
```

2. Configure the plugin to use dev mode:

```bash
openclaw config set plugins.entries.manifest.config.mode dev
openclaw config set plugins.entries.manifest.config.endpoint http://localhost:38238/otlp
```

3. Restart the gateway:

```bash
openclaw gateway --force
```

That's it — no API key needed. Telemetry from your agent flows directly to the local backend. Open `http://localhost:38238` to see the dashboard (you'll see an orange **Dev** badge in the header).

**When to use dev mode:**

- Testing routing, tier assignment, or model resolution
- Working on OTLP ingestion or telemetry pipelines
- Debugging the plugin ↔ backend integration
- Any time you need the full plugin + backend stack running locally

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start frontend + plugin in watch mode (start backend separately) |
| `npm run build` | Production build (frontend then backend via Turborepo) |
| `npm start` | Start the production server |
| `npm test --workspace=packages/backend` | Run backend unit tests (Jest) |
| `npm run test:e2e --workspace=packages/backend` | Run backend e2e tests (Jest + Supertest) |
| `npm test --workspace=packages/frontend` | Run frontend tests (Vitest) |
| `npm run build:plugin` | Build the OpenClaw plugin |

## Working with Individual Packages

### Backend (`packages/backend`)

- **Framework**: NestJS 11 with TypeORM 0.3 and PostgreSQL 16
- **Auth**: Better Auth (email/password + Google, GitHub, Discord OAuth)
- **Tests**: Jest for unit tests (`*.spec.ts`), Supertest for e2e tests (`test/`)
- **Key directories**: `entities/` (data models), `analytics/` (dashboard queries), `otlp/` (telemetry ingestion), `auth/` (session management)

### Frontend (`packages/frontend`)

- **Framework**: SolidJS with Vite
- **Charts**: uPlot for time-series visualization
- **Tests**: Vitest
- **Key directories**: `pages/` (route components), `components/` (shared UI), `services/` (API client, auth client)

### Plugin (`packages/openclaw-plugin`)

- **Bundler**: esbuild (zero runtime dependencies)
- **Build**: `npx tsx build.ts` or `npm run build:plugin` from the root
- **Watch mode**: `cd packages/openclaw-plugin && npx tsx watch build.ts`

## Making Changes

### Workflow

1. Create a branch from `main` for your change
2. Make your changes in the relevant package(s)
3. Write or update tests as needed
4. If your change affects a publishable package (`manifest`), add a changeset:

```bash
npx changeset
```

Follow the prompts to select the affected packages and bump type (patch / minor / major). This creates a file in `.changeset/` — commit it with your code. See [Changesets](#changesets) below for details.

5. Run the test suite to make sure everything passes:

```bash
npm test --workspace=packages/backend
npm run test:e2e --workspace=packages/backend
npm test --workspace=packages/frontend
```

6. Verify the production build works:

```bash
npm run build
```

7. Open a pull request against `main`

### Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and npm publishing. When you change a publishable package, you need to include a changeset describing the change.

**Which packages need changesets?**

| Package | npm name | Needs changeset? |
| --- | --- | --- |
| `packages/openclaw-plugin` | `manifest` | Yes |
| `packages/backend` | — | No (private) |
| `packages/frontend` | — | No (private) |

**Adding a changeset:**

```bash
npx changeset
```

Select the affected packages, choose the semver bump type, and write a short summary. This creates a markdown file in `.changeset/` — commit it alongside your code changes.

**What happens after merge:**

1. The release workflow detects changesets and opens a "Version Packages" PR
2. That PR bumps versions in `package.json` and updates `CHANGELOG.md`
3. When the version PR is merged, the workflow publishes to npm automatically

**If your change doesn't need a release** (e.g., docs, CI, internal tooling):

```bash
npx changeset add --empty
```

### Commit Messages

Write clear, concise commit messages that explain **why** the change was made. Use present tense (e.g., "Add token cost breakdown to overview page").

### Pull Requests

- Keep PRs focused on a single concern
- Include a short summary of what changed and why
- If you changed a publishable package, include a changeset (CI will warn if missing)
- Reference any related issues

## Architecture Notes

- **Single-service deployment**: In production, NestJS serves both the API and the frontend static files from the same port via `@nestjs/serve-static`.
- **Dev mode**: Vite on `:3000` proxies `/api` and `/otlp` to the backend on `:3001`. CORS is enabled only in development.
- **Database**: PostgreSQL 16. Schema changes are managed via TypeORM migrations (`migrationsRun: true` on boot). After modifying an entity, generate a migration with `npm run migration:generate -- src/database/migrations/Name`.
- **Validation**: Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- **TypeScript**: Strict mode across all packages.

## Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/mnfst/manifest/issues) with as much detail as possible.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
