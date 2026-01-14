# Implementation Plan: App User Invitations

**Branch**: `001-app-invites` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-app-invites/spec.md`

## Summary

Implement app invitation functionality that allows owners/admins to invite non-registered users to apps via email. When an unknown email is entered in the Users tab, a confirmation modal prompts to send an invitation email. Pending invitations appear in the user list with visual distinction and can be resent or revoked. Invited users accept via email link and gain app access upon registration/login.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (Node.js >= 18.0.0)
**Primary Dependencies**:
- Backend: NestJS 10.4.15, TypeORM 0.3.20, better-auth 1.4.10
- Frontend: React 18.3.1, Vite 6.0.5, Tailwind CSS
- Email: @react-email/components, @react-email/render, mailgun.js
**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM
**Testing**: Jest, @nestjs/testing (deferred for POC per constitution)
**Target Platform**: Web application (desktop browsers)
**Project Type**: Web monorepo (packages/backend, packages/frontend, packages/shared)
**Performance Goals**: Deferred for POC per constitution
**Constraints**: Deferred for POC per constitution
**Scale/Scope**: POC - standard single-user testing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | PASS | New PendingInvitation entity follows SRP. InvitationService handles invitation logic separately from UserManagementService. |
| II. Testing Standards | DEFERRED | POC - testing not required per constitution |
| III. UX Consistency | PASS | Modal follows existing patterns (EditAppModal, CreateAppModal). User list styling matches existing components. |
| IV. Performance Requirements | DEFERRED | POC - no performance targets per constitution |
| V. Documentation & Readability | PASS | Self-documenting code, descriptive naming, intention-revealing interfaces |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-app-invites/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── auth/
│       │   ├── pending-invitation.entity.ts    # NEW: Invitation entity
│       │   ├── invitation.service.ts           # NEW: Invitation business logic
│       │   ├── invitation.controller.ts        # NEW: Invitation endpoints
│       │   ├── user-management.service.ts      # MODIFY: Integrate invitation check
│       │   ├── user-management.controller.ts   # MODIFY: Update user list response
│       │   └── app-access.service.ts           # EXISTING: Permission checks
│       └── email/
│           ├── email.service.ts                # EXISTING: Add invitation send
│           └── templates/
│               └── invitation.tsx              # EXISTING: Adapt for new flow
├── frontend/
│   └── src/
│       ├── components/
│       │   └── app/
│       │       ├── UserManagement.tsx          # MODIFY: Add invite modal, pending display
│       │       └── InviteUserModal.tsx         # NEW: Confirmation modal
│       └── lib/
│           └── api.ts                          # MODIFY: Add invitation endpoints
└── shared/
    └── src/
        └── types/
            ├── auth.ts                         # MODIFY: Add PendingInvitation type
            └── email.ts                        # EXISTING: InvitationEmailProps
```

**Structure Decision**: Web application structure matching existing monorepo layout. New invitation logic encapsulated in dedicated service/controller following existing auth module patterns.

## Complexity Tracking

> No Constitution Check violations requiring justification.
