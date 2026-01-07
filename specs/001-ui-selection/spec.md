# Feature Specification: UI Selection Architecture Refactor

**Feature Branch**: `001-ui-selection`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "Refactor nodes folder structure with category folders, remove table/post-list UIs, add Stat Card UI component with readonly display capability"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Stat Card UI to Flow (Priority: P1)

A flow builder wants to display statistical metrics (KPIs, dashboard stats) in their workflow. They open the node library, navigate to the UI category, and select the "Stat Card" UI component. They drag it onto the canvas, configure the input data mappings to provide stats (label, value, change percentage, trend direction), and the component displays the configured statistics with visual trend indicators.

**Why this priority**: This is the core new functionality - adding the Stat Card UI component that replaces the removed table/post-list UIs and provides a clean, focused starting point for the UI component system.

**Independent Test**: Can be fully tested by dragging a Stat Card node onto a flow canvas, connecting it to upstream data, and verifying the stats render with correct values and trend indicators.

**Acceptance Scenarios**:

1. **Given** a flow builder is on the canvas view, **When** they open the node library and expand the UI section, **Then** they see "Stat Card" listed as an available UI component
2. **Given** a Stat Card node is on the canvas, **When** the builder configures input data with label, value, change, and trend properties, **Then** the component displays the statistics with appropriate visual formatting
3. **Given** a Stat Card receives upstream data, **When** the data includes a "trend" of "up"/"down"/"neutral", **Then** the component displays corresponding color-coded trend indicators (green/red/gray)

---

### User Story 2 - Browse UI Components in Node Library (Priority: P2)

A flow builder wants to see all available UI components in one place. They open the node library and find UI components grouped under a dedicated "interface" category. The Stat Card appears alongside any future UI components, each with a clear name, icon, and description.

**Why this priority**: This ensures discoverability of UI components within the existing node library infrastructure, making them accessible like any other node type.

**Independent Test**: Can be tested by opening the node library and verifying UI components appear in the interface category with proper metadata (name, icon, description).

**Acceptance Scenarios**:

1. **Given** a flow builder opens the node library, **When** they browse the interface category, **Then** they see Stat Card listed with its display name, icon, and description
2. **Given** multiple UI components exist, **When** the builder searches for "stat", **Then** the Stat Card component appears in search results

---

### User Story 3 - Navigate Organized Node Codebase (Priority: P3)

A developer working on the nodes package wants to find and modify node definitions. They navigate to `packages/nodes/src/nodes/` and find nodes organized by category folders (e.g., `return/`, `interface/`, `trigger/`, `action/`). Each category folder contains the relevant node definition files, making it easy to locate and maintain related nodes.

**Why this priority**: This improves developer experience and codebase maintainability but is not user-facing functionality.

**Independent Test**: Can be tested by navigating the folder structure and verifying nodes are correctly organized by their category with proper imports maintained.

**Acceptance Scenarios**:

1. **Given** a developer navigates to `packages/nodes/src/nodes/`, **When** they list the directory contents, **Then** they see category folders: `return/`, `interface/`, `trigger/`, `action/`
2. **Given** the InterfaceNode is in the interface category, **When** a developer looks in `nodes/interface/`, **Then** they find the InterfaceNode.ts file
3. **Given** nodes are reorganized into folders, **When** the application runs, **Then** all existing node functionality continues to work (imports resolve correctly)

---

### Edge Cases

- What happens when a Stat Card receives no data? Display empty/placeholder state with default values
- What happens when trend value is missing or invalid? Default to "neutral" display (gray, no change indicator)
- What happens when value is a number vs. string? Accept both formats, display as provided
- How does the component handle very long labels or values? Truncate with ellipsis per standard UI patterns

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST reorganize nodes in `packages/nodes/src/nodes/` into category subfolders (`return/`, `interface/`, `trigger/`, `action/`)
- **FR-002**: System MUST remove all traces of table UI component (code, registry entries, type definitions)
- **FR-003**: System MUST remove all traces of post-list UI component (code, registry entries, type definitions)
- **FR-004**: System MUST add a new "Stat Card" UI component based on the Manifest UI stats component structure
- **FR-005**: The Stat Card component MUST accept input data with the following properties: label, value, change (optional), changeLabel (optional), trend (optional: "up"/"down"/"neutral")
- **FR-006**: The Stat Card component MUST be read-only (display only, no output actions in this iteration)
- **FR-007**: The Stat Card component MUST appear in the node library under the interface category like any other node
- **FR-008**: System MUST store the default Stat Card source code template, which will be editable in future iterations
- **FR-009**: All node registry exports and imports MUST be updated to reflect the new folder structure
- **FR-010**: The LayoutTemplate type and LAYOUT_REGISTRY MUST be updated to remove table/post-list and include stat-card

### Key Entities

- **UI Component**: A visual component that renders data in the flow. Has a name, input schema (data it expects), category, and source code template. Initially read-only (no outputs).
- **Stat Card Data**: Represents individual statistic items with: label (metric name), value (display value), change (percentage), changeLabel (description), trend (direction indicator).
- **Node Category**: Classification for organizing nodes: trigger, action, interface, return.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can locate any node definition file within 2 folder levels from the nodes directory
- **SC-002**: Flow builders can find and use the Stat Card UI in under 30 seconds from opening the node library
- **SC-003**: 100% of existing flows continue to function after the refactor (no breaking changes to node interfaces)
- **SC-004**: The codebase contains zero references to table or post-list UI components after removal
- **SC-005**: The Stat Card component successfully renders statistics with all supported input combinations (with/without change, with/without trend)

## Assumptions

- The current node registry pattern (`builtInNodes` and `builtInNodeList` exports) will be maintained
- The Manifest UI stats component JSON structure is the authoritative reference for Stat Card input format
- Future UI components will follow the same pattern established by Stat Card
- The folder structure refactor applies only to `packages/nodes/src/nodes/`, not to frontend components
- Existing InterfaceNode infrastructure can be adapted/extended for the new UI component system
