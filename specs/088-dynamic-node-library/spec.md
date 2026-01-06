# Feature Specification: Dynamic Node Library

**Feature Branch**: `088-dynamic-node-library`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "The API Call Node does not appear in the node library. I am going to add many nodes afterwards, can we make sure that this list is dynamic and gets nodes by their groups? Also the Tool call is a return value, not an action"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Nodes by Category (Priority: P1)

A flow builder user opens the node library sidedrawer and browses available nodes organized by category (Triggers, Actions, Return Values, etc.). They see all registered nodes automatically appear in their correct category groups without manual configuration.

**Why this priority**: Core functionality - users must be able to discover and add nodes to their flows. If nodes don't appear in the library, they can't be used.

**Independent Test**: Open node library, verify all categories display, click each category and confirm all registered nodes for that category appear.

**Acceptance Scenarios**:

1. **Given** the node library is open, **When** a user clicks a category group (e.g., "Actions"), **Then** all nodes registered under that category are displayed
2. **Given** a new node type has been added to the backend registry, **When** the user opens the node library, **Then** the new node automatically appears in its correct category without frontend code changes
3. **Given** the node library is showing a category, **When** the user clicks a different category, **Then** only nodes from the selected category are shown

---

### User Story 2 - Search Across All Nodes (Priority: P2)

A user searches for a specific node by name or description to quickly find it without navigating through categories.

**Why this priority**: Improves efficiency for users who know what they're looking for, but category browsing is the primary discovery mechanism.

**Independent Test**: Type a search term, verify matching nodes from all categories appear in results.

**Acceptance Scenarios**:

1. **Given** the user is at the node library root view, **When** they type a search term, **Then** nodes matching the term (by name or description) are displayed regardless of category
2. **Given** search results are showing, **When** the user clears the search, **Then** the view returns to showing category groups

---

### User Story 3 - Node Category Correctness (Priority: P1)

Nodes must be categorized correctly to maintain a logical organization. Specifically:
- **Trigger nodes**: Nodes that initiate a flow (e.g., User Intent)
- **Action nodes**: Nodes that perform operations during flow execution (e.g., API Call)
- **Return Value nodes**: Nodes that output/return data from a flow (e.g., Return, Call Flow)
- **Interface nodes**: Nodes that display UI elements (e.g., Agentic Interface)

**Why this priority**: Incorrect categorization confuses users and makes nodes hard to find. The Call Flow node is currently categorized as an action, but it should be a return value since it calls another flow and returns its result.

**Independent Test**: Verify each node appears in its semantically correct category.

**Acceptance Scenarios**:

1. **Given** the API Call node is registered, **When** viewing the Actions category, **Then** the API Call node appears there (it performs an HTTP request operation)
2. **Given** the Call Flow node is registered, **When** viewing the Return Values category, **Then** the Call Flow node appears there (it calls another flow and returns the result)
3. **Given** any node type definition, **When** it specifies a category, **Then** the node appears exclusively in that category in the library

---

### Edge Cases

- What happens when no nodes are registered for a category? The category should still appear but show an empty state message
- How does the system handle when the API fails to return node types? An error message should be displayed with retry option
- What happens if a node has an invalid/unknown category? The node should be excluded from display and logged as a warning

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST dynamically fetch all registered node types from the backend API when the node library opens
- **FR-002**: System MUST group nodes by their `category` field and display them under the correct category heading
- **FR-003**: System MUST automatically display newly registered node types without requiring frontend code changes
- **FR-004**: System MUST display all standard categories (Triggers, Agentic Interfaces, Actions, Return Values) even if some have no nodes
- **FR-005**: System MUST correctly categorize the Call Flow node as a "return" category node (not "action")
- **FR-006**: System MUST allow searching across all nodes regardless of category
- **FR-007**: System MUST display an appropriate empty state when a category has no nodes
- **FR-008**: System MUST handle API errors gracefully with user-friendly error messaging

### Key Entities

- **NodeTypeDefinition**: Represents a type of node with its metadata (name, displayName, icon, category, description, inputs, outputs)
- **Category**: A grouping mechanism for organizing nodes (trigger, interface, action, return)
- **NodeLibrary**: The UI component that displays categorized nodes to users

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All registered nodes appear in the node library within their correct category groups
- **SC-002**: Adding a new node type to the backend results in automatic visibility in the node library without frontend changes
- **SC-003**: Users can locate any node within 3 clicks or less (open library → select category → select node)
- **SC-004**: Search returns relevant results within 1 second of typing
- **SC-005**: 100% of nodes are displayed in semantically correct categories as defined by their node type definition

## Assumptions

- The backend API `/api/node-types` is the single source of truth for available node types
- Node categories are limited to the four predefined values: trigger, interface, action, return
- The node library already fetches nodes dynamically from the API (verified in current implementation)
- The API Call node issue may be related to build/deployment rather than missing dynamic functionality
- The Call Flow node should be recategorized from "action" to "return" since it calls another flow and returns the result (similar to a function call that returns a value)
