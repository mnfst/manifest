# Feature Specification: Flow UI Fixes

**Feature Branch**: `001-flow-ui-fixes`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Flow detail: I should be able to preview even when no UI - Share your app: prepend both URLs with real domain, they should work - POST LIST not working. Nothing happens when we add it - Add a transformer not working. We cannot see the transformer unless we reload the app. When we do, the connection is only with the downstream node, not the upstream node - On flow detail preview: if no API key, add a link to settings for me to add one"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preview Flow Without UI Nodes (Priority: P1)

As a flow builder, I want to preview my flow even when it has no UI nodes (StatCard or PostList), so that I can test the flow logic and see intermediate outputs without requiring a visual interface component.

**Why this priority**: This is a fundamental usability issue that blocks users from testing their flows during development. Currently, the Preview tab is disabled when no UI nodes exist, which prevents users from validating their flow logic.

**Independent Test**: Can be fully tested by creating a flow with only data/transform nodes and verifying the Preview tab is accessible and functional.

**Acceptance Scenarios**:

1. **Given** a flow with only data source nodes (no UI nodes), **When** I view the flow detail page, **Then** the Preview tab should be enabled and accessible.
2. **Given** a flow with transform nodes but no interface nodes, **When** I click the Preview tab, **Then** I should see the preview interface (chat or output view) and be able to trigger the flow.
3. **Given** an empty flow with no nodes, **When** I view the flow detail page, **Then** the Preview tab should be disabled (no nodes to execute).

---

### User Story 2 - Transformer Node Visual Update (Priority: P1)

As a flow builder, I want to see transformer nodes appear immediately on the canvas after adding them, with proper connections to both upstream and downstream nodes, so that I don't need to reload the page to see my changes.

**Why this priority**: This is a critical bug that breaks the core flow editing experience. Users expect real-time visual feedback when adding nodes.

**Independent Test**: Can be fully tested by adding a transformer between two connected nodes and verifying it appears immediately with correct connections.

**Acceptance Scenarios**:

1. **Given** two connected nodes in a flow, **When** I add a transformer between them, **Then** the transformer node should appear immediately on the canvas without requiring a page reload.
2. **Given** a newly added transformer node, **When** it appears on the canvas, **Then** it should show connections to both the upstream (source) node and the downstream (target) node.
3. **Given** a transformer added via the "Add Transformer" modal, **When** the operation completes, **Then** the flow state should be refreshed to reflect all new nodes and connections.

---

### User Story 3 - Share Modal with Working URLs (Priority: P2)

As a user who wants to share my app, I want the share modal to display complete URLs with the real domain, so that the URLs actually work when I copy and share them.

**Why this priority**: Sharing is a key feature for app distribution, but non-working URLs completely break this functionality.

**Independent Test**: Can be fully tested by opening the share modal for a published app and verifying both URLs are complete and functional.

**Acceptance Scenarios**:

1. **Given** I have a published app, **When** I open the share modal, **Then** the Landing Page URL should display the complete URL with the production domain (not just a relative path).
2. **Given** the share modal is open, **When** I view the MCP Endpoint URL, **Then** it should display the complete URL with the production domain.
3. **Given** a complete URL in the share modal, **When** I click "Open" or copy and paste the URL into a browser, **Then** the URL should work and load the appropriate page/endpoint.

---

### User Story 4 - PostList Node Addition (Priority: P2)

As a flow builder, I want to add a PostList node to my flow and have it work correctly, so that I can display blog post lists in my app interface.

**Why this priority**: PostList is a recently added UI node type, and if adding it does nothing, users cannot use this feature at all.

**Independent Test**: Can be fully tested by selecting PostList from the node library and verifying it creates a node on the canvas.

**Acceptance Scenarios**:

1. **Given** I am on the flow detail page, **When** I select "Post List" from the node library, **Then** a new PostList node should be created and appear on the canvas.
2. **Given** a PostList node is being created, **When** the creation completes, **Then** the code editor should open for the new node.
3. **Given** a newly created PostList node, **When** I view it on the canvas, **Then** it should have the correct default parameters (layoutTemplate: 'post-list').

---

### User Story 5 - API Key Settings Link (Priority: P3)

As a user trying to preview my flow, I want to see a link to the settings page when no API key is configured, so that I can quickly navigate to add one without searching through the application.

**Why this priority**: This is a UX improvement that helps users resolve the missing API key issue faster, but doesn't block core functionality.

**Independent Test**: Can be fully tested by removing the API key from settings, viewing the preview tab, and verifying a clickable link to settings appears.

**Acceptance Scenarios**:

1. **Given** no API key is configured, **When** I view the Preview tab, **Then** I should see a message indicating an API key is required with a clickable link to the Settings page.
2. **Given** the "API Key Required" message is displayed, **When** I click the settings link, **Then** I should be navigated to the Settings page (or API Keys section).
3. **Given** I am on the Settings page after clicking the link, **When** I add an API key and return to the flow, **Then** the Preview tab should now be functional.

---

### Edge Cases

- What happens when a user tries to preview a flow with nodes that have configuration errors?
- How does the system handle adding a transformer when there's no existing connection between the selected nodes?
- What happens if the share modal is opened for an unpublished app (no slug)?
- What happens when multiple PostList nodes are added in quick succession?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enable the Preview tab for flows that have at least one executable node, regardless of whether UI nodes exist.
- **FR-002**: System MUST display transformer nodes immediately on the canvas after creation without requiring a page reload.
- **FR-003**: System MUST show connections from the transformer to both the upstream (source) node and downstream (target) node after insertion.
- **FR-004**: System MUST display complete, working URLs in the share modal including the production domain.
- **FR-005**: System MUST create a PostList node on the canvas when the user selects "Post List" from the node library.
- **FR-006**: System MUST display a clickable link to the Settings page when the Preview tab shows the "API Key Required" message.
- **FR-007**: System MUST refresh the flow state after any node or connection modification to ensure the UI reflects the current state.

### Key Entities

- **Flow**: Contains nodes and connections; must be refreshed after modifications.
- **Node**: Individual node instance (StatCard, PostList, Transform nodes, etc.); must render immediately after creation.
- **Connection**: Links between nodes; must be created and displayed for both ends of an inserted transformer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access the Preview tab for any flow with at least one node, regardless of UI node presence.
- **SC-002**: Transformer nodes appear on the canvas within 1 second of being added, without requiring page refresh.
- **SC-003**: 100% of URLs displayed in the share modal are complete and functional when opened in a browser.
- **SC-004**: PostList nodes are successfully created 100% of the time when selected from the node library.
- **SC-005**: Users can navigate from the "API Key Required" message to Settings with a single click.
- **SC-006**: All node and connection changes are reflected in the UI immediately without manual page refresh.

## Assumptions

- The production domain is available via the existing `BACKEND_URL` configuration or can be determined at runtime.
- The Settings page already exists and has a section for API key configuration.
- The existing node creation and flow refresh patterns can be reused for fixing the PostList and transformer issues.
- The Preview functionality has an alternate mode that doesn't require UI nodes (e.g., displaying raw output or using a generic output view).
