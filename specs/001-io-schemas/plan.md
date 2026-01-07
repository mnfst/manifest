# Implementation Plan: Node I/O Schema Validation

**Branch**: `001-io-schemas` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-io-schemas/spec.md`

## Summary

Add JSON Schema-based input/output validation for node connections in the workflow editor. Every node will declare `inputSchema` and `outputSchema` (JSON Schema), enabling design-time compatibility validation when connecting nodes. Connections will display visual feedback (green/yellow/red) indicating compatibility status, allowing users to identify incompatible flows before execution.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**:
- Backend: NestJS 10.4.15, TypeORM 0.3.20, Zod 3.24.1
- Frontend: React 18.3.1, @xyflow/react 12.10.0, TailwindCSS 3.4.17
- Shared: @chatgpt-app-builder/shared (types), @chatgpt-app-builder/nodes (node definitions)
**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM
**Testing**: N/A (POC phase - testing deferred per constitution)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Web monorepo (backend + frontend + shared packages)
**Performance Goals**: Schema validation < 100ms per connection (per constitution UX response time)
**Constraints**: Must maintain backward compatibility with existing nodes that lack schemas
**Scale/Scope**: 5 existing node types to retrofit, ~15 new API endpoints/components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Schema validator will be separate service (SRP), nodes extended not modified (OCP), interfaces for schema provider pattern (ISP/DIP) |
| II. Testing Standards | DEFERRED | POC phase - testing not required per constitution |
| III. UX Consistency | PASS | Visual feedback (green/yellow/red) follows standard conventions; error messages will be user-friendly; schema display within 100ms response time |
| IV. Performance Requirements | DEFERRED | POC phase - performance not enforced; design targets <100ms validation |
| V. Documentation & Readability | PASS | Self-documenting code with descriptive names; JSON Schema serves as living documentation |
| Auto-Serve | PASS | Will run serve-app.sh after implementation complete |

**Gate Status**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/001-io-schemas/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── node/
│       │   ├── node.service.ts           # Extend with schema validation
│       │   ├── node.controller.ts        # Extend with schema endpoints
│       │   └── schema/                   # NEW: Schema validation module
│       │       ├── schema.service.ts     # Schema compatibility logic
│       │       ├── schema.controller.ts  # Schema API endpoints
│       │       └── schema.types.ts       # Schema types
│       └── flow/
│           └── flow.service.ts           # Extend with flow-level validation
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── flow/
│       │   │   ├── FlowCanvas.tsx        # Extend connection validation
│       │   │   ├── CustomEdge.tsx        # NEW: Colored edge component
│       │   │   └── ConnectionValidator.tsx # NEW: Validation feedback
│       │   └── node/
│       │       ├── NodeSchemaPanel.tsx   # NEW: Schema display panel
│       │       └── SchemaViewer.tsx      # NEW: JSON Schema renderer
│       ├── hooks/
│       │   └── useSchemaValidation.ts    # NEW: Schema validation hook
│       └── lib/
│           └── schemaUtils.ts            # NEW: Schema utility functions
│
├── nodes/
│   └── src/
│       ├── types.ts                      # Extend NodeTypeDefinition with schemas
│       └── nodes/
│           ├── InterfaceNode.ts          # Add inputSchema, outputSchema
│           ├── ReturnNode.ts             # Add inputSchema (no output)
│           ├── CallFlowNode.ts           # Add schemas
│           ├── UserIntentNode.ts         # Add outputSchema (dynamic)
│           └── ApiCallNode.ts            # Add schemas (dynamic output)
│
└── shared/
    └── src/
        └── types/
            ├── schema.ts                 # NEW: JSON Schema types
            └── node.ts                   # Extend with schema types
```

**Structure Decision**: Web application structure maintained. New schema module added to backend under node/ for cohesion. Frontend components added under flow/ and new node/ directory for schema display.

## Complexity Tracking

No violations to justify - design follows SOLID principles and POC constraints.
