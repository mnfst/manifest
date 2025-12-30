# Data Model: Manual Node Connection Workflow

**Feature Branch**: `018-node-connection`
**Date**: 2025-12-29

## Existing Data Model (No Changes Required)

This feature uses the existing data model. No schema changes are required.

### Flow Entity (existing)

The Flow entity already has the necessary JSON columns for nodes and connections:

```typescript
interface Flow {
  id: string;
  appId: string;
  name: string;
  // ... other fields
  nodes: NodeInstance[];      // JSON column - array of nodes
  connections: Connection[];  // JSON column - array of connections
}
```

### NodeInstance (existing)

```typescript
interface NodeInstance {
  id: string;           // UUID
  type: NodeType;       // 'Interface' | 'Return' | 'CallFlow'
  name: string;         // Display name
  position: Position;   // { x: number, y: number }
  parameters: Record<string, unknown>;
}
```

### Connection (existing)

```typescript
interface Connection {
  id: string;           // UUID
  sourceNodeId: string; // ID of source node
  sourceHandle: string; // Handle identifier (e.g., 'output', 'action:submit')
  targetNodeId: string; // ID of target node
  targetHandle: string; // Handle identifier (e.g., 'input', 'left')
}
```

## Handle Naming Convention

Standardized handle names for consistent connection handling:

| Handle Name | Position | Usage |
|-------------|----------|-------|
| `output` | Right side | General output from any node |
| `input` | Left side | General input to any node |
| `action:{name}` | Right side | Action-specific output (e.g., `action:submit`) |

## Validation Rules

### Connection Validation

1. **Source node must exist**: `sourceNodeId` must reference an existing node in the flow
2. **Target node must exist**: `targetNodeId` must reference an existing node in the flow
3. **No duplicate connections**: Cannot have two connections with identical sourceNodeId + sourceHandle + targetNodeId + targetHandle
4. **No circular connections**: A connection cannot create a cycle in the graph
5. **No self-connections**: `sourceNodeId` cannot equal `targetNodeId`

### Node Type Connection Rules

| Source Type | Can Connect To |
|-------------|----------------|
| UserIntent (virtual) | Interface, Return, CallFlow |
| Interface | Interface, Return, CallFlow |
| Return | None (terminal) |
| CallFlow | None (terminal) |

## State Transitions

### Node Lifecycle

1. **Created**: Node appears on canvas with no connections
2. **Connected**: Node has one or more incoming/outgoing connections
3. **Orphaned**: Node was connected but connections were deleted
4. **Deleted**: Node is removed (cascade deletes its connections)

### Connection Lifecycle

1. **Created**: User drags from source handle to target handle
2. **Deleted**: User clicks trash icon on edge
