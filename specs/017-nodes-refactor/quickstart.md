# Quickstart: Nodes Package Refactor

**Feature**: 017-nodes-refactor
**Date**: 2025-12-29

## Overview

This refactor consolidates node-related entities into JSON columns within the Flow entity and creates a new `nodes` package for node type definitions.

## Key Changes

### Before (Separate Entities)
```
Flow
  ├── ViewEntity[]
  │   └── MockDataEntity
  ├── ReturnValueEntity[]
  ├── CallFlowEntity[]
  └── ActionConnectionEntity[]
```

### After (JSON Columns)
```
Flow
  ├── nodes: NodeInstance[]        # All nodes in one JSON array
  └── connections: Connection[]     # All connections in one JSON array
```

### Naming Changes
| Old Name | New Name |
|----------|----------|
| View | Interface |
| ReturnValue | Return |
| CallFlow | CallFlow (unchanged) |
| ActionConnection | Connection |

## Implementation Order

### Phase 1: Create nodes package
1. Create `packages/nodes/` directory structure
2. Define `NodeTypeDefinition` interface
3. Implement Interface, Return, CallFlow node definitions
4. Create node type registry

### Phase 2: Update shared types
1. Add `NodeInstance`, `Connection` types
2. Update `Flow` interface with new columns
3. Remove old view, return-value, call-flow, action-connection types

### Phase 3: Update backend
1. Add `nodes`, `connections` columns to FlowEntity
2. Remove old entity relations and modules
3. Create new NodeService for node CRUD operations
4. Update FlowController with node/connection endpoints

### Phase 4: Update frontend
1. Update API services to use new endpoints
2. Modify FlowCanvas to work with JSON nodes/connections
3. Update node components (ViewNode → InterfaceNode, etc.)

## File Locations

### New Files
```
packages/nodes/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── registry.ts
    └── definitions/
        ├── interface.node.ts
        ├── return.node.ts
        └── call-flow.node.ts

packages/shared/src/types/
└── node.ts                    # NodeInstance, Connection types

packages/backend/src/node/
├── node.module.ts
├── node.service.ts
└── node.controller.ts
```

### Files to Modify
```
packages/backend/src/
├── flow/flow.entity.ts        # Add nodes, connections columns
├── flow/flow.service.ts       # Update to use JSON nodes
├── flow/flow.module.ts        # Remove old module imports
└── app/app.module.ts          # Update entity list

packages/frontend/src/
├── components/flow/FlowCanvas.tsx  # Use JSON nodes/connections
└── services/flow.service.ts        # Update API calls
```

### Files to Delete
```
packages/backend/src/
├── view/                      # Entire module
├── return-value/              # Entire module
├── call-flow/                 # Entire module
├── action-connection/         # Entire module
└── mock-data/                 # Entire module

packages/shared/src/types/
├── view.ts
├── return-value.ts
├── call-flow.ts
├── action-connection.ts
└── mock-data.ts               # Keep MockData types, move to node.ts
```

## API Endpoints

### New Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/flows/{flowId}/nodes` | List all nodes in a flow |
| POST | `/api/flows/{flowId}/nodes` | Create a node |
| PATCH | `/api/flows/{flowId}/nodes/{nodeId}` | Update a node |
| DELETE | `/api/flows/{flowId}/nodes/{nodeId}` | Delete a node |
| PATCH | `/api/flows/{flowId}/nodes/{nodeId}/position` | Update node position |
| GET | `/api/flows/{flowId}/connections` | List all connections |
| POST | `/api/flows/{flowId}/connections` | Create a connection |
| DELETE | `/api/flows/{flowId}/connections/{connectionId}` | Delete a connection |
| GET | `/api/node-types` | List available node types |

### Deprecated Endpoints (to remove)
- `/api/flows/{flowId}/views/*`
- `/api/flows/{flowId}/return-values/*`
- `/api/flows/{flowId}/call-flows/*`
- `/api/views/{viewId}/action-connections/*`
- `/api/views/{viewId}/mock-data/*`

## Quick Reference

### Node Instance Structure
```typescript
interface NodeInstance {
  id: string;           // UUID
  type: 'Interface' | 'Return' | 'CallFlow';
  name: string;         // Unique within flow
  position: { x: number; y: number };
  parameters: {
    // Interface: { layoutTemplate, mockData }
    // Return: { text }
    // CallFlow: { targetFlowId }
  };
}
```

### Connection Structure
```typescript
interface Connection {
  id: string;
  sourceNodeId: string;
  sourceHandle: string;   // e.g., 'action:submit', 'right'
  targetNodeId: string;
  targetHandle: string;   // e.g., 'left'
}
```

### Node Type Definition
```typescript
interface NodeTypeDefinition {
  name: string;           // 'Interface'
  displayName: string;    // 'Display Interface'
  icon: string;           // 'layout-template'
  group: string[];        // ['views', 'ui']
  description: string;
  inputs: string[];       // ['main']
  outputs: string[];      // ['main', 'action:*']
  defaultParameters: Record<string, unknown>;
  execute: (context: ExecutionContext) => Promise<ExecutionResult>;
}
```

## Testing After Implementation

1. Start the app: `.specify/scripts/bash/serve-app.sh`
2. Create a new flow in an app
3. Add nodes via the canvas
4. Drag nodes to reposition
5. Connect nodes together
6. Verify positions persist after page reload
7. Delete a node and verify its connections are removed
