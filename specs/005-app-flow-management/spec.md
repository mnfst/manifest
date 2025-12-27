# Feature Specification: App & Flow Management

**Feature Branch**: `005-app-flow-management`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "The user should be able to edit and delete apps and flows. The app list should show the number of flows of it and it should not be possible to publish an app without any flow as it's useless."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit App Details (Priority: P1)

As a user, I want to edit my app's name and description so that I can correct mistakes or update information as my app evolves.

**Why this priority**: Editing is a fundamental CRUD operation that users expect. Without it, users must delete and recreate apps to fix simple typos, which is frustrating and loses associated flows.

**Independent Test**: Can be fully tested by creating an app, clicking edit, changing the name/description, saving, and verifying the changes persist. Delivers immediate value by allowing app refinement.

**Acceptance Scenarios**:

1. **Given** a user is viewing the app list, **When** they click the edit action on an app card, **Then** an edit form appears with the current app name and description pre-filled.
2. **Given** a user is editing an app, **When** they modify the name and/or description and save, **Then** the changes are persisted and visible immediately in the app list.
3. **Given** a user is editing an app, **When** they click cancel or press Escape, **Then** the edit form closes without saving changes.
4. **Given** a user is editing an app, **When** they clear the required name field and try to save, **Then** validation prevents saving and shows an error message.

---

### User Story 2 - Delete App (Priority: P1)

As a user, I want to delete apps I no longer need so that my app list stays organized and I can remove abandoned projects.

**Why this priority**: Deletion is essential for app lifecycle management. Without it, users accumulate clutter and cannot remove test or abandoned apps.

**Independent Test**: Can be fully tested by creating an app, deleting it, and verifying it no longer appears in the list. Delivers immediate value by enabling cleanup.

**Acceptance Scenarios**:

1. **Given** a user is viewing the app list, **When** they click the delete action on an app card, **Then** a confirmation dialog appears warning that this will also delete all associated flows.
2. **Given** a user sees the delete confirmation, **When** they confirm deletion, **Then** the app and all its flows are permanently removed from the system.
3. **Given** a user sees the delete confirmation, **When** they cancel, **Then** the app remains unchanged.
4. **Given** a published app, **When** a user deletes it, **Then** the MCP server endpoint for that app becomes unavailable.

---

### User Story 3 - Edit Flow Details (Priority: P2)

As a user, I want to edit my flow's name, description, tool name, and tool description so that I can refine how my MCP tools are presented.

**Why this priority**: Flows define the MCP tools exposed to AI assistants. Being able to refine tool names and descriptions improves discoverability and usability, but is secondary to basic app management.

**Independent Test**: Can be fully tested by navigating to a flow, editing its details, saving, and verifying changes appear in the flow detail and MCP tool listing.

**Acceptance Scenarios**:

1. **Given** a user is viewing a flow detail page, **When** they click an edit action, **Then** an edit form appears with current flow details pre-filled.
2. **Given** a user is editing a flow, **When** they modify fields and save, **Then** the changes are persisted and visible immediately.
3. **Given** a user edits the tool name of a flow on a published app, **When** they save, **Then** the MCP server reflects the new tool name for subsequent requests.
4. **Given** a user is editing a flow, **When** they cancel, **Then** no changes are saved.

---

### User Story 4 - Delete Flow (Priority: P2)

As a user, I want to delete flows I no longer need so that I can remove outdated or incorrect tools from my app.

**Why this priority**: Flow deletion enables users to refine their apps by removing unused tools. This is already partially implemented but needs proper UI integration in the flow detail page.

**Independent Test**: Can be fully tested by creating a flow, deleting it, and verifying it no longer appears in the app's flow list.

**Acceptance Scenarios**:

1. **Given** a user is viewing a flow detail page, **When** they click delete, **Then** a confirmation dialog appears.
2. **Given** a user confirms flow deletion, **When** the flow is deleted, **Then** all associated views are also deleted and the user is navigated back to the app detail page.
3. **Given** a flow on a published app, **When** deleted, **Then** the corresponding MCP tool is no longer available on the server.
4. **Given** an app with only one flow that is published, **When** the user tries to delete the last flow, **Then** the system warns that this will unpublish the app (since apps require at least one flow to be published).

---

### User Story 5 - Display Flow Count on App Cards (Priority: P2)

As a user, I want to see how many flows each app has on the app list so that I can quickly gauge the complexity and completeness of each app.

**Why this priority**: This is a quality-of-life improvement that helps users understand their apps at a glance without navigating into each one.

**Independent Test**: Can be fully tested by creating apps with different numbers of flows and verifying the correct count displays on each app card.

**Acceptance Scenarios**:

1. **Given** an app with 3 flows, **When** viewing the app list, **Then** the app card displays "3 flows" or similar indicator.
2. **Given** an app with 1 flow, **When** viewing the app list, **Then** the app card displays "1 flow" (singular).
3. **Given** an app with 0 flows, **When** viewing the app list, **Then** the app card displays "0 flows" or "No flows".

---

### User Story 6 - Prevent Publishing App Without Flows (Priority: P3)

As a user, I want to be prevented from publishing an app without any flows so that I don't create useless MCP endpoints.

**Why this priority**: This validation already exists in the backend but needs proper UI feedback. It's lower priority because it's an edge case (users typically create flows before publishing).

**Independent Test**: Can be fully tested by creating an app without flows and attempting to publish it, verifying the publish button is disabled or shows an error.

**Acceptance Scenarios**:

1. **Given** an app with 0 flows, **When** viewing the app detail page, **Then** the publish button is disabled with a tooltip explaining "Add at least one flow to publish".
2. **Given** an app with 0 flows, **When** a user somehow triggers publish, **Then** the system shows an error message explaining the requirement.
3. **Given** an app with 1+ flows, **When** viewing the app detail page, **Then** the publish button is enabled.

---

### Edge Cases

- What happens when deleting the last flow of a published app? The app should be automatically unpublished or the user should be warned before deletion.
- What happens when editing an app name to conflict with an existing slug? The system already handles slug uniqueness with numeric suffixes; edits should preserve the existing slug.
- What happens when trying to delete an app while it's being used via MCP? The deletion proceeds; active sessions may receive errors on subsequent requests.
- What happens when editing a flow's tool name to an empty string? Validation should prevent this as tool names are required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to edit app name and description from the app list page via an edit action.
- **FR-002**: System MUST allow users to delete apps from the app list page with a confirmation dialog.
- **FR-003**: System MUST delete all associated flows and views when an app is deleted (cascade delete).
- **FR-004**: System MUST allow users to edit flow name, description, tool name, and tool description from the flow detail page.
- **FR-005**: System MUST allow users to delete flows from the flow detail page with a confirmation dialog.
- **FR-006**: System MUST delete all associated views when a flow is deleted (cascade delete).
- **FR-007**: System MUST display the count of flows for each app on the app list cards.
- **FR-008**: System MUST disable the publish button when an app has no flows, with a clear explanation.
- **FR-009**: System MUST warn users when deleting the last flow of a published app that this action will require unpublishing.
- **FR-010**: System MUST preserve the existing app slug when the app name is edited (slugs are immutable after creation).
- **FR-011**: System MUST validate that app names are not empty and do not exceed 100 characters.
- **FR-012**: System MUST validate that flow tool names are not empty and do not exceed 100 characters.

### Key Entities

- **App**: Represents an MCP server. Key attributes: name, description, slug (immutable), status (draft/published), flows (one-to-many).
- **Flow**: Represents an MCP tool within an app. Key attributes: name, description, toolName, toolDescription, isActive, views (one-to-many).
- **View**: Display component within a flow. Cascade-deleted when parent flow is deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can edit any app's name and description within 3 clicks from the app list.
- **SC-002**: Users can delete an app within 3 clicks from the app list, with confirmation.
- **SC-003**: Users can edit any flow's details within 2 clicks from the flow detail page.
- **SC-004**: Users can delete a flow within 2 clicks from the flow detail page, with confirmation.
- **SC-005**: Flow count is visible on 100% of app cards in the app list.
- **SC-006**: 0% of apps with zero flows can be successfully published.
- **SC-007**: All edit and delete operations complete within 2 seconds under normal conditions.
- **SC-008**: 100% of cascade deletions correctly remove all child entities (flows, views).
