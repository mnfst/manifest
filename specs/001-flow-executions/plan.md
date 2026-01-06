# Implementation Plan: Flow Execution Tracking

**Branch**: `001-flow-executions` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-flow-executions/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add flow execution tracking to capture all MCP tool invocations. When a flow is executed via MCP server, create a `FlowExecution` record storing initial parameters, node-by-node data accumulation, status (pending/fulfilled/error), and timestamps. Expose execution history in a new "Usage" tab within the flow detail view using a two-column Gmail-style layout.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 with Vite 6.0.5 (frontend), TypeORM 0.3.20, @xyflow/react 12.10.0
**Storage**: better-sqlite3 (SQLite) with TypeORM
**Testing**: Deferred (POC phase per constitution)
**Target Platform**: Web application (Node.js backend, browser frontend)
**Project Type**: Web (monorepo with backend, frontend, shared, nodes packages)
**Performance Goals**: Execution history retrieval within 2 seconds, detail load within 1 second, tracking adds <10% overhead (per spec)
**Constraints**: Execution records retained indefinitely, support concurrent executions
**Scale/Scope**: Moderate volume (thousands of executions per day)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gates (POC Phase)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | Feature adds new module (FlowExecution) with single responsibility; extends existing Flow entity without modification |
| II. Testing Standards | ⏸️ DEFERRED | Per POC scope - manual testing acceptable |
| III. UX Consistency | ✅ PASS | Using existing patterns: Tabs component, two-column layout, status indicators |
| IV. Performance Requirements | ⏸️ DEFERRED | Per POC scope - targets are goals, not requirements |
| V. Documentation & Readability | ✅ PASS | Self-documenting code with clear entity/service structure |

### POC Scope Allowances Applied
- No automated testing required
- Performance optimization deferred
- Simplified workflow (manual testing)

### Post-Design Re-evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | Single Responsibility: FlowExecution module handles only execution tracking. Open/Closed: MCP service extended via injection, not modification. Dependency Inversion: Service injected into controller/MCP service. |
| II. Testing Standards | ⏸️ DEFERRED | Manual testing checklist provided in quickstart.md |
| III. UX Consistency | ✅ PASS | Two-column layout matches existing patterns. Status badges use standard colored circles. Pagination uses existing page number pattern. Tooltips on hover as specified. |
| IV. Performance Requirements | ⏸️ DEFERRED | Index on (flowId, startedAt) added for query performance. JSON columns for node data avoid complex joins. |
| V. Documentation & Readability | ✅ PASS | Clear type definitions in data-model.md. API contracts in OpenAPI format. Quickstart guide for implementation reference. |

**Design Decisions Summary**:
1. **Data Model**: Single entity with JSON columns for flexibility (nodeExecutions, initialParams)
2. **API Design**: RESTful endpoints following existing pattern (/api/flows/:flowId/executions)
3. **UI Pattern**: Gmail-style two-column layout with left list, right detail panel
4. **Real-time**: Polling-based updates (P3 scope), WebSockets deferred
5. **Retention**: SET NULL on flow deletion, denormalized flow name preserved

## Project Structure

### Documentation (this feature)

```text
specs/001-flow-executions/
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
│       ├── flow-execution/          # NEW: FlowExecution module
│       │   ├── flow-execution.entity.ts
│       │   ├── flow-execution.service.ts
│       │   ├── flow-execution.controller.ts
│       │   └── flow-execution.module.ts
│       ├── flow/                    # MODIFY: Flow module
│       │   └── flow.entity.ts       # Add OneToMany relation to FlowExecution
│       └── mcp/                     # MODIFY: MCP module
│           └── mcp.tool.ts          # Integrate execution tracking
├── frontend/
│   └── src/
│       ├── pages/
│       │   └── FlowDetail.tsx       # MODIFY: Add Usage tab content
│       ├── components/
│       │   └── execution/           # NEW: Execution UI components
│       │       ├── ExecutionList.tsx
│       │       ├── ExecutionListItem.tsx
│       │       ├── ExecutionDetail.tsx
│       │       ├── ExecutionStatusBadge.tsx
│       │       └── ExecutionDataViewer.tsx
│       ├── lib/
│       │   └── api.ts               # MODIFY: Add execution API methods
│       └── types/
│           └── execution.ts         # NEW: Execution type definitions
└── shared/
    └── src/
        └── types/
            └── execution.ts         # NEW: Shared execution types
```

**Structure Decision**: Web application structure (Option 2). Following existing monorepo conventions with packages for backend, frontend, shared. New FlowExecution module follows existing entity-service-controller pattern in backend. Frontend components follow existing component organization under components/execution/.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. All gates passed or deferred per POC scope.*
