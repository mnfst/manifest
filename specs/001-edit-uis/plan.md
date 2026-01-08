# Implementation Plan: Editable UI Interfaces

**Branch**: `001-edit-uis` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-edit-uis/spec.md`

## Summary

Enable users to customize Interface node components through a full-screen code editor with live preview. The editor replaces the canvas view when editing, uses CodeMirror with the Manifest VS Code theme, provides code validation before save, and persists custom code in node parameters.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: React 18.3.1, NestJS 10.4.15, @xyflow/react 12.10.0, CodeMirror 6 (to add), Vite 6.0.5
**Storage**: SQLite via TypeORM 0.3.20 (nodes stored as JSON in Flow entity)
**Testing**: Deferred per POC constitution
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (monorepo with packages/frontend, packages/backend, packages/shared)
**Performance Goals**: Per spec - edit view loads <2s, toggle <500ms, preview renders <1s
**Constraints**: Client-side validation, no server round-trips for validation
**Scale/Scope**: Single user POC, Interface nodes only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | New components follow SRP (EditorView, CodeEditor, Preview separate), OCP (template registry extensible) |
| II. Testing Standards | DEFERRED | POC phase - testing not required |
| III. UX Consistency | PASS | Follows existing modal/tab patterns, reuses Tailwind + CSS vars, provides feedback <100ms for toggles |
| IV. Performance | DEFERRED | POC phase - targets documented as goals |
| V. Documentation | PASS | Code will be self-documenting with clear naming |

**POC Relaxations Applied**:
- No automated tests required
- Performance targets are goals, not hard requirements
- Manual testing acceptable

## Project Structure

### Documentation (this feature)

```text
specs/001-edit-uis/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── flow/
│       │   │   ├── ViewNode.tsx           # Add Edit button
│       │   │   └── NodeEditModal.tsx      # Existing, may need updates
│       │   └── editor/                    # New: Editor components
│       │       ├── InterfaceEditor.tsx    # Full-screen editor view
│       │       ├── CodeEditor.tsx         # CodeMirror wrapper
│       │       ├── ComponentPreview.tsx   # Live preview with sample data
│       │       └── manifestTheme.ts       # CodeMirror Manifest theme
│       ├── pages/
│       │   └── FlowDetail.tsx             # Conditionally render editor vs canvas
│       └── lib/
│           ├── api.ts                     # Add updateNodeCode endpoint
│           └── codeValidator.ts           # New: Code validation utilities
├── backend/
│   └── src/
│       └── node/
│           └── node.controller.ts         # Add code update endpoint
├── shared/
│   └── src/
│       └── types/
│           ├── node.ts                    # Extend InterfaceNodeParameters
│           └── templates.ts               # New: Default template code registry
└── nodes/
    └── src/
        └── nodes/
            └── InterfaceNode.ts           # Update defaultParameters
```

**Structure Decision**: Web application monorepo (existing). New editor components in `packages/frontend/src/components/editor/`. Shared template definitions in `packages/shared/src/types/templates.ts`.

## Complexity Tracking

No constitution violations requiring justification.
