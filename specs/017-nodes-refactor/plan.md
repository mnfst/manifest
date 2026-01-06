# Implementation Plan: Nodes Package Refactor

**Branch**: `017-nodes-refactor` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-nodes-refactor/spec.md`

## Summary

Refactor the node entity architecture from 5 separate database tables (views, return_values, call_flows, action_connections, mock_data) into two JSON columns (`nodes` and `connections`) within the Flow entity. Create a new `nodes` package in the monorepo containing node type definitions (Interface, Return, CallFlow) with standardized properties and execute() functions. This n8n-inspired architecture simplifies data management, enables node position persistence, and improves extensibility for future node types.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), Vite 6.0.5, Tailwind CSS 3.4.17
**Storage**: SQLite via better-sqlite3 11.7.0, TypeORM 0.3.20 with auto-sync (POC mode)
**Testing**: Deferred (POC phase per constitution)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Monorepo with 3 packages (backend, frontend, shared) + new nodes package
**Performance Goals**: N/A (POC phase)
**Constraints**: N/A (POC phase)
**Scale/Scope**: POC - single user, local development

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | Node type definitions follow SRP (each node = one purpose), OCP (new nodes via extension), DIP (nodes package abstracts from core) |
| II. Testing Standards | ✅ DEFERRED | POC phase - testing not required per constitution |
| III. UX Consistency | ✅ PASS | Canvas interactions remain consistent with existing React Flow patterns |
| IV. Performance | ✅ DEFERRED | POC phase - performance targets not enforced |
| V. Documentation | ✅ PASS | Node type definitions self-document via displayName, description, icon properties |
| POC Workflow | ✅ PASS | Simplified workflow applies - focus on functionality |

**Gate Result**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/017-nodes-refactor/
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
├── backend/
│   └── src/
│       ├── flow/
│       │   ├── flow.entity.ts      # Modified: add nodes, connections columns
│       │   ├── flow.service.ts     # Modified: handle JSON node operations
│       │   └── flow.controller.ts  # Modified: new endpoints for nodes/connections
│       ├── node/                   # New: replaces view, return-value, call-flow modules
│       │   ├── node.module.ts
│       │   ├── node.service.ts     # CRUD for nodes within flows
│       │   └── node.controller.ts
│       ├── view/                   # REMOVED: migrated to nodes
│       ├── return-value/           # REMOVED: migrated to nodes
│       ├── call-flow/              # REMOVED: migrated to nodes
│       ├── action-connection/      # REMOVED: migrated to connections
│       └── mock-data/              # REMOVED: embedded in Interface node parameters
│
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── nodes/          # React Flow node components
│       │       │   ├── InterfaceNode.tsx
│       │       │   ├── ReturnNode.tsx
│       │       │   └── CallFlowNode.tsx
│       │       └── FlowCanvas.tsx  # Modified: use JSON nodes/connections
│       └── services/
│           └── flow.service.ts     # Modified: node/connection operations
│
├── shared/
│   └── src/
│       └── types/
│           ├── node.ts             # New: NodeInstance, Connection, NodeType interfaces
│           ├── view.ts             # REMOVED
│           ├── return-value.ts     # REMOVED
│           ├── call-flow.ts        # REMOVED
│           └── action-connection.ts # REMOVED
│
└── nodes/                          # NEW PACKAGE
    ├── package.json
    ├── src/
    │   ├── index.ts                # Exports node registry
    │   ├── types.ts                # NodeTypeDefinition interface
    │   ├── registry.ts             # Node type registry
    │   └── definitions/
    │       ├── interface.node.ts   # Interface node definition
    │       ├── return.node.ts      # Return node definition
    │       └── call-flow.node.ts   # CallFlow node definition
    └── tsconfig.json
```

**Structure Decision**: Web application with 4 packages (adding `nodes` package to existing monorepo). The new `nodes` package follows n8n's separation pattern, keeping node definitions decoupled from the core backend/frontend.

## Complexity Tracking

> No violations requiring justification - structure follows existing patterns.

| Aspect | Justification |
|--------|---------------|
| 4th package (nodes) | Required by FR-005: node definitions must be in separate package for extensibility |
| JSON columns vs entities | Simplifies architecture per spec - reduces 5 tables to 2 columns |
