# Implementation Plan: UI Consistency Fixes

**Branch**: `016-ui-consistency-fixes` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-ui-consistency-fixes/spec.md`

## Summary

This feature consolidates app navigation into the sidebar, removes redundant UI elements (top header, app list page, steps bar), and improves visual consistency across views. The main changes are: (1) moving the app switcher to the sidebar with logo, name, and chevron-down indicator, (2) removing the top header from app-scoped pages, (3) removing the home/app list route, (4) adding an edit button to app detail, (5) repositioning the create flow button to the top of the list, (6) centering flow editor tabs and updating the Usage icon, and (7) removing the Steps bar.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**: React 18.3.1, React Router 7.x, NestJS 10.4.15, Vite 6.0.5, Tailwind CSS 3.4.17, lucide-react 0.562.0
**Storage**: SQLite (TypeORM) - no schema changes required
**Testing**: Manual testing (POC mode)
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (monorepo: backend, frontend, shared)
**Performance Goals**: N/A (POC mode, UI-only changes)
**Constraints**: None (frontend-only changes, no API modifications)
**Scale/Scope**: ~10 files modified, 0 new entities, frontend-only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | Single responsibility maintained - sidebar selector is one focused component |
| II. Testing Standards | ✅ PASS (Deferred) | POC mode - manual testing acceptable |
| III. UX Consistency | ✅ PASS | Primary goal of this feature - improving consistency |
| IV. Performance | ✅ PASS (Deferred) | POC mode - no requirements |
| V. Documentation | ✅ PASS | Self-documenting code, spec provides context |

**Gate Status**: PASSED - No violations

## Project Structure

### Documentation (this feature)

```text
specs/016-ui-consistency-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A - no data changes)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # MODIFY: Add SidebarAppSelector, remove Apps nav
│   │   │   ├── SidebarAppSelector.tsx # CREATE: New app selector component
│   │   │   └── Header.tsx            # DELETE or DEPRECATE: No longer used
│   │   ├── app/
│   │   │   └── AppCard.tsx           # REFERENCE: Edit button pattern
│   │   └── common/
│   │       └── Tabs.tsx              # MODIFY: Add centering support
│   ├── pages/
│   │   ├── Home.tsx                  # DELETE or MODIFY: Redirect to first app
│   │   ├── AppDetail.tsx             # MODIFY: Add edit button, reposition create flow
│   │   └── FlowDetail.tsx            # MODIFY: Remove header, steps bar, update icon
│   └── App.tsx                       # MODIFY: Update routing, remove Header usage
```

**Structure Decision**: Web application structure with frontend package as primary modification target. No backend changes required.

## Complexity Tracking

No constitution violations to justify.
