# Implementation Plan: Navigation Sidebar

**Branch**: `007-sidebar` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-sidebar/spec.md`

## Summary

Add a persistent navigation sidebar to the application that provides quick access to "Apps" (linking to the existing app list at "/") and "Flows" (a new page listing all flows across all apps with parent app context). The sidebar will be visible on all pages with active section highlighting based on the current route.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (monorepo with 3 packages: backend, frontend, shared)
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 + Vite 6.0.5 (frontend), React Router 7.1.1, Tailwind CSS 3.4.17
**Storage**: SQLite via better-sqlite3 11.7.0, TypeORM 0.3.20 (existing App/Flow entities, no schema changes needed)
**Testing**: Deferred for POC (per constitution)
**Target Platform**: Desktop browsers (responsive design - sidebar collapse on narrow screens)
**Project Type**: Web application (frontend + backend + shared packages)
**Performance Goals**: Deferred for POC (per constitution)
**Constraints**: POC mode - no authentication, simplified workflow
**Scale/Scope**: Small POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | Sidebar component will be single-responsibility; new FlowsPage follows existing patterns |
| II. Testing Standards | DEFERRED | POC phase - no automated testing required |
| III. UX Consistency | PASS | Will reuse existing UI patterns (Tailwind, existing component styles) |
| IV. Performance Requirements | DEFERRED | POC phase - no performance targets enforced |
| V. Documentation & Readability | PASS | Self-documenting component names, follows existing patterns |

**Gate Result**: PASS - No violations. Proceed with planning.

## Project Structure

### Documentation (this feature)

```text
specs/007-sidebar/
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
│       ├── flow/
│       │   ├── flow.controller.ts  # Add GET /api/flows endpoint
│       │   └── flow.service.ts     # Add findAll method with app relation
│       └── ...
├── frontend/
│   └── src/
│       ├── App.tsx                 # Add Sidebar to layout
│       ├── components/
│       │   └── layout/
│       │       ├── Sidebar.tsx     # NEW: Main sidebar component
│       │       ├── SidebarItem.tsx # NEW: Individual navigation item
│       │       └── Header.tsx      # Adjust for sidebar integration
│       ├── pages/
│       │   ├── FlowsPage.tsx       # NEW: All flows listing page
│       │   └── Home.tsx            # Existing app list (Apps shortcut target)
│       └── lib/
│           └── api.ts              # Add getAllFlows API method
└── shared/
    └── src/
        └── types/
            └── flow.ts             # Add FlowWithApp type if needed
```

**Structure Decision**: Web application pattern using existing monorepo structure. New components follow established layout component patterns. New page follows existing page patterns.

## Complexity Tracking

> No violations requiring justification. Implementation follows existing patterns.

*No entries required - all implementations align with constitution and existing codebase patterns.*
