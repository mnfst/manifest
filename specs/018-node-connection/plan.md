# Implementation Plan: Manual Node Connection Workflow

**Branch**: `018-node-connection` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-node-connection/spec.md`

## Summary

Redesign node creation and connection workflow: nodes appear unconnected, users manually connect via drag-and-drop handles, connections can be deleted by clicking a trash icon on hover (no confirmation). Only nodes connected to user intent are executed.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: React 18.3.1, @xyflow/react 12.10.0, NestJS 10.4.15, TypeORM 0.3.20
**Storage**: SQLite (better-sqlite3), Flow.nodes and Flow.connections as JSON columns
**Testing**: Manual testing (POC phase)
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (monorepo: backend, frontend, shared)
**Performance Goals**: N/A (POC phase)
**Constraints**: N/A (POC phase)
**Scale/Scope**: Single-user POC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | Changes isolated to FlowDiagram and edge components |
| II. Testing Standards | ⏸️ DEFERRED | POC phase - manual testing acceptable |
| III. UX Consistency | ✅ PASS | Uses existing React Flow patterns, adds delete on hover |
| IV. Performance | ⏸️ DEFERRED | POC phase |
| V. Documentation | ✅ PASS | Code will be self-documenting |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/018-node-connection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       └── node/
│           ├── node.controller.ts   # Existing - connection endpoints
│           └── node.service.ts      # Existing - circular detection to add
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── FlowDiagram.tsx         # Modify - remove auto-edges
│       │       ├── DeletableEdge.tsx       # NEW - custom edge with trash icon
│       │       ├── ViewNode.tsx            # Modify - add target handles
│       │       ├── UserIntentNode.tsx      # Existing - source handle
│       │       ├── ReturnValueNode.tsx     # Existing - target handle
│       │       └── CallFlowNode.tsx        # Existing - target handle
│       └── pages/
│           └── FlowDetail.tsx              # Modify - remove auto-connection logic
└── shared/
    └── src/
        └── types/
            └── node.ts                     # Existing - types sufficient
```

**Structure Decision**: Web application structure (backend + frontend + shared). No new packages needed.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
