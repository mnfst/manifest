# Implementation Plan: Multiple Triggers per Flow

**Branch**: `029-multiple-triggers` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-multiple-triggers/spec.md`

## Summary

Dissociate MCP tools from flows by moving tool properties (toolName, toolDescription, parameters) from the Flow entity to individual UserIntent trigger nodes. Each trigger node becomes its own MCP tool, allowing one flow to expose multiple tools with different parameters. This enables users to create flows with multiple entry points that share common logic.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas), TypeORM 0.3.20 (ORM)
**Storage**: SQLite (better-sqlite3 11.7.0)
**Testing**: POC phase - no automated tests required
**Target Platform**: Web application (desktop browsers)
**Project Type**: Monorepo with packages (backend, frontend, nodes, shared)
**Performance Goals**: POC - no specific requirements
**Constraints**: POC phase - simplified workflow
**Scale/Scope**: POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID Principles | PASS | Changes maintain single responsibility (trigger = tool definition) |
| Testing Standards | DEFERRED | POC phase - no tests required |
| UX Consistency | PASS | Warning icons follow existing patterns, tool names displayed on nodes |
| Performance Requirements | DEFERRED | POC phase |
| Documentation & Readability | PASS | Clear separation of concerns |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/029-multiple-triggers/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-changes.md   # API contract changes
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── flow/
│       │   ├── flow.entity.ts      # Remove toolName, toolDescription, parameters
│       │   ├── flow.service.ts     # Update flow creation/update logic
│       │   └── flow.controller.ts  # Update DTOs
│       ├── node/
│       │   └── node.service.ts     # Add tool name uniqueness validation
│       └── mcp/
│           └── mcp.tool.ts         # Derive tools from triggers, not flows
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── FlowDiagram.tsx       # Show warning for no-trigger flows
│       │       ├── NodeEditModal.tsx     # Add tool properties to UserIntent config
│       │       └── TriggerNode.tsx       # Display tool name on node
│       └── pages/
│           └── FlowDetail.tsx            # Show MCP tools summary
├── nodes/
│   └── src/
│       └── nodes/
│           └── UserIntentNode.ts   # Add toolName, toolDescription, parameters, isActive
└── shared/
    └── src/
        └── types/
            ├── flow.ts             # Update Flow interface (remove tool fields)
            └── node.ts             # Update UserIntentNodeParameters
```

**Structure Decision**: Monorepo web application structure. Changes span all 4 packages with backend entity changes, frontend UI updates, node definition updates, and shared type changes.

## Complexity Tracking

> No constitution violations - section not applicable.
