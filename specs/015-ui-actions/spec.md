# Feature Specification: UI Component Actions

**Feature Branch**: `015-ui-actions`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Each view can have 0, 1 or several actions in function of what the UI component offers. For example the post list has an onReadMore action. Each action will show a handle with the action name near it and users will be able to connect an action to it, like return value or tool call. Each of the components will have in it's parameters an 'actions' key in their argument that shows different actions. An action can stay empty, or can have one step related to it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Component Actions in Flow Diagram (Priority: P1)

A user opens the flow diagram for an existing flow containing a view (e.g., a post list view). They see the view node displayed with action handles on the right side of the node. Each handle is labeled with the action name provided by the UI component (e.g., "onReadMore" for a blog post list). The user understands at a glance which interactive actions are available for that component.

**Why this priority**: This is foundational - users must first be able to see what actions are available before they can configure them. Without visible action handles, the entire feature is unusable.

**Independent Test**: Can be fully tested by opening a flow with a post-list view and verifying action handles appear correctly. Delivers immediate visibility into component capabilities.

**Acceptance Scenarios**:

1. **Given** a flow with a post-list view, **When** the user opens the flow diagram, **Then** the view node displays an "onReadMore" action handle on its right edge with the label visible.
2. **Given** a flow with a table view that has no actions defined, **When** the user opens the flow diagram, **Then** the view node displays no action handles.
3. **Given** a flow with a component that has multiple actions, **When** the user opens the flow diagram, **Then** all action handles are displayed vertically stacked with their respective labels.

---

### User Story 2 - Connect Action to Return Value (Priority: P2)

A user wants their blog post's "Read more" action to return detailed content to the LLM. They drag a connection from the "onReadMore" action handle to a return value node. The connection is established and saved. When the MCP tool executes and the user clicks "Read more" in the rendered widget, the system returns the configured text content.

**Why this priority**: Return value is the most common action target, enabling the core use case of interactive UI components triggering LLM responses. This builds on P1's visibility.

**Independent Test**: Can be tested by connecting onReadMore to a return value, executing the tool, clicking "Read more" in the widget, and verifying the return value content is sent back.

**Acceptance Scenarios**:

1. **Given** a view node with an "onReadMore" action handle, **When** the user drags from the action handle to a return value node, **Then** a visual connection line appears and the connection is persisted.
2. **Given** an action connected to a return value, **When** the user views the flow diagram later, **Then** the connection is still displayed.
3. **Given** an action connected to a return value, **When** the MCP tool executes and the user triggers that action in the widget, **Then** the return value content is delivered to the LLM.

---

### User Story 3 - Connect Action to Call Flow (Priority: P3)

A user wants their table's row action to trigger another flow. They drag a connection from an action handle to a call flow node. The connection is established. When the action is triggered from the rendered widget, the target flow executes.

**Why this priority**: Call flow connections enable complex multi-step workflows. This extends P2's pattern to another target type.

**Independent Test**: Can be tested by connecting an action to a call flow, triggering the action, and verifying the target flow executes.

**Acceptance Scenarios**:

1. **Given** a view node with an action handle, **When** the user drags from the action handle to a call flow node, **Then** a visual connection line appears and the connection is persisted.
2. **Given** an action connected to a call flow, **When** the action is triggered from the widget, **Then** the target flow executes with appropriate context.

---

### User Story 4 - Disconnect or Reconfigure Action (Priority: P4)

A user wants to change what an action does. They can either delete an existing connection or drag a new connection from the action handle to a different target. The old connection is replaced.

**Why this priority**: Users need to iterate on their flow designs. This enables modification without starting over.

**Independent Test**: Can be tested by creating a connection, then creating a new one from the same action to a different target, verifying only the new connection exists.

**Acceptance Scenarios**:

1. **Given** an action connected to a return value, **When** the user drags a new connection to a different return value, **Then** the old connection is removed and the new connection is saved.
2. **Given** an action connected to a target, **When** the user clicks delete on the connection, **Then** the connection is removed and the action returns to an unconnected state.
3. **Given** an unconnected action, **When** the MCP tool executes, **Then** the action is still interactive in the widget but triggering it has no effect (no error occurs).

---

### Edge Cases

- What happens when a component's available actions change (e.g., different layout template)?
  - The system updates the displayed action handles to reflect the new component's capabilities. Existing connections to removed actions are deleted.
- What happens when an action is connected to a deleted return value or call flow?
  - The connection is automatically removed when the target is deleted.
- What happens when multiple actions from the same view connect to the same target?
  - This is allowed - multiple actions can point to the same return value or call flow.
- What happens when a flow has no views but has return values or call flows?
  - No action handles are displayed since there are no view nodes. Existing behavior continues.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display action handles on view nodes in the flow diagram, positioned on the right edge of the node.
- **FR-002**: System MUST label each action handle with the action name defined by the UI component (e.g., "onReadMore").
- **FR-003**: System MUST support drag-and-drop connections from action handles to return value nodes.
- **FR-004**: System MUST support drag-and-drop connections from action handles to call flow nodes.
- **FR-005**: System MUST persist action-to-target connections as part of the flow configuration.
- **FR-006**: System MUST allow only one target per action (connecting to a new target replaces the previous connection).
- **FR-007**: System MUST allow actions to remain unconnected (no target configured).
- **FR-008**: System MUST remove connections when the target (return value or call flow) is deleted.
- **FR-009**: System MUST display the component's available actions based on an "actions" property in the component's parameters/configuration.
- **FR-010**: System MUST render action triggers in the MCP widget output that invoke the connected target when clicked.
- **FR-011**: System MUST handle triggered actions gracefully when no target is connected (action is interactive but has no effect).
- **FR-012**: System MUST update displayed action handles when a view's layout template changes, removing invalid connections.

### Key Entities

- **Action**: Represents an interactive capability of a UI component. Has a name (e.g., "onReadMore"), belongs to a View, and can optionally connect to one target (ReturnValue or CallFlow).
- **ActionConnection**: Represents the link between an Action and its target. Contains the action identifier, target type (returnValue or callFlow), and target ID.
- **View (extended)**: Existing entity extended to include available actions based on its layout template configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify available actions for any view component within 3 seconds of viewing the flow diagram.
- **SC-002**: Users can create an action-to-target connection with a single drag-and-drop gesture (no modal dialogs required for basic connection).
- **SC-003**: 100% of action connections are correctly persisted across page refreshes and session restarts.
- **SC-004**: Triggered actions in the MCP widget execute their connected targets within 2 seconds.
- **SC-005**: Users can complete a full action configuration workflow (view actions, connect, test) on their first attempt without external guidance.
- **SC-006**: All existing flows without action configurations continue to function identically (backward compatibility).

## Assumptions

- Each UI component type (layout template) has a predefined set of available actions. For the MVP:
  - `post-list` component: provides "onReadMore" action
  - `table` component: provides no actions initially (can be extended later)
- Actions are triggered client-side in the MCP widget through standard DOM events (click handlers).
- The existing FlowDiagram component using @xyflow/react can be extended to support additional handle positions and connection types.
- Action connections are stored as part of the flow configuration, similar to how return values and call flows are stored today.
- When an action is triggered but has no connected target, the widget provides visual feedback that the click was registered but takes no further action.
