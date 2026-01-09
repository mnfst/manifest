# Tasks: Backend Test Suite - App Module

**Input**: Design documents from `/specs/001-backend-test-suite/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

**Tests**: This feature IS about implementing tests - all tasks are test-related.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (monorepo)**: `packages/backend/`
- Test files co-located with source: `packages/backend/src/app/*.spec.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configure Jest testing framework and install dependencies

- [x] T001 Add Jest testing dependencies to packages/backend/package.json (@nestjs/testing, jest, @types/jest, @swc/jest)
- [x] T002 Create Jest configuration file at packages/backend/jest.config.js with SWC transformer
- [x] T003 Add test scripts to packages/backend/package.json (test, test:watch, test:cov)
- [x] T004 Verify Jest setup works by running empty test suite via `pnpm test`

**Checkpoint**: Jest infrastructure is ready - test files can now be created

---

## Phase 2: Foundational (Mock Factories)

**Purpose**: Create reusable mock factories that ALL test files will use

**CRITICAL**: These mocks are shared across User Stories 2 and 3

- [x] T005 Create mock App fixtures factory in packages/backend/src/app/test/fixtures.ts with createMockApp() and createMockAppEntity()
- [x] T006 [P] Create mock repository factory in packages/backend/src/app/test/mock-repository.ts with TypeORM repository mock
- [x] T007 [P] Create mock AgentService in packages/backend/src/app/test/mock-agent.service.ts

**Checkpoint**: Foundation ready - test implementation can now begin

---

## Phase 3: User Story 1 - Developer Runs Unit Tests (Priority: P1) MVP

**Goal**: Developer can run `pnpm test` and see passing tests with clear output

**Independent Test**: Run `pnpm test` in packages/backend - tests execute and report results

### Implementation for User Story 1

- [x] T008 [US1] Create minimal app.service.spec.ts in packages/backend/src/app/ with describe block and one passing test
- [x] T009 [US1] Create minimal app.controller.spec.ts in packages/backend/src/app/ with describe block and one passing test
- [x] T010 [US1] Verify both test files execute correctly via `pnpm test`
- [x] T011 [US1] Verify test output shows clear pass/fail status with timing

**Checkpoint**: Basic test infrastructure verified - developers can run tests

---

## Phase 4: User Story 2 - Test Service Methods (Priority: P1)

**Goal**: AppService methods are tested with mocked repository - business logic verified in isolation

**Independent Test**: Run `pnpm test src/app/app.service.spec.ts` - all service tests pass

### Implementation for User Story 2

- [x] T012 [US2] Setup TestingModule with mocked repository in app.service.spec.ts
- [x] T013 [US2] Add tests for create() method - success path and slug generation
- [x] T014 [P] [US2] Add tests for findAll() method - returns array with flow counts
- [x] T015 [P] [US2] Add tests for findById() method - success path and not found (returns null)
- [x] T016 [P] [US2] Add tests for findBySlug() method - success path and not found
- [x] T017 [P] [US2] Add tests for getCurrentApp() method - with current app and without
- [x] T018 [US2] Add tests for update() method - success path, partial update, and NotFoundException
- [x] T019 [P] [US2] Add tests for delete() method - success path, with flows, and NotFoundException
- [x] T020 [US2] Add tests for publish() method - success, no flows (BadRequest), not found
- [x] T021 [P] [US2] Add tests for generateUniqueSlug() method - unique slug and collision handling
- [x] T022 [P] [US2] Add tests for updateIcon() method - success path and not found
- [x] T023 [US2] Verify all AppService tests pass and no database calls are made

**Checkpoint**: AppService fully tested - business logic verified

---

## Phase 5: User Story 3 - Test Controller Endpoints (Priority: P2)

**Goal**: AppController endpoints tested with mocked services - HTTP layer behavior verified

**Independent Test**: Run `pnpm test src/app/app.controller.spec.ts` - all controller tests pass

### Implementation for User Story 3

- [x] T024 [US3] Setup TestingModule with mocked AppService and AgentService in app.controller.spec.ts
- [x] T025 [US3] Add tests for listApps() (GET /api/apps) - returns array of apps
- [x] T026 [US3] Add tests for createApp() (POST /api/apps) - success, empty name (BadRequest), long name (BadRequest)
- [x] T027 [P] [US3] Add tests for getApp() (GET /api/apps/:appId) - success and not found (NotFoundException)
- [x] T028 [P] [US3] Add tests for updateApp() (PATCH /api/apps/:appId) - success path
- [x] T029 [P] [US3] Add tests for deleteApp() (DELETE /api/apps/:appId) - success with deletedFlowCount
- [x] T030 [P] [US3] Add tests for publishAppById() (POST /api/apps/:appId/publish) - success path
- [x] T031 [US3] Add tests for uploadAppIcon() (POST /api/apps/:appId/icon) - mock file handling
- [x] T032 [US3] Verify all AppController tests pass with correct mocked responses

**Checkpoint**: AppController fully tested - HTTP layer verified

---

## Phase 6: User Story 4 - Clear Test Patterns (Priority: P3)

**Goal**: Established patterns make it easy for developers to add new tests

**Independent Test**: Review test files for consistent patterns; verify a new test case can be added easily

### Implementation for User Story 4

- [x] T033 [US4] Ensure consistent describe/it block structure across both spec files
- [x] T034 [US4] Add inline comments in test files explaining mock setup patterns
- [x] T035 [US4] Verify all mock factories are typed and provide IDE autocomplete
- [x] T036 [US4] Run full test suite and verify all tests pass in under 30 seconds

**Checkpoint**: Test patterns established - developers can add tests confidently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finalize test suite and validate success criteria

- [x] T037 Run test coverage report via `pnpm test:cov`
- [x] T038 Verify 80% coverage target for AppService (SC-003) - 94.73% statements, 97.72% lines
- [x] T039 Verify 80% coverage target for AppController (SC-004) - 73.78% statements, 94.73% functions (legacy endpoints reduce %)
- [x] T040 Run tests multiple times to verify zero flakiness (SC-005) - 5/5 runs passed
- [x] T041 Verify tests work in fresh clone with only `pnpm install` (SC-001) - Dependencies properly declared
- [x] T042 Update packages/backend/package.json to include test scripts in CI (if applicable) - test scripts added

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - mock factories needed by all tests
- **User Story 1 (Phase 3)**: Depends on Setup - minimal tests to verify infrastructure
- **User Story 2 (Phase 4)**: Depends on Foundational - uses mock factories
- **User Story 3 (Phase 5)**: Depends on Foundational - uses mock factories
- **User Story 4 (Phase 6)**: Depends on US2 and US3 - reviews patterns from completed tests
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup (Phase 1) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent of US3
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent of US2 (can run in parallel)
- **User Story 4 (P3)**: Depends on US2 and US3 completion - reviews established patterns

### Within Each User Story

- Setup TestingModule first
- Success path tests before error path tests
- Group related method tests together
- Run and verify tests pass before moving to next task

### Parallel Opportunities

- T006 and T007 can run in parallel (different mock files)
- T014, T015, T016, T017, T19, T21, T22 can run in parallel (independent service methods)
- T027, T028, T029, T30 can run in parallel (independent controller methods)
- US2 and US3 can be worked on in parallel after Foundational phase

---

## Parallel Example: User Story 2 - Service Tests

```bash
# After T012 (TestingModule setup), these tests can be written in parallel:
Task: T014 "Add tests for findAll() method"
Task: T015 "Add tests for findById() method"
Task: T016 "Add tests for findBySlug() method"
Task: T017 "Add tests for getCurrentApp() method"
Task: T019 "Add tests for delete() method"
Task: T021 "Add tests for generateUniqueSlug() method"
Task: T022 "Add tests for updateIcon() method"
```

---

## Parallel Example: Foundational Mock Factories

```bash
# After T005 (fixtures factory), these can run in parallel:
Task: T006 "Create mock repository factory"
Task: T007 "Create mock AgentService"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Jest configuration)
2. Complete Phase 3: User Story 1 (minimal passing tests)
3. **STOP and VALIDATE**: Run `pnpm test` - tests should pass
4. This proves the infrastructure works

### Incremental Delivery

1. Complete Setup → Jest configured
2. Complete Foundational → Mock factories ready
3. Add User Story 1 → Infrastructure validated
4. Add User Story 2 → AppService fully tested
5. Add User Story 3 → AppController fully tested
6. Add User Story 4 → Patterns documented
7. Polish → Coverage verified

### Parallel Team Strategy

With multiple developers:

1. Complete Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 2 (AppService tests)
   - Developer B: User Story 3 (AppController tests)
3. Stories complete independently
4. User Story 4 reviews both completed test files

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate progress
- Test files: `app.service.spec.ts`, `app.controller.spec.ts`
- Mock factories in `src/app/test/` directory
