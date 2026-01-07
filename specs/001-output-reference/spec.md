# Feature Specification: Output Reference & Trigger Node UX Improvements

**Feature Branch**: `001-output-reference`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "Trigger node IO schema improvements: no input, static+dynamic outputs from parameters, 'active' switch instead of checkbox, and 'Use Previous Outputs' component with slug-based node references ({{nodeSlug.path}} syntax)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Previous Node Outputs in Configuration (Priority: P1)

As a workflow designer, I want to easily reference outputs from previous nodes when configuring a node's inputs, so I can build connected workflows without memorizing output paths or node identifiers.

**Why this priority**: This is the core workflow building experience. Without easy access to previous outputs, users must manually type references, leading to errors and frustration. This directly impacts the usability of connecting nodes.

**Independent Test**: Can be fully tested by opening any node configuration modal (after a trigger), clicking "Use Previous Outputs", selecting a source node and output field, and verifying the correct reference string is copied to clipboard.

**Acceptance Scenarios**:

1. **Given** a node is connected downstream from a trigger, **When** the user opens the node's configuration modal, **Then** a "Use Previous Outputs" section is visible
2. **Given** the "Use Previous Outputs" section is open, **When** the user clicks the source node dropdown, **Then** a list of upstream nodes appears with their human-readable slugs (e.g., "weather_trigger", "api_call_1")
3. **Given** a source node is selected, **When** the user views the outputs dropdown, **Then** all available output fields are listed with their names and optional descriptions
4. **Given** an output field is selected, **When** the user clicks the copy button, **Then** the reference string in format `{{ nodeSlug.fieldPath }}` is copied to clipboard
5. **Given** a nested output field exists (e.g., `response.data.items`), **When** the user selects it, **Then** the full path is included in the reference (e.g., `{{ api_call.response.data.items }}`)

---

### User Story 2 - Clear Trigger Node Schema Display (Priority: P1)

As a workflow designer, I want to clearly see that trigger nodes have no input and understand their output structure (static + dynamic fields), so I can properly connect downstream nodes.

**Why this priority**: Trigger nodes are the starting point of every workflow. Users must understand what data is available from a trigger to build effective workflows. Clear schema display prevents connection errors.

**Independent Test**: Can be fully tested by selecting a User Intent trigger node and viewing its schema panel, verifying no input schema is shown and outputs display both static fields and user-defined parameters.

**Acceptance Scenarios**:

1. **Given** a User Intent trigger node is selected, **When** the user views the node schema panel, **Then** the input section displays "No input - triggers start the flow" or similar clear message
2. **Given** a User Intent trigger node with parameters, **When** the user views the output schema, **Then** static fields (type, triggered, toolName) are clearly labeled as "Static"
3. **Given** a User Intent trigger node with custom parameters, **When** the user views the output schema, **Then** dynamic fields from parameters are clearly labeled as "Dynamic" or "From Parameters"
4. **Given** the Edit User Intent modal is open, **When** viewing the parameters section, **Then** it is clear that these parameters become part of the trigger's output

---

### User Story 3 - Active/Inactive Toggle for MCP Tool Exposure (Priority: P2)

As a workflow designer, I want to toggle whether a trigger is "active" (exposed as an MCP tool) using a clear switch control, so I can easily enable or disable triggers without confusion about what the checkbox means.

**Why this priority**: The current "Expose as MCP tool" checkbox is confusing. A toggle switch with "Active/Inactive" state is more intuitive and follows common UI patterns for enabling/disabling features.

**Independent Test**: Can be fully tested by opening the Edit User Intent modal, toggling the active switch, and verifying the trigger's exposed state changes accordingly.

**Acceptance Scenarios**:

1. **Given** the Edit User Intent modal is open, **When** the user views the exposure setting, **Then** it displays as a toggle switch labeled "Active" (not a checkbox)
2. **Given** the toggle is in "Active" state, **When** the user views the switch, **Then** it clearly indicates the trigger is exposed as an MCP tool
3. **Given** the toggle is switched off, **When** the user saves, **Then** the trigger is not exposed as an MCP tool
4. **Given** the toggle is switched on, **When** the user saves, **Then** the trigger is exposed as an MCP tool with its configured name and parameters

---

### User Story 4 - Slug-Based Node References (Priority: P2)

As a workflow designer, I want nodes to be referenced by human-readable slugs rather than opaque IDs, so I can understand my workflow references without needing to look up which node corresponds to which ID.

**Why this priority**: Human-readable slugs improve debugging, readability, and maintainability of workflows. Users can understand `{{ weather_trigger.city }}` but not `{{ abc123-def456.city }}`.

**Independent Test**: Can be fully tested by creating nodes, verifying they have unique slugs, and confirming all output references use slugs instead of IDs.

**Acceptance Scenarios**:

1. **Given** a new node is created, **When** the node is added to the canvas, **Then** it is assigned a unique, human-readable slug based on its type (e.g., "user_intent_1", "api_call_2")
2. **Given** multiple nodes of the same type exist, **When** viewing their slugs, **Then** each has a unique slug with incrementing suffix
3. **Given** a node has a custom name set by the user, **When** the slug is generated, **Then** the slug reflects the custom name (sanitized for valid slug format)
4. **Given** output references are displayed anywhere in the UI, **When** viewing them, **Then** they use slugs (e.g., `{{ trigger_1.city }}`) not IDs

---

### Edge Cases

- What happens when a user renames a node that is already referenced by downstream nodes?
  - References should update automatically to use the new slug, or a warning should be displayed about broken references
- What happens when two nodes would have the same slug?
  - System should automatically append a number suffix to ensure uniqueness (e.g., "api_call_1", "api_call_2")
- What happens when a node has no outputs (e.g., Return node)?
  - The "Use Previous Outputs" component should not list nodes with no outputs, or show them as "(no outputs available)"
- What happens when the upstream node's schema is unknown or pending?
  - The outputs dropdown should show "(schema unavailable)" with option to refresh
- What happens if a referenced node is deleted?
  - References become invalid and should be highlighted as errors in the downstream node's configuration

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display "No input" message for trigger nodes in the schema panel
- **FR-002**: System MUST distinguish between static and dynamic output fields in trigger node schema display
- **FR-003**: System MUST display an "Active" toggle switch (not checkbox) for MCP tool exposure in the Edit User Intent modal
- **FR-004**: System MUST provide a "Use Previous Outputs" component in node configuration modals
- **FR-005**: The "Use Previous Outputs" component MUST show a dropdown of upstream nodes identified by their slugs
- **FR-006**: The "Use Previous Outputs" component MUST show a dropdown of available output fields from the selected node
- **FR-007**: The "Use Previous Outputs" component MUST display optional descriptions for output fields when available
- **FR-008**: System MUST provide a copy-to-clipboard button that copies the reference in `{{ nodeSlug.path }}` format
- **FR-009**: System MUST assign unique, human-readable slugs to all nodes
- **FR-010**: Node slugs MUST be derived from node type or custom name, sanitized to valid slug format (lowercase, underscores, no special characters)
- **FR-011**: System MUST ensure slug uniqueness by appending numeric suffixes when needed
- **FR-012**: All output references in the UI MUST use node slugs, not internal IDs
- **FR-013**: Dynamic output fields on trigger nodes MUST correspond directly to user-defined parameters

### Key Entities

- **Node Slug**: A unique, human-readable identifier for a node derived from its type or custom name. Format: lowercase letters, numbers, and underscores only (e.g., "user_intent_1", "weather_api_call").

- **Output Reference**: A string that references a specific output field from a node using the format `{{ nodeSlug.fieldPath }}`. Supports nested paths for complex output structures.

- **Static Output Field**: An output field that is always present on a node type regardless of configuration (e.g., "type", "triggered", "toolName" on trigger nodes).

- **Dynamic Output Field**: An output field that is generated based on user configuration (e.g., parameters defined on a User Intent trigger become dynamic output fields).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can insert a previous node output reference into a configuration field within 3 clicks (open dropdown, select node, select field, click copy)
- **SC-002**: 90% of users can correctly identify which outputs are available from a trigger node by viewing the schema panel
- **SC-003**: Users can understand the meaning of an output reference (e.g., `{{ weather_trigger.city }}`) without consulting documentation
- **SC-004**: Zero confusion between "active" toggle state and MCP tool exposure - toggle ON means exposed, toggle OFF means not exposed
- **SC-005**: All node references in the UI use human-readable slugs that users can understand at a glance
- **SC-006**: Users can distinguish between static outputs (always present) and dynamic outputs (from parameters) in trigger nodes

## Assumptions

- Nodes already have a unique internal ID that can be used as a fallback
- The existing schema validation system (from 001-io-schemas) provides output schema information that this feature will leverage
- Slugs are generated at node creation time and persist for the lifetime of the node
- The `{{ nodeSlug.path }}` syntax is already understood by the flow execution engine, or will be supported
- User Intent triggers are the primary trigger type; other trigger types (if any) follow the same patterns

## Out of Scope

- Auto-completion or intellisense for output references within text fields
- Validation that a referenced output field actually exists at configuration time (handled by existing schema validation)
- Batch renaming or refactoring of output references across multiple nodes
- Version history or change tracking for node slugs
