# Feature Specification: Call Flow End Action

**Feature Branch**: `014-call-flow-action`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Add Call Flow end action for flows - an end action like return value that enables users to call other flows from the same app. Triggers window.openai.callTool(name, args) from ChatGPT UI SDK."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Call Flow Action to Flow (Priority: P1)

A user building a flow wants to chain flows together by calling another flow at the end of the current flow. The user selects "Call Flow" as an end action and chooses which flow from the same app should be triggered when the current flow completes.

**Why this priority**: This is the core functionality of the feature. Without the ability to add a Call Flow action and select a target flow, no other functionality can work.

**Independent Test**: Can be fully tested by creating a flow, adding a Call Flow action, selecting a target flow, and verifying it saves correctly. Delivers immediate value by enabling flow chaining.

**Acceptance Scenarios**:

1. **Given** a user is editing a flow in an app that has multiple flows, **When** the user adds a "Call Flow" action, **Then** they see a selection of available flows from the same app to choose as the target.
2. **Given** a user has added a "Call Flow" action to their flow, **When** the user selects a target flow, **Then** the action displays the selected flow's name and the configuration is saved.
3. **Given** a flow has a Call Flow action configured, **When** the user views the flow diagram, **Then** the Call Flow node is visually distinct as an end action (no right-side handler) indicating nothing can follow it.

---

### User Story 2 - Call Flow Execution in ChatGPT (Priority: P2)

When a flow executes within ChatGPT and reaches a Call Flow action, the system triggers the target flow using the ChatGPT UI SDK's callTool API.

**Why this priority**: This is the runtime behavior that makes the feature functional. It depends on P1 (configuration) being complete first.

**Independent Test**: Can be tested by executing a flow in ChatGPT preview mode and verifying that window.openai.callTool is invoked with the correct tool name.

**Acceptance Scenarios**:

1. **Given** a flow is executing in ChatGPT and has a Call Flow action pointing to another flow "TargetFlow", **When** the Call Flow action executes, **Then** the system calls `window.openai.callTool("target-flow-tool-name")` to trigger the target flow.
2. **Given** a Call Flow action is configured without arguments, **When** the action executes, **Then** the callTool is invoked without arguments (as specified for current scope).

---

### User Story 3 - Visual End Action Distinction (Priority: P3)

Users can visually distinguish end actions (Call Flow, Return Value) from intermediate actions (Views) in the flow diagram by their appearance - specifically, end actions have no right-side connection point.

**Why this priority**: This is a UX enhancement that improves understandability but doesn't block core functionality.

**Independent Test**: Can be tested by comparing the visual appearance of a Call Flow node vs a View node in the flow diagram.

**Acceptance Scenarios**:

1. **Given** a Call Flow action exists in a flow diagram, **When** the user views the diagram, **Then** the Call Flow node has no right-side handler (source handle), indicating it's a terminal point.
2. **Given** both a View node and a Call Flow node are visible in the flow editor, **When** the user compares them, **Then** the View node has a right-side handler while the Call Flow node does not.

---

### Edge Cases

- What happens when a user tries to select a target flow that no longer exists (was deleted)?
  - System displays an error state on the Call Flow node indicating the target flow is missing
- What happens when the app has only one flow (no other flows to call)?
  - The "Call Flow" action shows an empty state message indicating no other flows are available to call
- What happens if a Call Flow action references itself (circular call)?
  - System prevents self-referencing by excluding the current flow from the target selection list
- What happens when a flow already has Views configured and user tries to add Call Flow?
  - System enforces mutual exclusivity: Call Flow is an end action mutually exclusive with Views
- What happens when there's already a Return Value action configured?
  - System enforces mutual exclusivity between different end action types (only one type per flow)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add a "Call Flow" action to a flow as an end action
- **FR-002**: System MUST display a list of other flows from the same app when configuring a Call Flow action
- **FR-003**: System MUST store the Call Flow action configuration including which target flow to call
- **FR-004**: System MUST exclude the current flow from the target selection list (prevent self-reference)
- **FR-005**: System MUST render Call Flow nodes without a right-side connection handle to visually indicate they are end points
- **FR-006**: System MUST trigger `window.openai.callTool(toolName)` when a Call Flow action executes in ChatGPT context
- **FR-007**: System MUST enforce mutual exclusivity between end action types and Views (a flow cannot have both Views and any end action)
- **FR-008**: System MUST enforce that a flow can only have one type of end action (either Return Values OR Call Flow actions, not both)
- **FR-009**: System MUST display an error state on Call Flow nodes when the target flow has been deleted
- **FR-010**: System MUST display an informative message when no other flows are available to call

### Key Entities

- **EndAction**: A base concept representing actions that terminate a flow's execution path. Subtypes include Return Value and Call Flow. End actions share common characteristics: no right-side handler, mutually exclusive with Views, and represent terminal points in the flow.

- **CallFlowAction**: A specific end action that triggers another flow from the same app. Contains a reference to the target flow to be called. Multiple Call Flow actions can exist in a single flow, each calling potentially different target flows.

- **Flow** (existing): Extended to support Call Flow actions. The relationship between Flow and CallFlowAction mirrors the existing Flow-ReturnValue relationship.

**Data Model Considerations for Future Extensibility**:

The system should support additional end action types in the future. The recommended approach is to introduce a discriminated union pattern or polymorphic entity design:

```
EndAction base concept:
- Common properties: id, flowId, order, createdAt, updatedAt
- Discriminator: type (e.g., "returnValue", "callFlow", "futureAction")
- Type-specific data stored per subtype

Current scope implements CallFlowAction as a parallel entity (matching existing ReturnValue pattern) with:
- id: unique identifier
- flowId: reference to parent flow
- targetFlowId: reference to flow to be called
- order: position among multiple call flow actions
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a Call Flow action and select a target flow in under 30 seconds
- **SC-002**: 100% of Call Flow actions successfully trigger the target flow when executed in ChatGPT
- **SC-003**: Users can visually distinguish end actions from intermediate actions without confusion
- **SC-004**: Flow configuration with Call Flow actions persists correctly across page reloads
- **SC-005**: System correctly prevents invalid configurations (self-reference, missing target, mixing end actions with Views)

## Assumptions

1. The ChatGPT UI SDK's `window.openai.callTool()` API is available and functional in the execution context
2. Arguments for callTool are not required for initial implementation (as specified by user)
3. Target flows must be from the same app - cross-app flow calling is out of scope
4. The existing mutual exclusivity pattern (Views vs end actions) should be extended to include Call Flow actions
5. Multiple Call Flow actions can exist in a single flow (similar to how multiple Return Values can exist)
6. The order of Call Flow actions determines execution sequence when there are multiple

## Out of Scope

- Passing arguments to the target flow (to be specified later)
- Cross-app flow calling
- Conditional Call Flow actions (always executes when reached)
- Monitoring/tracking of called flows
- Error handling for failed callTool invocations (relies on ChatGPT SDK behavior)
