# Implementation Plan: Backend Email System

**Branch**: `001-email` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-email/spec.md`

## Summary

Implement a backend email system with provider-agnostic architecture supporting password reset and invitation emails. Uses React Email for component-based templating with a modular layout system, and Mailgun for sending via an abstracted provider interface. The design follows SOLID principles (especially DIP) to enable swapping providers without business logic changes.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (Node.js >= 18.0.0)
**Primary Dependencies**: NestJS 10.4.15, React Email (@react-email/components, @react-email/render), mailgun.js (or nestjs-mailgun), nodemailer
**Storage**: N/A for email module (no persistence required; uses existing SQLite via TypeORM for user data)
**Testing**: Jest 29.7.0 with @nestjs/testing, mock providers for unit tests
**Target Platform**: Linux server (Docker-ready)
**Project Type**: Web application (monorepo with packages/backend, packages/frontend, packages/shared)
**Performance Goals**: Email delivery within 60 seconds under normal load (per spec SC-001, SC-002)
**Constraints**: POC phase - no authentication required; provider-agnostic architecture required
**Scale/Scope**: Transactional emails only (password reset, invitations); English only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | **PASS** | Architecture uses DIP with provider abstraction; templates follow SRP with modular composition |
| II. Testing Standards | **PASS** | POC-deferred, but spec requires 80% coverage - will implement tests |
| III. UX Consistency | **N/A** | Backend-only feature, no UI components |
| IV. Performance Requirements | **PASS** | POC-deferred, 60s delivery target is reasonable |
| V. Documentation & Readability | **PASS** | Will document architecture decisions |

**Gate Result**: PASSED - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-email/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/backend/src/
├── email/                         # New email module
│   ├── email.module.ts            # Module definition
│   ├── email.service.ts           # Orchestration service
│   ├── email.controller.ts        # HTTP endpoints (dev preview)
│   ├── providers/                 # Email sending providers
│   │   ├── email-provider.interface.ts
│   │   ├── mailgun.provider.ts
│   │   └── console.provider.ts    # Dev/test provider (logs to console)
│   ├── templates/                 # React Email templates
│   │   ├── engine/                # Template rendering abstraction
│   │   │   ├── template-engine.interface.ts
│   │   │   └── react-email.engine.ts
│   │   ├── components/            # Shared layout components
│   │   │   ├── BaseLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Button.tsx
│   │   ├── password-reset.tsx     # Password reset email
│   │   └── invitation.tsx         # Invitation email
│   └── dto/                       # Data transfer objects
│       ├── send-email.dto.ts
│       └── email-result.dto.ts
├── email/                         # Test files (alongside source)
│   ├── email.service.spec.ts
│   ├── email.controller.spec.ts
│   ├── providers/
│   │   └── mailgun.provider.spec.ts
│   └── templates/
│       └── templates.spec.ts

packages/shared/src/types/
└── email.ts                       # Shared email types
```

**Structure Decision**: Web application (Option 2) - email module integrates into existing `packages/backend/` structure. Templates live inside backend since they are server-side rendered. Shared types exported from `packages/shared/`.

## Complexity Tracking

> No violations requiring justification - architecture follows existing patterns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
