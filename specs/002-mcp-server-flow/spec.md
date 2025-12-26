# Feature Specification: MCP App and Flow Data Architecture

**Feature Branch**: `002-mcp-server-flow`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "I want to start a new feature that will change the whole data structure. Let's start by the main entity which is a server. A server is an MCP server that will be served at an URL corresponding to its slug. It looks like the current app entity with a name a description, themeVariables. Then you have Flow. The flow entity correspond to an MCP tool. It has a name description and is the parent of a set of View entity in a defined order. Each View has mockData, layoutTemplate and so on and is part of a Flow. Once this is done. I want to change the User workflow: First we see a form to create an MCP server. Then we have the prompt that will create a flow. The flow is created and we can go to the flow edition page. We should have a list of flows to visualize and manage"

## Clarifications

### Session 2025-12-26

- Q: Entity naming for the top-level MCP server entity? → A: Rename "Server" to "App" for user-friendliness
- Q: Flow edition page structure and view navigation? → A: Flow edition page lists all views; clicking a view navigates to view edition page with component preview and chat panel on the left (existing editor pattern)
- Q: Multiple app management on home page? → A: Single-app focus for POC; home page shows only app creation form; each session starts fresh (no cross-session persistence)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create App (Priority: P1)

As a user, I want to create an App by filling out a form so that I have a container for organizing my flows (MCP tools).

**Why this priority**: The App is the top-level entity that must exist before any flows can be created. This is the foundational entry point for the entire application workflow.

**Independent Test**: Can be fully tested by accessing the application, filling out the app creation form with name, description, and optional theme settings, and verifying the app is created and accessible via its slug URL.

**Acceptance Scenarios**:

1. **Given** I am on the home page, **When** I view the page, **Then** I see a form with fields for app name, description, and theme customization (no app list; fresh start each session)
2. **Given** I am on the app creation form, **When** I fill in the required fields and submit, **Then** a new App is created with a unique slug derived from the name
3. **Given** I have created an app, **When** I navigate to the app's slug URL, **Then** I see the app's dashboard with its associated flows

---

### User Story 2 - Create Flow via AI Prompt (Priority: P2)

As a user, I want to describe a flow using natural language so that the system generates an MCP tool with appropriate views automatically.

**Why this priority**: This is the core value proposition - users should be able to quickly create flows (MCP tools) using AI assistance rather than manual configuration.

**Independent Test**: Can be tested by selecting an app, entering a prompt describing the desired flow, and verifying a flow is created with at least one view containing mockData and layoutTemplate.

**Acceptance Scenarios**:

1. **Given** I am viewing an app dashboard, **When** I enter a prompt describing a flow (e.g., "A tool that displays customer orders in a table"), **Then** the system creates a flow with a name, description, and initial view
2. **Given** I have entered a flow prompt, **When** the flow is generated, **Then** I am automatically redirected to the flow edition page
3. **Given** a flow is created from a prompt, **When** I view the flow details, **Then** it contains at least one view with appropriate mockData and layoutTemplate based on my description

---

### User Story 3 - Edit Flow and Views (Priority: P3)

As a user, I want to edit a flow and its views so that I can customize the MCP tool's behavior and appearance.

**Why this priority**: After initial creation, users need the ability to refine and adjust flows to meet their exact requirements.

**Independent Test**: Can be tested by navigating to a flow edition page, viewing the list of views, clicking on a view to open the view edition page, and verifying changes persist.

**Acceptance Scenarios**:

1. **Given** I am on the flow edition page, **When** I view the page, **Then** I see a list of all views belonging to this flow with their names and layout types
2. **Given** I am on the flow edition page, **When** I modify the flow name or description, **Then** the changes are saved and reflected in the flow list
3. **Given** I am on the flow edition page, **When** I click on a view, **Then** I am taken to the view edition page
4. **Given** I am on the view edition page, **When** I view the page, **Then** I see the component preview on the right and the chat panel on the left (existing editor pattern)
5. **Given** I am on the view edition page, **When** I use the chat to modify the view, **Then** changes to mockData, layoutTemplate, or styling are applied and visible in the preview
6. **Given** I am editing a flow, **When** I add a new view, **Then** I can specify its layoutTemplate and mockData, and it appears in the correct order
7. **Given** a flow has multiple views, **When** I reorder the views, **Then** the new order is preserved and reflected in the flow's tool behavior

---

### User Story 4 - Manage Flows List (Priority: P4)

As a user, I want to see a list of all flows for an app so that I can navigate, manage, and organize my MCP tools.

**Why this priority**: As users create multiple flows, they need a way to visualize and manage them efficiently.

**Independent Test**: Can be tested by creating multiple flows for an app and verifying they appear in a list with options to view, edit, or delete.

**Acceptance Scenarios**:

1. **Given** I am on an app dashboard, **When** I view the flows section, **Then** I see a list of all flows belonging to that app with their names and descriptions
2. **Given** I am viewing the flows list, **When** I click on a flow, **Then** I am taken to the flow edition page
3. **Given** I am viewing the flows list, **When** I delete a flow, **Then** it is removed from the list and no longer accessible

---

### Edge Cases

- What happens when a user tries to create an app with a name that generates a duplicate slug? For POC (single-app, fresh session), this is not applicable; future multi-app support would append a numeric suffix.
- How does the system handle a flow with zero views? A flow must have at least one view; the system should prevent deletion of the last view.
- What happens if the AI fails to generate a flow from a prompt? The system should display an error message and allow the user to retry or manually create the flow.
- How does the system handle very long app/flow names? Names should be truncated for display but stored in full.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create an App with a name, description, and optional theme variables
- **FR-002**: System MUST generate a unique slug for each app based on its name
- **FR-003**: System MUST serve each App at a URL corresponding to its slug
- **FR-004**: System MUST allow users to create Flows associated with a specific app
- **FR-005**: System MUST support AI-assisted flow generation from natural language prompts
- **FR-006**: Each Flow MUST have a name, description, and act as an MCP tool
- **FR-007**: Each Flow MUST contain one or more Views in a defined order
- **FR-008**: Each View MUST have a layoutTemplate and mockData
- **FR-009**: System MUST allow users to add, edit, remove, and reorder views within a flow
- **FR-010**: System MUST display a list of all flows for a given app
- **FR-011**: System MUST allow users to navigate from flow list to flow edition page
- **FR-012**: System MUST allow users to delete flows from an app
- **FR-013**: System MUST persist the app-flow-view hierarchy within the current session (POC: no cross-session persistence)
- **FR-014**: System MUST display the app creation form as the home page entry point (no app list for POC)
- **FR-015**: Flow edition page MUST display a list of all views belonging to the flow
- **FR-016**: System MUST allow users to navigate from flow edition page to view edition page by clicking on a view
- **FR-017**: View edition page MUST display component preview on the right and chat panel on the left

### Key Entities

- **App**: The top-level entity representing an MCP server (formerly referred to as "Server"). Contains name, description, slug (unique URL identifier), and themeVariables. An app contains zero or more flows.

- **Flow**: Represents an MCP tool belonging to an app. Contains name, description, and references to an ordered collection of views. Acts as the tool that users invoke.

- **View**: A single display unit within a flow. Contains mockData (sample data structure), layoutTemplate (UI template type), and maintains its position order within the parent flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new App and have it accessible at its slug URL within 10 seconds of form submission
- **SC-002**: Users can generate a flow from a natural language prompt in under 30 seconds
- **SC-003**: Users can view and navigate their list of flows within 3 clicks from any page
- **SC-004**: 90% of users can complete the end-to-end workflow (create app -> create flow -> edit view) without external guidance
- **SC-005**: The system maintains data integrity across the app-flow-view hierarchy with no orphaned records
- **SC-006**: Flow reordering and view reordering operations complete within 2 seconds
- **SC-007**: Users can navigate from flow edition page to view edition page in 1 click

## Assumptions

- **POC Scope**: Single-app focus per session; each visit to the application starts fresh with no persisted apps from previous sessions
- The existing theme variables structure (HSL-based CSS variables) will be reused for App theming
- The existing layoutTemplate types ('table', 'post-list') will be reused for Views
- The existing mockData structure (union type for different layout types) will be reused for Views
- Slug generation will follow standard URL-safe conventions (lowercase, hyphens, alphanumeric)
- An app can have zero flows initially (empty state is valid)
- The AI-assisted flow generation will reuse the existing LangChain/agent infrastructure
- The view edition page follows the existing editor pattern with chat on the left and preview on the right
