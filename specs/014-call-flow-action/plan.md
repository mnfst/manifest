# Implementation Plan: Call Flow End Action

**Branch**: `014-call-flow-action` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-call-flow-action/spec.md`

## Summary

Add a "Call Flow" end action that enables users to trigger other flows from the same app at flow completion. Mirrors the existing ReturnValue pattern but invokes `window.openai.callTool(toolName)` to chain flows. End action nodes render without right-side handlers to visually indicate they are terminal points.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**: NestJS 10.4.15, React 18.3.1, Vite 6.0.5, TypeORM 0.3.20, @xyflow/react 12.10.0, Tailwind CSS 3.4.17, lucide-react 0.562.0
**Storage**: SQLite (better-sqlite3 11.7.0), TypeORM with auto-sync (POC mode)
**Testing**: Deferred (POC phase per constitution)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Monorepo with 3 packages (backend, frontend, shared)
**Performance Goals**: Deferred (POC phase per constitution)
**Constraints**: None enforced (POC phase)
**Scale/Scope**: Single-user POC, development environment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Follows existing patterns: separate entity, service, controller, node component |
| II. Testing Standards | DEFERRED | POC phase - testing not required |
| III. UX Consistency | PASS | Mirrors ReturnValue node pattern; uses existing color/icon conventions |
| IV. Performance | DEFERRED | POC phase - no performance requirements |
| V. Documentation | PASS | Self-documenting code; spec provides context |
| Auto-Serve | APPLICABLE | Must run serve script after implementation complete |

**Gate Status**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/014-call-flow-action/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── call-flow-api.yaml
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── app/
│       │   └── app.module.ts              # Register CallFlowModule
│       ├── call-flow/                     # NEW MODULE
│       │   ├── call-flow.entity.ts        # TypeORM entity
│       │   ├── call-flow.service.ts       # Business logic + validation
│       │   ├── call-flow.controller.ts    # REST endpoints
│       │   └── call-flow.module.ts        # NestJS module
│       ├── flow/
│       │   └── flow.entity.ts             # Add callFlows relation
│       └── mcp/
│           └── mcp.tool.ts                # Add callTool execution logic
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── FlowDiagram.tsx        # Register callFlowNode type
│       │       ├── CallFlowNode.tsx       # NEW: End action node component
│       │       ├── CallFlowEditor.tsx     # NEW: Modal for target selection
│       │       └── ReturnValueNode.tsx    # MODIFY: Remove right handler
│       ├── pages/
│       │   └── FlowDetail.tsx             # Add CallFlow CRUD handling
│       └── lib/
│           └── api.ts                     # Add CallFlow API methods
└── shared/
    └── src/
        └── types/
            ├── call-flow.ts               # NEW: CallFlow interfaces
            ├── flow.ts                    # Add callFlows to Flow interface
            └── index.ts                   # Export new types
```

**Structure Decision**: Follows existing monorepo structure with parallel module pattern matching ReturnValue implementation.

## Complexity Tracking

> No violations to justify - design follows existing patterns.
