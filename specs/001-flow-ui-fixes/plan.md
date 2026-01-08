# Implementation Plan: Flow UI Fixes

**Branch**: `001-flow-ui-fixes` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-flow-ui-fixes/spec.md`

## Summary

This plan addresses five frontend UI bugs/improvements: (1) Enable Preview tab for flows without UI nodes, (2) Fix transformer nodes not appearing after insertion, (3) Fix Share modal URLs missing production domain, (4) Fix PostList node creation not working, (5) Add settings link when API key is missing in Preview.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: React 18.3.1, @xyflow/react 12.10.0, NestJS 10.4.15 (backend)
**Storage**: SQLite via TypeORM 0.3.20 (flows stored with nodes as JSON arrays)
**Testing**: Manual testing (POC phase - automated tests deferred)
**Target Platform**: Web browsers (desktop)
**Project Type**: Web application (monorepo with packages/frontend and packages/backend)
**Performance Goals**: N/A (POC phase - performance deferred)
**Constraints**: UI changes must appear within 100ms per constitution UX requirements
**Scale/Scope**: Single-user POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Bug fixes follow single responsibility - each fix is isolated |
| II. Testing Standards | N/A | Deferred for POC phase |
| III. UX Consistency | PASS | Fixes maintain existing UI patterns |
| IV. Performance | N/A | Deferred for POC phase |
| V. Documentation | PASS | Self-documenting code, no new patterns introduced |

**Gate Result**: PASS - All applicable principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-flow-ui-fixes/
├── plan.md              # This file
├── research.md          # Phase 0: Bug analysis and root causes
├── quickstart.md        # Phase 1: Testing instructions
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── frontend/
│   └── src/
│       ├── pages/
│       │   └── FlowDetail.tsx          # Fix #1: Preview tab disabled logic
│       ├── components/
│       │   ├── app/
│       │   │   └── ShareModal.tsx      # Fix #3: URL domain prepending
│       │   ├── chat/
│       │   │   └── PreviewChat.tsx     # Fix #5: Settings link for API key
│       │   └── flow/
│       │       └── CompatibilityDetailModal.tsx  # Fix #2: Transformer refresh
│       ├── hooks/
│       │   └── useInsertTransformer.ts # Fix #2: Return flow state for refresh
│       └── lib/
│           └── api.ts                  # BACKEND_URL configuration
└── backend/
    └── src/
        └── node/
            └── node.service.ts         # Fix #2: Backend transformer insertion
```

**Structure Decision**: Web application structure with separate frontend/backend packages. All fixes are frontend-only except transformer insertion which may need backend investigation.

## Complexity Tracking

No violations requiring justification - all fixes follow existing patterns.
