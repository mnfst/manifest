# Feature Specification: Standardized Execution Metadata and Enhanced Usage UI

**Feature Branch**: `001-execution-metadata-ui`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "All nodes should pass value to downstream nodes at the root level. The execution metadata should be passed in an '_execution' property with standardized properties like success (bool), error? (string), and so on. See if other nodes need to produce specific metadata and create a TS interface that all nodes will follow. Once we have that, we can improve the 'usage' tabs by showing this data in an easy way. If there is an error we should see it quickly, success should also show a green circle somewhere. Think about the best way of doing that by taking inspiration from other products that have to display workflow execution logging UIs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Execution Status at a Glance (Priority: P1)

As a flow builder, I want to see the success or failure status of each node execution immediately when viewing the usage tab, so I can quickly identify issues without digging into details.

**Why this priority**: This is the core user need - understanding execution status quickly. Without visual indicators, users waste time clicking into each execution to find problems.

**Independent Test**: Can be fully tested by triggering a flow execution and observing the usage tab. Delivers immediate value by surfacing execution status visually.

**Acceptance Scenarios**:

1. **Given** a flow has executed successfully, **When** I view the usage tab, **Then** I see a green success indicator next to each successfully completed node
2. **Given** a flow has a failed node, **When** I view the usage tab, **Then** I see a red error indicator next to the failed node and can immediately identify which node failed
3. **Given** a flow is currently executing, **When** I view the usage tab, **Then** I see a pending/in-progress indicator (orange) for nodes that haven't completed yet

---

### User Story 2 - Access Error Details Quickly (Priority: P1)

As a flow builder, I want to see error messages prominently displayed when a node fails, so I can understand what went wrong without navigating through multiple views.

**Why this priority**: Error diagnosis is critical for debugging flows. Users need immediate access to error information.

**Independent Test**: Can be tested by triggering a flow that fails and observing error message visibility. Delivers value by reducing time-to-diagnosis.

**Acceptance Scenarios**:

1. **Given** a node execution has failed, **When** I view the execution details, **Then** I see the error message prominently displayed (not hidden in collapsed JSON)
2. **Given** multiple nodes in a flow have errors, **When** I view the execution list, **Then** I can see which specific nodes failed and their error summaries
3. **Given** an API call node fails, **When** I view the error details, **Then** I see relevant context (HTTP status, response body preview, duration)

---

### User Story 3 - Consistent Data Format from All Nodes (Priority: P2)

As a flow builder, I want all nodes to output data in a consistent format with standardized metadata, so downstream nodes can reliably access both the data and execution context.

**Why this priority**: Standardization enables predictable behavior when building flows and simplifies debugging. Lower than P1 because this is more of an infrastructure improvement.

**Independent Test**: Can be tested by connecting any two node types and verifying the downstream node receives data in the expected format with execution metadata.

**Acceptance Scenarios**:

1. **Given** any node executes successfully, **When** its output is passed downstream, **Then** the actual data is at the root level (not wrapped in a "data" property)
2. **Given** any node executes, **When** checking its output, **Then** an `_execution` property contains standardized metadata (success status, error if any)
3. **Given** an API call node executes, **When** checking its `_execution` metadata, **Then** it includes API-specific information (HTTP status, duration, request details)

---

### User Story 4 - Understand Execution Timeline (Priority: P3)

As a flow builder, I want to see how long each node took to execute, so I can identify performance bottlenecks in my flows.

**Why this priority**: Performance optimization is valuable but secondary to correctness. Users first need to know if it works, then how fast.

**Independent Test**: Can be tested by executing a flow and observing execution duration displayed for each node.

**Acceptance Scenarios**:

1. **Given** a node has finished executing, **When** I view its execution details, **Then** I see how long the execution took
2. **Given** a flow with multiple nodes completes, **When** I view the execution summary, **Then** I can see the total flow duration and per-node breakdown
3. **Given** a node takes longer than expected, **When** I view the execution list, **Then** I can identify slow executions by their displayed duration

---

### Edge Cases

- What happens when a node produces non-object output (e.g., a string or number)?
  - The output should be wrapped: `{ _value: <primitive>, _execution: {...} }`
- How does the system handle nodes that timeout during execution?
  - The `_execution` property should include a timeout indicator and partial results if available
- What happens when a transformer node's code throws an exception?
  - The error is captured in `_execution.error` and the node shows as failed in the UI
- How are pending/in-progress executions displayed?
  - Nodes show a spinner or pulsing indicator until completion; status updates in real-time

## Requirements *(mandatory)*

### Functional Requirements

**Execution Metadata Standard**

- **FR-001**: System MUST ensure all node types output their data at the root level of the output object, not wrapped in a nested "data" property
- **FR-002**: System MUST include an `_execution` property in every node's output containing standardized execution metadata
- **FR-003**: The `_execution` property MUST include at minimum: success status (boolean), and error message (string, if failed)
- **FR-004**: API-related nodes MUST include additional metadata in `_execution`: HTTP status code, request duration, and response headers summary
- **FR-005**: Transform nodes MUST include execution duration in their `_execution` metadata
- **FR-006**: The `_execution` property MUST be consistently named across all node types (not `_meta`, `__execution`, or other variants)

**Usage Tab UI**

- **FR-007**: The execution list MUST display a visual status indicator (colored circle/icon) for each execution showing success (green), error (red), or pending (orange) state
- **FR-008**: Individual node cards in execution details MUST display a status indicator showing the node's execution result
- **FR-009**: Error messages MUST be displayed prominently when a node fails, not hidden within collapsed JSON viewers
- **FR-010**: The UI MUST show execution duration for each node that tracks timing information
- **FR-011**: Users MUST be able to identify which specific node failed in a flow execution from the execution list view (without opening details)
- **FR-012**: The UI MUST support real-time status updates for in-progress executions

**Data Viewer Enhancements**

- **FR-013**: The data viewer MUST separate `_execution` metadata from the actual output data visually
- **FR-014**: Success/failure status MUST be visible without expanding any collapsed sections
- **FR-015**: Error messages MUST be displayed in a visually distinct manner (e.g., red background, warning icon)

### Key Entities

- **ExecutionMetadata**: Standardized metadata attached to every node output, containing success status, optional error details, optional timing information, and node-type-specific data
- **NodeOutput**: The output structure from any node, containing the actual result data at root level plus the `_execution` metadata property
- **ExecutionStatus**: Visual representation of node/flow execution state (pending, success, error) used throughout the UI

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify failed executions in under 2 seconds when viewing the usage tab (visual indicator immediately visible)
- **SC-002**: Error messages are visible without any user interaction (no clicking to expand, no scrolling within the card)
- **SC-003**: 100% of node types include the standardized `_execution` metadata in their output
- **SC-004**: Users can determine which specific node failed without opening execution details (error node name/indicator visible in list)
- **SC-005**: Execution duration is displayed for all node types that perform external operations (API calls) or computations (transforms)
- **SC-006**: The time to diagnose a failed execution is reduced (user can identify the failing node and error message within 5 seconds of opening the usage tab)

## Assumptions

- The existing execution storage mechanism (FlowExecution, NodeExecutionData) will be preserved and extended rather than replaced
- Real-time polling for execution updates will continue to use the existing 3-second interval approach
- The visual design should follow existing UI patterns for consistency
- Non-object outputs from nodes (primitives) will be wrapped in a `_value` property to maintain consistent structure
- Interface nodes (StatCard, PostList) that don't perform operations may have minimal `_execution` metadata (just success: true)
