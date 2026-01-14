# Implementation Plan: Registry-Based UI Nodes

**Branch**: `091-registry-items` | **Date**: 2026-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/091-registry-items/spec.md`

## Summary

Replace static UI node definitions (StatCard, PostList) from `packages/nodes/src/nodes/interface/` with a dynamic registry system that fetches component definitions from a remote URL (`https://ui.manifest.build/r/registry.json`). The node library will display registry components organized by category with two-level navigation, and store complete component code in node data when adding to canvas.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (Node.js >= 18.0.0)
**Primary Dependencies**:
- Frontend: React 18.3.1, @xyflow/react 12.10.0, Vite 6.0.5, TailwindCSS 3.4.17
- Backend: NestJS 10.4.15, TypeORM 0.3.20, better-sqlite3 11.7.0
**Storage**: SQLite via better-sqlite3 (nodes stored as JSON in Flow entity)
**Testing**: Deferred (POC phase per constitution)
**Target Platform**: Web application (Linux server backend, modern browsers frontend)
**Project Type**: Monorepo with packages (frontend, backend, nodes, shared)
**Performance Goals**: Component addition < 2 seconds including fetch (per SC-002)
**Constraints**: No caching, fresh fetch on every access (per clarifications)
**Scale/Scope**: ~50+ registry components across 7+ categories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | New registry service follows SRP, existing patterns |
| II. Testing Standards | DEFERRED | POC phase - testing not required |
| III. UX Consistency | PASS | Reuses existing NodeLibrary patterns, adds skeleton loading |
| IV. Performance Requirements | DEFERRED | POC phase - 2s target is best effort |
| V. Documentation & Readability | PASS | Self-documenting code with clear interfaces |

**Gate Result**: PASS - All active principles satisfied, deferred items noted.

## Project Structure

### Documentation (this feature)

```text
specs/091-registry-items/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── NodeLibrary/
│       │       │   ├── NodeLibrary.tsx        # MODIFY: Add category navigation
│       │       │   ├── CategoryList.tsx       # NEW: Category grid/list
│       │       │   ├── RegistryItemList.tsx   # NEW: Components in category
│       │       │   └── RegistryItemSkeleton.tsx # NEW: Loading skeleton
│       │       └── ViewNode.tsx               # MODIFY: Handle registry components
│       ├── services/
│       │   └── registry.ts                    # NEW: Registry fetch service
│       └── types/
│           └── registry.ts                    # NEW: Registry type definitions
│
├── backend/
│   └── src/
│       ├── registry/
│       │   ├── registry.module.ts             # NEW: Registry module
│       │   ├── registry.controller.ts         # NEW: Proxy endpoints
│       │   └── registry.service.ts            # NEW: Registry fetch logic
│       ├── node/
│       │   └── node-types.controller.ts       # MODIFY: Remove static interface nodes
│       └── flow/
│           └── flow.service.ts                # MODIFY: Migration to delete old flows
│
├── nodes/
│   └── src/
│       └── nodes/
│           ├── interface/                     # DELETE: Entire folder
│           │   ├── StatCardNode.ts            # DELETE
│           │   ├── PostListNode.ts            # DELETE
│           │   └── index.ts                   # DELETE
│           └── index.ts                       # MODIFY: Remove interface exports
│
└── shared/
    └── src/
        └── types/
            └── registry.ts                    # NEW: Shared registry types
```

**Structure Decision**: Web application (monorepo). Frontend handles UI/navigation, backend provides optional proxy for registry (CORS), nodes package loses static interface nodes, shared package gets registry type definitions.

## Complexity Tracking

No violations requiring justification - feature follows existing patterns.
