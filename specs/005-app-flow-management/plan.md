# Implementation Plan: App & Flow Management

**Branch**: `005-app-flow-management` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-app-flow-management/spec.md`

## Summary

Enable full CRUD operations for Apps and Flows by adding edit and delete capabilities to the UI, displaying flow counts on app cards, and enforcing the existing backend validation that prevents publishing apps without flows. This feature builds on the existing entity structure and backend services, primarily requiring frontend UI changes with minimal backend additions.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (monorepo with 3 packages: backend, frontend, shared)
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 + Vite 6.0.5 (frontend), TypeORM 0.3.20 (ORM)
**Storage**: SQLite via better-sqlite3 11.7.0, TypeORM with auto-sync (POC mode)
**Testing**: Deferred for POC (manual testing acceptable per constitution)
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**: Operations complete within 2 seconds (POC, not enforced)
**Constraints**: POC phase - no authentication, no automated testing required
**Scale/Scope**: Single-user POC, ~10 screens total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID Principles | ✅ Pass | Reusing existing service patterns (AppService, FlowService) |
| Testing Standards | ✅ N/A | Deferred for POC per constitution |
| UX Consistency | ✅ Pass | Reusing existing modal patterns (CreateAppModal), card patterns (AppCard, FlowCard), and confirmation dialogs |
| Performance Requirements | ✅ N/A | Deferred for POC per constitution |
| Documentation & Readability | ✅ Pass | Following existing code patterns and naming conventions |

**Gate Status**: ✅ PASSED - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/005-app-flow-management/
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
│       ├── entities/
│       │   └── app.entity.ts          # App entity (existing, no changes)
│       ├── app/
│       │   ├── app.controller.ts      # Add DELETE endpoint
│       │   └── app.service.ts         # Add delete method, flow count
│       └── flow/
│           ├── flow.controller.ts     # Existing (already has DELETE)
│           └── flow.service.ts        # Add last-flow check logic
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── app/
│       │   │   ├── AppCard.tsx        # Add flow count, edit/delete actions
│       │   │   ├── EditAppModal.tsx   # NEW: Edit app modal
│       │   │   └── DeleteConfirmDialog.tsx  # NEW: Reusable confirmation
│       │   └── flow/
│       │       ├── FlowCard.tsx       # Existing (minor updates)
│       │       └── EditFlowForm.tsx   # NEW: Edit flow inline form
│       └── pages/
│           ├── Home.tsx               # Pass edit/delete handlers to AppCard
│           ├── AppDetail.tsx          # Add publish button disabled state
│           └── FlowDetail.tsx         # Add edit form, delete button
└── shared/
    └── src/
        └── types/
            ├── app.ts                 # Add flowCount to App interface
            └── api.ts                 # Add delete response types
```

**Structure Decision**: Web application structure following existing monorepo pattern. New components follow established patterns (modals, cards, forms). Backend changes are minimal - primarily exposing flow counts and adding a delete endpoint for apps.

## Complexity Tracking

> No violations requiring justification. All changes follow established patterns.
