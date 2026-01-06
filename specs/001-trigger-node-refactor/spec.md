# Feature Specification: Trigger Node Refactor

**Feature Branch**: `001-trigger-node-refactor`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "Refactor the user intent node from a flow-level concept into a proper trigger node type, introducing node type categories (trigger, interface, action, return), renaming existing nodes, and updating the add-step modal to support grouped node selection."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add User Intent Trigger Node (Priority: P1)

A flow builder user opens the canvas to create a new workflow. They click the "+" button to add a node and see a modal with nodes organized by category. Under the "Trigger" category, they select "User Intent" and a new trigger node appears on the canvas. They configure when the AI should use this flow and when it should not, directly on this node.

**Why this priority**: This is the core functionality that replaces the existing flow-level user intent configuration. Without this, flows cannot define their activation conditions in the new architecture.

**Independent Test**: Can be fully tested by creating a new flow, adding a User Intent trigger node, configuring its properties, saving, and verifying the trigger persists correctly.

**Acceptance Scenarios**:

1. **Given** a user is on the flow canvas, **When** they click the "+" button to add a node, **Then** they see a modal with nodes grouped by type categories including a "Trigger" section with "User Intent" option.
2. **Given** the add-step modal is open, **When** the user selects "User Intent" from the Trigger category, **Then** a new UserIntentNode is created on the canvas with only a right-side handle (output only).
3. **Given** a UserIntentNode exists on the canvas, **When** the user edits it, **Then** they can configure "When to Use" and "When Not to Use" properties.

---

### User Story 2 - Multiple Triggers Per Flow (Priority: P1)

A flow builder user wants their workflow to be triggered by multiple different user intents. They add a second User Intent trigger node to the same flow, each with different "when to use" conditions. Both triggers can connect to the same downstream nodes.

**Why this priority**: The ability to have multiple triggers per flow is a key architectural change that enables more flexible workflow design and is explicitly required in the feature request.

**Independent Test**: Can be fully tested by adding two User Intent trigger nodes to the same flow, configuring them differently, connecting both to a shared downstream node, and verifying both persist and function correctly.

**Acceptance Scenarios**:

1. **Given** a flow already has one UserIntentNode, **When** the user adds another UserIntentNode, **Then** the system allows it and both nodes appear on the canvas.
2. **Given** multiple UserIntentNodes exist in a flow, **When** the user saves the flow, **Then** all trigger nodes are persisted with their individual configurations.
3. **Given** multiple UserIntentNodes exist, **When** viewing the flow structure, **Then** each trigger node shows only a right-side (output) handle with no left-side (input) handle.

---

### User Story 3 - Grouped Node Selection Modal (Priority: P2)

A flow builder user opens the add-step modal and sees nodes clearly organized into categories: Triggers, Interfaces, Actions, and Return Values. This organization helps them quickly find the type of node they need.

**Why this priority**: While the system can function with a flat list, the grouped modal significantly improves usability and reflects the new node type architecture.

**Independent Test**: Can be fully tested by opening the add-step modal and verifying all node types appear under their correct category headers.

**Acceptance Scenarios**:

1. **Given** the add-step modal is open, **When** viewing available nodes, **Then** nodes are visually grouped under category headers: "Triggers", "Agentic Interfaces", "Actions", and "Return Values".
2. **Given** the add-step modal shows grouped nodes, **When** the user looks at the "Triggers" category, **Then** they see "User Intent" as an available option.
3. **Given** the add-step modal shows grouped nodes, **When** the user looks at the "Agentic Interfaces" category, **Then** they see the renamed "Agentic Interface" node (formerly "Interface").

---

### User Story 4 - Existing Nodes with New Names (Priority: P2)

A flow builder user sees the existing Interface node now labeled as "Agentic Interface" and the Return node labeled as "Return Value" throughout the application. The functionality remains the same, only the display names have changed.

**Why this priority**: Renaming provides clarity and consistency with the new node type architecture, but the underlying functionality doesn't change.

**Independent Test**: Can be fully tested by viewing any existing flow with Interface or Return nodes and verifying they display with new names.

**Acceptance Scenarios**:

1. **Given** a flow has existing Interface nodes, **When** viewing the canvas or node list, **Then** they are displayed as "Agentic Interface".
2. **Given** a flow has existing Return nodes, **When** viewing the canvas or node list, **Then** they are displayed as "Return Value".
3. **Given** the add-step modal is open, **When** viewing available nodes, **Then** "Agentic Interface" appears under "Agentic Interfaces" category and "Return Value" appears under "Return Values" category.

---

### User Story 5 - Migration of Existing Flow Data (Priority: P3)

A user with existing flows opens the application. Their flows that previously had user intent configuration at the flow level are automatically migrated to include a UserIntentNode containing that data. The flow entity no longer stores whenToUse and whenNotToUse properties.

**Why this priority**: This ensures backward compatibility and data integrity for existing users, but is needed only after the core functionality is in place.

**Independent Test**: Can be fully tested by loading an existing flow with flow-level user intent data and verifying a UserIntentNode is created with that data.

**Acceptance Scenarios**:

1. **Given** an existing flow has flow-level whenToUse and whenNotToUse values, **When** the migration runs, **Then** a UserIntentNode is created containing those values.
2. **Given** the migration has run on an existing flow, **When** viewing the flow, **Then** the Flow entity no longer contains whenToUse or whenNotToUse properties.
3. **Given** an existing flow has no user intent configuration, **When** the migration runs, **Then** no UserIntentNode is automatically created (flow starts empty of triggers).

---

### Edge Cases

- What happens when a user tries to connect an incoming edge to a trigger node? The connection should be rejected since trigger nodes only have output handles.
- What happens when a user deletes all trigger nodes from a flow? The flow should still be valid but will have no automatic activation conditions.
- How does the system handle flows with no user intent during migration? No trigger node is created; the flow simply has no triggers until the user adds one.
- What happens if a trigger node's whenToUse or whenNotToUse exceeds the character limit? The system should validate and enforce the same 500-character limit currently used for flow-level properties.

## Requirements *(mandatory)*

### Functional Requirements

#### Node Type Categories

- **FR-001**: System MUST support four node type categories: Trigger, Interface, Action, and Return.
- **FR-002**: Each node type MUST belong to exactly one category.
- **FR-003**: The UserIntentNode MUST be classified as a Trigger node type.
- **FR-004**: The AgenticInterfaceNode (formerly InterfaceNode) MUST be classified as an Interface node type.
- **FR-005**: The CallFlowNode MUST be classified as an Action node type.
- **FR-006**: The ReturnValueNode (formerly ReturnNode) MUST be classified as a Return node type.

#### Trigger Node Behavior

- **FR-007**: Trigger nodes MUST only have output handles (right-side); they MUST NOT accept incoming connections.
- **FR-008**: System MUST prevent users from creating connections that target a trigger node's input.
- **FR-009**: A single flow MUST support multiple trigger nodes.
- **FR-010**: Trigger nodes MUST be placeable at any position on the canvas.

#### UserIntentNode Specifics

- **FR-011**: The UserIntentNode MUST contain properties: whenToUse (optional, max 500 characters) and whenNotToUse (optional, max 500 characters).
- **FR-012**: The UserIntentNode MUST have a display name of "User Intent".
- **FR-013**: The UserIntentNode MUST have an appropriate icon distinguishing it from other node types.
- **FR-014**: Users MUST be able to edit UserIntentNode properties through a configuration modal or inline editing.

#### Node Renaming

- **FR-015**: The InterfaceNode MUST be renamed to AgenticInterfaceNode with display name "Agentic Interface".
- **FR-016**: The ReturnNode MUST be renamed to ReturnValueNode with display name "Return Value".
- **FR-017**: All user-facing references to these nodes MUST use the new display names.

#### Flow Entity Changes

- **FR-018**: The Flow entity MUST remove the whenToUse property.
- **FR-019**: The Flow entity MUST remove the whenNotToUse property.
- **FR-020**: The Flow entity MUST retain toolDescription as this describes the flow itself, not trigger conditions.

#### Add-Step Modal

- **FR-021**: The add-step modal MUST display nodes grouped by their type category.
- **FR-022**: Each category MUST have a visible header/label identifying the category name.
- **FR-023**: The "Triggers" category MUST include the UserIntentNode option.
- **FR-024**: The category order SHOULD be: Triggers, Agentic Interfaces, Actions, Return Values.

#### Data Migration

- **FR-025**: System MUST migrate existing flow-level user intent data to UserIntentNode instances.
- **FR-026**: Migration MUST preserve existing whenToUse and whenNotToUse values from flows.
- **FR-027**: Migration MUST NOT create UserIntentNodes for flows that had no user intent configuration.
- **FR-028**: Migration MUST be idempotent (running multiple times produces the same result).

### Key Entities

- **NodeTypeCategory**: A classification for node types. Categories are: Trigger, Interface, Action, Return. Each category defines the role a node plays in flow execution.

- **UserIntentNode**: A trigger node type representing conditions under which the AI should activate this flow. Contains whenToUse and whenNotToUse text properties. Belongs to the Trigger category. Has only output handles.

- **AgenticInterfaceNode**: A renamed version of the former InterfaceNode. Displays UI interfaces with data. Belongs to the Interface category. Has both input and output handles.

- **ReturnValueNode**: A renamed version of the former ReturnNode. Returns a value and terminates flow execution. Belongs to the Return category. Has only input handles (terminal node).

- **CallFlowNode**: An action node that invokes another flow. Belongs to the Action category. Has both input and output handles.

- **Flow**: The container for a workflow. After this feature, it will no longer contain whenToUse and whenNotToUse properties. Will contain multiple nodes including zero or more trigger nodes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a User Intent trigger node to a flow within 3 clicks from the canvas view.
- **SC-002**: Users can configure multiple trigger nodes per flow, with each trigger independently editable.
- **SC-003**: 100% of existing flows with user intent data are successfully migrated without data loss.
- **SC-004**: The add-step modal displays all node types organized into exactly 4 category groups.
- **SC-005**: Trigger nodes cannot accept incoming connections - all such connection attempts are prevented.
- **SC-006**: All node display names throughout the application reflect the new naming conventions.
- **SC-007**: Users can complete the flow of adding a trigger, configuring it, and connecting it to downstream nodes in under 60 seconds.

## Assumptions

- The existing canvas supports adding nodes with different handle configurations (output-only for triggers).
- The current connection validation logic can be extended to enforce trigger node constraints.
- The node type system can be extended to include a category classification without breaking existing functionality.
- The migration can be implemented as a one-time database transformation or lazy migration on flow load.
- The toolDescription property will remain on the Flow entity as it describes the flow's overall purpose rather than trigger conditions.
