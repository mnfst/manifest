# Implementation Plan: App Secrets Vault

**Branch**: `001-app-secrets-vault` | **Date**: 2026-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-app-secrets-vault/spec.md`

## Summary

Add a secrets vault feature for apps to manage secret variables (key-value pairs with masked values), along with a navigation restructure that separates user settings (`/settings`) from app settings (`/app/:appId/settings`). Secrets are displayed Railway-style with masked values, reveal/copy functionality, and full CRUD operations. All app collaborators have equal access to secrets.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >= 18.0.0
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 (frontend), Vite 6.0.5, TailwindCSS 3.4.17
**Storage**: SQLite via better-sqlite3 11.7.0, TypeORM 0.3.20
**Testing**: Jest + @nestjs/testing (deferred per POC constitution)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Web (monorepo: packages/backend, packages/frontend, packages/shared)
**Performance Goals**: Deferred per POC constitution
**Constraints**: API response feedback within 100ms (UX consistency per constitution)
**Scale/Scope**: Same as current app (POC scope)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | New entity/service follows existing patterns (Single Responsibility) |
| II. Testing Standards | DEFERRED | POC phase - no automated tests required |
| III. UX Consistency | PASS | Reuses existing tab patterns, follows Railway reference UI |
| IV. Performance | DEFERRED | POC phase |
| V. Documentation | PASS | Self-documenting code; spec serves as architecture doc |
| Auto-Serve for Testing | WILL COMPLY | Run serve-app.sh after implementation |

**Gate Status**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-app-secrets-vault/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── app/
│       │   └── app.entity.ts          # (existing) - no changes needed
│       └── secret/                     # NEW module
│           ├── secret.entity.ts       # AppSecret entity
│           ├── secret.service.ts      # CRUD operations
│           ├── secret.controller.ts   # API endpoints
│           └── secret.module.ts       # NestJS module
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── SettingsPage.tsx       # MODIFY: Remove General tab
│       │   └── AppSettingsPage.tsx    # NEW: App-scoped settings
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx        # MODIFY: Settings link logic
│       │   │   └── UserAvatar.tsx     # MODIFY: Rename dropdown item
│       │   └── settings/
│       │       ├── SecretsTab.tsx     # NEW: Secrets management UI
│       │       └── SecretRow.tsx      # NEW: Individual secret row
│       ├── lib/
│       │   └── api.ts                 # MODIFY: Add secret API methods
│       └── App.tsx                    # MODIFY: Add /app/:appId/settings route
└── shared/
    └── src/
        └── types/
            └── secret.ts              # NEW: AppSecret types
```

**Structure Decision**: Follows existing web application pattern. New `secret` module in backend mirrors `app` and `flow` modules. Frontend follows existing page/component organization.

## Complexity Tracking

> No violations requiring justification - standard CRUD feature following existing patterns.
