# Implementation Plan: Node Library Sidedrawer

**Branch**: `001-node-library` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-node-library/spec.md`

## Summary

Replace the existing "+" button / modal-based node selection with a new Node Library sidedrawer component positioned adjacent to the main sidebar. The sidedrawer provides hierarchical navigation (groups → nodes) with smooth animations, search functionality at root level, and maintains the existing visual presentation (icons, colors) for node types.

## Technical Context

**Language/Version**: TypeScript 5.7.2, React 18.3.1
**Primary Dependencies**: @xyflow/react 12.10.0 (React Flow), lucide-react 0.562.0 (icons), Tailwind CSS 3.4.17
**Storage**: N/A (frontend-only UI change)
**Testing**: None (POC phase - testing deferred per constitution)
**Target Platform**: Desktop browsers (Vite 6.0.5 build)
**Project Type**: Web application (monorepo: packages/frontend, packages/backend, packages/shared)
**Performance Goals**: 60fps animations, <100ms search filtering
**Constraints**: Must integrate with existing React Flow canvas without disrupting flow editing
**Scale/Scope**: 3 node types currently (Interface, Return, CallFlow), organized into logical groups

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | New component follows SRP (sidedrawer has one purpose), can extend node types without modifying core component |
| II. Testing Standards | ✅ DEFERRED | POC phase - testing not required |
| III. UX Consistency | ✅ PASS | Reuses existing UI patterns (StepTypeDrawer modal structure, Tailwind animations), preserves node icons/colors |
| IV. Performance Requirements | ✅ DEFERRED | POC phase - but design targets 60fps animations and <100ms search |
| V. Documentation & Readability | ✅ PASS | Self-documenting component names, TypeScript interfaces |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-node-library/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - frontend-only)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/frontend/
├── src/
│   ├── components/
│   │   ├── flow/
│   │   │   ├── FlowDiagram.tsx          # (modify) Integrate NodeLibrary trigger
│   │   │   ├── StepTypeDrawer.tsx       # (remove) Replace with NodeLibrary
│   │   │   ├── AddStepNode.tsx          # (remove) No longer needed
│   │   │   └── NodeLibrary/             # (new) Node Library sidedrawer
│   │   │       ├── NodeLibrary.tsx      # Main sidedrawer component
│   │   │       ├── NodeGroup.tsx        # Group item with icon/color
│   │   │       ├── NodeItem.tsx         # Individual node with icon/color
│   │   │       ├── NodeSearch.tsx       # Search bar component
│   │   │       └── index.ts             # Barrel export
│   │   └── layout/
│   │       └── Sidebar.tsx              # (modify) May need adjustment for drawer positioning
│   ├── pages/
│   │   └── FlowDetail.tsx               # (modify) Replace AddStepModal with NodeLibrary
│   └── lib/
│       └── nodeConfig.ts                # (new) Node types configuration (groups, icons, colors)
└── tests/                               # (deferred - POC)
```

**Structure Decision**: Using the existing web application structure. New components added under `packages/frontend/src/components/flow/NodeLibrary/` following the established component organization pattern.

## Complexity Tracking

No constitution violations to justify.
