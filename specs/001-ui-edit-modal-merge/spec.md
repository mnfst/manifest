# Feature Specification: UI Node Edit Modal Consolidation

**Feature Branch**: `001-ui-edit-modal-merge`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Merge the edit modal of UI nodes to edit code, remove layout template field, add appearance configuration tabs"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified UI Node Editing Experience (Priority: P1)

A user wants to configure all aspects of a UI node (name, schema, appearance, code) in one place instead of navigating between separate modals.

**Why this priority**: This is the core consolidation that eliminates UX confusion from having redundant editing interfaces. All subsequent features depend on this unified experience.

**Independent Test**: Can be fully tested by opening a UI node for editing and verifying all configuration options are accessible in a single tabbed interface.

**Acceptance Scenarios**:

1. **Given** a user has a UI node on the canvas, **When** they open the edit interface, **Then** they see a single unified editor with tabs for "General", "Appearance", "Code", and "Preview"
2. **Given** a user is editing a UI node, **When** they switch between tabs, **Then** their unsaved changes are preserved across tab switches
3. **Given** a user is on the "General" tab, **When** they view the form, **Then** they see fields for node name and schema configuration (no layout template field)

---

### User Story 2 - Appearance Configuration for UI Nodes (Priority: P2)

A user wants to configure the visual appearance options of a UI component (variants, columns, boolean flags) through a form interface rather than editing code.

**Why this priority**: This provides a no-code way to customize component appearance, making the tool accessible to non-developers while the code editor remains available for advanced users.

**Independent Test**: Can be fully tested by selecting different appearance options in the form and verifying they reflect in the preview.

**Acceptance Scenarios**:

1. **Given** a user is on the "Appearance" tab for a Post List component, **When** they view the form, **Then** they see dropdown for variant (list/grid/carousel), dropdown for columns (2/3), and toggles for showAuthor and showCategory
2. **Given** a user changes the variant dropdown from "list" to "grid", **When** they view the preview tab, **Then** the component displays in grid layout
3. **Given** a user toggles showAuthor to off, **When** they save the node, **Then** the appearance configuration is persisted and reflected when reopening the editor
4. **Given** a component has a numeric appearance option, **When** the user views that option, **Then** they see a number input field

---

### User Story 3 - Non-Disruptive Node Addition (Priority: P3)

A user wants to add a UI node to the canvas without being immediately taken to the edit interface, allowing them to position and organize nodes first.

**Why this priority**: This improves workflow by giving users control over when to edit, rather than forcing immediate configuration that may interrupt their layout planning.

**Independent Test**: Can be fully tested by adding a UI node and verifying it appears on the canvas without any modal or editor opening automatically.

**Acceptance Scenarios**:

1. **Given** a user clicks to add a UI node from the library, **When** the node is created, **Then** the node appears on the canvas without any edit modal or editor opening
2. **Given** a newly added UI node on the canvas, **When** the user wants to edit it, **Then** they can open the edit interface through the node's context menu or by double-clicking

---

### User Story 4 - Complete Backend Cleanup (Priority: P4)

The system should not store or process deprecated fields (layout template) to maintain data consistency and prevent confusion.

**Why this priority**: Backend cleanup ensures data integrity and prevents future bugs from deprecated fields being partially supported.

**Independent Test**: Can be verified by creating/updating UI nodes and confirming layout template is neither sent nor received in API calls.

**Acceptance Scenarios**:

1. **Given** a UI node is created or updated via the API, **When** the request is processed, **Then** no layout template field is accepted or stored
2. **Given** existing UI nodes with layout template data, **When** they are loaded, **Then** the layout template field is ignored without errors

---

### Edge Cases

- What happens when a component has no appearance options? The Appearance tab displays a message indicating no configurable options are available.
- How does the system handle appearance values that were set in code but not in the form? Values set directly in code take precedence; the form displays the code values as read-only or syncs them.
- What happens when a user has unsaved changes and tries to close the editor? A confirmation dialog warns about unsaved changes.
- How does the system handle migrating existing nodes that use layout template? Existing nodes continue to work; the layout template field is simply hidden and ignored.

## Requirements *(mandatory)*

### Functional Requirements

**Modal Consolidation**

- **FR-001**: System MUST remove the separate "Edit" modal currently used for UI node configuration
- **FR-002**: System MUST remove the "Layout Template" field from all UI node interfaces and data models
- **FR-003**: System MUST rename "Edit Code" to "Edit" in all UI references
- **FR-004**: System MUST provide a tabbed interface in the unified editor with tabs: General, Appearance, Code, Preview

**General Tab**

- **FR-005**: General tab MUST display a text field for editing the node name
- **FR-006**: General tab MUST display the schema configuration for the UI node

**Appearance Tab**

- **FR-007**: Appearance tab MUST render appropriate form controls based on the component's appearance option types:
  - Dropdown/select for enum types (e.g., variant: 'list' | 'grid' | 'carousel')
  - Toggle/switch for boolean types (e.g., showAuthor: boolean)
  - Text input for string types
  - Number input for numeric types
- **FR-008**: System MUST support all appearance option types from the component registry (Post List, Product List, Option List, Tag Select, Progress Steps, Status Badge, Post Card, Table, Message Bubble)
- **FR-009**: Appearance configuration changes MUST be reflected in the Preview tab in real-time
- **FR-010**: System MUST persist appearance configuration when the user saves the node

**Node Addition Behavior**

- **FR-011**: When a user adds a UI node from the library, the system MUST NOT automatically open any edit modal or editor
- **FR-012**: System MUST allow users to initiate editing through the node's context menu or interaction (e.g., double-click)

**Backend Cleanup**

- **FR-013**: Backend MUST NOT accept layout template field in create/update node requests
- **FR-014**: Backend MUST NOT return layout template field in node responses
- **FR-015**: System MUST handle existing nodes with layout template data gracefully (ignore the field)

### Key Entities

- **UI Node**: A visual component node that can be customized through code and appearance settings. Contains: name, type, schema, customCode, appearanceConfig
- **Appearance Config**: A key-value configuration object storing component-specific visual options. Each key maps to the component's appearance parameter schema.
- **Component Registry**: External registry defining available components and their appearance option schemas (types: enum, boolean, string, number)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access all UI node configuration (name, schema, appearance, code, preview) from a single interface with zero navigation to separate modals
- **SC-002**: 100% of appearance option types from the component registry are configurable through form controls (no code editing required for basic customization)
- **SC-003**: Changes made in the Appearance tab are visible in the Preview tab within 1 second
- **SC-004**: Users adding a new UI node remain on the canvas without any interruption or modal appearing
- **SC-005**: All existing UI nodes continue to function correctly after removing layout template support

## Assumptions

- The component registry at ui.manifest.build/r/registry.json is the authoritative source for component appearance options
- Existing custom code in UI nodes should be preserved and continue to work
- The schema configuration in the General tab refers to input/output schema definitions already present in the system
- Double-click on a node is an acceptable interaction pattern for opening the editor (in addition to context menu)
