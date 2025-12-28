# Feature Specification: MCP Tool Parameters

**Feature Branch**: `001-tool-params`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Add parameter support to MCP tools for flow creation and editing. Support string, number, integer, and boolean types with optional checkbox. Allow users to edit, remove parameters. Display param count on flow cards next to views."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Parameters During Flow Creation (Priority: P1)

As a user creating a new MCP flow, I want to define parameters that the tool will accept so that AI agents can pass dynamic values when invoking the tool.

**Why this priority**: Parameters are the core feature. Without the ability to add parameters during flow creation, the entire feature has no value. This establishes the foundation for all other parameter functionality.

**Independent Test**: Can be fully tested by creating a new flow and adding parameters during the creation process. The flow should save with parameters persisted.

**Acceptance Scenarios**:

1. **Given** a user is creating a new flow with name and description filled, **When** they click "Add Parameter", **Then** a parameter entry form appears allowing them to configure name, type, and optional flag
2. **Given** a user has added a parameter entry, **When** they select a type from the dropdown, **Then** only the supported types (string, number, integer, boolean) are available as options
3. **Given** a user has added multiple parameters, **When** they submit the flow creation form, **Then** the flow is created with all parameters saved and associated with it
4. **Given** a user has added a parameter, **When** they check the "Optional" checkbox, **Then** the parameter is marked as optional and this is persisted

---

### User Story 2 - Edit Parameters on Existing Flow (Priority: P2)

As a user managing an existing flow, I want to edit the parameters after creation so that I can refine the tool's interface as requirements evolve.

**Why this priority**: Flows evolve over time. Users need to modify parameters without recreating the entire flow. This is essential for iterative development.

**Independent Test**: Can be tested by navigating to an existing flow's detail page, modifying parameters, and verifying changes persist after save.

**Acceptance Scenarios**:

1. **Given** a user is viewing a flow detail page with existing parameters, **When** they click "Edit Parameters", **Then** they see all current parameters displayed in an editable form
2. **Given** a user is editing parameters, **When** they modify a parameter's name, type, or optional flag, **Then** the changes are reflected immediately in the form
3. **Given** a user has made parameter modifications, **When** they save the changes, **Then** the updated parameters are persisted and visible on refresh
4. **Given** a user is editing parameters, **When** they add a new parameter to the existing list, **Then** it appears in the form and can be configured alongside existing parameters

---

### User Story 3 - Remove Parameters (Priority: P2)

As a user managing flow parameters, I want to remove parameters that are no longer needed so that the tool interface stays clean and accurate.

**Why this priority**: Same priority as editing—part of the essential parameter management lifecycle. Users must be able to remove obsolete parameters.

**Independent Test**: Can be tested by removing a parameter from an existing flow and verifying it no longer appears after save.

**Acceptance Scenarios**:

1. **Given** a user is editing a flow with multiple parameters, **When** they click the remove/delete button on a parameter, **Then** the parameter is removed from the form immediately
2. **Given** a user has removed a parameter, **When** they save the flow, **Then** the parameter is no longer associated with the flow
3. **Given** a user removes the last parameter from a flow, **When** they save, **Then** the flow is saved successfully with zero parameters

---

### User Story 4 - View Parameter Count on Flow Cards (Priority: P3)

As a user browsing the flow list, I want to see the number of parameters each flow has so that I can quickly understand the complexity of each tool at a glance.

**Why this priority**: This is a display enhancement that improves discoverability but doesn't block core functionality. Users can still use the feature without this.

**Independent Test**: Can be tested by viewing the flow list/cards and verifying parameter counts are displayed alongside view counts.

**Acceptance Scenarios**:

1. **Given** a flow has 3 parameters and 2 views, **When** the user views the flow card/list, **Then** both counts are displayed (e.g., "3 params • 2 views")
2. **Given** a flow has 0 parameters, **When** the user views the flow card, **Then** the parameter count shows "0 params" (or is omitted gracefully)
3. **Given** a user adds a parameter to a flow, **When** they return to the flow list, **Then** the parameter count is updated to reflect the new total

---

### Edge Cases

- What happens when a user tries to add a parameter with a name that already exists on the flow? → System prevents duplicate parameter names within the same flow
- What happens when a user submits a parameter with an empty name? → Validation requires a non-empty name
- How does the system handle very long parameter names? → Enforce a reasonable character limit (50 characters)
- What happens when a flow with parameters is loaded but the data is corrupted/invalid? → Display graceful fallback, log error, allow user to reset parameters

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add parameters when creating a new flow
- **FR-002**: System MUST support four parameter types: string, number, integer, and boolean
- **FR-003**: Each parameter MUST have a name field that is required and unique within the flow
- **FR-004**: Each parameter MUST have an "optional" flag that users can toggle (checkbox)
- **FR-005**: System MUST allow users to edit existing parameters on a flow
- **FR-006**: System MUST allow users to remove parameters from a flow
- **FR-007**: System MUST persist parameter configurations when the flow is saved
- **FR-008**: System MUST display the parameter count on flow cards/list alongside the view count
- **FR-009**: System MUST validate parameter names are non-empty before saving
- **FR-010**: System MUST prevent duplicate parameter names within the same flow
- **FR-011**: Parameter names MUST be limited to 50 characters maximum
- **FR-012**: System MUST preserve parameter order as defined by the user

### Key Entities

- **Flow**: Existing entity that represents an MCP tool. Will be extended to include a collection of parameters.
- **Parameter**: A configuration item for a flow tool. Has a name, type (string/number/integer/boolean), and optional flag. Belongs to exactly one flow. Order is significant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add parameters to a new flow in under 30 seconds per parameter
- **SC-002**: Users can modify any parameter attribute (name, type, optional) in 2 clicks or fewer
- **SC-003**: Parameter count is visible on flow cards without requiring navigation to flow detail
- **SC-004**: 100% of parameter configurations survive a page refresh (data persistence verification)
- **SC-005**: Users can create flows with 0 to 20+ parameters without performance degradation
- **SC-006**: Parameter management UI follows existing modal and form patterns for consistency

## Assumptions

- Parameters are metadata for the MCP tool definition and do not require runtime validation against actual tool inputs (that is handled by the MCP protocol layer)
- Parameter descriptions are not required in this initial version (name, type, and optional flag are sufficient)
- The order of parameters is meaningful and should be preserved (order in which they appear in forms/UI)
- Parameters are stored as part of the flow entity (not as separate database records in this MVP)
- The existing CreateFlowModal will be extended rather than replaced
- Default values for parameters are out of scope for this version
