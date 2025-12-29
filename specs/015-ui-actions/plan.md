# Implementation Plan: UI Component Actions

**Branch**: `015-ui-actions` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-ui-actions/spec.md`

## Summary

Enable UI component actions in the flow diagram by displaying action handles on view nodes (e.g., "onReadMore" for post-list components) and allowing users to connect these actions to return values or call flows via drag-and-drop. When the MCP tool executes, clicking an action in the widget triggers its connected target.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**:
- Backend: NestJS 10.4.15, TypeORM 0.3.20, LangChain 0.3.26
- Frontend: React 18.3.1, Vite 6.0.5, @xyflow/react 12.10.0, Tailwind CSS 3.4.17, lucide-react 0.562.0
**Storage**: SQLite via better-sqlite3 11.7.0, TypeORM with auto-sync (POC mode)
**Testing**: Not configured (POC - deferred per constitution)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Monorepo with 3 packages (backend, frontend, shared)
**Performance Goals**: Deferred for POC per constitution
**Constraints**: Backward compatibility with existing flows (SC-006)
**Scale/Scope**: Single-user POC, existing flow diagram extension

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | Feature extends existing patterns (ViewNode, ReturnValue, CallFlow) |
| II. Testing Standards | DEFERRED | POC phase - no testing required |
| III. User Experience Consistency | PASS | Reuses existing drag-and-drop patterns from @xyflow/react; action handles follow existing node styling |
| IV. Performance Requirements | DEFERRED | POC phase - no performance targets |
| V. Documentation & Readability | PASS | Self-documenting action names from component config |

**Gate Result**: PASS - Proceed to Phase 0

### Post-Phase 1 Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | ActionConnectionEntity follows CallFlowEntity pattern; single responsibility maintained |
| II. Testing Standards | DEFERRED | POC phase - no testing required |
| III. User Experience Consistency | PASS | Action handles use consistent purple color scheme; drag-and-drop matches existing patterns |
| IV. Performance Requirements | DEFERRED | POC phase - no performance targets |
| V. Documentation & Readability | PASS | OpenAPI contract documented; data model documented; quickstart guide created |

**Gate Result**: PASS - Ready for `/speckit.tasks`

## Project Structure

### Documentation (this feature)

```text
specs/015-ui-actions/
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
│       ├── app/
│       │   └── app.module.ts         # TypeORM entities registration
│       ├── flow/
│       │   ├── flow.entity.ts        # Flow entity (parent of views)
│       │   └── flow.service.ts       # Flow operations
│       ├── view/
│       │   ├── view.entity.ts        # View entity (extend with actions)
│       │   └── view.service.ts       # View operations
│       ├── return-value/
│       │   ├── return-value.entity.ts
│       │   └── return-value.service.ts
│       ├── call-flow/
│       │   ├── call-flow.entity.ts
│       │   └── call-flow.service.ts
│       ├── action-connection/        # NEW: Action connection module
│       │   ├── action-connection.entity.ts
│       │   ├── action-connection.controller.ts
│       │   └── action-connection.service.ts
│       └── mcp-tool/
│           └── mcp-tool.service.ts   # MCP tool execution (modify for action triggers)
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow-diagram/
│       │       ├── FlowDiagram.tsx   # Main flow diagram (modify for action edges)
│       │       ├── ViewNode.tsx      # View node (add action handles)
│       │       └── nodes/            # Node type definitions
│       ├── services/
│       │   └── api.ts                # API service (add action connection endpoints)
│       └── pages/
│           └── flows/                # Flow pages
└── shared/
    └── src/
        └── types/
            ├── view.ts               # View types (extend with actions)
            ├── layout-registry.ts    # Layout templates with action definitions
            └── action-connection.ts  # NEW: Action connection types
```

**Structure Decision**: Web application structure (Option 2). Feature adds new action-connection module to backend and extends existing flow diagram components in frontend. Shared package extended with action connection types.

## Complexity Tracking

No violations to justify - feature follows existing patterns.
