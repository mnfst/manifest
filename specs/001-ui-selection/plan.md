# Implementation Plan: UI Selection Architecture Refactor

**Branch**: `001-ui-selection` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ui-selection/spec.md`

## Summary

Refactor the nodes package folder structure to organize nodes by category, remove existing table/post-list UI components, and introduce a new Stat Card UI component based on Manifest UI. The Stat Card will be read-only initially, displaying statistical metrics with trend indicators, and will appear in the node library like any other node.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: NestJS 10.x (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), pnpm 9.15.4 (monorepo)
**Storage**: SQLite via better-sqlite3 (existing)
**Testing**: Manual testing (POC phase - deferred per constitution)
**Target Platform**: Web (desktop browsers)
**Project Type**: Monorepo (packages/backend, packages/frontend, packages/nodes, packages/shared)
**Performance Goals**: Deferred (POC phase)
**Constraints**: Maintain backward compatibility with existing flows; no breaking changes to node registry interface
**Scale/Scope**: Single new UI component, 5 existing nodes reorganized into 4 category folders

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID: Single Responsibility | PASS | Each node file has one purpose; Stat Card is a distinct component |
| SOLID: Open/Closed | PASS | Adding new UI via extension, not modifying existing node behavior |
| SOLID: Liskov Substitution | PASS | NodeTypeDefinition interface maintained |
| SOLID: Interface Segregation | PASS | Stat Card uses same NodeTypeDefinition interface |
| SOLID: Dependency Inversion | PASS | Nodes depend on abstractions (NodeTypeDefinition) |
| Testing (DEFERRED) | N/A | POC phase - manual testing acceptable |
| UX Consistency | PASS | Stat Card follows existing node library patterns |
| Performance (DEFERRED) | N/A | POC phase |
| Documentation | PASS | Specification provides design documentation |

**Pre-Design Gate**: PASSED - No violations requiring justification.

**Post-Design Re-evaluation** (after Phase 1):

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID: Single Responsibility | PASS | StatCardNode handles one thing: displaying stats |
| SOLID: Open/Closed | PASS | New node added without modifying existing nodes |
| SOLID: Liskov Substitution | PASS | StatCardNode substitutes for any NodeTypeDefinition |
| SOLID: Interface Segregation | PASS | Uses only needed parts of NodeTypeDefinition |
| SOLID: Dependency Inversion | PASS | Depends on JSONSchema abstraction for validation |
| UX Consistency | PASS | Follows existing node library patterns; consistent styling |
| Documentation | PASS | research.md, data-model.md, contracts/ all created |

**Post-Design Gate**: PASSED - Design artifacts complete and constitution-compliant.

## Project Structure

### Documentation (this feature)

```text
specs/001-ui-selection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── nodes/src/
│   ├── types.ts                 # NodeTypeDefinition (unchanged)
│   ├── index.ts                 # Main exports
│   └── nodes/
│       ├── index.ts             # Registry exports (refactored)
│       ├── trigger/
│       │   └── UserIntentNode.ts
│       ├── action/
│       │   └── ApiCallNode.ts
│       ├── interface/
│       │   ├── InterfaceNode.ts
│       │   └── StatCardNode.ts  # NEW
│       └── return/
│           ├── ReturnNode.ts
│           └── CallFlowNode.ts
│
├── shared/src/types/
│   └── app.ts                   # LayoutTemplate, LAYOUT_REGISTRY (modified)
│
├── backend/src/
│   ├── mcp/templates/
│   │   ├── stats.html           # NEW: Stat Card HTML template
│   │   ├── table.html           # TO BE REMOVED
│   │   └── post-list.html       # TO BE REMOVED
│   └── agent/tools/
│       └── layout-selector.ts   # (modified for stat-card)
│
└── frontend/src/components/
    ├── flow/
    │   └── ViewNode.tsx         # (may need updates for stat-card)
    └── editor/
        └── LayoutRenderer.tsx   # (may need updates for stat-card)
```

**Structure Decision**: Monorepo structure with 4 packages. Nodes organized by category subfolder matching their `NodeTypeCategory` value.

## Complexity Tracking

No violations requiring justification.
