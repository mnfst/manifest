# Research: Call Flow End Action

**Feature**: 014-call-flow-action
**Date**: 2025-12-28
**Status**: Complete

## Research Topics

### 1. Existing Pattern: ReturnValue Implementation

**Decision**: Mirror the ReturnValue pattern for CallFlow implementation

**Rationale**: The codebase has a proven pattern for flow-level actions:
- Dedicated TypeORM entity with flowId foreign key
- NestJS service with CRUD + reorder + mutual exclusivity validation
- REST controller with flow-scoped endpoints
- React Flow custom node component
- Frontend API client methods

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Unified EndAction entity with discriminator column | Over-engineering for current scope; would require refactoring existing ReturnValue |
| Generic action system with plugin architecture | POC phase doesn't warrant the complexity |
| Inline action storage in Flow entity (JSON column) | Loses type safety and relational integrity |

**Implementation Details Found**:
```
ReturnValueEntity → CallFlowEntity pattern:
- @Entity('call_flows')
- PrimaryGeneratedColumn('uuid') id
- Column('uuid') flowId + ManyToOne to FlowEntity
- Column('uuid') targetFlowId (NEW: reference to target flow)
- Column('int', default: 0) order
- CreateDateColumn/UpdateDateColumn
```

---

### 2. Mutual Exclusivity Enforcement

**Decision**: Extend existing mutual exclusivity checks in CallFlowService.create()

**Rationale**: Current ReturnValueService already validates against Views. CallFlow needs the same pattern extended to cover:
1. Views (cannot have CallFlow + Views)
2. ReturnValues (cannot have CallFlow + ReturnValues)

**Alternatives Considered**:

| Alternative | Rejected Because |
|-------------|------------------|
| Database-level constraint (CHECK) | SQLite doesn't support cross-table CHECK constraints |
| Type-level discrimination (union types) | Would require significant refactoring of existing code |
| UI-level only enforcement | Security risk - API would still allow invalid states |

**Validation Logic**:
```typescript
// Before creating CallFlow:
if (flow.views?.length > 0) {
  throw new BadRequestException('Cannot add call flows to a flow with views');
}
if (flow.returnValues?.length > 0) {
  throw new BadRequestException('Cannot add call flows to a flow with return values');
}

// Also update ReturnValueService and ViewService to check for callFlows
```

---

### 3. Target Flow Selection

**Decision**: Filter available flows from same app, excluding current flow

**Rationale**:
- Same-app constraint maintains data isolation between apps
- Self-reference prevention avoids infinite loops
- Simple dropdown selection matches existing UI patterns

**Implementation Details**:
```typescript
// API endpoint: GET /api/apps/:appId/flows (existing)
// Frontend filter:
const availableFlows = flows.filter(f => f.id !== currentFlowId);
```

**Edge Cases Handled**:
- Deleted target flow → Display error state on node
- No other flows available → Display empty state message
- Target flow made inactive → Still callable (design decision - or needs clarification)

---

### 4. Node Visual Distinction (No Right Handler)

**Decision**: Remove right-side Handle component from CallFlowNode and ReturnValueNode

**Rationale**:
- End actions should visually communicate "nothing can follow"
- Consistent with spec requirement FR-005
- ReturnValueNode currently has a right handler that should also be removed for consistency

**Implementation Details**:
```tsx
// CallFlowNode.tsx - only left handle
<Handle
  type="target"
  position={Position.Left}
  id="left"
  className="!bg-purple-400 !w-2 !h-2 !border-0"
/>
// NO right Handle component

// Also update ReturnValueNode.tsx to remove right handle
```

**Visual Differentiation**:
| Node Type | Color | Right Handle | Purpose |
|-----------|-------|--------------|---------|
| ViewNode | Blue | Yes | Intermediate action, can chain |
| ReturnValueNode | Green | No (update) | End action, returns text |
| CallFlowNode | Purple | No | End action, triggers another flow |

---

### 5. callTool Integration in MCP Execution

**Decision**: Execute callTool in generated widget HTML response

**Rationale**:
- ChatGPT SDK `window.openai.callTool(name, args)` is client-side API
- MCP tool response can include HTML widget with JavaScript
- Existing pattern in mcp.tool.ts generates HTML with `window.callMcpTool`

**Implementation Details**:
```typescript
// In executeCallFlowFlow():
private executeCallFlowFlow(
  flow: FlowEntity,
  callFlows: CallFlowEntity[],
  allFlows: FlowEntity[]
): McpToolResponse {
  // Generate HTML that invokes callTool for each target
  const callScript = callFlows
    .sort((a, b) => a.order - b.order)
    .map(cf => {
      const targetFlow = allFlows.find(f => f.id === cf.targetFlowId);
      if (!targetFlow) return '';
      return `window.openai?.callTool("${targetFlow.toolName}");`;
    })
    .join('\n');

  // Return as widget with auto-executing script
  return {
    content: [{ type: 'text', text: `Calling flow: ${targetFlow?.name}` }],
    structuredContent: { /* ... */ },
    _meta: { 'openai/outputTemplate': htmlWithScript }
  };
}
```

**Open Question**: Should callTool invocation be immediate (auto-execute) or require user action?
- **Decision**: Auto-execute since it's an "end action" - the flow has completed and is triggering the next flow.

---

### 6. Flow Diagram Rendering

**Decision**: Add CallFlowNode to nodeTypes, position after UserIntentNode like ReturnValue

**Rationale**: Consistent with existing layout algorithm in FlowDiagram.tsx

**Implementation Details**:
```typescript
const nodeTypes = {
  // ... existing types
  callFlowNode: CallFlowNode,
};

// Positioning (in getFlowState and node creation):
// CallFlow nodes at y: 80, x: 330 + index * 250 (same as ReturnValue)
```

---

### 7. API Design Pattern

**Decision**: REST endpoints scoped to flow, matching ReturnValue pattern

**Rationale**: Consistent API design enables frontend code reuse

**Endpoints**:
```
GET    /api/flows/:flowId/call-flows         # List call flows for a flow
POST   /api/flows/:flowId/call-flows         # Create call flow
GET    /api/call-flows/:callFlowId           # Get single call flow
PATCH  /api/call-flows/:callFlowId           # Update call flow
DELETE /api/call-flows/:callFlowId           # Delete call flow
POST   /api/flows/:flowId/call-flows/reorder # Reorder call flows
```

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| Architecture | Mirror ReturnValue pattern (entity + service + controller + node) |
| Mutual Exclusivity | Service-level validation against Views AND ReturnValues |
| Target Selection | Same-app flows only, exclude current flow |
| Node Visual | Purple theme, no right handle (end action) |
| Execution | Auto-invoke callTool via widget HTML script |
| API Design | REST endpoints matching /return-values pattern |
| ReturnValueNode | Update to remove right handle (consistency) |

## Outstanding Items

None - all technical decisions resolved. Ready for Phase 1 design artifacts.
