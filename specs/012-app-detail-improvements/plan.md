# Implementation Plan: App Detail Page Improvements

**Branch**: `012-app-detail-improvements` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-app-detail-improvements/spec.md`

## Summary

Improve the app detail page with four key changes: (1) consolidate sharing URLs into a modal triggered by a share icon in the header, (2) display flow cards in a single-column layout instead of grid, (3) remove flow card icons, and (4) add app icons with 8 default pixel art options randomly assigned on creation and custom upload capability in edit mode.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: React 18.3.1, NestJS 10.4.15, Vite 6.0.5, Tailwind CSS 3.4.17, lucide-react
**Storage**: SQLite via TypeORM (better-sqlite3 11.7.0)
**Testing**: Manual testing (POC mode - automated tests deferred)
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (monorepo: backend, frontend, shared packages)
**Performance Goals**: Deferred for POC
**Constraints**: POC mode - no authentication, simplified workflow
**Scale/Scope**: Single-user POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | Feature follows existing patterns, single responsibility per component |
| II. Testing Standards | DEFERRED | POC mode - manual testing acceptable |
| III. User Experience Consistency | PASS | Using existing UI patterns (modals, Tailwind), lucide-react icons |
| IV. Performance Requirements | DEFERRED | POC mode |
| V. Documentation & Readability | PASS | Code will follow self-documenting conventions |

**Gate Result**: PASS - All applicable principles satisfied or explicitly deferred per POC constitution.

## Project Structure

### Documentation (this feature)

```text
specs/012-app-detail-improvements/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (not created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── app/
│       │   ├── app.controller.ts    # Add icon upload endpoint
│       │   └── app.service.ts       # Add icon assignment logic
│       ├── entities/
│       │   └── app.entity.ts        # Repurpose logoUrl for iconUrl
│       └── uploads/                 # New: uploaded icons storage
│
├── frontend/
│   ├── public/
│   │   └── icons/                   # New: 8 default pixel art icons
│   │       ├── icon-red.png
│   │       ├── icon-orange.png
│   │       ├── icon-yellow.png
│   │       ├── icon-green.png
│   │       ├── icon-blue.png
│   │       ├── icon-purple.png
│   │       ├── icon-pink.png
│   │       └── icon-gray.png
│   └── src/
│       ├── components/
│       │   ├── app/
│       │   │   ├── ShareModal.tsx      # New: share URLs modal
│       │   │   └── AppIconUpload.tsx   # New: icon with upload overlay
│       │   └── flow/
│       │       ├── FlowCard.tsx        # Modify: remove icon
│       │       └── FlowList.tsx        # Modify: single column layout
│       └── pages/
│           └── AppDetail.tsx           # Modify: integrate share modal, app icon
│
└── shared/
    └── src/types/
        └── app.ts                      # Update: iconUrl in App interface
```

**Structure Decision**: Extends existing web application monorepo structure. No new packages needed.

## Complexity Tracking

No constitution violations requiring justification.
