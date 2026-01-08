# Feature Specification: Link Output Node

**Feature Branch**: `001-link-node`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Add a new Output node called Link that opens external URLs using ChatGPT's window.openai.openExternal API, only available after UI nodes, terminating the flow successfully."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open External Link After UI Interaction (Priority: P1)

A flow designer wants to redirect users to an external resource (documentation, product page, booking system, etc.) after showing them UI content. The Link node allows them to complete a flow by opening an external URL in the user's browser.

**Why this priority**: This is the core functionality of the Link node - enabling flows to navigate users to external resources, which is the primary use case.

**Independent Test**: Can be fully tested by creating a flow with a UI node followed by a Link node, then verifying that the external URL opens correctly when the flow executes.

**Acceptance Scenarios**:

1. **Given** a flow with a UI node (like StatCard) connected to a Link node with a configured URL, **When** the flow executes and reaches the Link node, **Then** the external URL is opened using the ChatGPT openExternal API and the flow completes successfully.

2. **Given** a flow where a Link node receives a dynamic URL from upstream data, **When** the flow executes, **Then** the Link node uses the incoming URL value to open the external resource.

3. **Given** a flow with a Link node, **When** the flow reaches the Link node, **Then** no further nodes execute after it (flow terminates successfully).

---

### User Story 2 - Dynamic URL from Flow Data (Priority: P2)

A flow designer wants to use dynamic data from the flow (e.g., an API response containing a URL, or a computed URL based on user input) to determine where to redirect the user.

**Why this priority**: While static URLs are useful, most real-world scenarios require dynamic URLs based on flow context (user data, API responses, etc.).

**Independent Test**: Can be tested by configuring the Link node to accept a URL from its input data and verifying it uses that dynamic value.

**Acceptance Scenarios**:

1. **Given** a flow where upstream nodes produce a data object containing a URL field, **When** the Link node is configured to use that field as the target URL, **Then** the Link node opens the dynamically provided URL.

2. **Given** a Link node configured with both a static URL and a dynamic input, **When** the dynamic input provides a URL value, **Then** the dynamic value takes precedence over the static configuration.

---

### User Story 3 - Placement Constraint Validation (Priority: P2)

A flow designer attempts to place a Link node in an invalid position (not after a UI node). The system prevents this and provides clear feedback about the constraint.

**Why this priority**: Enforcing the ChatGPT App constraint (Link only after UI) is critical for ensuring flows work correctly when deployed.

**Independent Test**: Can be tested by attempting to connect a Link node directly after a trigger or action node and verifying the connection is rejected.

**Acceptance Scenarios**:

1. **Given** a flow canvas with a UserIntent trigger node, **When** a user attempts to connect the trigger directly to a Link node, **Then** the connection is rejected with a message explaining that Link nodes must follow UI nodes.

2. **Given** a flow canvas with a UI node (e.g., StatCard), **When** a user connects the UI node to a Link node, **Then** the connection is accepted and created successfully.

3. **Given** a flow canvas with an action node (e.g., ApiCall), **When** a user attempts to connect the action node directly to a Link node, **Then** the connection is rejected with appropriate feedback.

---

### Edge Cases

- What happens when the URL is empty or invalid?
  - The Link node should validate the URL format and display an error if invalid, preventing flow execution with a broken link.

- What happens when the URL is missing the protocol (e.g., "example.com" instead of "https://example.com")?
  - The system should either auto-prepend "https://" or reject with a clear validation message.

- How does the system handle special characters in URLs?
  - URLs should be properly encoded before being passed to the openExternal API.

- What happens if the openExternal API is not available (e.g., not running in ChatGPT context)?
  - The flow should complete with an appropriate status indicating the external link could not be opened.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a new "Link" output node in the node library.

- **FR-002**: Link node MUST accept a URL as input (either configured statically or received from upstream flow data).

- **FR-003**: Link node MUST invoke the ChatGPT openExternal API to open the specified URL when executed.

- **FR-004**: Link node MUST terminate the flow successfully after execution (no downstream nodes allowed).

- **FR-005**: Link node MUST have no output handles (classified as a terminal/return node).

- **FR-006**: System MUST enforce that Link nodes can only be connected after UI category nodes (interface nodes like StatCard).

- **FR-007**: System MUST validate URL format before allowing flow execution (must be a valid URL with protocol).

- **FR-008**: Link node MUST support dynamic URL values from upstream flow data, allowing the URL to be determined at runtime.

- **FR-009**: System MUST provide clear feedback when a user attempts to connect a Link node in an invalid position (not after UI).

- **FR-010**: Link node MUST appear in the node library within an appropriate category for flow termination/output nodes.

### Key Entities

- **Link Node**: An output node type that opens external URLs. Has one input handle (for upstream connections), no output handles (terminates flow). Requires a URL parameter (static or dynamic).

- **Node Connection Constraint**: A validation rule that restricts which node types can connect to the Link node's input. Only UI/interface category nodes are valid sources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Flow designers can add a Link node to a flow in under 30 seconds using the node library.

- **SC-002**: 100% of flows using Link nodes correctly open the specified external URL when executed in a ChatGPT context.

- **SC-003**: 100% of invalid Link node placements (not after UI nodes) are blocked with clear error messaging.

- **SC-004**: Flow designers can configure a Link node with a static URL in under 1 minute.

- **SC-005**: Flows using dynamic URLs from upstream data successfully open the correct external resource on execution.

- **SC-006**: Users understand the Link node's purpose and constraints within 30 seconds of reading its description in the node library.

## Assumptions

- The ChatGPT openExternal API (`window.openai.openExternal({ href })`) is available in the target runtime environment.
- UI nodes (interface category) are already implemented and functional in the flow system.
- The existing node validation system can be extended to support source-node-type constraints.
- Dynamic URL values will be provided as string properties in the upstream flow data.
- Standard URL validation (protocol + domain) is sufficient for most use cases.
