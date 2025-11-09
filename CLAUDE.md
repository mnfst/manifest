# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Manifest is a 1-file backend framework that allows developers to define their entire backend (entities, relationships, auth, storage, etc.) in a single YAML file (`manifest.yml`). The framework generates:
- A REST API with full CRUD operations
- An admin panel (Angular-based)
- TypeScript type definitions
- OpenAPI documentation
- Database schemas (SQLite, PostgreSQL, MySQL)

## Monorepo Structure

This is a Turborepo monorepo with workspaces in `packages/`:

```
packages/
├── core/
│   ├── manifest/        # Main NestJS backend (the core package)
│   ├── admin/           # Angular admin panel
│   ├── types/           # Shared TypeScript types
│   ├── json-schema/     # Manifest JSON schema definition
│   └── common/          # Shared utilities
├── js-sdk/              # Client JavaScript SDK (@mnfst/sdk)
└── create-manifest/     # CLI tool for project scaffolding
```

## Common Commands

### Development
```bash
# Install all dependencies
npm install
npm install --workspaces

# Start development servers (both API and admin panel)
npm run dev

# Development URLs:
# - Admin panel: http://localhost:4200
# - API docs: http://localhost:3000/api

# Seed database with test data (run after dev server starts)
npm run seed
```

### Testing
```bash
# Run all tests (unit + e2e)
npm run test

# Run tests in CI mode (includes coverage)
npm run test:ci

# Test specific package
cd packages/core/manifest
npm run test:unit           # Unit tests only
npm run test:e2e:sqlite     # E2E tests with SQLite
npm run test:e2e:postgres   # E2E tests with PostgreSQL
npm run test:e2e:mysql      # E2E tests with MySQL
```

### Building
```bash
# Build all packages (respects Turbo dependency graph)
npm run build

# Turbo builds in order: json-schema → manifest → js-sdk → admin
```

### Linting & Formatting
```bash
npm run lint
```

Prettier config: no semicolons, single quotes, no trailing commas (except YAML uses double quotes).

### Publishing Workflow
```bash
# Create a changeset (required before merging PRs)
npx changeset

# Publish (after merging to master)
npm run publish-packages
```

## Architecture

### Core Modules (NestJS)

The main backend (`packages/core/manifest/src`) is organized into modules:

- **ManifestModule**: Loads and parses `manifest.yml`, validates against JSON schema
  - `ManifestService`: Core service for reading manifest configuration
  - `YamlService`: YAML parsing
  - `SchemaService`: JSON schema validation
  - `EntityManifestService`, `PropertyManifestService`, `RelationshipManifestService`: Manifest builders
  - `ManifestWriterService`: Writes changes back to `manifest.yml`

- **EntityModule**: Dynamic entity management
  - `EntityLoaderService`: Generates TypeORM EntitySchemas from manifest at runtime
  - Supports SQLite, PostgreSQL, MySQL with different column type mappings
  - Handles relationships (belongsTo, hasMany, etc.)

- **CrudModule**: Auto-generated CRUD controllers/services for each entity
  - One controller/service dynamically created per entity
  - Supports filtering, pagination, sorting, search

- **AuthModule**: Authentication & authorization
  - JWT-based auth for authenticable entities
  - Token generation and validation

- **ValidationModule**: Property validation based on manifest rules
  - Integrates with class-validator

- **UploadModule** & **StorageModule**: File upload handling
  - Local storage or S3-compatible storage
  - Image resizing with Sharp

- **OpenApiModule**: Generates OpenAPI spec from manifest
  - Auto-generates TypeScript interfaces in `generated/types.ts`
  - Writes OpenAPI spec to `generated/openapi.yml`

- **HookModule**: Lifecycle hooks (beforeInsert, afterUpdate, etc.)

- **EndpointModule**: Custom endpoints defined in manifest

- **PolicyModule**: Access control policies

- **SeedModule**: Database seeding with Faker.js

### Admin Panel (Angular)

Located in `packages/core/admin/`:
- Built with Angular 17, Bulma CSS
- Modules: auth, crud, editor (for manifest editing), layout, shared
- Builds into `dist/admin` and is served by the NestJS backend
- During build, admin dist is copied to manifest package: `packages/core/manifest/dist/admin`

### Manifest YAML Location

The development manifest file is at: `packages/core/manifest/manifest/manifest.yml`

This is the file you modify during development. It defines entities, properties, relationships, auth settings, etc.

### Database Configuration

Environment variables control database connection:
- `DB_CONNECTION`: `sqlite` (default), `postgres`, or `mysql`
- SQLite: Uses file in `storage/db.sqlite`
- Postgres/MySQL: Configure via env vars

For contributions, use `.env.contribution` (already configured for development).

### Build Dependencies

The Turbo build graph enforces order:
1. `@repo/json-schema#build` - Generates JSON schema
2. `manifest#build` - Builds backend + bundles admin panel
3. `@mnfst/sdk#build` - Builds SDK (depends on json-schema)

The manifest package build does:
```bash
rm -fr ./dist && nest build && cd ../admin && npm run build-admin-in-bundle
```

### Key TypeScript Packages

- `@repo/types`: Shared types used across all packages (AppManifest, EntityManifest, PropertyManifest, etc.)
- `@repo/common`: Shared utilities
- `@repo/json-schema`: The canonical Manifest JSON schema (https://schema.manifest.build/schema.json)

## Testing Patterns

- Unit tests: `*.spec.ts` files, use Jest
- E2E tests: `e2e/*.e2e-spec.ts`, use Jest with Supertest
- E2E tests run against all three databases in CI
- Test containers used for PostgreSQL and MySQL in CI
- Single worker for E2E tests (`maxWorkers: 1`) to avoid conflicts

## Code Quality & CI

- **Linting**: Husky pre-commit hook runs `npm run lint`
- **Changesets**: Required for all PRs (run `npx changeset`)
- **Conventional Commits**: Commit messages should follow convention
- **CodeCov**: Coverage reports uploaded from CI
- **CodeFactor**: Code quality checks

## Development Notes

### Hot Reload

In development mode, the backend uses:
- Nodemon to watch `.ts`, `.yml`, `.json`, `.js` files
- LiveReload to refresh browser on file changes
- Watch paths: `src`, `manifest/*.yml`, `manifest/handlers/*.js`

### Environment Variables

Production safety check: `TOKEN_SECRET_KEY` must be set in production (not the default value).

### Manifest Editing

The admin panel includes a YAML editor with JSON schema validation for editing `manifest.yml` directly through the UI. Changes are persisted via `ManifestWriterService`.

## TypeORM Integration

Entities are generated dynamically at runtime:
1. Manifest is loaded from YAML
2. `EntityLoaderService` creates TypeORM `EntitySchema` objects
3. Schemas injected into TypeORM module during app initialization
4. Different column types for SQLite vs Postgres vs MySQL

## Common Development Tasks

When working on manifest-related features:
1. Update types in `packages/core/types/src/manifests/` if changing manifest structure
2. Update JSON schema in `packages/core/json-schema/src/` for validation
3. Update `EntityLoaderService` if adding new property types
4. Update admin UI in `packages/core/admin/` if adding UI for new features
5. Add e2e tests in `packages/core/manifest/e2e/`

## Documentation

Official docs are in a separate repo: https://github.com/mnfst/docs
