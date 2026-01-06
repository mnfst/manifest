# Feature Specification: Manual Node Connection Workflow

**Feature Branch**: `018-node-connection`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "I want to redefine how nodes are created. When a user create a node it should appear in the canvas without any connection. Then the user will manually connect the handlers of 2 nodes to create a connection (flow.connections column). When hovering the connector, we should display a trash icon that will delete the connector. No confirmation is required for that. We should be able to create several nodes without connecting them. Only the nodes that are related to the 'user intent' node will be executed sequentially."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Unconnected Nodes (Priority: P1)

As a flow builder, I want to create nodes that appear on the canvas without any automatic connections, so that I have full control over my flow structure.

**Why this priority**: This is the foundational change that enables the new connection model. Without this, no other stories can function.

**Independent Test**: Can be tested by creating multiple nodes and verifying none have automatic connections. Delivers immediate value by giving users control over node placement.

**Acceptance Scenarios**:

1. **Given** I am on a flow canvas with a user intent defined, **When** I click "Add Step" and select a node type (Interface, Return, or CallFlow), **Then** the new node appears on the canvas without any connection to existing nodes.

2. **Given** I have created one unconnected node, **When** I create another node, **Then** both nodes remain unconnected and visible on the canvas.

3. **Given** I have multiple unconnected nodes on the canvas, **When** I view the flow, **Then** all nodes are displayed independently without any auto-generated edges.

---

### User Story 2 - Manual Connection Creation (Priority: P1)

As a flow builder, I want to manually connect nodes by dragging from one node's handle to another node's handle, so that I can define my own execution flow.

**Why this priority**: This is equally critical as P1 - users need the ability to create connections manually since automatic connections are removed.

**Independent Test**: Can be tested by creating two nodes and dragging from one handle to another to create a connection. Delivers value by enabling user-defined flow paths.

**Acceptance Scenarios**:

1. **Given** I have two unconnected nodes on the canvas, **When** I drag from a source handle on one node to a target handle on another node, **Then** a visual connection (edge) is created between them and saved to flow.connections.

2. **Given** I am dragging a connection from a source handle, **When** I hover over a valid target handle, **Then** the target handle is visually highlighted to indicate it can accept the connection.

3. **Given** I am dragging a connection, **When** I release over an invalid target or empty space, **Then** no connection is created.

---

### User Story 3 - Delete Connection on Hover (Priority: P2)

As a flow builder, I want to quickly delete connections by hovering over them and clicking a trash icon, so that I can easily modify my flow without extra confirmation dialogs.

**Why this priority**: Important for usability but users can work with the system using P1 stories alone. This enhances the editing experience.

**Independent Test**: Can be tested by creating a connection, hovering over it, and clicking the delete icon. Delivers value by providing a fast way to remove unwanted connections.

**Acceptance Scenarios**:

1. **Given** I have a connection between two nodes, **When** I hover over the connection line, **Then** a trash icon appears on or near the connection.

2. **Given** I see a trash icon on a connection, **When** I click the trash icon, **Then** the connection is immediately deleted without any confirmation dialog.

3. **Given** I delete a connection, **When** the deletion completes, **Then** the connection is removed from both the visual canvas and flow.connections in the database.

---

### User Story 4 - Sequential Execution of Connected Nodes (Priority: P2)

As a flow runner, I want only the nodes connected to the "user intent" node to be executed in sequence, so that unconnected nodes do not affect flow execution.

**Why this priority**: Important for the execution model but can be developed after the connection UI is complete.

**Independent Test**: Can be tested by creating a flow with some connected and some unconnected nodes, then executing the flow. Only connected nodes should run.

**Acceptance Scenarios**:

1. **Given** I have a flow with a user intent node connected to nodes A and B (in sequence), and an unconnected node C, **When** the flow is executed, **Then** only nodes A and B are executed, and node C is ignored.

2. **Given** I have multiple branches of connected nodes from the user intent, **When** the flow is executed, **Then** each branch is executed following the connection order.

---

### Edge Cases

- What happens when a user tries to create a circular connection (node A → node B → node A)?
- How does the system handle a node that was previously connected but is now orphaned after connection deletion?
- What happens when a user hovers over overlapping connections?
- How are unconnected nodes visually distinguished from connected ones?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create nodes (Interface, Return, CallFlow) that appear on the canvas without any automatic connections.
- **FR-002**: System MUST allow users to create multiple unconnected nodes simultaneously on the same canvas.
- **FR-003**: System MUST provide draggable handles on nodes that users can use to initiate connections.
- **FR-004**: System MUST create a connection (stored in flow.connections) when a user successfully drags from a source handle to a valid target handle.
- **FR-005**: System MUST display a trash icon when a user hovers over an existing connection line.
- **FR-006**: System MUST delete a connection immediately when the user clicks the trash icon, without requiring confirmation.
- **FR-007**: System MUST visually highlight valid target handles when a user is dragging a connection.
- **FR-008**: System MUST execute only nodes that are connected (directly or transitively) to the user intent node.
- **FR-009**: System MUST prevent circular connections that would create infinite execution loops.
- **FR-010**: System MUST persist all connections to the flow.connections column in the database.

### Key Entities

- **Node**: A step in the flow (Interface, Return, or CallFlow type) that can exist independently on the canvas without connections.
- **Connection**: A directional link between two nodes stored in flow.connections, defining execution order. Contains sourceNodeId, sourceHandle, targetNodeId, and targetHandle.
- **Handle**: A connectable point on a node (source for outgoing, target for incoming connections).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create 5 or more nodes on a canvas without any automatic connections appearing.
- **SC-002**: Users can manually create a connection between two nodes in under 3 seconds using drag-and-drop.
- **SC-003**: Users can delete a connection with a single click (no confirmation required) in under 1 second.
- **SC-004**: 100% of unconnected nodes are excluded from flow execution.
- **SC-005**: Users can successfully distinguish between connected and unconnected nodes visually.

## Assumptions

- The existing flow.connections column structure is sufficient for storing manual connections.
- React Flow's built-in handle and edge functionality supports the hover-to-delete interaction.
- Circular connection detection will be handled at connection creation time, not allowing the connection to be made.
- Orphaned nodes (previously connected but now unconnected) remain visible on the canvas for potential reconnection.
