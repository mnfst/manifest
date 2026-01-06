# Research: Trigger Node Refactor

**Feature**: 001-trigger-node-refactor
**Date**: 2026-01-06

## Research Questions

### 1. How to implement output-only handles for trigger nodes?

**Decision**: Use existing React Flow pattern with `inputs: []` in node type definition and only render `<Handle type="source">` components.

**Rationale**: The codebase already has this pattern implemented in UserIntentNode.tsx (current "fake" node) which only has a source handle. The node type definition system in `packages/nodes/src/types.ts` supports empty input arrays.

**Alternatives considered**:
- Custom connection validation to reject trigger node inputs: Rejected because React Flow's Handle component already provides this - if no target handle exists, connections cannot target that node.
- Separate "TriggerNodeDefinition" interface: Rejected as over-engineering; the existing `inputs: []` pattern is sufficient.

### 2. How to enforce connection validation for trigger nodes?

**Decision**: No additional validation needed in `isValidConnection`. The absence of target handles on trigger node components will naturally prevent incoming connections.

**Rationale**: React Flow only allows connections to existing handles. By not rendering target handles on trigger nodes, the UI itself prevents invalid connections. The existing cycle detection and self-connection prevention in `FlowDiagram.tsx` remain sufficient.

**Alternatives considered**:
- Add explicit trigger-node check in `isValidConnection`: Rejected as redundant with handle-based prevention.
- Server-side validation: Already exists via connection API; can add trigger-node specific validation as defense-in-depth.

### 3. How to implement node type categories?

**Decision**: Add a `category` property to `NodeTypeDefinition` interface with values: `'trigger' | 'interface' | 'action' | 'return'`.

**Rationale**: Categories are metadata used for UI grouping and behavior classification. Adding as a property follows the existing pattern of node metadata (icon, group, description). The `group` property exists but is an array of tags rather than a single classification.

**Alternatives considered**:
- Use existing `group` property: Rejected because `group` is an array of tags for filtering, not a single classification.
- Separate category registry: Rejected as over-engineering; embedding category in definition is simpler.

### 4. How to handle node renaming without breaking existing data?

**Decision**: Keep internal type names unchanged (`Interface`, `Return`), only update `displayName` properties. This preserves database compatibility.

**Rationale**: The `type` field in `NodeInstance` and database entities uses the internal name (`Interface`, `Return`, `CallFlow`). Changing display names only requires updating `displayName` in node definitions - no data migration needed for existing nodes.

**Alternatives considered**:
- Full rename including internal names: Rejected because it requires data migration to update all existing node type references in the database.
- Create new types with backward-compatible aliases: Over-engineering for display name changes.

### 5. How to migrate flow-level user intent to UserIntentNode?

**Decision**: Implement as a database migration script that:
1. For each flow with `whenToUse` or `whenNotToUse` values
2. Creates a new node record with type `UserIntent`, position `{x: 50, y: 200}`
3. Copies `whenToUse` and `whenNotToUse` to node parameters
4. Sets the flow's `whenToUse` and `whenNotToUse` to NULL

**Rationale**: One-time migration ensures clean data model. Since this is POC with `synchronize: true`, we can run migration manually before schema changes take effect.

**Alternatives considered**:
- Lazy migration on flow load: Adds complexity to every flow fetch, harder to track migration status.
- Dual-write with gradual migration: Over-engineering for POC phase.

### 6. How to structure the AddStepModal grouping?

**Decision**: Group nodes by category with section headers. Order: Triggers → Agentic Interfaces → Actions → Return Values.

**Rationale**: Follows logical flow creation order (trigger first, then processing, then output). The existing AddStepModal uses a grid layout that can be adapted to show category headers.

**Alternatives considered**:
- Tabs for categories: Adds complexity and hides options; grid with headers is more scannable.
- Collapsible sections: Unnecessary for 4-5 nodes total.

## Key Technical Findings

### Existing Pattern for Output-Only Nodes

From `packages/frontend/src/components/flow/UserIntentNode.tsx`:
```typescript
<Handle
  type="source"
  position={Position.Right}
  id="output"
  className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-200"
/>
```

This component has NO target handle, making it output-only.

### Node Type Definition Structure

From `packages/nodes/src/types.ts`:
```typescript
export interface NodeTypeDefinition {
  name: string;           // Internal type (stored in DB)
  displayName: string;    // Shown to users
  icon: string;           // Lucide icon name
  group: string[];        // Tags for filtering
  description: string;
  inputs: string[];       // Handle IDs for inputs
  outputs: string[];      // Handle IDs for outputs
  defaultParameters: Record<string, unknown>;
  execute: (context: ExecutionContext) => Promise<ExecutionResult>;
}
```

### Current Node Types

| Node | Internal Name | Display Name (Current) | Display Name (New) | Inputs | Outputs |
|------|---------------|------------------------|-------------------|--------|---------|
| Interface | `Interface` | "Display Interface" | "Agentic Interface" | `['main']` | `['action:submit', 'action:click', 'action:select']` |
| Return | `Return` | "Return Value" | "Return Value" | `['main']` | `[]` |
| CallFlow | `CallFlow` | "Call Flow" | "Call Flow" | `['main']` | `['main']` |
| UserIntent | `UserIntent` (NEW) | N/A | "User Intent" | `[]` | `['main']` |

### Flow Entity Current Schema

From `packages/backend/src/flow/flow.entity.ts`:
- `whenToUse: string | null` (VARCHAR 500) - TO BE REMOVED
- `whenNotToUse: string | null` (VARCHAR 500) - TO BE REMOVED
- `toolDescription: string` - KEEP (describes the flow itself)

## Dependencies

- **@xyflow/react**: Already supports handle-based connection control
- **TypeORM**: Supports schema synchronization for POC
- **Lucide React**: Already includes suitable icons for trigger nodes (e.g., `zap`, `play`, `target`)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing flows break after migration | Medium | High | Run migration script before deploying schema changes; backup database |
| Users confused by node renaming | Low | Low | Display names are self-explanatory; existing users are minimal (POC) |
| Connection validation edge cases | Low | Medium | Server-side validation as defense-in-depth |
