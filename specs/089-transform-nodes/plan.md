# Implementation Plan: Transform Node Category

**Branch**: `089-transform-nodes` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/089-transform-nodes/spec.md`

## Summary

Implement a Transform node category containing specialized transformer nodes that convert data formats between incompatible nodes. The first transformer is "JavaScript Code" which allows users to write custom transformation logic via a CodeMirror editor. Transformer nodes feature a distinctive diamond shape (45-degree rotated square), UNO reverse-style icon, dedicated color scheme, and require input connections. The system auto-suggests transformers when incompatible connections are detected.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**:
- Frontend: React 18.3.1, @xyflow/react 12.10.0, Vite, Tailwind CSS, lucide-react
- Backend: NestJS 10.4.15, TypeORM 0.3.20
- Shared: pnpm workspaces monorepo

**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM - nodes stored as JSON arrays in Flow entity
**Testing**: Deferred per POC constitution
**Target Platform**: Web application (desktop browsers)
**Project Type**: Web (monorepo with frontend/backend/shared/nodes packages)
**Performance Goals**: POC - deferred per constitution (UI feedback within 100ms per UX consistency principle)
**Constraints**: POC phase - simplified workflow, no automated tests required
**Scale/Scope**: Single Transform category with JavaScript Code transformer as first implementation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Transformer nodes follow existing node pattern (single responsibility), extend via new node types (open/closed) |
| II. Testing Standards | DEFERRED | POC phase - testing standards deferred |
| III. UX Consistency | REQUIRES ATTENTION | Must reuse existing modal patterns, error message formats, and maintain 100ms feedback for UI interactions |
| IV. Performance | DEFERRED | POC phase - performance requirements deferred |
| V. Documentation & Readability | PASS | Code must be self-documenting with descriptive names; architecture documented in spec |

**Pre-Design Gate Status**: PASS - No constitution violations requiring justification

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Design extends existing patterns: NodeTypeDefinition (single responsibility), new node type without modifying existing (open/closed), consistent interface (Liskov/ISP), dependency on abstractions (DI) |
| II. Testing Standards | DEFERRED | POC phase |
| III. UX Consistency | PASS | Design reuses: existing modal pattern (NodeEditModal), existing node library, existing execution tracking, existing color scheme pattern |
| IV. Performance | DEFERRED | POC phase |
| V. Documentation & Readability | PASS | Contracts documented in OpenAPI, TypeScript interfaces, and quickstart guide |

**Post-Design Gate Status**: PASS - All design artifacts align with constitution principles

## Project Structure

### Documentation (this feature)

```text
specs/089-transform-nodes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
├── checklists/          # Quality checklists
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── FlowDiagram.tsx          # Register transformer node types
│       │       ├── TransformNode.tsx        # NEW: Diamond-shaped node component
│       │       ├── NodeEditModal.tsx        # Extend with JavaScript editor
│       │       └── CompatibilityDetailModal.tsx  # Add "Add transformer" button
│       └── hooks/
│           └── useSchemaValidation.ts       # Existing - may extend
│
├── backend/
│   └── src/
│       └── node/
│           ├── node.service.ts              # Extend for transformer validation
│           └── schema/
│               └── schema.service.ts        # Extend for compatibility suggestions
│
├── shared/
│   └── src/
│       └── types/
│           ├── node.ts                      # Add Transform types
│           └── schema.ts                    # May extend for suggestion types
│
└── nodes/
    └── src/
        └── nodes/
            ├── index.ts                     # Export new transformer nodes
            └── JavaScriptCodeTransform.ts   # NEW: Transformer implementation
```

**Structure Decision**: Web application pattern with existing monorepo structure. Transform nodes integrate into existing packages rather than creating new package structure.

## Complexity Tracking

No constitution violations requiring justification.
