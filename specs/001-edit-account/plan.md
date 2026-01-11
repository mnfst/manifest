# Implementation Plan: Edit Account

**Branch**: `001-edit-account` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-edit-account/spec.md`

## Summary

Add an Edit Account page that allows authenticated users to update their profile information (first name, last name), change their email (with verification flow), and change their password. The feature includes a navigation entry in the user dropdown menu and a verification email template following existing React Email branding.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (Node.js >= 18.0.0)
**Primary Dependencies**:
- Backend: NestJS 10.4.15, better-auth 1.4.10, TypeORM 0.3.20
- Frontend: React 18.3.1, React Router 7.1.1, Vite 6.0.5, TailwindCSS 3.4.17
- Email: @react-email/components 1.0.4, @react-email/render 2.0.2
**Storage**: SQLite via better-sqlite3 11.7.0 (user data managed by better-auth)
**Testing**: Jest (backend), manual testing for POC
**Target Platform**: Web application (desktop browsers, mobile deferred)
**Project Type**: Web (monorepo with packages/backend, packages/frontend, packages/shared)
**Performance Goals**: POC - deferred per constitution
**Constraints**: POC - simplified workflow per constitution
**Scale/Scope**: Single-user editing, standard form interactions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | Feature follows existing service/controller patterns |
| II. Testing Standards | DEFERRED | POC phase - manual testing acceptable |
| III. User Experience Consistency | PASS | Reuses existing UI components (tabs, forms, buttons) |
| IV. Performance Requirements | DEFERRED | POC phase |
| V. Documentation & Readability | PASS | Self-documenting code, spec documentation in place |
| Auto-Serve for Testing | REQUIRED | Must run serve script after implementation |

**Gate Status**: PASS - No violations requiring justification

**Post-Design Re-check (Phase 1 Complete)**:
- Data model adds one new entity (EmailVerificationToken) - minimal complexity
- API contracts follow existing REST patterns
- No new external dependencies required
- All principles still satisfied

## Project Structure

### Documentation (this feature)

```text
specs/001-edit-account/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.yaml         # OpenAPI specification
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/backend/
├── src/
│   ├── auth/
│   │   ├── user-management.controller.ts  # Add update endpoints
│   │   ├── user-management.service.ts     # Add update logic
│   │   ├── dto/                           # Add update DTOs
│   │   │   └── update-user.dto.ts
│   │   └── auth.ts                        # Better-auth config (verify fields)
│   └── email/
│       ├── email.service.ts               # Add email change verification method
│       └── templates/
│           └── email-change-verification.tsx  # New template

packages/frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── UserAvatar.tsx             # Add "Edit Account" menu item
│   │   └── settings/
│   │       └── AccountTab.tsx             # New account settings tab
│   ├── pages/
│   │   └── SettingsPage.tsx               # Add account tab to settings
│   └── lib/
│       └── api.ts                         # Add update user API methods

packages/shared/
└── src/
    └── types/
        ├── auth.ts                        # Extend UserProfile type
        └── email.ts                       # Add email change template type
```

**Structure Decision**: Web application structure following existing monorepo layout with packages/backend, packages/frontend, and packages/shared.

## Complexity Tracking

> No violations - table not required.
