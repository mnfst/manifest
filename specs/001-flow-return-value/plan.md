# Implementation Plan: Flow Return Value Support

**Branch**: `001-flow-return-value` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-flow-return-value/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable MCP tools without UI by adding return value support to flows. This feature replaces the "Create your first view" prompt with "Add next step", introduces a side drawer for selecting between View or Return value steps, and implements text return values following the MCP protocol text content format (`{ "type": "text", "text": "<content>" }`).

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**: NestJS 10.4.15, React 18.3.1, Vite 6.0.5, TypeORM 0.3.20, Tailwind CSS 3.4.17, @xyflow/react 12.10.0, lucide-react 0.562.0
**Storage**: SQLite (better-sqlite3 11.7.0), TypeORM with auto-sync (POC mode)
**Testing**: Deferred for POC (manual testing)
**Target Platform**: Web browser (desktop), Node.js server
**Project Type**: Web application (monorepo: backend, frontend, shared packages)
**Performance Goals**: Deferred for POC
**Constraints**: Deferred for POC
**Scale/Scope**: POC - single user, local development

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | New ReturnValue entity follows existing entity patterns; single responsibility maintained |
| II. Testing Standards | DEFERRED | POC phase - manual testing acceptable |
| III. User Experience Consistency | PASS | Reusing existing UI patterns (modals, drawers); consistent with flow diagram interactions |
| IV. Performance Requirements | DEFERRED | POC phase - no performance targets enforced |
| V. Documentation & Readability | PASS | Self-documenting code with TypeScript types; follows existing naming conventions |

**Gate Result**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/001-flow-return-value/
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
│       ├── return-value/          # NEW: ReturnValue module
│       │   ├── return-value.entity.ts
│       │   ├── return-value.service.ts
│       │   ├── return-value.controller.ts
│       │   └── return-value.module.ts
│       ├── flow/                  # MODIFY: Flow entity and service
│       │   ├── flow.entity.ts
│       │   └── flow.service.ts
│       └── mcp/                   # MODIFY: MCP tool execution
│           └── mcp.tool.ts
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/              # MODIFY: Flow diagram components
│       │       ├── AddViewNode.tsx      → AddStepNode.tsx (rename)
│       │       ├── StepTypeDrawer.tsx   # NEW
│       │       ├── ReturnValueNode.tsx  # NEW
│       │       ├── ReturnValueEditor.tsx # NEW
│       │       └── FlowDiagram.tsx      # MODIFY
│       ├── pages/
│       │   └── FlowDetail.tsx     # MODIFY: Add drawer integration
│       └── lib/
│           └── api.ts             # MODIFY: Add return value endpoints
└── shared/
    └── src/
        └── types/
            ├── return-value.ts    # NEW: ReturnValue types
            └── flow.ts            # MODIFY: Add returnValue relation
```

**Structure Decision**: Web application monorepo with backend, frontend, and shared packages. New ReturnValue module follows existing entity pattern (flow, view, mock-data). Frontend components follow existing flow diagram patterns with React Flow nodes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all gates passed.
