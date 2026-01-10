# Tasks: Backend Email System

**Input**: Design documents from `/specs/001-email/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: REQUIRED - spec FR-008 mandates test suite, SC-006 requires 80% coverage

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/shared/src/`
- Templates live in backend since they are server-side rendered

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and configuration

- [x] T001 Install React Email dependencies in packages/backend/ (`pnpm add @react-email/components @react-email/render react react-dom`)
- [x] T002 Install Mailgun SDK in packages/backend/ (`pnpm add mailgun.js form-data`)
- [x] T003 [P] Install React type definitions in packages/backend/ (`pnpm add -D @types/react @types/react-dom`)
- [x] T004 [P] Configure JSX support in packages/backend/tsconfig.json (`"jsx": "react-jsx"`)
- [x] T005 [P] Add email environment variables to packages/backend/.env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create shared email types in packages/shared/src/types/email.ts (EmailTemplateType enum, EmailMessage, EmailSendResult, props interfaces)
- [x] T007 Export email types from packages/shared/src/types/index.ts
- [x] T008 [P] Create email module directory structure in packages/backend/src/email/
- [x] T009 Create EmailProvider interface in packages/backend/src/email/providers/email-provider.interface.ts
- [x] T010 Create TemplateEngine interface in packages/backend/src/email/templates/engine/template-engine.interface.ts
- [x] T011 [P] Create ConsoleProvider (dev/test) in packages/backend/src/email/providers/console.provider.ts
- [x] T012 Create MailgunProvider in packages/backend/src/email/providers/mailgun.provider.ts
- [x] T013 Create DTOs in packages/backend/src/email/dto/send-email.dto.ts and email-result.dto.ts
- [x] T014 Create EmailModule with provider factory in packages/backend/src/email/email.module.ts
- [x] T015 Register EmailModule in packages/backend/src/app.module.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Password Reset Email (Priority: P1) 🎯 MVP

**Goal**: Users who forgot their password receive a secure email with reset link

**Independent Test**: Trigger password reset request and verify email delivery with correct reset link

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [P] [US1] Unit tests for password reset template rendering in packages/backend/src/email/templates/password-reset.spec.ts
- [x] T017 [P] [US1] Unit tests for EmailService.sendPasswordReset in packages/backend/src/email/email.service.spec.ts

### Implementation for User Story 1

- [x] T018 [P] [US1] Create BaseLayout component in packages/backend/src/email/templates/components/BaseLayout.tsx
- [x] T019 [P] [US1] Create Header component in packages/backend/src/email/templates/components/Header.tsx
- [x] T020 [P] [US1] Create Footer component in packages/backend/src/email/templates/components/Footer.tsx
- [x] T021 [P] [US1] Create Button component in packages/backend/src/email/templates/components/Button.tsx
- [x] T022 [US1] Create PasswordResetEmail template in packages/backend/src/email/templates/password-reset.tsx (uses BaseLayout, Header, Footer, Button)
- [x] T023 [US1] Create ReactEmailEngine in packages/backend/src/email/templates/engine/react-email.engine.ts
- [x] T024 [US1] Create EmailService with sendPasswordReset method in packages/backend/src/email/email.service.ts
- [x] T025 [US1] Add email validation using class-validator in packages/backend/src/email/email.service.ts
- [x] T026 [US1] Add logging for email send attempts in packages/backend/src/email/email.service.ts

**Checkpoint**: Password reset emails can be sent and rendered correctly. US1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Invitation Email (Priority: P2)

**Goal**: Invitees receive professional invitation email with inviter name, app name, and access link

**Independent Test**: Trigger invitation and verify email contains correct inviter name, app name, and access link

### Tests for User Story 2 ⚠️

- [x] T027 [P] [US2] Unit tests for invitation template rendering in packages/backend/src/email/templates/invitation.spec.ts
- [x] T028 [P] [US2] Unit tests for EmailService.sendInvitation in packages/backend/src/email/email.service.spec.ts (add to existing file)

### Implementation for User Story 2

- [x] T029 [US2] Create InvitationEmail template in packages/backend/src/email/templates/invitation.tsx (reuses BaseLayout, Header, Footer, Button)
- [x] T030 [US2] Add sendInvitation method to EmailService in packages/backend/src/email/email.service.ts
- [x] T031 [US2] Register invitation template in ReactEmailEngine in packages/backend/src/email/templates/engine/react-email.engine.ts

**Checkpoint**: Invitation emails can be sent. Both US1 and US2 work independently.

---

## Phase 5: User Story 3 - Email Template Consistency (Priority: P3)

**Goal**: All emails share consistent visual layout and branding

**Independent Test**: Send multiple email types and verify they share same header, footer, colors, typography

### Tests for User Story 3 ⚠️

- [x] T032 [P] [US3] Integration tests verifying both templates use shared layout in packages/backend/src/email/templates/templates.integration.spec.ts

### Implementation for User Story 3

- [x] T033 [US3] Add shared styles and color constants to BaseLayout in packages/backend/src/email/templates/components/BaseLayout.tsx
- [x] T034 [US3] Add preview endpoint to EmailController in packages/backend/src/email/email.controller.ts (GET /email/preview/:template)
- [x] T035 [US3] Add templates list endpoint in packages/backend/src/email/email.controller.ts (GET /email/templates)
- [x] T036 [US3] Add config status endpoint in packages/backend/src/email/email.controller.ts (GET /email/config)

**Checkpoint**: All email templates render with consistent branding. Preview available for development.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, edge cases, and coverage

- [ ] T037 [P] Controller tests in packages/backend/src/email/email.controller.spec.ts
- [ ] T038 [P] MailgunProvider tests in packages/backend/src/email/providers/mailgun.provider.spec.ts
- [ ] T039 [P] ConsoleProvider tests in packages/backend/src/email/providers/console.provider.spec.ts
- [ ] T040 Add error handling for template rendering failures in packages/backend/src/email/templates/engine/react-email.engine.ts
- [ ] T041 Add error handling for provider failures in packages/backend/src/email/email.service.ts
- [ ] T042 Add text truncation handling for long names in templates in packages/backend/src/email/templates/components/
- [ ] T043 Run test coverage report and verify 80%+ coverage for email module
- [ ] T044 Validate quickstart.md scenarios work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Reuses components from US1 but independently testable
- **User Story 3 (P3)**: Can start after US1 complete (needs templates to verify consistency)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Layout components before template components
- Template engine before service
- Service before controller endpoints
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005 can run in parallel (different files)
- T008, T011 can run in parallel (different directories)
- T016, T017 can run in parallel (different test files)
- T018, T019, T020, T021 can run in parallel (different component files)
- T027, T028 can run in parallel (different test files)
- T037, T038, T039 can run in parallel (different test files)

---

## Parallel Example: User Story 1 Components

```bash
# Launch all base components together:
Task: "Create BaseLayout component in packages/backend/src/email/templates/components/BaseLayout.tsx"
Task: "Create Header component in packages/backend/src/email/templates/components/Header.tsx"
Task: "Create Footer component in packages/backend/src/email/templates/components/Footer.tsx"
Task: "Create Button component in packages/backend/src/email/templates/components/Button.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Password Reset Email)
4. **STOP and VALIDATE**: Test password reset email independently
5. Deploy/demo if ready - users can recover their passwords!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP - Password Reset)
3. Add User Story 2 → Test independently → Deploy (+ Invitations)
4. Add User Story 3 → Test independently → Deploy (+ Consistent Branding)
5. Polish → Full test coverage, error handling

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (P1)
   - Developer B: User Story 2 (P2) - can start after base components exist
3. User Story 3 requires US1 to complete (needs templates to verify consistency)
4. Polish phase can be split among team

---

## Summary

| Phase | Tasks | Parallel Tasks | Description |
|-------|-------|----------------|-------------|
| Setup | 5 | 3 | Dependencies and config |
| Foundational | 10 | 3 | Core interfaces and module |
| US1 (Password Reset) | 11 | 6 | MVP - Password reset emails |
| US2 (Invitation) | 5 | 2 | Invitation emails |
| US3 (Consistency) | 5 | 1 | Branding and preview |
| Polish | 8 | 4 | Tests, error handling, validation |
| **Total** | **44** | **19** | |

### Independent Test Criteria

- **US1**: Trigger password reset → Receive email with correct reset link
- **US2**: Trigger invitation → Receive email with inviter name, app name, link
- **US3**: Send both email types → Both use same header, footer, colors

### MVP Scope

**Phase 1 + Phase 2 + Phase 3 (User Story 1)** = Minimum viable email system with password reset functionality

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests are REQUIRED per spec FR-008 (80% coverage target per SC-006)
