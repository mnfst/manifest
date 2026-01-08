# Implementation Plan: UI Node Actions

**Branch**: `090-ui-node-actions` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/090-ui-node-actions/spec.md`

## Summary

Add support for interactive actions on UI nodes, starting with the Post List component. Actions enable conditional execution paths where clicking a UI element (e.g., "Read More" on a post) triggers downstream nodes with the action's data (e.g., the Post object). The existing node canvas renders action handlers as labeled connection points on the right side of nodes, and the node library displays action count or "read only" status.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: React 18.3.1, NestJS 10.4.15, @xyflow/react 12.10.0, TypeORM 0.3.20
**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM - nodes stored as JSON arrays in Flow entity
**Testing**: Deferred (POC phase per constitution)
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Deferred (POC phase)
**Constraints**: None beyond POC scope
**Scale/Scope**: Single-tenant POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. SOLID Principles** | PASS | New PostListNode follows Single Responsibility; extends existing patterns |
| **II. Testing Standards** | DEFERRED | POC phase - no automated tests required |
| **III. UX Consistency** | PASS | Reuses existing UI patterns (handles, node library); action labels provide immediate feedback |
| **IV. Performance** | DEFERRED | POC phase - no performance targets |
| **V. Documentation** | PASS | Code will be self-documenting with clear naming |
| **Auto-Serve for Testing** | APPLICABLE | Must run serve-app.sh after implementation |

**No violations requiring justification.**

## Project Structure

### Documentation (this feature)

```text
specs/090-ui-node-actions/
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
│       ├── mcp/
│       │   └── mcp.tool.ts                    # Execution engine (update for action handles)
│       └── node/
│           └── node.service.ts                # Node types API (unchanged)
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── ViewNode.tsx               # UI node component (already has action handle support)
│       │       └── NodeLibrary/
│       │           └── NodeItem.tsx           # Library item (add action count display)
│       └── lib/
│           └── api.ts                         # API client (types may need update)
├── nodes/
│   └── src/
│       └── nodes/
│           └── interface/
│               ├── index.ts                   # Export PostListNode
│               ├── StatCardNode.ts            # Existing read-only UI node
│               └── PostListNode.ts            # NEW: Post List node with onReadMore action
└── shared/
    └── src/
        └── types/
            ├── app.ts                         # LAYOUT_REGISTRY (add post-list template)
            └── node.ts                        # NodeType union (add PostList)
```

**Structure Decision**: Web application pattern with packages/backend, packages/frontend, packages/nodes, and packages/shared. Following existing monorepo structure.

## Complexity Tracking

> No violations requiring justification - follows existing patterns.
