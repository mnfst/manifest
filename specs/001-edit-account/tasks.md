# Tasks: Edit Account

**Input**: Design documents from `/specs/001-edit-account/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml

**Tests**: POC phase - manual testing only (per constitution). No automated test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types and DTOs that all user stories depend on

- [x] T001 [P] Add UpdateProfileRequest, UpdateProfileResponse types to packages/shared/src/types/auth.ts
- [x] T002 [P] Add ChangeEmailRequest, ChangeEmailResponse, VerifyEmailChangeRequest, VerifyEmailChangeResponse types to packages/shared/src/types/auth.ts
- [x] T003 [P] Add ChangePasswordRequest, ChangePasswordResponse types to packages/shared/src/types/auth.ts
- [x] T004 [P] Extend UserProfile interface with firstName and lastName fields in packages/shared/src/types/auth.ts
- [x] T005 [P] Add EMAIL_CHANGE_VERIFICATION to EmailTemplateType enum in packages/shared/src/types/email.ts
- [x] T006 [P] Add EmailChangeVerificationEmailProps interface to packages/shared/src/types/email.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create EmailVerificationToken TypeORM entity in packages/backend/src/auth/entities/email-verification-token.entity.ts
- [x] T008 Register EmailVerificationToken entity in TypeORM configuration in packages/backend/src/app/app.module.ts
- [x] T009 Create UpdateProfileDto class with validation in packages/backend/src/auth/dto/update-profile.dto.ts
- [x] T010 [P] Create ChangeEmailDto class with validation in packages/backend/src/auth/dto/change-email.dto.ts
- [x] T011 [P] Create VerifyEmailChangeDto class with validation in packages/backend/src/auth/dto/verify-email-change.dto.ts
- [x] T012 [P] Create ChangePasswordDto class with validation in packages/backend/src/auth/dto/change-password.dto.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Access Edit Account Page (Priority: P1) 🎯 MVP

**Goal**: User can navigate to the Edit Account page from the sidebar dropdown and see their current profile data pre-populated.

**Independent Test**: Click user avatar in sidebar → Select "Edit Account" → Verify page loads with current first name, last name, and email pre-filled.

### Implementation for User Story 1

- [x] T013 [US1] Add "Edit Account" menu item to UserAvatar dropdown in packages/frontend/src/components/layout/UserAvatar.tsx
- [x] T014 [US1] Create AccountTab component with profile form layout in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T015 [US1] Add "Account" tab configuration to SettingsPage tabs array in packages/frontend/src/pages/SettingsPage.tsx
- [x] T016 [US1] Import and render AccountTab in SettingsPage when account tab is selected in packages/frontend/src/pages/SettingsPage.tsx
- [x] T017 [US1] Fetch and display current user profile data in AccountTab form fields in packages/frontend/src/components/settings/AccountTab.tsx

**Checkpoint**: User Story 1 complete - user can navigate to Edit Account page and see pre-filled form

---

## Phase 4: User Story 2 - Update Personal Information (Priority: P1) 🎯 MVP

**Goal**: User can update their first name and/or last name, save changes, and see updates reflected in sidebar.

**Independent Test**: Change first name from "John" to "Jonathan" → Click Save → Verify sidebar shows "Jonathan" and page reload preserves the change.

### Implementation for User Story 2

- [x] T018 [US2] Implement updateProfile method in UserManagementService to update firstName/lastName via better-sqlite3 in packages/backend/src/auth/user-management.service.ts
- [x] T019 [US2] Add PATCH /users/me endpoint for profile update in packages/backend/src/auth/user-management.controller.ts
- [x] T020 [US2] Add updateProfile API method to frontend API client in packages/frontend/src/lib/api.ts
- [x] T021 [US2] Implement profile update form submission in AccountTab with validation (at least one name required) in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T022 [US2] Add success/error toast notifications for profile update in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T023 [US2] Refresh auth context after profile update to reflect changes in sidebar in packages/frontend/src/components/settings/AccountTab.tsx

**Checkpoint**: User Story 2 complete - user can update name and see changes throughout app

---

## Phase 5: User Story 3 - Change Email Address (Priority: P2)

**Goal**: User can request email change, receive verification email, click link, and have email updated.

**Independent Test**: Enter new email → Click Save → Check console for verification email → Open verification link → Verify email is updated and can log in with new email.

### Implementation for User Story 3

- [x] T024 [P] [US3] Create EmailChangeVerification React Email template in packages/backend/src/email/templates/email-change-verification.tsx
- [x] T025 [US3] Register EmailChangeVerification template in template engine registry in packages/backend/src/email/templates/engine/react-email.engine.ts
- [x] T026 [US3] Add sendEmailChangeVerification method to EmailService in packages/backend/src/email/email.service.ts
- [x] T027 [US3] Implement requestEmailChange method in UserManagementService (create token, invalidate previous, check email uniqueness) in packages/backend/src/auth/user-management.service.ts
- [x] T028 [US3] Implement verifyEmailChange method in UserManagementService (validate token, update email, mark used) in packages/backend/src/auth/user-management.service.ts
- [x] T029 [US3] Add POST /users/me/email endpoint for email change request in packages/backend/src/auth/user-management.controller.ts
- [x] T030 [US3] Add POST /users/me/email/verify endpoint for email verification in packages/backend/src/auth/user-management.controller.ts
- [x] T031 [US3] Add requestEmailChange and verifyEmailChange API methods to frontend API client in packages/frontend/src/lib/api.ts
- [x] T032 [US3] Add email change section to AccountTab with new email input and status message in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T033 [US3] Create email verification callback page/route to handle verification link clicks in packages/frontend/src/pages/VerifyEmailChangePage.tsx
- [x] T034 [US3] Add route for email verification callback in packages/frontend/src/App.tsx or router configuration

**Checkpoint**: User Story 3 complete - user can change email with verification flow

---

## Phase 6: User Story 4 - Change Password (Priority: P3)

**Goal**: User can change password by providing current password and new password.

**Independent Test**: Enter current password and new password → Click Save → Log out → Log in with new password succeeds.

### Implementation for User Story 4

- [x] T035 [US4] Implement changePassword method in UserManagementService using better-auth changePassword API in packages/backend/src/auth/user-management.service.ts
- [x] T036 [US4] Add POST /users/me/password endpoint for password change in packages/backend/src/auth/user-management.controller.ts
- [x] T037 [US4] Add changePassword API method to frontend API client in packages/frontend/src/lib/api.ts
- [x] T038 [US4] Add password change section to AccountTab with current password, new password fields in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T039 [US4] Implement password validation (min 8 chars) and empty field handling (skip if empty) in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T040 [US4] Add success/error handling for password change with appropriate messages in packages/frontend/src/components/settings/AccountTab.tsx

**Checkpoint**: User Story 4 complete - user can change password with verification

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [x] T041 Add form validation for all fields (email format, password length, name requirements) across AccountTab in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T042 Handle "no changes" scenario - detect unchanged fields and skip unnecessary API calls in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T043 Add loading states to save buttons during API calls in packages/frontend/src/components/settings/AccountTab.tsx
- [x] T044 Clean up expired email verification tokens (background job or on-demand) in packages/backend/src/auth/user-management.service.ts
- [ ] T045 Run serve script and perform manual testing per quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority and can run in parallel after Foundation
  - US3 (P2) can start after Foundation, but may integrate with US1/US2
  - US4 (P3) can start after Foundation
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Access Edit Account Page
  - Can start after Foundational (Phase 2) - No dependencies on other stories
  - Creates the AccountTab shell that other stories extend

- **User Story 2 (P1)**: Update Personal Information
  - Can start after Foundational (Phase 2)
  - Works best after US1 (AccountTab exists), but backend can be built in parallel

- **User Story 3 (P2)**: Change Email Address
  - Can start after Foundational (Phase 2)
  - Adds to AccountTab from US1
  - Independent email verification flow

- **User Story 4 (P3)**: Change Password
  - Can start after Foundational (Phase 2)
  - Adds to AccountTab from US1
  - Uses better-auth's built-in password change

### Within Each User Story

- Backend before frontend for API-dependent features
- Types/DTOs must exist before service implementation
- Service methods before controller endpoints
- API client methods before frontend form submission

### Parallel Opportunities

**Phase 1 (Setup)**: All T001-T006 can run in parallel (different type files)

**Phase 2 (Foundational)**: T010-T012 can run in parallel (separate DTO files)

**Phase 3-6 (User Stories)**:
- Backend and frontend tasks can often run in parallel if API contract is known
- US1, US2, US3, US4 backend work can proceed in parallel
- Frontend tasks within each story should be sequential

---

## Parallel Example: Setup Phase

```bash
# Launch all shared type updates in parallel:
Task: "Add UpdateProfileRequest types to packages/shared/src/types/auth.ts"
Task: "Add EMAIL_CHANGE_VERIFICATION to packages/shared/src/types/email.ts"
```

## Parallel Example: Foundational Phase

```bash
# Launch all DTO creation in parallel:
Task: "Create ChangeEmailDto in packages/backend/src/auth/dto/change-email.dto.ts"
Task: "Create VerifyEmailChangeDto in packages/backend/src/auth/dto/verify-email-change.dto.ts"
Task: "Create ChangePasswordDto in packages/backend/src/auth/dto/change-password.dto.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (entity, DTOs)
3. Complete Phase 3: User Story 1 (navigation + page)
4. Complete Phase 4: User Story 2 (name update)
5. **STOP and VALIDATE**: Test navigation and name update flow
6. Deploy/demo if ready - users can now edit their name

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 → Test independently → MVP! (Navigate + Name update)
3. Add US3 → Test email change flow → Deploy/Demo (Email change)
4. Add US4 → Test password change → Deploy/Demo (Password change)
5. Polish → Full feature complete

### Single Developer Strategy

Execute phases sequentially in order: 1 → 2 → 3 → 4 → 5 → 6 → 7

Priority: US1 and US2 together form MVP, US3 adds security-critical email change, US4 completes the feature.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- POC phase: Manual testing only - run quickstart.md validation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- After Phase 7, run `.specify/scripts/bash/serve-app.sh` for testing (per constitution Auto-Serve requirement)
