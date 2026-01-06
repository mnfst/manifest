# Implementation Plan: Trigger Node Refactor

**Branch**: `001-trigger-node-refactor` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-trigger-node-refactor/spec.md`

## Summary

Refactor the user intent from a flow-level property into a proper trigger node type (UserIntentNode), introducing node type categories (Trigger, Interface, Action, Return), renaming existing nodes (InterfaceNode → AgenticInterfaceNode, ReturnNode → ReturnValueNode), and updating the add-step modal to display nodes grouped by category. This enables multiple triggers per flow and creates a cleaner architectural separation of node types.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), TypeORM 0.3.20 (ORM)
**Storage**: SQLite via better-sqlite3 (TypeORM with synchronize: true for POC)
**Testing**: No automated testing configured (POC phase)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Web (monorepo with packages/backend, packages/frontend, packages/nodes, packages/shared)
**Performance Goals**: N/A (POC phase - deferred)
**Constraints**: N/A (POC phase - deferred)
**Scale/Scope**: Single-user POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | New node category system follows Open/Closed principle - extending node types without modifying existing logic |
| II. Testing Standards | DEFERRED | POC phase - no automated tests required |
| III. UX Consistency | PASS | Reusing existing modal patterns, node rendering components, consistent UI |
| IV. Performance Requirements | DEFERRED | POC phase |
| V. Documentation & Readability | PASS | Clear naming conventions, self-documenting code expected |
| Auto-Serve for Testing | PASS | Will run serve-app.sh after implementation |

**Gate Status**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-trigger-node-refactor/
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
│       ├── flow/
│       │   ├── flow.entity.ts       # Remove whenToUse, whenNotToUse
│       │   ├── flow.service.ts      # Update flow operations
│       │   └── flow.controller.ts
│       ├── node/
│       │   ├── node.entity.ts       # Add node type category support
│       │   ├── node.service.ts      # Handle trigger node constraints
│       │   └── node.controller.ts
│       └── migrations/              # Data migration for existing flows
│
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── AddStepModal.tsx      # Grouped node selection
│       │       ├── UserIntentNode.tsx    # New trigger node component
│       │       ├── FlowDiagram.tsx       # Updated node type mappings
│       │       └── NodeEditModal.tsx     # Support UserIntentNode editing
│       └── services/
│           └── api.ts                    # Updated API calls
│
├── nodes/
│   └── src/
│       ├── types.ts                      # Add NodeTypeCategory
│       └── nodes/
│           ├── index.ts                  # Export updated node registry
│           ├── UserIntentNode.ts         # New trigger node definition
│           ├── AgenticInterfaceNode.ts   # Renamed from InterfaceNode
│           └── ReturnValueNode.ts        # Renamed from ReturnNode
│
└── shared/
    └── src/
        └── types/
            ├── node.ts                   # Updated NodeType union, add category
            └── flow.ts                   # Remove whenToUse, whenNotToUse
```

**Structure Decision**: Web application structure with existing monorepo layout. Changes span all four packages (backend, frontend, nodes, shared) as this is a cross-cutting refactor affecting types, entities, UI, and node definitions.

## Complexity Tracking

> No violations requiring justification. All changes follow existing patterns.
