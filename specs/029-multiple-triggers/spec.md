# Feature Specification: Multiple Triggers per Flow

**Feature Branch**: `029-multiple-triggers`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "Dissociate MCP tools and flows to allow one flow to have several triggers as several intents can lead to the same flow, sometimes with different params. Remove toolName and toolDescription from Flow to merge with trigger node params. Each trigger becomes its own MCP tool."

## Clarifications

### Session 2026-01-06

- Q: How is the tool name derived? → A: Auto-generated from node name in snake_case (same as current flow name behavior)
- Q: How to handle duplicate tool names? → A: System enforces uniqueness; if duplicate detected, append suffix to make unique
- Q: How to handle flows without trigger nodes? → A: Flow can exist but is non-functional; UI shows warning indicator
- Q: How should the no-trigger warning be displayed? → A: Warning icon on flow card + canvas header with tooltip explaining the issue

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Flow with Multiple Triggers (Priority: P1)

A flow builder wants to create a single flow that can be invoked through multiple different user intents. For example, a "get product info" flow could be triggered by "show product details", "lookup item", or "find product" - each with slightly different parameter requirements.

**Why this priority**: This is the core value proposition. Without multiple triggers, users must duplicate entire flows for different intents, leading to maintenance burden and inconsistency.

**Independent Test**: Can be fully tested by creating a flow, adding 2+ trigger nodes with different tool names/descriptions, and verifying both appear as separate MCP tools.

**Acceptance Scenarios**:

1. **Given** a user has created a flow, **When** they add a second UserIntent trigger node with a different tool name, **Then** the flow contains two trigger nodes, each with its own MCP tool identity.
2. **Given** a flow has two trigger nodes, **When** the user views the MCP server tool list, **Then** both tools appear with their distinct names and descriptions.
3. **Given** a flow has multiple triggers, **When** the user edits one trigger's parameters, **Then** only that trigger's MCP tool definition is affected.

---

### User Story 2 - MCP Tool Generation from Trigger Nodes (Priority: P1)

When a flow is published, each active trigger node becomes a distinct MCP tool. The tool name, description, and parameters are defined on the trigger node rather than the flow.

**Why this priority**: This is the fundamental architectural change that enables multiple triggers. The MCP server must derive tools from triggers, not flows.

**Independent Test**: Can be tested by creating a flow with 2 triggers and calling the MCP list_tools endpoint to verify both tools are served.

**Acceptance Scenarios**:

1. **Given** a flow with 3 active trigger nodes, **When** the MCP server lists tools, **Then** 3 distinct tools are exposed.
2. **Given** a trigger node with tool name "get_weather" and description "Fetch current weather", **When** the MCP tool list is queried, **Then** a tool appears with name "get_weather" and description "Fetch current weather".
3. **Given** a trigger node is marked inactive, **When** the MCP tool list is queried, **Then** that trigger's tool is not exposed.

---

### User Story 3 - Execute Flow via Specific Trigger (Priority: P1)

When an MCP tool is called, the system executes the flow starting from the specific trigger node that corresponds to that tool, using the parameters defined on that trigger.

**Why this priority**: Execution must be trigger-aware to support different parameter sets for each trigger.

**Independent Test**: Can be tested by calling each trigger's tool with different inputs and verifying correct parameter handling.

**Acceptance Scenarios**:

1. **Given** a flow with triggers "get_product_by_id" (param: id) and "search_products" (param: query), **When** "get_product_by_id" is called with id=123, **Then** the flow executes with id=123 available.
2. **Given** a flow with two triggers connecting to the same action node, **When** either trigger's tool is called, **Then** the shared action node executes correctly.
3. **Given** a trigger has required parameters, **When** the MCP tool is called without those parameters, **Then** the system returns an appropriate validation error.

---

### User Story 4 - Multiple Triggers to Same Action (Priority: P2)

Users can connect multiple trigger nodes to the same action or return node, allowing different entry points to share common flow logic.

**Why this priority**: Enables code reuse within flows. Less critical than basic multi-trigger functionality but important for practical usage.

**Independent Test**: Can be tested by creating 2 triggers both connecting to a single Return node and verifying both executions reach the same output.

**Acceptance Scenarios**:

1. **Given** two trigger nodes, **When** the user connects both to the same action node, **Then** the connections are created successfully.
2. **Given** a flow canvas with triggers A and B both connected to action C, **When** the flow is saved, **Then** the connection configuration persists correctly.
3. **Given** triggers A and B connect to the same action chain ending in Return, **When** either trigger is invoked, **Then** the execution follows the path to Return correctly.

---

### User Story 5 - Migration from Flow-Level Tool Properties (Priority: P2)

Existing flows with toolName and toolDescription on the Flow entity are migrated. The first trigger node in each flow inherits these properties.

**Why this priority**: Required for backward compatibility but only affects existing data, not core functionality.

**Independent Test**: Can be tested by running migration on a database with existing flows and verifying trigger nodes receive the tool properties.

**Acceptance Scenarios**:

1. **Given** an existing flow with toolName="my_tool" and toolDescription="My description", **When** migration runs, **Then** the flow's first UserIntent node gains these properties.
2. **Given** an existing flow with parameters defined, **When** migration runs, **Then** the first UserIntent node inherits those parameters.
3. **Given** an existing flow with no UserIntent node, **When** migration runs, **Then** a UserIntent node is created with the flow's tool properties.

---

### User Story 6 - Distinct Tool Identity Display (Priority: P2)

The UI clearly distinguishes that each trigger node represents a separate MCP tool, helping users understand that one flow results in multiple tools.

**Why this priority**: User experience clarity. Without clear visual distinction, users may be confused about the relationship between triggers and MCP tools.

**Independent Test**: Can be tested by visual inspection of the canvas and trigger node configuration panels.

**Acceptance Scenarios**:

1. **Given** a trigger node on the canvas, **When** the user views it, **Then** the tool name is prominently displayed on the node.
2. **Given** a user selects a trigger node, **When** the configuration panel opens, **Then** it clearly indicates "This trigger exposes an MCP tool: [tool name]".
3. **Given** a flow with 2 triggers, **When** viewing the flow summary, **Then** both tool names are listed as "MCP Tools: get_weather, lookup_weather".

---

### Edge Cases

- What happens when a trigger node has no tool name? Tool name is auto-generated from node name in snake_case; node name is always required.
- What happens when two trigger nodes would have identical tool names? System appends numeric suffix to ensure uniqueness (e.g., "get_weather", "get_weather_2").
- What happens when a flow has no trigger nodes? Flow can exist but is non-functional; warning icon appears on flow card and canvas header with explanatory tooltip.
- What happens when all trigger nodes in a flow are inactive? The flow contributes no tools to the MCP server; same warning as no-trigger state.
- What happens when a trigger node is deleted? Its MCP tool is removed; other triggers in the flow remain unaffected.
- What happens when a node is renamed? Tool name is regenerated from new name; if conflict arises, suffix is added.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow multiple UserIntent trigger nodes per flow.
- **FR-002**: Each UserIntent node MUST have its own `toolName`, `toolDescription`, and `parameters` properties.
- **FR-003**: Tool names MUST be unique across all trigger nodes within the same app.
- **FR-004**: The MCP server MUST expose each active UserIntent node as a separate tool.
- **FR-005**: Tool execution MUST start from the specific trigger node that was invoked.
- **FR-006**: Multiple trigger nodes MUST be able to connect to the same downstream node(s).
- **FR-007**: System MUST auto-generate tool name from node name in snake_case format (e.g., "Get Weather Data" → "get_weather_data").
- **FR-008**: Flow entity MUST no longer store toolName, toolDescription, or parameters at the flow level.
- **FR-009**: System MUST provide a migration path for existing flows to move tool properties to trigger nodes.
- **FR-010**: UserIntent nodes MUST support an `isActive` property to enable/disable individual triggers.
- **FR-011**: The UI MUST clearly display which MCP tool each trigger node represents.
- **FR-012**: System MUST enforce tool name uniqueness within the app; if a duplicate would occur, append a numeric suffix (e.g., "get_weather_2").
- **FR-013**: System MUST display a warning icon on flow cards and canvas header for flows without trigger nodes, with tooltip: "This flow has no trigger nodes and cannot be executed via MCP."

### Key Entities

- **Flow**: Represents a reusable workflow. No longer contains toolName, toolDescription, or parameters. Contains nodes and connections.
- **UserIntent (Trigger Node)**: Entry point for flow execution. Now contains toolName, toolDescription, parameters, isActive, whenToUse, whenNotToUse.
- **MCP Tool**: Virtual entity derived from UserIntent nodes. Each active UserIntent = one MCP tool.
- **Connection**: Links between nodes. Multiple triggers can connect to the same target node.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single flow can expose up to 10 MCP tools (one per trigger node).
- **SC-002**: Users can create multiple triggers connecting to a shared action node in under 30 seconds.
- **SC-003**: All existing flows continue functioning after migration with no data loss.
- **SC-004**: Tool name uniqueness validation provides immediate feedback (under 500ms response).
- **SC-005**: The relationship between triggers and MCP tools is understood by users without documentation (task completion rate above 85% in usability testing).
- **SC-006**: Switching between trigger-based tool model works for 100% of existing flows with valid configurations.

## Assumptions

- Tool names follow snake_case convention as enforced by existing validation.
- Parameters follow the existing FlowParameter structure (name, type, description, optional).
- The MCP protocol version in use supports the current tool discovery format.
- Existing flows have at least one UserIntent node or the migration will create one.
- The "isActive" property defaults to true for new trigger nodes.
