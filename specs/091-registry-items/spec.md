# Feature Specification: Registry-Based UI Nodes

**Feature Branch**: `091-registry-items`
**Created**: 2026-01-13
**Status**: Draft
**Input**: User description: "Change UI nodes from package-based to live registry fetch. Delete nodes/interface folder. Fetch registry URL (configurable), display items by category with version/title/description, add category navigation level, and store component code in node data when adding to canvas."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse UI Components by Category (Priority: P1)

As a flow builder, I want to browse available UI components organized by category so that I can easily find the component I need among the many available options.

**Why this priority**: This is the core navigation experience that enables users to discover and select components. Without category-based organization, users would face an overwhelming flat list of components.

**Independent Test**: Can be fully tested by opening the node library, clicking "UI", seeing categories listed, clicking a category, and seeing components for that category.

**Acceptance Scenarios**:

1. **Given** the node library is open, **When** user clicks on the "UI" section, **Then** a list of categories (form, payment, list, blogging, messaging, events, miscellaneous) is displayed instead of individual components
2. **Given** the user is viewing categories, **When** user clicks on a category (e.g., "blogging"), **Then** only components in that category are displayed with their title, description, and version
3. **Given** the user is viewing components in a category, **When** user wants to go back, **Then** they can navigate back to the category list

---

### User Story 2 - Add Registry Component to Canvas (Priority: P1)

As a flow builder, I want to add a UI component from the registry to my canvas so that I can use it in my flow with all its code embedded.

**Why this priority**: This is the primary action users take after discovering a component. The embedded code approach ensures the flow is self-contained and works offline.

**Independent Test**: Can be fully tested by selecting a component from the library and verifying it appears on the canvas with its full code stored in node data.

**Acceptance Scenarios**:

1. **Given** the user is viewing components in a category, **When** user clicks on a component to add it, **Then** the system fetches the component's detailed JSON file (e.g., `https://ui.manifest.build/r/post-card.json`)
2. **Given** the component detail is fetched, **When** the component is added to the canvas, **Then** the node data includes the complete component code (all file contents from the registry)
3. **Given** a component is added, **When** viewing the node data, **Then** it contains title, description, version, dependencies, registryDependencies, and all file contents

---

### User Story 3 - View Component Information (Priority: P2)

As a flow builder, I want to see component details (version, title, description) before adding it so that I can make an informed decision about which component to use.

**Why this priority**: Helps users make informed choices but is secondary to basic navigation and adding functionality.

**Independent Test**: Can be fully tested by viewing any component in the library and verifying version, title, and description are displayed.

**Acceptance Scenarios**:

1. **Given** a category is selected, **When** viewing the component list, **Then** each component displays its version number (e.g., "v2.0.2"), title (e.g., "Post Card"), and description
2. **Given** multiple components in a category, **When** comparing them, **Then** all components show consistent information format for easy comparison

---

### User Story 4 - Configure Registry URL (Priority: P3)

As a system administrator, I want to configure the registry URL via environment variable so that I can point to a custom or self-hosted registry.

**Why this priority**: Important for enterprise/custom deployments but not needed for initial MVP functionality.

**Independent Test**: Can be tested by setting the environment variable and verifying the system fetches from the configured URL.

**Acceptance Scenarios**:

1. **Given** no environment variable is set, **When** the system fetches the registry, **Then** it uses the default URL `https://ui.manifest.build/r/registry.json`
2. **Given** an environment variable is set with a custom URL, **When** the system fetches the registry, **Then** it uses the configured URL instead of the default

---

### Edge Cases

- What happens when the registry URL is unreachable? The system displays an error message and the UI category shows as empty or with an error state.
- What happens when a component's detail JSON fails to fetch? The system shows an error message and prevents adding the component. User must re-click the component to retry (no automatic retry or retry button).
- What happens when a component has no files array? The component is still added but with minimal data (metadata only).
- How does the system handle registry items with missing required fields (title, description, version)? Display what's available and use sensible defaults (e.g., name as fallback for title, "No description" placeholder).
- What happens when the registry returns invalid JSON? The system displays a parsing error message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch the component registry from a configurable URL (default: `https://ui.manifest.build/r/registry.json`)
- **FR-002**: System MUST support configuring the registry URL via environment variable
- **FR-003**: System MUST display UI components organized by category in the node library
- **FR-004**: System MUST show categories as an intermediate navigation level when user selects "UI"
- **FR-005**: System MUST display version, title, and description for each component in the category view
- **FR-006**: System MUST fetch the detailed component JSON when a component is selected for adding
- **FR-007**: System MUST store the complete component code (all file contents) in the node data when adding to canvas
- **FR-008**: System MUST remove the existing static interface nodes package (`nodes/interface` folder with PostListNode, StatCardNode, etc.)
- **FR-009**: System MUST transform registry data format to the local node interface format
- **FR-010**: System MUST handle fetch failures gracefully with appropriate error messages
- **FR-011**: System MUST allow navigation back from component list to category list
- **FR-012**: System MUST fetch fresh registry data on every access (no caching)
- **FR-013**: Migration MUST delete all existing flows containing old interface nodes (PostListNode, StatCardNode)
- **FR-014**: System MUST display skeleton/placeholder items in the UI section while registry data is loading (other sections remain unaffected)
- **FR-015**: System MUST display categories in the order they appear in the registry response (registry controls ordering)

### Key Entities

- **Registry**: The remote source containing the list of all available components. Contains items array with metadata for each component.
- **Registry Item**: An entry in the registry representing a UI component. Has name, version, type, title, description, category, dependencies, registryDependencies, and files metadata.
- **Component Detail**: The full component data fetched from individual component URLs. Includes all Registry Item fields plus complete file contents (source code).
- **Category**: A grouping mechanism for components. Examples: form, payment, list, blogging, messaging, events, miscellaneous.
- **UI Node**: The canvas node created when a component is added. Stores the complete component data including all source code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can browse all available UI components within 3 clicks (UI > Category > Component)
- **SC-002**: Component addition to canvas completes in under 2 seconds (including registry fetch)
- **SC-003**: 100% of registry components are accessible through the new category-based navigation
- **SC-004**: All flows containing old interface nodes (PostListNode, StatCardNode) are removed during migration (breaking change, no production data)
- **SC-005**: Users can find a specific component type 50% faster with category organization compared to flat list
- **SC-006**: System gracefully handles registry unavailability without crashing or blocking other functionality

## Clarifications

### Session 2026-01-13

- Q: What is the caching strategy for registry data? → A: No caching - always fetch fresh data from registry on every access
- Q: What is the backward compatibility strategy for existing flows with old interface nodes? → A: Breaking change - delete all flows containing old nodes (no production data)
- Q: How should loading states be displayed when fetching registry data? → A: Show skeleton/placeholder items in the UI section only while loading
- Q: How should component fetch failures be handled for retry? → A: Show error only, user must re-click the component to retry
- Q: How should categories be ordered in the UI section? → A: Order as returned from registry (registry controls order)

## Assumptions

- The registry URL follows the format `{base}/registry.json` and individual components follow `{base}/{component-name}.json`
- Categories returned from the registry are dynamic and may change over time
- The component file contents in the detailed JSON are complete and ready to use without additional processing
- Network connectivity is typically available when users are building flows
- The list of categories will remain manageable (under 20 categories) for single-level navigation
