# Feature Specification: Simplified Flow Creation

**Feature Branch**: `001-flow-creation`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Redefine flow creation to replace the prompt-based approach with a simplified modal showing only name and description, auto-generate tool name from name using snake_case, and guide users through creating their first user intent and view on the flow canvas."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a New Flow with Name and Description (Priority: P1)

A user wants to create a new flow for their application. They open the flow creation modal, enter a meaningful name and optional description for their flow. The system automatically generates a snake_case tool name from the provided name. Upon creation, the user is redirected to the flow editor page where they see an empty canvas with a centered "Add user intent" prompt.

**Why this priority**: This is the core entry point for flow creation. Without this, users cannot begin building any flows. The simplified approach removes friction by eliminating the prompt field and auto-generating technical details.

**Independent Test**: Can be fully tested by creating a new flow from the app detail page, verifying the modal fields, checking the generated tool name, and confirming navigation to an empty flow editor.

**Acceptance Scenarios**:

1. **Given** a user is on the app detail page, **When** they click "Create New Flow", **Then** they see a modal with only "Name" and "Description" fields (no prompt field)
2. **Given** the modal is open with name "My Product Catalog", **When** the user views the form, **Then** they see a preview of the auto-generated tool name "my_product_catalog"
3. **Given** a user enters "Hello World!" as the name, **When** they view the generated tool name, **Then** it displays "hello_world" (special characters removed, spaces converted to underscores, all lowercase)
4. **Given** a user has entered a valid name, **When** they click "Create Flow", **Then** they are redirected to the flow editor page for the newly created flow
5. **Given** a user is redirected to the flow editor, **When** the page loads, **Then** they see an empty React Flow canvas with no nodes and no views

---

### User Story 2 - Add Initial User Intent to Empty Flow (Priority: P1)

A user has just created a new flow and is on the empty flow editor. They see a centered element with a "+" icon and "Add user intent" label. Clicking this element opens the User Intent modal where they configure how the AI should use this tool.

**Why this priority**: The user intent is required before any views can be added. This is the critical second step in the guided flow creation process and establishes the purpose of the entire flow.

**Independent Test**: Can be fully tested by navigating to a newly created flow with no user intent, clicking the "Add user intent" element, filling out the User Intent modal, and verifying the user intent node appears on the canvas.

**Acceptance Scenarios**:

1. **Given** a user is on an empty flow editor, **When** they view the canvas, **Then** they see a clickable element centered in the canvas with a "+" icon and "Add user intent" text
2. **Given** the "Add user intent" element is visible, **When** the user clicks on it, **Then** the User Intent modal opens with the existing fields (tool description, when to use, when not to use)
3. **Given** the User Intent modal is open, **When** the user fills in the tool description and saves, **Then** the "Add user intent" placeholder is replaced with the User Intent node showing the description
4. **Given** the user intent has been created, **When** the user views the canvas, **Then** the User Intent node is positioned on the left side of the canvas as the starting point

---

### User Story 3 - Prompted to Add First View After User Intent (Priority: P2)

After creating the user intent, the user is prompted to create their first view. A new centered element appears (or the flow guides them) to add the first view node.

**Why this priority**: Flows require at least one view to be functional. Guiding users to create the first view immediately after user intent ensures they complete the minimum viable flow setup.

**Independent Test**: Can be fully tested by creating a user intent on an empty flow and verifying that a prompt to add the first view appears on the canvas.

**Acceptance Scenarios**:

1. **Given** a user has just created a user intent on an empty flow, **When** the User Intent modal closes, **Then** a new element or prompt appears guiding them to "Add first view"
2. **Given** the "Add first view" prompt is visible, **When** the user clicks on it, **Then** the view creation modal opens (using existing view creation functionality)
3. **Given** the user completes view creation, **When** the view is saved, **Then** the view node appears connected to the user intent node

---

### Edge Cases

- What happens when a user enters an empty name? The form validation prevents submission and shows an error message
- What happens when the generated tool name conflicts with an existing tool name in the same app? The system allows it (tool names can be edited later in flow settings)
- What happens when a user navigates away from the flow editor without adding a user intent? The flow remains in an incomplete state and the "Add user intent" element appears when they return
- How does the system handle names with only special characters (e.g., "!!!???")? The system shows a validation error as the generated tool name would be empty
- What happens if a user closes the User Intent modal without saving? The "Add user intent" placeholder remains on the canvas

## Requirements *(mandatory)*

### Functional Requirements

#### Flow Creation Modal Changes
- **FR-001**: System MUST display only "Name" (required) and "Description" (optional) fields in the flow creation modal
- **FR-002**: System MUST remove the "Prompt" field and all related prompt functionality from the flow creation modal
- **FR-003**: System MUST auto-generate the tool name from the flow name using snake_case format (lowercase, underscores for spaces, no special characters)
- **FR-004**: System MUST display the generated tool name as a preview in the modal (read-only or lightly styled)
- **FR-005**: System MUST validate that the flow name produces a valid tool name (at least one alphanumeric character)

#### Backend Changes
- **FR-006**: Backend MUST accept flow creation requests with only `name` and `description` fields (no `prompt` field)
- **FR-007**: Backend MUST generate the `toolName` from the `name` field using snake_case conversion
- **FR-008**: Backend MUST remove or deprecate the AI prompt-based flow generation logic from the agent service
- **FR-009**: Backend MUST create flows without initial views (empty flow)
- **FR-010**: Backend MUST create flows without initial user intent data (toolDescription, whenToUse, whenNotToUse left empty)

#### Flow Editor Initial State
- **FR-011**: System MUST display an empty React Flow canvas when a newly created flow has no user intent
- **FR-012**: System MUST display a centered clickable element with "+" icon and "Add user intent" text on empty flow canvas
- **FR-013**: System MUST open the existing User Intent modal when the "Add user intent" element is clicked
- **FR-014**: System MUST replace the "Add user intent" placeholder with the User Intent node after user intent is saved

#### Post-User-Intent Guidance
- **FR-015**: System MUST display guidance to add the first view after user intent is created (when flow has user intent but no views)
- **FR-016**: System MUST connect newly created views to the user intent node in the flow diagram

#### Code Cleanup
- **FR-017**: Frontend MUST remove the `PromptInput` component and its usage
- **FR-018**: Backend MUST remove or disable the `generateFlow` method in the agent service that processes prompts
- **FR-019**: Shared types MUST update `CreateFlowRequest` to contain only `name` and `description` fields

### Key Entities

- **Flow**: Represents a user's workflow configuration. Key attributes: name, description, toolName (auto-generated), toolDescription (empty until user intent added), views (empty initially)
- **User Intent**: Configuration defining how AI should use the tool. Created separately after flow creation via modal.
- **View**: Individual step in the flow. Created by user after user intent is established.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new flow in under 30 seconds by entering only name and description
- **SC-002**: 100% of newly created flows have correctly formatted snake_case tool names
- **SC-003**: Users can navigate from flow creation to adding their first user intent within 3 clicks
- **SC-004**: The "Add user intent" prompt is visible within 1 second of loading an empty flow editor
- **SC-005**: All prompt-related code is removed from both frontend and backend (zero references to prompt field in flow creation)
- **SC-006**: Users successfully complete the guided flow setup (user intent + first view) on their first attempt without confusion

## Assumptions

- The existing User Intent modal functionality remains unchanged and will be reused
- The existing view creation functionality remains unchanged and will be reused
- Tool name conflicts within the same app are acceptable (users can rename via flow settings)
- The flow remains valid in the database even without user intent or views (partial/draft state)
- The "Add first view" guidance can use the same or similar visual pattern as "Add user intent"
