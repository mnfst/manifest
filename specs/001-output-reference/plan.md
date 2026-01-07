# Implementation Plan: Output Reference & Trigger Node UX Improvements

**Branch**: `001-output-reference` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-output-reference/spec.md`

## Summary

Add human-readable slug-based node references with a "Use Previous Outputs" component for easy output path selection. Improve trigger node UX by displaying static vs dynamic schema fields and replacing the MCP exposure checkbox with an "Active" toggle switch.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**:
- Backend: NestJS 10.4.15, TypeORM 0.3.20
- Frontend: React 18.3.1, @xyflow/react 12.10.0, TailwindCSS 3.4.17
- Shared: @chatgpt-app-builder/shared (types), @chatgpt-app-builder/nodes (node definitions)
**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM
**Testing**: N/A (POC phase - testing deferred per constitution)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Web monorepo (backend + frontend + shared packages)
**Performance Goals**: Schema lookup and reference resolution < 100ms (per constitution UX response time)
**Constraints**: Must maintain backward compatibility with existing flows using UUID references
**Scale/Scope**: ~5 existing node types to extend, ~8 new/modified components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | UsePreviousOutputs is single-purpose component (SRP), slug utilities separate from node logic (SRP), extends existing components (OCP) |
| II. Testing Standards | DEFERRED | POC phase - testing not required per constitution |
| III. UX Consistency | PASS | Reuses existing modal patterns; Active toggle follows standard switch UI; Copy button follows clipboard conventions |
| IV. Performance Requirements | DEFERRED | POC phase - performance not enforced; client-side operations are fast |
| V. Documentation & Readability | PASS | Slugs are self-documenting; reference syntax is human-readable |
| Auto-Serve | PASS | Will run serve-app.sh after implementation complete |

**Gate Status**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/001-output-reference/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-changes.md   # API modifications
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── node/
│       │   ├── node.service.ts           # Extend: generate slug on create/rename
│       │   └── node.controller.ts        # No changes needed
│       ├── mcp/
│       │   └── mcp.tool.ts               # Extend: slug-based reference resolution
│       └── utils/
│           └── slug.ts                   # NEW: Slug generation utilities
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── common/
│       │   │   └── UsePreviousOutputs.tsx    # NEW: Output reference builder
│       │   ├── flow/
│       │   │   └── NodeEditModal.tsx         # Extend: add UsePreviousOutputs, Active toggle
│       │   └── node/
│       │       └── NodeSchemaPanel.tsx       # Extend: static/dynamic badges
│       ├── hooks/
│       │   └── useUpstreamNodes.ts           # NEW: Compute upstream nodes with schemas
│       └── lib/
│           └── schemaUtils.ts                # Extend: flattenSchemaProperties()
│
├── nodes/
│   └── src/
│       └── nodes/
│           ├── UserIntentNode.ts         # Extend: add x-field-source to schema
│           ├── ApiCallNode.ts            # Extend: add x-field-source to schema
│           ├── InterfaceNode.ts          # Extend: add x-field-source to schema
│           ├── CallFlowNode.ts           # Extend: add x-field-source to schema
│           └── ReturnNode.ts             # Extend: add x-field-source to schema
│
└── shared/
    └── src/
        ├── types/
        │   ├── node.ts                   # Extend: add slug field to NodeInstance
        │   └── schema.ts                 # Extend: add FlattenedSchemaField type
        └── utils/
            └── slug.ts                   # NEW: Shared slug utilities
```

**Structure Decision**: Web application structure maintained. New components follow existing patterns (common/ for shared components, hooks/ for custom hooks). Slug utilities shared between backend and frontend via shared package.

## Complexity Tracking

No violations to justify - design follows SOLID principles and POC constraints.

## Key Design Decisions

### 1. Slug vs UUID References
- **Decision**: Add `slug` field to NodeInstance, use slugs in template syntax
- **Rationale**: Human-readable references improve UX per spec requirements
- **Trade-off**: Slug changes require reference migration

### 2. Client-Side Upstream Discovery
- **Decision**: Compute upstream nodes in frontend, not via API
- **Rationale**: All data already available; real-time updates; simpler implementation
- **Trade-off**: Logic duplicated if needed elsewhere

### 3. Schema Metadata Extension
- **Decision**: Use `x-field-source` JSON Schema extension
- **Rationale**: Standard extension pattern; no schema validator changes needed
- **Trade-off**: Non-standard property (acceptable for internal use)

### 4. Backward Compatibility
- **Decision**: Dual-resolve slugs and UUIDs during transition
- **Rationale**: Existing flows continue working; gradual migration
- **Trade-off**: Slightly more complex resolution logic

## Implementation Order

1. **Shared types and utilities** (slug generation, NodeInstance changes)
2. **Backend changes** (node service slug generation, execution resolution)
3. **Node schema metadata** (x-field-source on all node types)
4. **Frontend utilities** (flattenSchemaProperties, useUpstreamNodes)
5. **Frontend components** (UsePreviousOutputs, schema panel updates, toggle)
6. **Integration** (wire components into NodeEditModal)

## Dependencies

- Builds on existing 001-io-schemas feature (schema types, validation)
- Uses existing node/connection data structures
- Leverages existing toast/clipboard utilities from frontend
