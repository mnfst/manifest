# Implementation Plan: Simplified Flow Creation

**Branch**: `001-flow-creation` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-flow-creation/spec.md`

## Summary

Replace the prompt-based flow creation with a simplified modal that only requires name and description. The tool name is auto-generated from the flow name using snake_case conversion. After creation, users are guided through adding their first user intent and view via centered placeholder elements on the React Flow canvas.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**:
- Backend: NestJS 10.4.15, TypeORM 0.3.20
- Frontend: React 18.3.1, Vite 6.0.5, @xyflow/react 12.10.0, Tailwind CSS 3.4.17, lucide-react
- Shared: TypeScript types package
**Storage**: SQLite via better-sqlite3 11.7.0, TypeORM with auto-sync (POC mode)
**Testing**: Deferred per POC constitution
**Target Platform**: Web (desktop browsers)
**Project Type**: Monorepo with 3 packages (backend, frontend, shared)
**Performance Goals**: Deferred per POC constitution
**Constraints**: None specified (POC mode)
**Scale/Scope**: Single-user POC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Feature modifies existing components within their responsibilities |
| II. Testing Standards | DEFERRED | POC phase - no testing required |
| III. UX Consistency | PASS | Reuses existing modal patterns, adds new placeholder element following existing design |
| IV. Performance Requirements | DEFERRED | POC phase |
| V. Documentation & Readability | PASS | Self-documenting code expected, spec serves as documentation |

**Gate Status**: PASS - All applicable principles satisfied or deferred per POC constitution.

## Project Structure

### Documentation (this feature)

```text
specs/001-flow-creation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── flow-creation.yaml
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── agent/
│       │   └── agent.service.ts     # REMOVE: generateFlow method
│       └── flow/
│           ├── flow.controller.ts   # MODIFY: new createFlow logic
│           └── flow.service.ts      # MODIFY: simplified create method
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── CreateFlowModal.tsx     # MODIFY: name/description only
│       │       ├── PromptInput.tsx         # DELETE: entire file
│       │       ├── FlowDiagram.tsx         # MODIFY: add placeholder nodes
│       │       ├── AddUserIntentNode.tsx   # NEW: placeholder node
│       │       └── AddViewNode.tsx         # NEW: placeholder node
│       └── pages/
│           ├── AppDetail.tsx               # MODIFY: new modal props
│           └── FlowDetail.tsx              # MODIFY: handle empty states
└── shared/
    └── src/
        └── types/
            └── flow.ts                     # MODIFY: CreateFlowRequest type
```

**Structure Decision**: Existing monorepo structure with backend, frontend, and shared packages. All changes modify or remove existing files; only two new React components are added.

## Complexity Tracking

> No violations requiring justification.

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. SOLID Principles | PASS | Single Responsibility maintained: CreateFlowModal handles modal UI, FlowDiagram handles canvas, new placeholder nodes have focused purpose. No new abstractions or patterns introduced beyond necessity. |
| II. Testing Standards | DEFERRED | POC phase - manual testing checklist provided in quickstart.md |
| III. UX Consistency | PASS | Modal uses same field patterns as EditFlowForm. Placeholder nodes styled consistently with existing UserIntentNode/ViewNode. Error messages follow existing patterns. |
| IV. Performance Requirements | DEFERRED | POC phase |
| V. Documentation & Readability | PASS | Code structure documented in plan.md. API contract in OpenAPI format. Quickstart provides implementation guidance. |

**Post-Design Gate Status**: PASS - Design adheres to all applicable constitution principles.

## Generated Artifacts

| Artifact | Location | Description |
|----------|----------|-------------|
| research.md | `specs/001-flow-creation/research.md` | Technical decisions and rationale |
| data-model.md | `specs/001-flow-creation/data-model.md` | Flow entity behavior changes and state detection |
| flow-creation.yaml | `specs/001-flow-creation/contracts/` | OpenAPI 3.0 contract for POST /api/apps/:appId/flows |
| quickstart.md | `specs/001-flow-creation/quickstart.md` | Implementation order and code patterns |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list.
