# Feature Specification: Node I/O Schema Validation

**Feature Branch**: `001-io-schemas`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "Schema-validated workflow system with JSON Schema input/output validation for node connections, design-time compatibility checking, and visual schema feedback"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Node Schema Information (Priority: P1)

As a workflow designer, I want to see the input and output schema formats for any node so that I understand what data a node expects and produces.

**Why this priority**: This is foundational - users need visibility into schemas before they can reason about compatibility. Without this, all other features lack context.

**Independent Test**: Can be fully tested by selecting any node on the canvas and viewing its schema information panel, delivering immediate value for understanding node data contracts.

**Acceptance Scenarios**:

1. **Given** a node is selected on the canvas, **When** the user views the node details, **Then** the input schema and output schema are displayed in a readable format
2. **Given** a node with a static schema (e.g., "Send Email"), **When** the user views its schema, **Then** the schema shows predefined fields with their types and required status
3. **Given** a node with a dynamic schema (e.g., "User Intent Trigger" with user-defined parameters), **When** the user views its schema, **Then** the schema reflects the current parameter configuration
4. **Given** a "Return" node, **When** the user views its schema, **Then** only the input schema is shown (no output schema displayed)

---

### User Story 2 - Design-Time Compatibility Validation (Priority: P1)

As a workflow designer, I want the system to validate schema compatibility when I attempt to connect two nodes, so I know immediately if the connection is valid.

**Why this priority**: Proactive validation prevents runtime failures and catches errors at design time, which is the core value proposition of this feature.

**Independent Test**: Can be tested by attempting to connect incompatible nodes and observing the validation feedback.

**Acceptance Scenarios**:

1. **Given** I drag a connection from Node A's output to Node B's input, **When** Node A's output schema is compatible with Node B's input schema, **Then** the connection is allowed and created
2. **Given** I drag a connection from Node A's output to Node B's input, **When** required fields in Node B's input are missing from Node A's output, **Then** the connection is blocked and an error message shows which fields are missing
3. **Given** I drag a connection from Node A's output to Node B's input, **When** field types do not match (e.g., string expected but number provided), **Then** the connection is blocked and an error message shows the type mismatch
4. **Given** a connection attempt with warnings (e.g., type coercion possible), **When** the user proceeds, **Then** the connection is created with a warning indicator

---

### User Story 3 - Inspect Schema Compatibility Details (Priority: P2)

As a workflow designer, I want to see detailed compatibility information between connected nodes so I can understand exactly what data flows between them and identify any issues.

**Why this priority**: While visual indicators (P1) provide quick feedback, detailed inspection is needed for troubleshooting and understanding complex schemas.

**Independent Test**: Can be tested by selecting a connection and viewing the detailed compatibility panel.

**Acceptance Scenarios**:

1. **Given** an existing connection between two nodes, **When** I select/hover the connection, **Then** I see a detailed view showing: source output schema, target input schema, and field-by-field compatibility status
2. **Given** a connection with compatibility warnings, **When** I inspect the connection, **Then** each warning is listed with an explanation (e.g., "Field 'count' - output is number, input expects string - will be auto-converted")
3. **Given** an incompatible connection, **When** I inspect the connection, **Then** each incompatibility is listed with a clear explanation of what's wrong

---

### User Story 4 - Dynamic Schema Resolution (Priority: P2)

As a workflow designer, when I use nodes with dynamic schemas (like API Call or User Intent Trigger), I want the system to compute or fetch the actual schema so compatibility can still be validated.

**Why this priority**: Without dynamic schema support, many practical nodes cannot participate in design-time validation, limiting the feature's usefulness.

**Independent Test**: Can be tested by configuring an API Call node with parameters and verifying the schema updates accordingly.

**Acceptance Scenarios**:

1. **Given** a "User Intent Trigger" node with parameters defined by the user, **When** the user modifies the parameters, **Then** the output schema updates to reflect those parameters
2. **Given** an "API Call" node that requires execution to determine its output schema, **When** the user triggers schema discovery, **Then** the system fetches/computes the schema (may require a test call) and updates the node's schema
3. **Given** a node with a dynamic schema that hasn't been resolved yet, **When** the user attempts to connect it, **Then** the system indicates the schema is "unknown/pending" and validation cannot be performed

---

### User Story 5 - Flow-Level Validation Summary (Priority: P3)

As a workflow designer, I want to see an overall validation status for my entire flow so I can quickly identify if any connections have issues.

**Why this priority**: While individual connection validation (P1) handles most cases, a flow-level summary improves efficiency for complex workflows.

**Independent Test**: Can be tested by viewing the flow summary panel which shows overall validation status across all connections.

**Acceptance Scenarios**:

1. **Given** a flow with all compatible connections, **When** I view the flow validation summary, **Then** it shows "All connections valid" status
2. **Given** a flow with some warning connections, **When** I view the flow validation summary, **Then** it shows a count of warnings and allows navigation to each
3. **Given** a flow with incompatible connections, **When** I view the flow validation summary, **Then** it shows error count and allows navigation to each error

---

### Edge Cases

- What happens when a node's schema cannot be determined (API not responding, configuration incomplete)?
  - The node should display an "unknown schema" state and connections should show an "unvalidated" status rather than blocking
- What happens when a schema is updated after connections are already made?
  - Existing connections should be re-validated and their visual status updated accordingly
- How does the system handle circular references in JSON Schema?
  - Standard JSON Schema $ref resolution should be used; deeply nested circular refs should have a reasonable depth limit for display
- What happens with "any" or "unknown" type fields?
  - These should be treated as compatible with any type (wildcard matching)
- How are optional vs required fields handled?
  - Missing optional fields in source = compatible; Missing required fields in source = error

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every node definition MUST declare an `inputSchema` (JSON Schema) describing expected input data
- **FR-002**: Every node definition MUST declare an `outputSchema` (JSON Schema) describing guaranteed output data (except "Return" nodes which have no output)
- **FR-003**: System MUST validate schema compatibility when a connection is attempted between two nodes
- **FR-004**: System MUST block connections when required fields are missing from the source node's output
- **FR-005**: System MUST block connections when field types are incompatible and no safe coercion exists
- **FR-006**: System MUST allow connections when source output has additional fields not required by target input (structural subtyping)
- **FR-007**: System MUST display input/output schemas in a human-readable format when viewing node details
- **FR-008**: System MUST visually distinguish connection states: compatible (valid), warning (with issues), and error (incompatible)
- **FR-009**: System MUST provide detailed error/warning messages explaining why a connection is problematic
- **FR-010**: System MUST support nodes with static schemas (predefined in node definition)
- **FR-011**: System MUST support nodes with dynamic schemas (computed from node configuration/parameters)
- **FR-012**: System MUST re-validate existing connections when a connected node's schema changes
- **FR-013**: System MUST provide a mechanism for nodes that require runtime execution to discover their output schema
- **FR-014**: System MUST handle "unknown" schema state gracefully when schema cannot be determined

### Key Entities

- **Node Schema**: Represents the input/output data contract for a node. Contains `inputSchema` and `outputSchema` as JSON Schema objects. Can be static (defined at node type level) or dynamic (computed from node instance configuration).

- **Schema Compatibility Result**: The outcome of comparing two schemas for connection compatibility. Contains: compatibility status (compatible/warning/error), list of issues (missing fields, type mismatches), and suggested resolutions.

- **Connection Validation State**: The validation status associated with a connection in the flow. Tracks the current compatibility result and updates when connected node schemas change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Workflow designers can identify incompatible connections before saving/running a flow 100% of the time (design-time validation)
- **SC-002**: All connection compatibility issues are visible within 1 second of making a connection
- **SC-003**: Users can view full schema details for any node within 2 interactions (clicks/hovers)
- **SC-004**: Schema validation catches 100% of type mismatches and missing required fields
- **SC-005**: 90% of users can identify and understand connection errors without consulting documentation
- **SC-006**: Flow-level validation summary accurately reflects all individual connection states
- **SC-007**: Dynamic schema nodes display updated schemas within 3 seconds of configuration changes

## Assumptions

- JSON is the only data format exchanged between nodes (as specified by user)
- JSON Schema (draft-07 or later) is sufficient for describing all node data contracts
- Nodes will adopt this schema pattern incrementally - existing nodes without schemas will be treated as having "unknown" schemas
- The visual indicators (colors) for connection states will follow standard UX conventions (green=good, yellow=warning, red=error)
- Transform/data mapping nodes are explicitly out of scope for this sprint (noted by user)
- Schema discovery for dynamic nodes (like API Call) may require async operations and should not block the UI

## Out of Scope

- **Transform/Data Mapping Node**: The automatic insertion of data mapping nodes when schemas are incompatible is deferred to a future sprint
- **Auto-fix suggestions**: Automatic generation of transformation logic between incompatible schemas
- **Schema versioning**: Tracking schema changes over time or migration support
- **Non-JSON data formats**: Support for binary, XML, or other data formats between nodes
