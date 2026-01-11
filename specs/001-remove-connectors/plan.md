# Implementation Plan: Remove Connectors Feature

**Branch**: `001-remove-connectors` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-remove-connectors/spec.md`

## Summary

Remove the entire connectors feature from the codebase, including all backend modules (entity, service, controller), frontend components and pages, shared types, configuration files, and documentation. This is a cleanup task to remove unused code that is not planned for near-term implementation.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (Node.js >= 18.0.0)
**Primary Dependencies**: NestJS 10.4.15, React 18.3.1, TypeORM 0.3.20
**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM - removing ConnectorEntity
**Testing**: Jest (backend), existing test suite must pass after removal
**Target Platform**: Web application (Node.js backend, browser frontend)
**Project Type**: Monorepo with packages/backend, packages/frontend, packages/shared
**Performance Goals**: N/A (removal task)
**Constraints**: Must not break existing functionality; build and tests must pass
**Scale/Scope**: Removal affects ~15 files across 3 packages + documentation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | Removal improves SRP by eliminating dead code |
| II. Testing Standards | PASS (POC) | Tests deferred for POC; existing tests must still pass |
| III. User Experience Consistency | PASS | Sidebar menu item removal maintains consistency |
| IV. Performance Requirements | PASS (POC) | No performance impact |
| V. Documentation & Readability | PASS | Removing stale docs improves readability |

**Gate Status**: PASSED - No violations. Removal task aligns with all constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-remove-connectors/
├── plan.md              # This file
├── research.md          # Phase 0 output - verification of assumptions
├── data-model.md        # Phase 1 output - entities being removed
├── quickstart.md        # Phase 1 output - removal instructions
├── contracts/           # Phase 1 output - API endpoints being removed
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── app/
│       │   └── app.module.ts     # MODIFY: Remove ConnectorModule import
│       ├── connector/            # DELETE: Entire directory
│       │   ├── connector.controller.ts
│       │   ├── connector.entity.ts
│       │   ├── connector.module.ts
│       │   └── connector.service.ts
│       └── utils/
│           └── encryption.ts     # DELETE: Only used by connectors
├── frontend/
│   └── src/
│       ├── App.tsx               # MODIFY: Remove /connectors route
│       ├── components/
│       │   ├── connector/        # DELETE: Entire directory
│       │   │   ├── ConnectorCard.tsx
│       │   │   ├── ConnectorList.tsx
│       │   │   ├── ConnectorRow.tsx
│       │   │   ├── CreateConnectorModal.tsx
│       │   │   ├── DeleteConnectorDialog.tsx
│       │   │   └── EditConnectorModal.tsx
│       │   └── layout/
│       │       └── Sidebar.tsx   # MODIFY: Remove Connectors menu item
│       ├── lib/
│       │   └── api.ts            # MODIFY: Remove connector API functions
│       └── pages/
│           └── ConnectorsPage.tsx # DELETE
└── shared/
    └── src/
        ├── index.ts              # MODIFY: Remove connector exports
        └── types/
            └── connector.ts      # DELETE

# Configuration files (repository root)
├── docker-compose.yml            # MODIFY: Remove CONNECTOR_ENCRYPTION_KEY
├── README.md                     # MODIFY: Remove connector references
└── packages/backend/.env.example # MODIFY: Remove CONNECTOR_ENCRYPTION_KEY

# Specs to clean (other features referencing connectors)
specs/
├── 011-connectors/               # DELETE: Entire directory
├── 001-io-schemas/spec.md        # MODIFY: Remove connector reference
└── 018-node-connection/spec.md   # MODIFY: Remove connector reference
```

**Structure Decision**: Monorepo structure preserved. All connector-related code is isolated in dedicated directories/files, making removal straightforward.

## Complexity Tracking

> No violations - this is a straightforward removal task that reduces complexity.

| Aspect | Status |
|--------|--------|
| Files to delete | 13 files + 2 directories |
| Files to modify | 9 files |
| Dependencies to remove | mysql2 package (only used by connectors) |
| Breaking changes | None (feature was isolated) |

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion*

| Principle | Pre-Design | Post-Design | Notes |
|-----------|------------|-------------|-------|
| I. Code Quality & SOLID | PASS | PASS | No new code complexity; removal only |
| II. Testing Standards | PASS (POC) | PASS (POC) | Existing tests must pass post-removal |
| III. User Experience Consistency | PASS | PASS | UI remains consistent minus one menu item |
| IV. Performance Requirements | PASS (POC) | PASS (POC) | No performance changes |
| V. Documentation & Readability | PASS | PASS | Docs will be more accurate |

**Post-Design Gate Status**: PASSED - Design phase complete. Ready for `/speckit.tasks`.
