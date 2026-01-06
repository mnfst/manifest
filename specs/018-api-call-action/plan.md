# Implementation Plan: API Call Action Node

**Branch**: `018-api-call-action` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-api-call-action/spec.md`

## Summary

Add a new "API Call" action node to the workflow editor that allows users to make HTTP requests to external APIs. The node will be configurable with URL, HTTP method (GET/POST/PUT/DELETE/PATCH), and headers. It accepts dynamic inputs from upstream nodes via an input mapping interface and outputs the API response (status, headers, body) through a single output handle for downstream consumption.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (ES2022 target)
**Primary Dependencies**:
- Backend: NestJS 10.4.15, TypeORM 0.3.20
- Frontend: React 18.3.1, Vite 6.0.5, XYFlow React 12.10.0, Tailwind CSS 3.4.17
- Shared: TypeScript type definitions
- Nodes: Custom node type definition package (ESM)
**Storage**: SQLite (better-sqlite3) via TypeORM - nodes stored as JSON in Flow entity
**Testing**: Not configured (POC phase - manual testing per constitution)
**Target Platform**: Web browser (frontend) + Node.js 18+ (backend)
**Project Type**: pnpm monorepo with Turbo orchestration (packages/backend, frontend, nodes, shared)
**Performance Goals**: Deferred for POC (constitution)
**Constraints**: POC phase - no authentication/security requirements
**Scale/Scope**: Single-user POC workflow builder

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | New node follows existing patterns (Single Responsibility: ApiCallNode handles only API calls; Open/Closed: extends node registry without modifying existing nodes) |
| II. Testing Standards | ⏸️ DEFERRED | POC phase - manual testing acceptable per constitution |
| III. User Experience Consistency | ✅ PASS | Node UI follows existing patterns (AddStepModal, NodeEditModal, ViewNode); error messages will be user-friendly and actionable |
| IV. Performance Requirements | ⏸️ DEFERRED | POC phase - no performance targets enforced |
| V. Documentation & Readability | ✅ PASS | Code will follow existing naming conventions and include JSDoc for public functions |

**Gate Result**: ✅ PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/018-api-call-action/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── node/
│       │   ├── node.controller.ts    # REST API for node operations
│       │   └── node.service.ts       # Node CRUD and connection validation
│       └── flow/
│           └── flow.service.ts       # Flow execution (will execute ApiCallNode)
├── frontend/
│   └── src/
│       └── components/
│           └── flow/
│               ├── AddStepModal.tsx      # Node picker modal (add ApiCall option)
│               ├── NodeEditModal.tsx     # Node configuration (add ApiCall config)
│               └── ViewNode.tsx          # Node visualization (add ApiCall rendering)
├── nodes/
│   └── src/
│       ├── nodes/
│       │   ├── index.ts              # Node registry (export ApiCallNode)
│       │   ├── InterfaceNode.ts      # Reference pattern
│       │   ├── ReturnNode.ts         # Reference pattern
│       │   ├── CallFlowNode.ts       # Reference pattern (async execution)
│       │   └── ApiCallNode.ts        # NEW: API Call node implementation
│       └── types.ts                  # NodeTypeDefinition interface
└── shared/
    └── src/
        └── types/
            └── node.ts               # NodeType enum (add 'ApiCall')
```

**Structure Decision**: Monorepo with four packages. The ApiCallNode follows the existing node pattern established by InterfaceNode, ReturnNode, and CallFlowNode. Implementation spans:
- `packages/nodes` - Node type definition and execution logic
- `packages/shared` - Type updates
- `packages/frontend` - UI components for adding/configuring/displaying the node
- `packages/backend` - No changes needed (existing flow execution handles new node types)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - feature follows existing patterns without added complexity.
