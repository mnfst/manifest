# Feature Specification: Transform Node Category

**Feature Branch**: `089-transform-nodes`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "Create a Transform node category with nodes responsible for transforming output formats between incompatible connectors, featuring visual diamond-shaped nodes, auto-suggestion on incompatibility, and a JavaScript Code transformer with CodeMirror editor"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Transformer via Incompatibility Suggestion (Priority: P1)

A flow builder encounters an incompatible connection between two nodes. The system detects the mismatch and suggests adding a transformer. The user clicks "Add a transformer" and selects from available transformer nodes in the library. The selected transformer is automatically inserted between the two nodes, connecting both ends.

**Why this priority**: This is the core value proposition - helping users resolve data format mismatches seamlessly without manual intervention. It directly addresses the pain point of incompatible node connections.

**Independent Test**: Can be fully tested by creating two nodes with incompatible schemas, triggering the suggestion, and inserting a transformer. Delivers immediate value by solving connection issues.

**Acceptance Scenarios**:

1. **Given** two nodes are connected with incompatible output/input schemas, **When** the user views the connection, **Then** an "Add a transformer" button appears on or near the incompatible connector
2. **Given** the "Add a transformer" button is clicked, **When** the node library opens, **Then** only transformer nodes from the Transform category are shown (no other node types)
3. **Given** a transformer is selected from the library, **When** confirmed, **Then** the transformer is inserted between the two nodes with both connections established automatically
4. **Given** a transformer is inserted, **When** the canvas updates, **Then** the transformer appears as a smaller 45-degree rotated square (diamond shape) with the distinctive icon

---

### User Story 2 - Configure JavaScript Code Transformer (Priority: P2)

A user needs to transform data between nodes using custom JavaScript logic. They add or edit a JavaScript Code transformer node and write transformation code in a CodeMirror editor. The editor displays a function template that receives the previous node's output as input and returns the transformed output. As the user writes code, the output schema preview updates dynamically.

**Why this priority**: The JavaScript Code transformer is the first and most flexible transformer node, enabling users to handle any transformation scenario. Configuration is essential for the node to be useful.

**Independent Test**: Can be tested by opening a JavaScript Code transformer's modal, writing transformation code, and verifying the output schema updates. Delivers value by enabling custom data transformations.

**Acceptance Scenarios**:

1. **Given** a JavaScript Code transformer exists on the canvas, **When** the user opens its configuration modal, **Then** a CodeMirror editor is displayed with a function template
2. **Given** the editor is open, **When** viewing the function template, **Then** it shows parameters representing the output schema of the connected upstream node
3. **Given** the user writes valid transformation code, **When** the code changes, **Then** the output schema preview updates dynamically to reflect the return type
4. **Given** the user saves the configuration, **When** the modal closes, **Then** the transformer node stores the code and the output schema is available to downstream nodes

---

### User Story 3 - Manually Add Transformer Node (Priority: P3)

A user wants to proactively add a transformer node after an existing node, anticipating the need for data transformation. They can add a transformer manually from the node library or context menu, but the transformer must always connect to an upstream node (left side) since it requires input data.

**Why this priority**: Manual addition provides flexibility for users who want to plan their flows in advance. However, it's less critical than auto-suggestion since users can always use that feature.

**Independent Test**: Can be tested by manually adding a transformer node to the canvas and attempting to connect it. Delivers value by giving users proactive control over flow design.

**Acceptance Scenarios**:

1. **Given** a user opens the node library, **When** browsing the Transform category, **Then** transformer nodes (including JavaScript Code) are listed with their distinctive diamond icon
2. **Given** a transformer node is dragged onto the canvas without connections, **When** viewing its state, **Then** it indicates it requires an input connection (left handle must be connected)
3. **Given** a transformer node has no input connection, **When** the user attempts to save/execute the flow, **Then** a validation error indicates the transformer needs an input source
4. **Given** a transformer is connected on its left (input) side, **When** the right (output) side is unconnected, **Then** the node is valid (output is optional for downstream connections)

---

### User Story 4 - Track Transformer Execution on Usage Screen (Priority: P4)

An administrator or user wants to monitor transformer node executions to understand flow performance and troubleshoot issues. The usage screen displays execution data for transformer nodes with their distinctive styling and category color.

**Why this priority**: Execution tracking is important for production monitoring but is not required for the core transformation functionality to work.

**Independent Test**: Can be tested by executing a flow with transformer nodes and viewing the usage screen. Delivers value by providing visibility into transformer performance.

**Acceptance Scenarios**:

1. **Given** a flow containing transformer nodes has executed, **When** viewing the usage screen, **Then** transformer node executions appear with the Transform category color
2. **Given** transformer executions are displayed, **When** viewing execution details, **Then** input data, output data, and execution time are visible
3. **Given** a transformer execution failed, **When** viewing the usage screen, **Then** the error is displayed with the failed execution highlighted

---

### Edge Cases

- What happens when a transformer node is deleted while connected between two nodes? The two original nodes should become disconnected.
- How does the system handle circular transformer chains? The system should prevent creating circular connections.
- What happens when upstream schema changes after transformer code is written? The editor should show a warning about schema changes and allow updating the function parameters.
- How does the system behave when JavaScript code has syntax errors? The editor should highlight syntax errors in real-time and prevent saving invalid code.
- What happens when a transformer's output schema cannot be determined from the code? The system should allow manual schema definition or show "unknown" type.

## Requirements *(mandatory)*

### Functional Requirements

**Node Category & Visual Design**
- **FR-001**: System MUST provide a "Transform" node category in the node library containing all transformer nodes
- **FR-002**: Transformer nodes MUST render as 45-degree rotated squares (diamond shape) smaller than standard nodes
- **FR-003**: Transformer nodes MUST display exactly two handles: one input (left) and one output (right)
- **FR-004**: Transformer nodes MUST display an icon resembling the UNO reverse/change turn card
- **FR-005**: Transform category and transformer nodes MUST have a distinct, consistent color throughout the application

**Incompatibility Detection & Suggestion**
- **FR-006**: System MUST detect when connected nodes have incompatible output/input schemas
- **FR-007**: System MUST display an "Add a transformer" button when incompatible connections are detected
- **FR-008**: Clicking "Add a transformer" MUST open the node library filtered to show only Transform category nodes
- **FR-009**: System MUST automatically insert the selected transformer between the two originally connected nodes
- **FR-010**: System MUST establish connections from the upstream node to transformer input, and transformer output to downstream node

**Manual Addition & Validation**
- **FR-011**: Users MUST be able to add transformer nodes manually from the node library
- **FR-012**: Transformer nodes MUST always require an input connection (left handle connected to upstream node)
- **FR-013**: System MUST validate that transformer nodes have input connections before flow execution
- **FR-014**: System MUST display validation errors for transformer nodes without input connections

**JavaScript Code Transformer**
- **FR-015**: System MUST provide a "JavaScript Code" transformer node as the first transformer type
- **FR-016**: JavaScript Code transformer configuration modal MUST include a CodeMirror editor
- **FR-017**: The CodeMirror editor MUST display a function template with parameters matching the upstream node's output schema
- **FR-018**: The output schema preview MUST update dynamically as the user modifies the transformation code
- **FR-019**: System MUST validate JavaScript syntax and highlight errors in real-time
- **FR-020**: System MUST store the transformation code when the user saves the configuration

**Execution Tracking**
- **FR-021**: System MUST track execution data for transformer nodes (input, output, timing, status)
- **FR-022**: Usage screen MUST display transformer executions with the Transform category color
- **FR-023**: Usage screen MUST show transformer execution details including input data, output data, and errors

### Key Entities

- **Transform Category**: A node category grouping all transformer nodes, with a distinctive color identifier
- **Transformer Node**: A specialized node type with diamond visual representation, two handles, and the purpose of converting data formats between nodes
- **JavaScript Code Transformer**: A specific transformer node type that executes user-defined JavaScript code to transform data
- **Transformation Function**: User-written JavaScript code that receives input data and returns transformed output
- **Schema Compatibility**: The relationship between node output schemas and downstream input schemas that determines if transformation is needed

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can resolve incompatible node connections by adding a transformer within 3 clicks (button click, select transformer, confirm)
- **SC-002**: Transformer nodes are visually distinguishable from other nodes at a glance (different shape, size, and color)
- **SC-003**: Users can write and test transformation code with immediate visual feedback on output schema changes
- **SC-004**: 100% of transformer node executions are tracked and visible on the usage screen
- **SC-005**: Flow validation catches all transformer nodes missing required input connections before execution
- **SC-006**: JavaScript syntax errors are detected and displayed to users within 1 second of code changes

## Assumptions

- The existing node library infrastructure supports filtering by category
- The I/O schema system (from feature 001-io-schemas) provides schema compatibility checking capabilities
- CodeMirror or equivalent code editor can be integrated into the modal system
- The usage/execution tracking system can be extended to support new node types
- The canvas rendering system (xyflow) supports custom node shapes and rotations
