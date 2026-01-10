# Tasks: User Authentication & Authorization

**Input**: Design documents from `/specs/001-auth/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/

**Tests**: Backend auth tests required per user request (see Phase 8).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `packages/backend/src/`
- **Frontend**: `packages/frontend/src/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create base configuration for authentication

- [ ] T001 [P] Install better-auth dependencies in packages/backend/ (better-auth, @thallesp/nestjs-better-auth)
- [ ] T002 [P] Install better-auth client in packages/frontend/ (better-auth)
- [ ] T003 Add BETTER_AUTH_SECRET and BETTER_AUTH_URL to packages/backend/.env
- [ ] T004 Update packages/backend/src/main.ts to disable body parsing (bodyParser: false)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth infrastructure that MUST be complete before ANY user story can be implemented

**Critical**: This phase sets up the auth framework that all user stories depend on.

### Core Auth Infrastructure

- [ ] T005 Create AppRole type in packages/shared/src/types/auth.ts
- [ ] T006 Create UserAppRoleEntity in packages/backend/src/auth/user-app-role.entity.ts
- [ ] T007 Add userRoles relation to AppEntity in packages/backend/src/app/app.entity.ts
- [ ] T008 Create auth.module.ts with better-auth configuration in packages/backend/src/auth/auth.module.ts
- [ ] T009 Create @Public() decorator in packages/backend/src/auth/decorators/public.decorator.ts
- [ ] T010 Create @CurrentUser() decorator in packages/backend/src/auth/decorators/current-user.decorator.ts
- [ ] T011 Create AuthGuard in packages/backend/src/auth/auth.guard.ts
- [ ] T012 Register AuthModule and apply global auth guard in packages/backend/src/app.module.ts

### Security: Privacy-First Authorization

- [ ] T013 Create AppAccessGuard that returns 404 (not 403) for unauthorized access in packages/backend/src/auth/app-access.guard.ts
- [ ] T014 Create AppAccessService to check user-app permissions in packages/backend/src/auth/app-access.service.ts
- [ ] T015 Mark MCP controller routes as @Public() in packages/backend/src/mcp/ui.controller.ts
- [ ] T016 Update AppController to use AppAccessGuard for all app-specific routes in packages/backend/src/app/app.controller.ts
- [ ] T017 Update FlowController to use AppAccessGuard for all flow routes in packages/backend/src/flow/flow.controller.ts

### Frontend Auth

- [ ] T018 Create auth-client.ts in packages/frontend/src/lib/auth-client.ts
- [ ] T019 Create useAuth hook in packages/frontend/src/hooks/useAuth.ts

**Checkpoint**: Auth framework ready with privacy-first 404 responses - user story implementation can now begin

---

## Phase 3: User Story 1 - User Login + Seeded Admin (Priority: P1) MVP

**Goal**: Users can log in with email/password and access protected pages. Seeded admin user exists for first-time login.

**Independent Test**: Start fresh instance, navigate to any page, get redirected to /auth, log in as admin@manifest.build/admin, see home page with Test App.

### Implementation for User Story 1

- [ ] T020 [US1] Update seed.service.ts to create admin user via better-auth in packages/backend/src/seed/seed.service.ts
- [ ] T021 [US1] Create UserAppRole for admin user as owner of Test App in seed.service.ts
- [ ] T022 [P] [US1] Create AuthPage.tsx with login/signup tabs in packages/frontend/src/pages/AuthPage.tsx
- [ ] T023 [P] [US1] Create LoginForm.tsx component in packages/frontend/src/components/auth/LoginForm.tsx
- [ ] T024 [P] [US1] Create AuthTabs.tsx component for tab navigation in packages/frontend/src/components/auth/AuthTabs.tsx
- [ ] T025 [US1] Add /auth route and auth redirect logic in packages/frontend/src/App.tsx
- [ ] T026 [US1] Create AuthProvider wrapper for session state in packages/frontend/src/components/auth/AuthProvider.tsx
- [ ] T027 [US1] Wrap app with AuthProvider and protect routes in packages/frontend/src/App.tsx
- [ ] T028 [US1] Update Home.tsx to filter apps by user access in packages/frontend/src/pages/Home.tsx
- [ ] T029 [US1] Add getAppsForUser method to AppService in packages/backend/src/app/app.service.ts
- [ ] T030 [US1] Update AppController.listApps to filter by current user in packages/backend/src/app/app.controller.ts

**Checkpoint**: User Story 1 complete - login flow works end-to-end with seeded admin user

---

## Phase 4: User Story 2 - User Signup (Priority: P2)

**Goal**: New users can create accounts via the signup tab.

**Independent Test**: Navigate to /auth, switch to Sign Up tab, enter new email/password, submit, automatically logged in and redirected to home.

### Implementation for User Story 2

- [ ] T031 [P] [US2] Create SignupForm.tsx component in packages/frontend/src/components/auth/SignupForm.tsx
- [ ] T032 [US2] Add SignupForm to AuthPage tabs in packages/frontend/src/pages/AuthPage.tsx
- [ ] T033 [US2] Add form validation for email format and password length in SignupForm.tsx
- [ ] T034 [US2] Handle duplicate email error display in SignupForm.tsx

**Checkpoint**: User Story 2 complete - new users can register

---

## Phase 5: User Story 3 - Sidebar User Profile (Priority: P2)

**Goal**: Logged-in users see their email/initials in sidebar with logout access.

**Independent Test**: Log in, verify sidebar shows actual user email (not "Demo User"), click user area, logout option visible, logout works.

### Implementation for User Story 3

- [ ] T035 [US3] Update UserAvatar.tsx to use real auth data in packages/frontend/src/components/layout/UserAvatar.tsx
- [ ] T036 [US3] Add logout button/dropdown to UserAvatar component
- [ ] T037 [US3] Implement logout action that calls authClient.signOut() and redirects to /auth
- [ ] T038 [US3] Generate initials from user email in UserAvatar.tsx

**Checkpoint**: User Story 3 complete - real user profile in sidebar with logout

---

## Phase 6: User Story 4 - User Management for App (Priority: P3)

**Goal**: App owners/admins can add and remove users from their apps via a User Management tab.

**Independent Test**: Log in as admin, go to Test App, see "Users" tab, see admin@manifest.build as owner (non-removable), add new user, see them in list, remove them.

### Backend Implementation for User Story 4

- [ ] T039 [P] [US4] Create user-management.service.ts in packages/backend/src/auth/user-management.service.ts
- [ ] T040 [P] [US4] Create user-management.controller.ts in packages/backend/src/auth/user-management.controller.ts
- [ ] T041 [US4] Implement GET /apps/:appId/users endpoint (list users with roles, return 404 if no access)
- [ ] T042 [US4] Implement POST /apps/:appId/users endpoint (add user by email, return 404 if no access)
- [ ] T043 [US4] Implement DELETE /apps/:appId/users/:userId endpoint (remove non-owner, return 404 if no access)
- [ ] T044 [US4] Implement GET /users/search endpoint (find user by email)
- [ ] T045 [US4] Add authorization check: only owners/admins can manage users (return 404 for others)

### Frontend Implementation for User Story 4

- [ ] T046 [P] [US4] Create UserManagement.tsx component in packages/frontend/src/components/app/UserManagement.tsx
- [ ] T047 [US4] Add "Users" tab to AppDetail.tsx in packages/frontend/src/pages/AppDetail.tsx
- [ ] T048 [US4] Implement user list display with email, role, and remove button
- [ ] T049 [US4] Implement owner badge/indicator with disabled remove button
- [ ] T050 [US4] Implement "Add User" form with email input and role dropdown
- [ ] T051 [US4] Add API methods to packages/frontend/src/lib/api.ts for user management endpoints
- [ ] T052 [US4] Handle error cases: user not found, already has access, cannot remove owner

**Checkpoint**: User Story 4 complete - full user management functionality

---

## Phase 7: Backend Auth Tests

**Purpose**: Verify authentication and authorization logic with unit and integration tests

**Goal**: Achieve >80% coverage on auth-related code paths

### Unit Tests

- [ ] T053 [P] Create auth.guard.spec.ts in packages/backend/tests/auth/auth.guard.spec.ts
- [ ] T054 [P] Create app-access.guard.spec.ts in packages/backend/tests/auth/app-access.guard.spec.ts
- [ ] T055 [P] Create app-access.service.spec.ts in packages/backend/tests/auth/app-access.service.spec.ts
- [ ] T056 Test AuthGuard rejects unauthenticated requests with 401
- [ ] T057 Test AuthGuard allows requests with valid session
- [ ] T058 Test @Public() decorator bypasses AuthGuard
- [ ] T059 Test AppAccessGuard returns 404 (not 403) for unauthorized app access
- [ ] T060 Test AppAccessGuard allows access for users with valid role

### Integration Tests

- [ ] T061 Create auth.e2e-spec.ts in packages/backend/tests/auth/auth.e2e-spec.ts
- [ ] T062 Test unauthenticated request to /api/apps returns 401
- [ ] T063 Test authenticated request to app without permission returns 404
- [ ] T064 Test authenticated request to app with permission returns data
- [ ] T065 Test MCP endpoints (/servers/*) are accessible without authentication
- [ ] T066 Test flow endpoints return 404 when user lacks access to parent app

**Checkpoint**: Auth tests complete with >80% coverage on auth logic

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T067 [P] Add error handling for session expiry (redirect to /auth)
- [ ] T068 [P] Add loading states during auth operations
- [ ] T069 Handle edge case: accessing app without permission (frontend shows 404 page)
- [ ] T070 Assign existing apps to admin user during migration (for upgrades from pre-auth versions)
- [ ] T071 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
┌───────────────────────────────────────────┐
│  User Stories can proceed in parallel:    │
│                                           │
│  Phase 3: US1 - Login + Seed (P1) ← MVP  │
│      ↓                                    │
│  Phase 4: US2 - Signup (P2)              │
│  Phase 5: US3 - Sidebar Profile (P2)     │
│      ↓                                    │
│  Phase 6: US4 - User Management (P3)     │
└───────────────────────────────────────────┘
    ↓
Phase 7: Backend Auth Tests (can start after Phase 2)
    ↓
Phase 8: Polish
```

### User Story Dependencies

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|------------------------------|
| US1 (Login + Seed) | Phase 2 complete | None - standalone MVP |
| US2 (Signup) | Phase 2 complete | None - can run parallel to US1 |
| US3 (Sidebar Profile) | Phase 2 complete | Uses useAuth from US1, but independently testable |
| US4 (User Management) | Phase 2 complete | Requires users to exist (US1 seed or US2 signup) |

### Within Each User Story

1. Backend before frontend (services before UI)
2. Entities before services
3. Services before controllers
4. Controllers before frontend integration
5. Core implementation before edge cases

### Parallel Opportunities

**Phase 1 (Setup):**
```
T001 [Install backend deps] ─┬─ parallel
T002 [Install frontend deps] ─┘
```

**Phase 2 (Foundational):**
```
T005-T012 [Backend auth core] sequential
T013-T017 [Security guards & controller updates] can start once T012 complete
T018-T019 [Frontend auth] can start once T008 complete
```

**Phase 3 (US1):**
```
T020-T021 [Seed] sequential
T022, T023, T024 [Auth components] ─┬─ parallel
T025-T030 [Integration] sequential  ─┘
```

**Phase 6 (US4):**
```
T039 [Service] ─┬─ parallel ─→ T041-T045 [Endpoints] sequential
T040 [Controller] ─┘
T046 [UI Component] ─→ T047-T052 [Integration] sequential
```

**Phase 7 (Tests):**
```
T053, T054, T055 [Test file creation] ─┬─ parallel
T056-T060 [Unit tests] sequential      │
T061-T066 [Integration tests] sequential ─┘
```

---

## Parallel Example: Phase 3 Components

```bash
# Launch all auth components in parallel:
Task: "Create AuthPage.tsx in packages/frontend/src/pages/AuthPage.tsx"
Task: "Create LoginForm.tsx in packages/frontend/src/components/auth/LoginForm.tsx"
Task: "Create AuthTabs.tsx in packages/frontend/src/components/auth/AuthTabs.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T019) **CRITICAL - includes security guards**
3. Complete Phase 3: User Story 1 (T020-T030)
4. **STOP and VALIDATE**: Login works, seeded admin can access Test App
5. Deploy/demo if ready

### Incremental Delivery

| Increment | Stories Included | Value Delivered |
|-----------|------------------|-----------------|
| MVP | US1 (Login + Seed) | Protected app, admin can log in |
| +Signup | US1 + US2 | New users can register |
| +Profile | US1 + US2 + US3 | Real user identity in UI |
| Full | All stories | Multi-user collaboration |

### Suggested Stopping Points

1. **After Phase 2**: Auth framework verified, routes protected, 404 privacy in place
2. **After Phase 3 (MVP)**: Admin can log in and see apps
3. **After Phase 4**: New users can register
4. **After Phase 5**: User identity visible throughout app
5. **After Phase 6**: Full user management for collaboration
6. **After Phase 7**: All auth tests passing with >80% coverage

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1: Setup | 4 | - |
| Phase 2: Foundational | 15 | - |
| Phase 3: US1 Login + Seed | 11 | US1 |
| Phase 4: US2 Signup | 4 | US2 |
| Phase 5: US3 Sidebar Profile | 4 | US3 |
| Phase 6: US4 User Management | 14 | US4 |
| Phase 7: Backend Auth Tests | 14 | - |
| Phase 8: Polish | 5 | - |
| **Total** | **71** | |

### Per User Story

| User Story | Priority | Task Count |
|------------|----------|------------|
| US1 - User Login + Seeded Admin | P1 | 11 |
| US2 - User Signup | P2 | 4 |
| US3 - Sidebar User Profile | P2 | 4 |
| US4 - User Management for App | P3 | 14 |

### Security Tasks

| Task Category | Description | Count |
|---------------|-------------|-------|
| AppAccessGuard | Returns 404 for unauthorized access | 2 |
| MCP Public Routes | Mark /servers/* as public | 1 |
| Controller Updates | Apply AppAccessGuard | 2 |
| Auth Tests | Unit + integration tests | 14 |

---

## Notes

- [P] tasks = different files, no dependencies within same phase
- [Story] label maps task to specific user story
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Security**: All unauthorized access returns 404 (not 403) to prevent resource enumeration
- **MCP**: Endpoints under /servers/* remain public for external client access
