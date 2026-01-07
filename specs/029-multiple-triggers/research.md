# Research: Multiple Triggers per Flow

**Feature**: 029-multiple-triggers
**Date**: 2026-01-06

## Research Summary

This document captures technical decisions and patterns for implementing multiple triggers per flow.

---

## 1. Tool Name Generation Strategy

**Decision**: Auto-generate tool name from node name using snake_case conversion

**Rationale**:
- Consistent with existing flow.toolName generation from flow.name
- Users don't need to manually enter tool names
- Reduces user input errors and naming conflicts

**Implementation Pattern**:
```typescript
function toSnakeCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
// "Get Weather Data" → "get_weather_data"
```

**Alternatives Considered**:
- Manual tool name entry: Rejected - adds friction, prone to errors
- UUID-based names: Rejected - not human-readable for MCP clients

---

## 2. Tool Name Uniqueness Enforcement

**Decision**: Enforce uniqueness within app scope; append numeric suffix on conflict

**Rationale**:
- MCP protocol requires unique tool names per server (app)
- Automatic suffix prevents blocking user workflows
- Suffix pattern is predictable and debuggable

**Implementation Pattern**:
```typescript
async function generateUniqueToolName(appId: string, baseName: string): Promise<string> {
  const existingNames = await getToolNamesForApp(appId);
  if (!existingNames.includes(baseName)) return baseName;

  let suffix = 2;
  while (existingNames.includes(`${baseName}_${suffix}`)) {
    suffix++;
  }
  return `${baseName}_${suffix}`;
}
```

**Alternatives Considered**:
- Block creation on conflict: Rejected - poor UX, forces manual rename
- Random suffix: Rejected - not predictable, harder to debug

---

## 3. No-Trigger Flow Warning Display

**Decision**: Warning icon on flow card + canvas header with tooltip

**Rationale**:
- Consistent visibility across list and detail views
- Non-blocking - allows flow to exist during construction
- Tooltip provides actionable guidance

**Implementation Pattern**:
- Use `AlertTriangle` icon from lucide-react (already in project)
- Tooltip text: "This flow has no trigger nodes and cannot be executed via MCP."
- Compute `hasTriggers` from nodes array: `nodes.some(n => n.type === 'UserIntent')`

**Alternatives Considered**:
- Banner only: Rejected - less visible in flow list
- Block flow creation: Rejected - prevents work-in-progress flows

---

## 4. MCP Tool Derivation from Triggers

**Decision**: Query all active UserIntent nodes across flows to build tool list

**Rationale**:
- Each trigger = one tool (1:1 mapping)
- isActive on trigger controls individual tool visibility
- Flow-level isActive no longer needed for tool visibility

**Implementation Pattern**:
```typescript
async listTools(appSlug: string): Promise<McpTool[]> {
  const flows = await flowRepo.find({ where: { app: { slug: appSlug } } });

  return flows.flatMap(flow =>
    flow.nodes
      .filter(node => node.type === 'UserIntent' && node.parameters.isActive !== false)
      .map(trigger => ({
        name: trigger.parameters.toolName,
        description: trigger.parameters.toolDescription,
        inputSchema: buildSchema(trigger.parameters.parameters),
      }))
  );
}
```

**Alternatives Considered**:
- Separate TriggerTool entity: Rejected - over-engineering for POC
- Keep flow.isActive as master switch: Rejected - less granular control

---

## 5. Trigger-Specific Execution

**Decision**: Execute flow starting from the specific trigger that was invoked

**Rationale**:
- Different triggers may have different parameters
- Execution context needs to know which trigger started the flow
- Allows different parameter schemas per entry point

**Implementation Pattern**:
```typescript
async executeTool(appSlug: string, toolName: string, input: object): Promise<McpToolResponse> {
  // Find the trigger by toolName
  const { flow, trigger } = await findTriggerByToolName(appSlug, toolName);

  // Validate input against trigger's parameter schema
  validateInput(input, trigger.parameters.parameters);

  // Execute only nodes reachable from THIS trigger
  const reachableNodes = getNodesReachableFrom(trigger.id, flow.nodes, flow.connections);
  return executeNodes(reachableNodes, input);
}
```

**Alternatives Considered**:
- Execute all triggers: Rejected - wrong semantics, confuses execution paths
- Merge all trigger parameters: Rejected - loses specificity of each tool

---

## 6. Migration Strategy

**Decision**: In-place migration moving flow properties to first UserIntent node

**Rationale**:
- Minimizes data loss risk
- Preserves existing tool names and behavior
- Single migration script handles all cases

**Implementation Pattern**:
```typescript
// Migration pseudo-code
for (const flow of flows) {
  const firstTrigger = flow.nodes.find(n => n.type === 'UserIntent');

  if (firstTrigger) {
    firstTrigger.parameters.toolName = flow.toolName;
    firstTrigger.parameters.toolDescription = flow.toolDescription;
    firstTrigger.parameters.parameters = flow.parameters;
    firstTrigger.parameters.isActive = flow.isActive;
  } else {
    // Create a UserIntent node with flow's tool properties
    flow.nodes.push({
      id: uuid(),
      type: 'UserIntent',
      name: flow.name,
      position: { x: 100, y: 100 },
      parameters: {
        toolName: flow.toolName,
        toolDescription: flow.toolDescription,
        parameters: flow.parameters,
        isActive: flow.isActive,
        whenToUse: '',
        whenNotToUse: '',
      },
    });
  }

  // Clear flow-level properties (will be removed from entity)
  delete flow.toolName;
  delete flow.toolDescription;
  delete flow.parameters;
}
```

**Alternatives Considered**:
- Dual-write period: Rejected - adds complexity for POC
- New trigger entity: Rejected - over-engineering, breaks existing structure

---

## 7. UI Component Patterns

**Decision**: Extend existing NodeEditModal for UserIntent-specific fields

**Rationale**:
- Reuses existing modal infrastructure
- Consistent UX with other node types
- Tool properties visible when editing trigger

**UI Elements**:
1. **Trigger Node on Canvas**: Display tool name badge below node
2. **Edit Modal**: Add "MCP Tool" section with toolName (read-only, derived), toolDescription, parameters editor
3. **Flow Card**: Show warning icon + "No triggers" if empty
4. **Flow Detail Header**: List exposed tool names

**Alternatives Considered**:
- Separate tool configuration modal: Rejected - fragments the UX
- Inline editing on canvas: Rejected - too cramped for parameter lists
