# Feature Specification: Nodes Package Refactor

**Feature Branch**: `017-nodes-refactor`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "Refactor node entities into separate package with unified nodes and connections columns in Flow entity, inspired by n8n architecture"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Flow Designer Edits Nodes on Canvas (Priority: P1)

A flow designer opens an existing flow in the canvas editor and can see all nodes (Interface, Return, Call Flow) positioned correctly. They can drag nodes to reposition them, and the new positions are saved automatically. The designer can add new nodes, connect them visually, and see the flow structure clearly.

**Why this priority**: This is the core user experience for flow management. Without reliable node positioning and visualization, users cannot effectively design their flows.

**Independent Test**: Can be fully tested by opening a flow, verifying nodes appear at saved positions, dragging a node, and confirming the position persists after page reload.

**Acceptance Scenarios**:

1. **Given** a flow with 3 nodes (Interface, Return, Call Flow), **When** the user opens the flow canvas, **Then** all nodes appear at their saved x/y coordinates
2. **Given** a node on the canvas, **When** the user drags it to a new position, **Then** the new coordinates are saved to the flow's nodes data
3. **Given** two nodes on the canvas, **When** the user creates a connection between them, **Then** the connection is saved to the flow's connections data

---

### User Story 2 - System Executes Flow Nodes (Priority: P1)

When a flow is triggered, the system traverses the nodes using the connections data and executes each node's logic in the correct order. Interface nodes render their layouts, Return nodes output their text values, and Call Flow nodes invoke their target flows.

**Why this priority**: Flow execution is the primary function of the system. Nodes must execute correctly for the product to deliver value.

**Independent Test**: Can be fully tested by triggering a flow and verifying each node type executes its expected behavior in sequence.

**Acceptance Scenarios**:

1. **Given** a flow with an Interface node connected to a Return node, **When** the flow executes, **Then** the Interface renders first, followed by the Return value output
2. **Given** a Call Flow node with a valid target flow, **When** the node executes, **Then** it invokes the target flow and returns control to the caller
3. **Given** a flow with multiple branches, **When** executed, **Then** the system follows the connection paths correctly

---

### User Story 3 - Developer Adds New Node Type (Priority: P2)

A developer wants to add a new node type to the system. They create a new node definition in the nodes package with the required properties (name, displayName, icon, group, description) and an execute() function. The new node automatically becomes available in the flow editor.

**Why this priority**: Extensibility ensures the system can grow with new capabilities. This is important for long-term maintainability but not required for initial functionality.

**Independent Test**: Can be fully tested by creating a new node definition file, registering it in the package, and verifying it appears as an option in the flow editor.

**Acceptance Scenarios**:

1. **Given** a new node definition file with required properties, **When** registered in the nodes package, **Then** the node appears in the available nodes list
2. **Given** a registered node with an execute() function, **When** the node is placed in a flow and executed, **Then** the execute function is called with appropriate context

---

### User Story 4 - Migration of Existing Flows (Priority: P1)

When the system is updated, existing flows with separate View, ReturnValue, and CallFlow entities are automatically migrated to use the new nodes and connections JSON structure within the Flow entity.

**Why this priority**: Data integrity during migration is critical. Existing user data must be preserved without manual intervention.

**Independent Test**: Can be fully tested by running migration on a database with existing flows and verifying all nodes and connections are correctly converted.

**Acceptance Scenarios**:

1. **Given** a flow with View entities, **When** migration runs, **Then** each View becomes an Interface node in the nodes JSON with preserved properties and position
2. **Given** a flow with ActionConnection entities, **When** migration runs, **Then** connections are converted to the connections JSON format
3. **Given** a flow with ReturnValue and CallFlow entities, **When** migration runs, **Then** they become Return and CallFlow nodes respectively

---

### Edge Cases

- What happens when a node is deleted that has connections? Connections referencing the deleted node must be removed automatically
- How does the system handle a Call Flow node whose target flow is deleted? The node should indicate the target is missing and skip execution gracefully
- What happens when nodes have duplicate names within a flow? The system must enforce unique node names per flow
- How are orphaned connections handled (connections pointing to non-existent nodes)? They should be cleaned up automatically

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store all node instances within the Flow entity as a JSON column named "nodes"
- **FR-002**: System MUST store all connections within the Flow entity as a JSON column named "connections"
- **FR-003**: Each node instance MUST include: id (unique within flow), type (node type name), name (display name), position (x, y coordinates), and parameters (type-specific configuration)
- **FR-004**: Each connection MUST specify: sourceNodeId, sourceHandle, targetNodeId, targetHandle
- **FR-005**: System MUST provide a nodes package containing node type definitions separate from the core application
- **FR-006**: Each node type definition MUST include: name, displayName, icon, group (array of strings), description, and an execute() function
- **FR-007**: System MUST rename "View" node type to "Interface" throughout the codebase
- **FR-008**: System MUST rename "Return Value" node type to "Return" throughout the codebase
- **FR-009**: System MUST remove the separate ViewEntity, ReturnValueEntity, CallFlowEntity, and ActionConnectionEntity tables
- **FR-010**: System MUST provide migration scripts to convert existing entity data to the new JSON structure
- **FR-011**: System MUST validate node names are unique within each flow
- **FR-012**: System MUST automatically remove connections when their source or target node is deleted
- **FR-013**: The nodes package MUST export a registry of available node types for the core application to consume
- **FR-014**: Interface nodes MUST preserve their layoutTemplate and mockData properties within the node parameters
- **FR-015**: Return nodes MUST preserve their text property within the node parameters
- **FR-016**: CallFlow nodes MUST preserve their targetFlowId property within the node parameters

### Key Entities

- **Flow**: Represents a workflow containing nodes and connections. Key attributes: id, appId, name, description, toolName, toolDescription, parameters, nodes (JSON array), connections (JSON array), isActive, timestamps
- **Node Instance**: A placed node within a flow (stored in Flow.nodes). Key attributes: id, type, name, position {x, y}, parameters (varies by type)
- **Connection**: A link between two nodes (stored in Flow.connections). Key attributes: sourceNodeId, sourceHandle, targetNodeId, targetHandle
- **Node Type Definition**: A class/object defining a node's behavior (in nodes package). Key attributes: name, displayName, icon, group[], description, execute()

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing flows are successfully migrated with zero data loss (100% of nodes and connections preserved)
- **SC-002**: Flow editor canvas correctly displays nodes at their saved positions after reload
- **SC-003**: New node types can be added to the nodes package and appear in the editor without modifying core application code
- **SC-004**: Flow execution time is not degraded compared to the previous entity-based approach (within 10% of baseline)
- **SC-005**: Codebase reduces entity count from 5 separate tables (views, return_values, call_flows, action_connections, mock_data) to JSON columns within the Flow entity
- **SC-006**: Node position changes persist correctly when users drag nodes on the canvas

## Assumptions

- The n8n-style nodes/connections JSON structure is suitable for the existing storage approach with simple-json column type
- The current React Flow canvas implementation can adapt to read/write from JSON columns instead of separate entities
- Node type definitions will be objects/classes with a standard interface
- The nodes package will be part of the existing monorepo structure alongside backend and frontend packages
- MockData will become a property within Interface node parameters rather than a separate entity
