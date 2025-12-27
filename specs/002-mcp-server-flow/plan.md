# Implementation Plan: MCP App and Flow Data Architecture

**Branch**: `002-mcp-server-flow` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-mcp-server-flow/spec.md`

## Summary

Restructure the application data model from a single App entity to a hierarchical App → Flow → View architecture. This enables MCP servers (Apps) to contain multiple tools (Flows), each with ordered Views for display. The user workflow changes: home page shows app creation form, app dashboard shows flow list with AI-assisted creation, and flow edition page lists views with navigation to view editor.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**: NestJS 10.4.15, React 18.3.1, Vite 6.0.5, TypeORM 0.3.20, LangChain 0.3.26
**Storage**: SQLite (better-sqlite3 11.7.0), TypeORM with auto-sync (POC mode)
**Testing**: No automated testing framework configured (POC - deferred)
**Target Platform**: Web application (desktop browsers, mobile deferred)
**Project Type**: Web application - npm workspaces monorepo (backend, frontend, shared)
**Performance Goals**: Deferred for POC per constitution
**Constraints**: POC scope - single-app session focus, no cross-session persistence, no authentication
**Scale/Scope**: Single user, in-memory session state, ~5 screens (home, app dashboard, flow list, flow editor, view editor)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | New entities follow existing patterns; services will be separated by responsibility |
| II. Testing Standards | DEFERRED | POC scope - no automated tests required |
| III. User Experience Consistency | PASS | Reusing existing UI patterns (chat+preview layout, theme system) |
| IV. Performance Requirements | DEFERRED | POC scope - no performance targets enforced |
| V. Documentation & Readability | PASS | TypeScript types self-document; spec documents architecture |

**Gate Result**: PASS - All applicable principles satisfied; deferred items per POC constitution v1.1.0

## Project Structure

### Documentation (this feature)

```text
specs/002-mcp-server-flow/
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
│       ├── main.ts
│       ├── app/
│       │   ├── app.module.ts          # Root module with TypeORM config
│       │   ├── app.controller.ts      # App CRUD endpoints (modified)
│       │   └── app.service.ts         # App service (modified)
│       ├── flow/                      # NEW - Flow module
│       │   ├── flow.module.ts
│       │   ├── flow.controller.ts
│       │   ├── flow.service.ts
│       │   └── flow.entity.ts
│       ├── view/                      # NEW - View module
│       │   ├── view.module.ts
│       │   ├── view.controller.ts
│       │   ├── view.service.ts
│       │   └── view.entity.ts
│       ├── entities/
│       │   └── app.entity.ts          # Modified - remove layout/mockData fields
│       ├── agent/
│       │   ├── agent.service.ts       # Modified - flow generation logic
│       │   └── tools/                 # Modified - flow-aware tools
│       └── mcp/
│           └── mcp.service.ts         # Modified - flow-based tool serving
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx               # Modified - app creation form
│       │   ├── AppDashboard.tsx       # NEW - flow list + creation
│       │   ├── FlowEditor.tsx         # NEW - view list + flow properties
│       │   └── ViewEditor.tsx         # NEW - existing editor pattern (chat+preview)
│       ├── components/
│       │   ├── app/                   # NEW - app-related components
│       │   │   └── AppForm.tsx
│       │   ├── flow/                  # NEW - flow-related components
│       │   │   ├── FlowList.tsx
│       │   │   └── FlowCard.tsx
│       │   ├── view/                  # NEW - view-related components
│       │   │   ├── ViewList.tsx
│       │   │   └── ViewCard.tsx
│       │   ├── editor/                # Modified - view-specific editing
│       │   └── chat/
│       └── lib/
│           └── api.ts                 # Modified - new endpoints
└── shared/
    └── src/types/
        ├── app.ts                     # Modified - App without layout/mockData
        ├── flow.ts                    # NEW - Flow types
        ├── view.ts                    # NEW - View types (inherits mockData/layout)
        └── index.ts                   # Modified - export new types
```

**Structure Decision**: Web application structure maintained. New modules (flow, view) follow existing NestJS patterns. Frontend adds new pages following React Router patterns.

## Complexity Tracking

> No violations requiring justification - design follows existing patterns.

## Constitution Re-Check (Post-Design)

*Verified after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Code Quality & SOLID | PASS | Separate modules for App/Flow/View (SRP); TypeORM relations (DI); shared types (ISP) |
| II. Testing Standards | DEFERRED | POC scope - manual testing acceptable per constitution |
| III. User Experience Consistency | PASS | View editor reuses existing chat+preview pattern; consistent navigation |
| IV. Performance Requirements | DEFERRED | POC scope - no performance targets |
| V. Documentation & Readability | PASS | OpenAPI contract, data-model.md, quickstart.md provided |

**Post-Design Gate Result**: PASS - Design adheres to constitution. Ready for task generation.

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | `research.md` | Technology decisions and patterns |
| Data Model | `data-model.md` | Entity definitions and relationships |
| API Contract | `contracts/api.yaml` | OpenAPI 3.0 specification |
| Quickstart | `quickstart.md` | Developer onboarding guide |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list.
