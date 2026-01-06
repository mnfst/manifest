# Feature Specification: Flow Execution Tracking

**Feature Branch**: `001-flow-executions`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "I want to track flow executions. A flow execution is when a flow is executed through an MCP server. It is a new entity that has the following props (at least): id, flowId (relation), startedAt, endedAt (optional), status (pending, fulfilled, error), initialParams (log of what we have from MCP client) and data (where we can pass the data through the nodes sequentially)"

## Clarifications

### Session 2026-01-06

- Q: Where should execution history be displayed? → A: In the "Usage" tab of the flow detail view
- Q: What layout should the execution history use? → A: Two-column Gmail-style layout with execution list on left, details panel on right
- Q: How should execution status be visually indicated? → A: Colored circles (red=error, orange=pending, green=fulfilled) like GitHub Actions
- Q: How should users understand status colors? → A: Hover tooltip on status indicator explaining the status meaning
- Q: What information should each execution list item display? → A: Start time + duration + first parameter preview
- Q: How should the execution list be sorted by default? → A: Most recent first (newest at top)
- Q: How long should execution records be retained? → A: Indefinite (never auto-delete)
- Q: How should the list handle large numbers of executions? → A: Traditional pagination (page numbers, prev/next buttons)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Flow Execution History (Priority: P1)

As a flow creator, I want to see a history of all executions for my flows in the "Usage" tab so that I can understand how they are being used and debug issues when they occur.

**Why this priority**: This is the core value proposition - without visibility into execution history, users cannot diagnose issues or understand usage patterns. It's the primary reason for tracking executions.

**Independent Test**: Can be fully tested by executing a flow via MCP and then viewing the execution record in the Usage tab. Delivers immediate value by providing visibility into flow usage.

**Acceptance Scenarios**:

1. **Given** a flow has been executed via MCP, **When** the user opens the "Usage" tab, **Then** they see a two-column layout with execution list on the left showing status indicator, start time, duration, and first parameter preview
2. **Given** an execution is in progress, **When** the user views the execution list, **Then** the execution appears with an orange circle (pending status) and no end time
3. **Given** a flow has never been executed, **When** the user views the Usage tab, **Then** they see an empty state indicating no executions yet
4. **Given** the user hovers over a status indicator, **When** the tooltip appears, **Then** it displays the status meaning (e.g., "Pending - Execution in progress")

---

### User Story 2 - Inspect Execution Details (Priority: P2)

As a flow creator, I want to click on an execution in the list and see its details in the right panel so that I can debug issues and understand flow behavior.

**Why this priority**: Once users can see executions exist (P1), they need to drill into details for debugging. This is essential for troubleshooting but depends on P1 being complete.

**Independent Test**: Can be tested by clicking on an execution in the left panel list and verifying all expected details (initial params, node-by-node data, final status) are displayed in the right detail panel.

**Acceptance Scenarios**:

1. **Given** an execution has completed, **When** the user clicks on it in the list, **Then** the right panel displays the initial parameters that triggered the execution
2. **Given** an execution has processed multiple nodes, **When** the user views execution details in the right panel, **Then** they see the data state after each node in the execution sequence
3. **Given** an execution ended in error, **When** the user views execution details, **Then** the right panel shows which node failed and the error information
4. **Given** no execution is selected, **When** the user views the Usage tab, **Then** the right panel shows a placeholder prompting to select an execution

---

### User Story 3 - Track Execution Status in Real-Time (Priority: P3)

As a flow creator, I want to see the current status of ongoing executions so that I can monitor flows while they run.

**Why this priority**: Real-time monitoring is valuable but not essential for the core debugging and visibility use case. Most flows complete quickly, making this a nice-to-have enhancement.

**Independent Test**: Can be tested by triggering a flow execution and observing the status update from pending to fulfilled/error in the UI without manual refresh.

**Acceptance Scenarios**:

1. **Given** an execution is in progress, **When** the status changes, **Then** the UI reflects the new status without requiring a page refresh
2. **Given** an execution completes while user is viewing the list, **When** the execution finishes, **Then** the end time and final status are displayed automatically

---

### Edge Cases

- What happens when a flow execution is interrupted due to server restart?
  - Executions in "pending" status at server restart should be marked as "error" with an appropriate message
- How does the system handle extremely long-running executions?
  - Executions should have a reasonable timeout after which they are marked as "error" (default: 5 minutes)
- What happens when the associated flow is deleted while viewing execution history?
  - Execution records should be retained for historical purposes with a reference to the deleted flow's name
- How are concurrent executions of the same flow handled?
  - Each execution is independent and tracked separately with its own data context

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a new FlowExecution record when a flow is invoked via MCP server
- **FR-002**: System MUST capture the initial parameters from the MCP client request in the execution record
- **FR-003**: System MUST record the start timestamp when execution begins
- **FR-004**: System MUST update the end timestamp when execution completes (success or error)
- **FR-005**: System MUST track execution status with values: pending (in progress), fulfilled (completed successfully), error (failed)
- **FR-006**: System MUST maintain a data object that accumulates results as execution passes through each node
- **FR-007**: System MUST record which node caused a failure when execution ends in error status
- **FR-008**: System MUST associate each execution with its parent flow via flowId
- **FR-009**: Users MUST be able to view a list of executions in the "Usage" tab of flow detail, displayed in a two-column layout with list on left and details on right
- **FR-010**: Users MUST be able to click an execution in the list to view its details in the right panel
- **FR-013**: System MUST display execution status using colored circle indicators: green (fulfilled), orange (pending), red (error)
- **FR-014**: Status indicators MUST show a tooltip on hover explaining the status meaning
- **FR-015**: Each execution list item MUST display: status indicator, start time, duration (if completed), and a preview of the first parameter
- **FR-016**: Execution list MUST be sorted by start time descending (most recent first) by default
- **FR-017**: System MUST retain execution records indefinitely (no automatic deletion)
- **FR-018**: Execution list MUST use traditional pagination with page numbers and prev/next navigation
- **FR-011**: System MUST retain execution records when the associated flow is deleted
- **FR-012**: System MUST handle concurrent executions of the same flow independently

### Key Entities

- **FlowExecution**: Represents a single invocation of a flow via MCP. Key attributes:
  - Unique identifier
  - Reference to the flow being executed
  - Execution status (pending, fulfilled, error)
  - Start timestamp (when execution began)
  - End timestamp (when execution completed, if applicable)
  - Initial parameters (captured from MCP client request)
  - Data context (accumulated results from node execution)
  - Error information (if execution failed)

- **Flow** (existing entity): The workflow being executed. FlowExecution has a many-to-one relationship with Flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All flow executions via MCP are captured with 100% reliability - no executions are lost
- **SC-002**: Users can retrieve execution history for any flow within 2 seconds
- **SC-003**: Execution details (initial params, node data progression) are accessible within 1 second of selection
- **SC-004**: Users can identify the cause of failed executions (which node, what error) in 90% of error cases
- **SC-005**: Execution tracking adds no more than 10% overhead to flow execution time
- **SC-006**: Execution records remain available even after flow deletion for historical analysis

## Assumptions

- Flow executions are typically short-lived (seconds to a few minutes), not long-running background processes
- The MCP client provides initial parameters in a structured format that can be stored as-is
- The data context passed between nodes is serializable and can be stored for later inspection
- Execution volume is moderate (thousands per day, not millions) - sufficient for typical app usage patterns
- Users primarily need read access to execution history; bulk export or analytics are future enhancements
