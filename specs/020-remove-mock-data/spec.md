# Feature Specification: Remove Mock Data and Add Default Test Fixtures

**Feature Branch**: `020-remove-mock-data`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "I want to remove everything related to the mock data. When we create an interface node there should be no mock data node. Also remove the mock data generation code from the agent, the APIs and so on. Make sure that there is nothing left regarding that usage. Also I want you to create a dummy app and and dummy flow by default so i do not have to do it everytime i test a PR."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Interface Node Without Mock Data (Priority: P1)

As a developer building flows, I want to create interface nodes that focus purely on layout configuration without automatic mock data generation, so that the interface design is decoupled from sample data concerns.

**Why this priority**: This is the core of the feature - eliminating the automatic coupling between interface nodes and mock data. Every other change depends on this fundamental behavior change.

**Independent Test**: Can be fully tested by creating a new interface node in a flow and verifying no mock data node appears, no mock data is stored in parameters, and the interface node functions correctly with just layout configuration.

**Acceptance Scenarios**:

1. **Given** a user is on the flow editor, **When** they create a new Interface node, **Then** only the Interface node is created without any accompanying mock data node or mock data in parameters
2. **Given** a user selects a layout template for an Interface node, **When** they save the node, **Then** the node contains only the layout configuration without any mock data fields
3. **Given** an Interface node exists in a flow, **When** a user views or edits the node, **Then** there are no mock data editing options or mock data preview sections

---

### User Story 2 - Default Test App and Flow on Startup (Priority: P2)

As a developer testing PRs, I want a default dummy app and flow to be automatically created and available when I start the application, so that I can immediately begin testing without manual setup steps.

**Why this priority**: This directly addresses the developer experience pain point of having to manually create test data for every PR review. It's second priority because it's about convenience rather than core functionality change.

**Independent Test**: Can be fully tested by starting a fresh instance of the application and verifying a default app and flow exist without any manual intervention.

**Acceptance Scenarios**:

1. **Given** the application starts with an empty database, **When** the application initialization completes, **Then** a default test app named "Test App" exists with a default flow named "Test Flow"
2. **Given** a developer opens the application after a fresh deployment, **When** they navigate to the apps list, **Then** they see the default "Test App" ready for use
3. **Given** the default test app exists, **When** a developer opens it, **Then** it contains a "Test Flow" with a basic flow structure ready for testing

---

### User Story 3 - Clean Codebase Without Mock Data Artifacts (Priority: P3)

As a maintainer of the codebase, I want all mock data related code, types, components, and APIs to be completely removed, so that the codebase is clean, easier to maintain, and has no dead code related to deprecated functionality.

**Why this priority**: This is cleanup work that ensures technical debt is not accumulated. While important for long-term maintainability, it can be done after the functional changes are complete.

**Independent Test**: Can be verified by searching the codebase for "mock" references and confirming all mock data related code has been removed, and that the application compiles and runs without errors.

**Acceptance Scenarios**:

1. **Given** the mock data removal is complete, **When** a developer searches for "mockData" or "mock-data" in the codebase, **Then** no functional code references are found (only this spec or migration notes may reference the term)
2. **Given** all mock data code has been removed, **When** the application is built, **Then** the build succeeds without errors or warnings related to missing mock data types/functions
3. **Given** the agent service previously used mock data generation, **When** apps are generated via the agent, **Then** the generation completes successfully without invoking any mock data tools

---

### Edge Cases

- What happens to existing flows with Interface nodes that have mock data stored? The mock data field should be ignored/dropped when loading, and not saved on subsequent updates.
- What happens if the default test fixtures already exist when the app starts? The seeding should be idempotent - skip creation if fixtures already exist.
- What happens to layout rendering when no mock data is provided? Layout components should gracefully handle undefined/null mock data, showing empty states or placeholder content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST NOT create mock data nodes when Interface nodes are created
- **FR-002**: System MUST NOT include mock data in Interface node parameters
- **FR-003**: System MUST remove the mock data generator tool from the agent tools
- **FR-004**: System MUST remove mock data generation from the app generation workflow
- **FR-005**: System MUST remove mock data chat/regeneration functionality from the agent service
- **FR-006**: System MUST remove MockDataModal component from the frontend
- **FR-007**: System MUST remove MockDataNode component from the frontend
- **FR-008**: System MUST remove mock data type definitions from shared types (MockData, TableMockData, PostListMockData, DEFAULT_TABLE_MOCK_DATA, DEFAULT_POST_LIST_MOCK_DATA)
- **FR-009**: System MUST update InterfaceNode definition to remove mockData from defaultParameters
- **FR-010**: System MUST update NodeEditModal to not generate or update mockData
- **FR-011**: System MUST update LayoutRenderer and VisualDisplay to handle absent mock data gracefully
- **FR-012**: System MUST seed a default test app on application startup when no apps exist
- **FR-013**: System MUST seed a default test flow within the default test app
- **FR-014**: System MUST make the seeding idempotent to prevent duplicate fixtures on restart

### Key Entities

- **Interface Node**: A flow node that defines UI layout. After this change, contains only layout configuration without mock data.
- **Default Test App**: A pre-seeded application entity created on startup for testing purposes.
- **Default Test Flow**: A pre-seeded flow entity within the default test app, available for immediate testing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero references to mock data functionality remain in the production codebase (excluding specs/documentation)
- **SC-002**: Interface node creation completes without creating any mock data nodes
- **SC-003**: Application startup with empty database results in exactly 1 default test app and 1 default test flow available within 5 seconds of initialization
- **SC-004**: All existing tests pass after mock data removal
- **SC-005**: Application builds successfully with no TypeScript errors related to removed mock data types
- **SC-006**: Developers can start testing PR deployments without manual app/flow creation steps
