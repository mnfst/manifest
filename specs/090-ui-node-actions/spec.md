# Feature Specification: UI Node Actions

**Feature Branch**: `090-ui-node-actions`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Add actions to UI nodes with conditional execution flow - starting with Post List component"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Post List UI Node with Action (Priority: P1)

As a flow builder, I want to add a Post List UI node to my flow that displays blog posts, so that end users can browse and interact with content. When an end user clicks "Read More" on a post, I want the flow to continue execution with that specific post's data available to subsequent nodes.

**Why this priority**: This is the core feature - adding a new UI node type that demonstrates the action system. Without this, no other stories can be tested.

**Independent Test**: Can be fully tested by adding a Post List node to a flow, connecting a Return Value node to its "onReadMore" action handler, running the app, clicking "Read More" on a post, and verifying the Post data is returned.

**Acceptance Scenarios**:

1. **Given** the node library is open, **When** I search for "Post List", **Then** I see the Post List UI node available for selection
2. **Given** I have added a Post List node to my flow, **When** I view the node on the canvas, **Then** I see an action handler connection point on the right side labeled "onReadMore"
3. **Given** a Post List node with onReadMore connected to a Return Value node, **When** an end user clicks "Read More" on a post in the running app, **Then** the connected node receives the Post object as input

---

### User Story 2 - Conditional Flow Execution via Actions (Priority: P2)

As a flow builder, I want actions to create branching execution paths, so that a single trigger can lead to different outcomes based on which UI action the end user takes.

**Why this priority**: This extends the core action concept to enable more complex flows. It requires the action handler system from P1 but adds the conditional branching behavior.

**Independent Test**: Can be tested by creating a flow with one trigger, a Post List node, and different nodes connected to the onReadMore action vs the main output (if any), then verifying each path executes independently when triggered.

**Acceptance Scenarios**:

1. **Given** a Post List node with an action handler connection, **When** I connect a node to that action handler, **Then** that node only executes when the corresponding action is triggered
2. **Given** a flow where a Post List node has connections to its action handler, **When** no action is triggered by the end user, **Then** the action-connected nodes do not execute
3. **Given** multiple UI nodes with actions in a single flow path, **When** actions are triggered sequentially by the end user, **Then** each action's connected nodes execute in the correct order with the correct data

---

### User Story 3 - Node Library Action Information (Priority: P3)

As a flow builder browsing the node library, I want to see at a glance whether a UI node has actions and how many, so that I can quickly identify interactive vs read-only UI components.

**Why this priority**: This is a UX enhancement that helps with node discovery. It provides value but the feature works without it.

**Independent Test**: Can be tested by viewing the node library and verifying each UI node displays the correct action count or "read only" label.

**Acceptance Scenarios**:

1. **Given** the node library shows UI nodes, **When** a UI node has one or more actions defined, **Then** the library displays the count of available actions (e.g., "1 action" or "3 actions")
2. **Given** the node library shows UI nodes, **When** a UI node has zero actions, **Then** the library displays "read only" label
3. **Given** the existing Stat Card node, **When** I view it in the library, **Then** it shows "read only" since it has no actions

---

### Edge Cases

- What happens when an action handler connection point has no connected nodes? The action can still fire but produces no downstream execution.
- What happens when the same UI node action is connected to multiple downstream nodes? All connected nodes should execute with the same action data.
- How does the system handle if the Post data passed to an action is malformed or incomplete? Downstream nodes receive whatever data the action provides; validation is the responsibility of receiving nodes.
- What happens when a UI node type definition changes and gains/loses actions? Existing flows should gracefully handle missing actions (show error indicator) or new actions (show available but unconnected).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support adding new UI node types that include action definitions
- **FR-002**: System MUST render action handler connection points on the right side of UI nodes that have actions defined
- **FR-003**: Each action handler connection point MUST display the action name as a label (e.g., "onReadMore")
- **FR-004**: System MUST allow connecting any valid downstream node to an action handler connection point
- **FR-005**: When an action is triggered at runtime, system MUST pass the action's argument data (e.g., Post object) to all connected downstream nodes
- **FR-006**: System MUST support multiple action handlers on a single UI node (for future UI components with multiple actions)
- **FR-007**: Actions MUST enable conditional/branching execution paths - downstream nodes connected to an action only execute when that specific action is triggered
- **FR-008**: The node library MUST display action count information for each UI node (e.g., "1 action", "2 actions")
- **FR-009**: UI nodes with zero actions MUST display "read only" label in the node library
- **FR-010**: System MUST include the Post List UI node type with its onReadMore action that passes a Post object
- **FR-011**: The existing Stat Card UI node MUST show "read only" label in the node library (since it has no actions)
- **FR-012**: Action handler connection points MUST be visually distinct from the regular output connection point (if the node has one)

### Key Entities

- **UI Node Action**: An interactive event that a UI component can emit (name, argument type, description). Examples: onReadMore(Post), onBack(), onSelect(Item)
- **Action Handler Connection Point**: A visual connection point on a node that represents where downstream nodes connect to receive action events
- **Post**: A content entity with id, title, excerpt, coverImage (optional), author (name, avatar), publishedAt, readTime (optional), tags (optional), category (optional), url (optional)
- **Action Count Metadata**: Information about how many actions a UI node type has, used for library display

## Assumptions

- The existing node canvas system already supports multiple connection points on a single node (this feature extends it to right-side action handlers)
- The Post List component schema follows the structure defined at ui.manifest.build/r/post-list.json
- Action names follow camelCase convention starting with "on" (e.g., onReadMore, onBack, onSelect)
- The runtime execution engine can handle conditional branching where some paths only execute on user interaction

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Flow builders can add a Post List node and connect downstream nodes to its action in under 30 seconds
- **SC-002**: 100% of UI nodes in the library correctly display their action count or "read only" status
- **SC-003**: End users clicking "Read More" on a post successfully trigger the connected downstream nodes with correct Post data on every attempt
- **SC-004**: Flow builders can visually distinguish action handler connection points from regular outputs without confusion
- **SC-005**: Flows with action-based branching execute only the relevant branch when a specific action is triggered (no unintended execution of other branches)
