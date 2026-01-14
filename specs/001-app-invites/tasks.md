# Tasks: App User Invitations

**Input**: Design documents from `/specs/001-app-invites/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT included (POC - testing deferred per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and shared types

- [x] T001 [P] Add invitation-related types to packages/shared/src/types/auth.ts (PendingInvitation, CreateInvitationRequest, AcceptInvitationRequest, AppUserListItem, InvitationValidation, AcceptInvitationResponse)
- [x] T002 [P] Export new types from packages/shared/src/types/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create PendingInvitationEntity in packages/backend/src/auth/pending-invitation.entity.ts following user-app-role.entity.ts pattern
- [x] T004 Register PendingInvitationEntity in packages/backend/src/app/app.module.ts TypeORM entities array
- [x] T005 Create InvitationService skeleton in packages/backend/src/auth/invitation.service.ts with token generation utilities
- [x] T006 Create InvitationController skeleton in packages/backend/src/auth/invitation.controller.ts
- [x] T007 Register InvitationService and InvitationController in packages/backend/src/auth/auth.module.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Invite Non-Registered User (Priority: P1)

**Goal**: When admin enters non-existent email, show confirmation modal and send invitation email

**Independent Test**: Enter non-existent email in Users tab → modal appears → click Send → email sent

### Implementation for User Story 1

- [x] T008 [US1] Implement createInvitation() method in packages/backend/src/auth/invitation.service.ts (generate token, hash, store, send email)
- [x] T009 [US1] Implement token generation utility using crypto.randomBytes(32).toString('base64url') in packages/backend/src/auth/invitation.service.ts
- [x] T010 [US1] Implement POST /apps/:appId/invitations endpoint in packages/backend/src/auth/invitation.controller.ts
- [x] T011 [US1] Update packages/backend/src/email/templates/invitation.tsx to accept dynamic appLink with token
- [x] T012 [US1] Add createInvitation() method to packages/frontend/src/lib/api.ts
- [x] T013 [US1] Create InviteUserModal component in packages/frontend/src/components/app/InviteUserModal.tsx following EditAppModal.tsx pattern
- [x] T014 [US1] Modify add user flow in packages/frontend/src/components/app/UserManagement.tsx to detect non-existent user and show InviteUserModal

**Checkpoint**: User Story 1 complete - can invite non-registered users via email

---

## Phase 4: User Story 2 - View Pending Invitations (Priority: P1)

**Goal**: Pending invitations appear in user list with visual distinction

**Independent Test**: After sending invitation, refresh Users tab → see pending invite with badge and muted styling

### Implementation for User Story 2

- [x] T015 [US2] Implement listPendingInvitations() method in packages/backend/src/auth/invitation.service.ts
- [x] T016 [US2] Implement GET /apps/:appId/invitations endpoint in packages/backend/src/auth/invitation.controller.ts
- [x] T017 [US2] Modify listAppUsers() in packages/backend/src/auth/user-management.service.ts to merge active users and pending invitations
- [x] T018 [US2] Update GET /apps/:appId/users response in packages/backend/src/auth/user-management.controller.ts to use merged list
- [x] T019 [US2] Update packages/frontend/src/components/app/UserManagement.tsx to display pending invitations with muted styling and "Pending Invite" badge

**Checkpoint**: User Story 2 complete - pending invitations visible in user list

---

## Phase 5: User Story 3 - Revoke Pending Invitation (Priority: P2)

**Goal**: Admin can delete pending invitation, invalidating the invite link

**Independent Test**: Click remove on pending invite → invite disappears → clicking old link shows error

### Implementation for User Story 3

- [x] T020 [US3] Implement revokeInvitation() method in packages/backend/src/auth/invitation.service.ts
- [x] T021 [US3] Implement DELETE /apps/:appId/invitations/:invitationId endpoint in packages/backend/src/auth/invitation.controller.ts
- [x] T022 [US3] Add revokeInvitation() method to packages/frontend/src/lib/api.ts
- [x] T023 [US3] Add remove button and handler for pending invitations in packages/frontend/src/components/app/UserManagement.tsx

**Checkpoint**: User Story 3 complete - can revoke pending invitations

---

## Phase 6: User Story 4 - Resend Invitation Email (Priority: P2)

**Goal**: Admin can resend invitation email with new token

**Independent Test**: Click mail icon on pending invite → toast confirmation → new email sent

### Implementation for User Story 4

- [x] T024 [US4] Implement resendInvitation() method in packages/backend/src/auth/invitation.service.ts (regenerate token, update DB, send email)
- [x] T025 [US4] Implement POST /apps/:appId/invitations/:invitationId/resend endpoint in packages/backend/src/auth/invitation.controller.ts
- [x] T026 [US4] Add resendInvitation() method to packages/frontend/src/lib/api.ts
- [x] T027 [US4] Add mail icon button and resend handler for pending invitations in packages/frontend/src/components/app/UserManagement.tsx with toast feedback

**Checkpoint**: User Story 4 complete - can resend invitation emails

---

## Phase 7: User Story 5 - Accept Invitation (Priority: P1)

**Goal**: Invited user clicks email link, authenticates, and gains app access

**Independent Test**: Click invite link → sign in/up → redirected to app with access

### Implementation for User Story 5

- [x] T028 [US5] Implement validateToken() method in packages/backend/src/auth/invitation.service.ts
- [x] T029 [US5] Implement GET /invitations/validate endpoint (Public) in packages/backend/src/auth/invitation.controller.ts
- [x] T030 [US5] Implement acceptInvitation() method in packages/backend/src/auth/invitation.service.ts (validate token, check email match, create UserAppRole, delete invitation)
- [x] T031 [US5] Implement POST /invitations/accept endpoint in packages/backend/src/auth/invitation.controller.ts
- [x] T032 [US5] Add validateInvitation() and acceptInvitation() methods to packages/frontend/src/lib/api.ts
- [x] T033 [US5] Create AcceptInvitePage component in packages/frontend/src/pages/AcceptInvitePage.tsx
- [x] T034 [US5] Add /accept-invite route to packages/frontend/src/App.tsx router configuration
- [x] T035 [US5] Implement sessionStorage preservation for invitation context through auth redirect flow in LoginForm.tsx and SignupForm.tsx

**Checkpoint**: User Story 5 complete - full invitation acceptance flow working

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T036 [P] Handle duplicate invitation edge case (409 response with resend offer) in packages/backend/src/auth/invitation.service.ts
- [x] T037 [P] Handle existing user edge case (400 response suggesting direct add) in packages/backend/src/auth/invitation.service.ts
- [x] T038 [P] Add email case normalization (lowercase) throughout invitation flow
- [x] T039 Verify cascade delete works (app deletion removes pending invitations) - configured via @ManyToOne onDelete: 'CASCADE'
- [x] T040 Update tasks.md with completion status

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel once foundational is done
  - US3 and US4 can proceed after US2 (need pending invitations visible)
  - US5 can proceed after US1 (need invitations created)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Invite) | Foundational | Phase 2 complete |
| US2 (View Pending) | Foundational | Phase 2 complete |
| US3 (Revoke) | US2 | Phase 4 complete |
| US4 (Resend) | US2 | Phase 4 complete |
| US5 (Accept) | US1 | Phase 3 complete |

### Within Each User Story

- Backend service before controller
- Backend complete before frontend
- API methods before UI components
- Core implementation before integration

### Parallel Opportunities

**Phase 1 (Setup)**:
- T001 and T002 can run in parallel

**Phase 2 (Foundational)**:
- T003-T007 should run sequentially (entity → registration → service → controller → module)

**User Stories**:
- US1 and US2 can run in parallel once foundational is complete
- US3 and US4 can run in parallel (both depend on US2)
- Within each story: backend tasks before frontend tasks

---

## Parallel Example: Phase 1 Setup

```bash
# Launch both in parallel:
Task: "Add invitation-related types to packages/shared/src/types/auth.ts"
Task: "Export new types from packages/shared/src/types/index.ts"
```

## Parallel Example: User Stories 1 & 2

```bash
# After Phase 2, launch both user stories in parallel:
# US1 Track: T008 → T009 → T010 → T011 → T012 → T013 → T014
# US2 Track: T015 → T016 → T017 → T018 → T019
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (entity, service, controller skeletons)
3. Complete Phase 3: User Story 1 (invite flow)
4. Complete Phase 4: User Story 2 (view pending)
5. **STOP and VALIDATE**: Test invite + view flow independently
6. Deploy/demo MVP

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 + US2 → Test → Deploy (MVP: can invite and see pending)
3. Add US3 + US4 → Test → Deploy (manage pending invitations)
4. Add US5 → Test → Deploy (complete acceptance flow)
5. Add Polish → Final validation

### Single Developer Strategy

Recommended order for maximum value delivery:
1. **Phase 1-2**: Setup + Foundational
2. **Phase 3-4**: US1 + US2 together (invite + view - natural pair)
3. **Phase 7**: US5 (acceptance - completes core flow)
4. **Phase 5-6**: US3 + US4 (management features)
5. **Phase 8**: Polish

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | T001-T002 | Shared types |
| Phase 2: Foundational | T003-T007 | Entity, service, controller skeletons |
| Phase 3: US1 | T008-T014 | Invite non-registered user |
| Phase 4: US2 | T015-T019 | View pending invitations |
| Phase 5: US3 | T020-T023 | Revoke invitation |
| Phase 6: US4 | T024-T027 | Resend invitation |
| Phase 7: US5 | T028-T035 | Accept invitation |
| Phase 8: Polish | T036-T040 | Edge cases, validation |

**Total Tasks**: 40
**Completed Tasks**: 40/40 (100%)
**MVP Scope**: Phases 1-4 (19 tasks) - can invite users and see pending invitations

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No tests included (POC per constitution - testing deferred)
- Email functionality assumes existing email service is configured
- Token hashing uses bcrypt (available via better-auth dependencies)
- Commit after each task or logical group
