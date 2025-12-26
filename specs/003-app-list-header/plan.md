# Implementation Plan: App List Home Page and Header Navigation

**Branch**: `003-app-list-header` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-app-list-header/spec.md`

## Summary

Transform the home page from an app creation form to an app list view, add a global header component with app switcher dropdown and dummy user avatar. This is a frontend-focused feature with one new backend endpoint (list apps).

## Technical Context

**Language/Version**: TypeScript 5.7.2 (monorepo with 3 packages)
**Primary Dependencies**:
- Backend: NestJS 10.x, TypeORM, SQLite (better-sqlite3)
- Frontend: React 18.x, React Router 7.x, Tailwind CSS 3.x, Vite 6.x
- Shared: TypeScript types package

**Storage**: SQLite via TypeORM (existing App entity, no schema changes)
**Testing**: Deferred (POC scope per constitution)
**Target Platform**: Desktop web browsers (Chrome, Firefox, Safari)
**Project Type**: Web application (backend + frontend + shared packages)
**Performance Goals**: N/A (POC - deferred per constitution)
**Constraints**: N/A (POC - deferred per constitution)
**Scale/Scope**: POC - small number of apps expected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | New components follow single responsibility |
| II. Testing Standards | ✅ N/A | Deferred for POC |
| III. UX Consistency | ✅ PASS | Reuses existing UI patterns (cards, buttons, forms) |
| IV. Performance | ✅ N/A | Deferred for POC |
| V. Documentation | ✅ PASS | Code will be self-documenting with JSDoc |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/003-app-list-header/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output
    └── api.md           # API contract for GET /apps
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── app/
│       │   ├── app.service.ts      # Add findAll() method
│       │   └── app.controller.ts   # Add GET /api/apps endpoint
│       └── entities/
│           └── app.entity.ts       # No changes (existing)
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── app/
│       │   │   ├── AppCard.tsx     # NEW: App card for list
│       │   │   └── AppList.tsx     # NEW: App list grid
│       │   └── layout/
│       │       ├── Header.tsx      # NEW: Global header component
│       │       ├── AppSwitcher.tsx # NEW: Dropdown for switching apps
│       │       └── UserAvatar.tsx  # NEW: Dummy user display
│       ├── pages/
│       │   ├── Home.tsx            # MODIFY: Show app list instead of form
│       │   ├── AppDetail.tsx       # MODIFY: Add Header wrapper
│       │   ├── FlowDetail.tsx      # MODIFY: Add Header wrapper
│       │   └── ViewEditor.tsx      # MODIFY: Add Header wrapper
│       └── lib/
│           └── api.ts              # Add listApps() function
│
└── shared/
    └── src/types/
        └── app.ts                  # No changes needed
```

**Structure Decision**: Web application structure with existing monorepo layout. Changes are minimal - one new backend endpoint and several new frontend components.

## Complexity Tracking

> No violations requiring justification - design is straightforward.

| Aspect | Complexity Level | Justification |
|--------|-----------------|---------------|
| Backend changes | Low | Single new endpoint, simple query |
| Frontend changes | Medium | New components, but follows existing patterns |
| Data model | None | No schema changes |
| State management | Low | React local state sufficient |
