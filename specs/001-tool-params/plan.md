# Implementation Plan: MCP Tool Parameters

**Branch**: `001-tool-params` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-tool-params/spec.md`

## Summary

Add parameter support to MCP tool flows, enabling users to define typed parameters (string, number, integer, boolean) during flow creation and editing. Each parameter has a name, type, and optional flag. Parameters are displayed as a count on flow cards alongside views.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**: NestJS 10.4.15, React 18.3.1, TypeORM 0.3.20, Vite 6.0.5, Tailwind CSS 3.4.17
**Storage**: SQLite (better-sqlite3 11.7.0) with TypeORM auto-sync (POC mode)
**Testing**: No automated testing framework (POC mode - manual testing)
**Target Platform**: Web application (Desktop browsers)
**Project Type**: Web (monorepo with backend, frontend, shared packages)
**Performance Goals**: Deferred (POC) - User interactions should feel responsive
**Constraints**: Deferred (POC) - Standard web app expectations
**Scale/Scope**: POC - Single user, local development

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Parameters extend Flow entity; single responsibility maintained |
| II. Testing Standards | DEFERRED | POC phase - manual testing acceptable |
| III. UX Consistency | PASS | Will reuse existing modal and form patterns |
| IV. Performance Requirements | DEFERRED | POC phase |
| V. Documentation & Readability | PASS | Self-documenting code with clear naming |

**Gate Result**: PASS - All applicable principles satisfied or appropriately deferred per POC scope.

## Project Structure

### Documentation (this feature)

```text
specs/001-tool-params/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── flow/
│       │   ├── flow.entity.ts      # Extend with parameters JSON column
│       │   ├── flow.controller.ts  # Update create/update endpoints
│       │   └── flow.service.ts     # Handle parameter validation
│       └── ...
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       ├── CreateFlowModal.tsx  # Add parameter management UI
│       │       ├── EditFlowForm.tsx     # Add parameter editing
│       │       ├── FlowCard.tsx         # Display parameter count
│       │       └── ParameterEditor.tsx  # New: Parameter list component
│       └── ...
└── shared/
    └── src/
        └── types/
            └── flow.ts              # Add Parameter interface
```

**Structure Decision**: Web application structure - existing monorepo with backend (NestJS), frontend (React), and shared (types) packages. No new packages required; this feature extends existing flow module.

## Complexity Tracking

No constitution violations requiring justification.
