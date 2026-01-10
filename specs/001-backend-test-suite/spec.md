# Feature Specification: Backend Test Suite - App Module

**Feature Branch**: `001-backend-test-suite`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "I would like to implement a test suite progressively, starting from the backend. I would like to follow NestJS convention https://docs.nestjs.com/fundamentals/testing and start creating backend only tests with Jest and for the app module only to start."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Runs Unit Tests for App Module (Priority: P1)

As a developer, I want to run unit tests for the App module (AppController and AppService) so that I can verify individual components work correctly in isolation before integrating them.

**Why this priority**: Unit tests form the foundation of a reliable test suite. Starting with the App module's core components (controller and service) establishes patterns that can be replicated across other modules. This provides immediate confidence in critical CRUD operations.

**Independent Test**: Can be fully tested by running `pnpm test` in the backend package and verifying that AppController and AppService unit tests pass with mocked dependencies.

**Acceptance Scenarios**:

1. **Given** the backend project has Jest configured, **When** a developer runs the test command, **Then** unit tests for AppService execute and report pass/fail status with clear output.
2. **Given** unit tests exist for AppController, **When** tests are run, **Then** each endpoint handler is tested with mocked service responses and HTTP status codes are verified.
3. **Given** a new developer clones the repository, **When** they run tests without additional setup beyond package installation, **Then** all tests pass in under 30 seconds.

---

### User Story 2 - Developer Tests Service Methods in Isolation (Priority: P1)

As a developer, I want AppService methods tested with mocked repository dependencies so that I can verify business logic without needing a real database.

**Why this priority**: Service methods contain core business logic. Testing them in isolation ensures logic correctness independent of database state.

**Independent Test**: Can run AppService tests with a mocked TypeORM repository and verify all CRUD methods behave correctly.

**Acceptance Scenarios**:

1. **Given** AppService depends on TypeORM Repository, **When** tests run, **Then** the repository is mocked and no actual database calls are made.
2. **Given** the `create` method is called with valid input, **When** tested, **Then** it returns the expected App object with all required fields.
3. **Given** the `findById` method is called with a non-existent ID, **When** tested, **Then** it returns null as expected.
4. **Given** the `update` method is called with invalid ID, **When** tested, **Then** it throws NotFoundException.

---

### User Story 3 - Developer Tests Controller Endpoints (Priority: P2)

As a developer, I want AppController endpoints tested with mocked service dependencies so that I can verify HTTP layer behavior, validation, and error handling.

**Why this priority**: Controller tests verify the HTTP contract including status codes, request validation, and proper error responses. This is critical for API consumers.

**Independent Test**: Can run AppController tests verifying each endpoint returns correct HTTP status codes and response shapes.

**Acceptance Scenarios**:

1. **Given** a GET request to `/api/apps`, **When** tested with mocked service, **Then** response status is 200 and returns an array.
2. **Given** a POST request to `/api/apps` with invalid body (empty name), **When** tested, **Then** response status is 400 (BadRequest).
3. **Given** a GET request to `/api/apps/:appId` with non-existent ID, **When** tested with service returning null, **Then** response status is 404 (NotFound).
4. **Given** a DELETE request to `/api/apps/:appId`, **When** tested, **Then** response status is 200 and includes deletedFlowCount.

---

### User Story 4 - Developer Adds Tests for New Features (Priority: P3)

As a developer working on new features, I want clear test patterns and examples so that I can easily add tests following established conventions.

**Why this priority**: Sustainability of the test suite depends on developers being able to add tests easily. Clear patterns reduce friction.

**Independent Test**: Can be verified by reviewing test file structure and documentation, and successfully adding a new test case following existing patterns.

**Acceptance Scenarios**:

1. **Given** existing test files follow NestJS conventions (`.spec.ts` suffix, co-located with source), **When** a developer adds a new test, **Then** they can follow the established pattern.
2. **Given** test utilities are set up for common mocking patterns, **When** creating new tests, **Then** developers can reuse existing mock factories.

---

### Edge Cases

- What happens when tests run without environment variables configured?
  - Tests should work with defaults or mocked values; no real environment configuration should be required for unit tests.
- How does the test suite handle database-related tests without a real database?
  - Repository mocks ensure no database is needed for unit tests.
- What happens when external services (AgentService) are dependencies?
  - External dependencies are mocked at the module level in the testing setup.
- How are async operations and promises handled in tests?
  - Jest's async/await support handles promise-based assertions correctly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST configure Jest as the test runner following NestJS conventions.
- **FR-002**: System MUST include test files with `.spec.ts` suffix co-located with source files in `packages/backend/src/app/`.
- **FR-003**: System MUST provide unit tests for `AppService` with mocked TypeORM repository.
- **FR-004**: System MUST provide unit tests for `AppController` with mocked `AppService` and `AgentService`.
- **FR-005**: Tests MUST run without requiring an actual database connection.
- **FR-006**: Tests MUST use NestJS Testing Module (`@nestjs/testing`) for dependency injection setup.
- **FR-007**: System MUST provide a test script in `package.json` that runs all tests via Jest.
- **FR-008**: Tests MUST cover success paths and error paths (exceptions, validation failures).
- **FR-009**: Test setup MUST mock external dependencies (AgentService, file system operations for icon upload).

### Key Entities

- **AppService**: Core business logic service handling App CRUD operations, slug generation, and session management.
- **AppController**: HTTP layer handling endpoints for apps management, icon uploads, and legacy endpoints.
- **AppEntity**: TypeORM entity representing the App domain object.
- **TestingModule**: NestJS testing utility for creating isolated test contexts with dependency injection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All unit tests pass when running the test command in a fresh clone with only `pnpm install` as setup.
- **SC-002**: Test execution completes in under 30 seconds for the App module tests.
- **SC-003**: At least 80% of AppService public methods have corresponding test coverage.
- **SC-004**: At least 80% of AppController endpoints have corresponding test coverage.
- **SC-005**: Zero test flakiness - tests pass consistently on repeated runs without database or network dependencies.
- **SC-006**: Test files follow NestJS naming convention (`*.spec.ts`) and are co-located with source files.

## Assumptions

- Jest is the preferred test framework as it's the NestJS default and widely adopted.
- Unit tests focus on isolated component testing with mocked dependencies (not integration/e2e tests at this phase).
- The test configuration will be added to the existing `packages/backend/package.json`.
- Tests will use TypeScript directly (Jest configured with ts-jest or SWC transformer).
- The scope is limited to the App module (AppService, AppController) as stated by the user - other modules will be tested in subsequent phases.
- NestJS testing utilities (`@nestjs/testing`) will be used for creating test modules with proper dependency injection.
