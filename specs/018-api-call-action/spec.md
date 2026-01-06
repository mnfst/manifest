# Feature Specification: API Call Action Node

**Feature Branch**: `018-api-call-action`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "i want to add a new action node that will consist in an async API call. For now the API call should be pretty basic, with choosing the URL, Method and headers. It accepts inputs (previous node outputs) in a nice and elegant way for users. It outputs the response of the API call so it has one handler left and one handler right. Add it to the list of nodes (the modal from the '+' sign)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Basic API Call (Priority: P1)

A user building a workflow wants to make an external API call to fetch or send data. They add an API Call node from the "+" modal, configure the URL, select the HTTP method (GET, POST, PUT, DELETE, PATCH), and optionally add headers. The node executes the API call and outputs the response for subsequent nodes to use.

**Why this priority**: This is the core functionality - without the ability to configure and execute an API call, the feature has no value. This enables the primary use case of integrating external services into workflows.

**Independent Test**: Can be fully tested by adding an API Call node, configuring it to call a public API (e.g., a JSONPlaceholder endpoint), executing the flow, and verifying the response data is correctly output.

**Acceptance Scenarios**:

1. **Given** the user is in the flow editor, **When** they click the "+" button to add a new node, **Then** they see "API Call" as an option in the modal with an appropriate icon and description.

2. **Given** the user has added an API Call node, **When** they open the node configuration, **Then** they can enter a URL, select an HTTP method from a dropdown (GET, POST, PUT, DELETE, PATCH), and add key-value pairs for headers.

3. **Given** the user has configured an API Call node with valid settings, **When** the flow executes and reaches this node, **Then** the node makes the HTTP request and outputs the response (status code, headers, and body) to the right-side handle.

4. **Given** the user has configured an API Call node, **When** they view the node in the flow diagram, **Then** they see one input handle on the left and one output handle on the right.

---

### User Story 2 - Use Previous Node Output as Input (Priority: P2)

A user wants to dynamically construct their API call using data from a previous node's output. They can reference previous node outputs in the URL, headers, or body fields using a clear templating syntax or input mapping interface.

**Why this priority**: This enables dynamic workflows where API calls are parameterized based on earlier results. Without this, the feature is limited to static API calls, significantly reducing its usefulness.

**Independent Test**: Can be tested by creating a two-node flow where the first node outputs data, and the API Call node uses that data in its URL or body, then verifying the correct values are sent in the request.

**Acceptance Scenarios**:

1. **Given** an API Call node connected after another node that outputs data, **When** the user configures the API Call node, **Then** they can see available inputs from the previous node and select which values to use.

2. **Given** the user has mapped a previous node's output to the API Call URL field, **When** the flow executes, **Then** the URL is dynamically constructed with the actual value from the previous node.

3. **Given** the user is configuring input mappings, **When** they view the available inputs, **Then** the interface clearly shows what data is available from connected upstream nodes.

---

### User Story 3 - Handle API Call Errors Gracefully (Priority: P3)

A user wants their workflow to handle API failures without crashing. When an API call fails (network error, timeout, 4xx/5xx status), the node should capture the error information and make it available in the output so the workflow can respond appropriately.

**Why this priority**: Error handling ensures workflows are resilient. While not core functionality, it's essential for production-ready workflows that need to handle real-world failure scenarios.

**Independent Test**: Can be tested by configuring an API Call node with an invalid URL or a URL that returns an error status, executing the flow, and verifying the error information is captured in the output.

**Acceptance Scenarios**:

1. **Given** an API Call node configured with an unreachable URL, **When** the flow executes, **Then** the node outputs an error object containing the error type and message instead of crashing the flow.

2. **Given** an API Call node makes a request that returns a 4xx or 5xx status code, **When** the response is received, **Then** the node outputs the full response including status code so downstream logic can handle it.

3. **Given** an API Call node is configured with a timeout, **When** the request exceeds the timeout duration, **Then** the node outputs a timeout error.

---

### Edge Cases

- What happens when the URL field is empty? (Validation error shown, node cannot execute)
- What happens when headers contain invalid characters? (Validation feedback before execution)
- How does the system handle very large response bodies? (Response truncated or size limit enforced)
- What happens when the user provides an invalid URL format? (Validation error shown during configuration)
- How are redirects handled? (Follow redirects up to a reasonable limit, configurable in future versions)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display "API Call" as a selectable option in the "+" add node modal with an appropriate icon and description.
- **FR-002**: System MUST allow users to configure the HTTP method from a dropdown containing: GET, POST, PUT, DELETE, PATCH.
- **FR-003**: System MUST allow users to enter a URL for the API endpoint.
- **FR-004**: System MUST allow users to add, edit, and remove HTTP headers as key-value pairs.
- **FR-005**: System MUST render the API Call node with one input handle on the left side.
- **FR-006**: System MUST render the API Call node with one output handle on the right side.
- **FR-007**: System MUST execute the configured HTTP request asynchronously when the flow reaches this node.
- **FR-008**: System MUST output the API response (status code, response headers, response body) through the right-side output handle.
- **FR-009**: System MUST allow users to reference and map outputs from connected upstream nodes to use in URL, headers, or body configuration.
- **FR-010**: System MUST display available upstream node outputs in a clear, selectable interface when configuring input mappings.
- **FR-011**: System MUST capture and output error information when the API call fails (network error, timeout, or HTTP error status).
- **FR-012**: System MUST validate that the URL field is not empty before allowing flow execution.
- **FR-013**: System MUST support a configurable timeout for API requests with a sensible default (30 seconds).

### Key Entities

- **API Call Node**: A workflow node that performs HTTP requests. Key attributes: method, URL, headers, timeout, input mappings.
- **API Response**: The output produced by the node. Key attributes: status code, response headers, response body, success indicator, error details (if applicable).
- **Input Mapping**: Configuration that maps upstream node outputs to fields in the API Call configuration. Key attributes: source node ID, source field, target field (URL/header/body).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add and configure an API Call node in under 2 minutes for simple GET requests.
- **SC-002**: 95% of API Call nodes with valid configurations execute successfully on first attempt.
- **SC-003**: Users can complete input mapping from upstream nodes without referring to documentation.
- **SC-004**: API call response data is available to downstream nodes within 1 second of response receipt.
- **SC-005**: Error scenarios (timeouts, network failures, HTTP errors) provide clear, actionable error information in the output.

## Assumptions

- The existing node infrastructure (handles, connections, execution context) supports the addition of new node types without architectural changes.
- The flow execution engine already supports asynchronous operations based on the existing CallFlow node pattern.
- Users are familiar with basic HTTP concepts (methods, headers, URLs) from using similar tools.
- The system has access to make outbound HTTP requests (not blocked by firewall or network policy).
- Response bodies will be treated as JSON by default, with raw text fallback for non-JSON responses.
