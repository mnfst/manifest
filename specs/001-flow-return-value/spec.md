# Feature Specification: Flow Return Value Support

**Feature Branch**: `001-flow-return-value`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Enable MCP tools without UI by adding return value support to flows - replace 'create your first view' with 'add next step', add side drawer with step type options (View or Return value), and implement text return value following MCP protocol"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Return Value Step to Flow (Priority: P1)

A user wants to create an MCP tool that returns text data directly to the LLM without displaying any UI. After defining the user intent for a flow, they click "Add next step" and select "Return value" from the side drawer. They then configure the return value using a text editor.

**Why this priority**: This is the core feature that enables MCP tools without UI. It unlocks an entirely new use case where flows can return data programmatically rather than requiring visual components.

**Independent Test**: Can be fully tested by creating a new flow, filling user intent, clicking "Add next step", selecting "Return value", editing the text content, and verifying the flow saves correctly.

**Acceptance Scenarios**:

1. **Given** a flow with user intent defined and no steps, **When** the user views the flow diagram, **Then** they see an "Add next step" placeholder (not "Create your first view")
2. **Given** the user clicks "Add next step", **When** the side drawer opens, **Then** they see options for "View" and "Return value"
3. **Given** the user selects "Return value" from the drawer, **When** the return value step is created, **Then** they see a text editor to configure the return content
4. **Given** the user edits the return value text, **When** they save, **Then** the flow persists the return value content

---

### User Story 2 - MCP Tool Returns Text to LLM (Priority: P1)

When an LLM makes a tool call to a flow that has a return value step, the system returns the configured text content following the MCP protocol text content format.

**Why this priority**: This completes the end-to-end functionality. Without the return value being properly formatted and returned, the feature provides no value.

**Independent Test**: Can be tested by configuring a flow with a return value, then making an MCP tool call and verifying the response matches the expected MCP protocol format.

**Acceptance Scenarios**:

1. **Given** a flow with a return value step containing "Hello from MCP", **When** the LLM calls the corresponding tool, **Then** the tool returns content with type "text" and text "Hello from MCP"
2. **Given** a flow with a return value step, **When** the tool execution completes, **Then** the response follows the MCP protocol structure with `content` array containing text content objects
3. **Given** a flow with a return value containing multi-line text, **When** the LLM calls the tool, **Then** the full multi-line text is returned in the response

---

### User Story 3 - Choose Between View and Return Value (Priority: P2)

A user can choose between adding a View step (existing functionality) or a Return value step when building their flow. The side drawer presents both options clearly.

**Why this priority**: This enables the user to make an informed choice between UI-based and data-return-based flows. It's secondary because the return value is the new capability being added.

**Independent Test**: Can be tested by creating a flow, clicking "Add next step", verifying both options appear in the drawer, and selecting "View" to ensure existing functionality still works.

**Acceptance Scenarios**:

1. **Given** the step type drawer is open, **When** the user views the options, **Then** they see "View" and "Return value" as distinct choices with descriptions
2. **Given** the user selects "View" from the drawer, **When** the view is created, **Then** the existing view creation workflow proceeds unchanged
3. **Given** a flow with a return value step, **When** the user returns to the flow later, **Then** they see the return value step displayed in the diagram

---

### Edge Cases

- What happens when the user saves an empty return value text? The system allows empty text but shows a visual indicator that the return value is unconfigured
- How does the system handle very long return value text? The text editor supports scrolling and the full text is stored without truncation
- What happens if a flow has multiple return values? All return values are concatenated in order and returned as separate text content items in the MCP response array
- Can a flow have both views and return values? For this initial implementation, a flow can have either views OR return values, not both (mutual exclusivity enforced)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace the "Create your first view" placeholder text with "Add next step" in the flow diagram
- **FR-002**: System MUST display a side drawer on the right when user clicks "Add next step"
- **FR-003**: Side drawer MUST present two options: "View" and "Return value"
- **FR-004**: Selecting "View" MUST trigger the existing view creation workflow
- **FR-005**: Selecting "Return value" MUST create a return value step and display a text editor
- **FR-006**: System MUST persist the return value text content when the user saves
- **FR-007**: System MUST return the configured text following MCP protocol text content format: `{ "type": "text", "text": "<content>" }`
- **FR-008**: The return value response MUST be wrapped in the MCP tool result structure with `content` array
- **FR-009**: System MUST display the return value step visually in the flow diagram after creation
- **FR-010**: System MUST support multiple return value steps per flow, each stored as a separate entity
- **FR-011**: Users MUST be able to edit an existing return value step by clicking on it in the diagram
- **FR-012**: Users MUST be able to delete individual return value steps
- **FR-013**: Return value steps MUST be ordered and the order MUST be editable
- **FR-014**: When executing a tool, the system MUST return all return values as separate text content items in the MCP response array

### Key Entities

- **ReturnValue**: Represents a return value step in a flow. Stored as a separate entity with its own lifecycle. Contains the text content to be returned to the LLM. Multiple return values can be associated with a single flow, ordered by position. Designed for future extensibility (additional fields may be added).
- **Flow** (extended): Existing flow entity extended with a one-to-many relationship to ReturnValue entities

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a complete MCP tool flow with a return value in under 2 minutes
- **SC-002**: 100% of return value tool calls return responses compliant with MCP protocol text content format
- **SC-003**: Users can successfully distinguish between View and Return value options in the step type drawer
- **SC-004**: Return value text of at least 10,000 characters can be stored and returned without truncation

## Assumptions

- The text editor for return value will be a simple code/text editor component (similar to existing editors in the application)
- For this initial implementation, flows are limited to either views OR return values (mutual exclusivity)
- A flow can have zero or more return value steps (stored as separate entities)
- Return values are ordered; the order determines the sequence in the MCP response content array
- The MCP protocol text content format does not require annotations for this initial implementation
- The side drawer component pattern exists or can be implemented using existing UI patterns in the application
- The ReturnValue entity is designed for extensibility (future fields like templates, variables, etc. may be added)
