# Quickstart: Trigger Node Refactor

**Feature**: 001-trigger-node-refactor
**Date**: 2026-01-06

## Overview

This guide provides a quick reference for implementing the trigger node refactor feature.

## Implementation Order

1. **Shared Package** - Update types first (other packages depend on these)
2. **Nodes Package** - Add UserIntentNode definition, update existing nodes
3. **Backend** - Update entities, add validation, create migration
4. **Frontend** - Update AddStepModal, register new node component

## Key Files to Modify

### Phase 1: Shared Types

```
packages/shared/src/types/node.ts
├── Add NodeTypeCategory type
├── Add 'UserIntent' to NodeType union
├── Add UserIntentNodeParameters interface
└── Add isUserIntentNode type guard
```

```
packages/shared/src/types/flow.ts
├── Remove whenToUse property
└── Remove whenNotToUse property
```

### Phase 2: Node Definitions

```
packages/nodes/src/types.ts
└── Add 'category' to NodeTypeDefinition interface
```

```
packages/nodes/src/nodes/
├── UserIntentNode.ts (NEW)
├── InterfaceNode.ts (update displayName + add category)
├── ReturnNode.ts (update displayName + add category)
├── CallFlowNode.ts (add category)
└── index.ts (export UserIntentNode, update registry)
```

### Phase 3: Backend

```
packages/backend/src/flow/flow.entity.ts
├── Remove whenToUse column
└── Remove whenNotToUse column
```

```
packages/backend/src/node/node.service.ts
└── Add connection validation for trigger nodes
```

```
packages/backend/src/migrations/ (NEW)
└── MigrateUserIntentToNodes.ts
```

### Phase 4: Frontend

```
packages/frontend/src/components/flow/AddStepModal.tsx
├── Fetch node types with categories
├── Group nodes by category
└── Add section headers
```

```
packages/frontend/src/components/flow/FlowDiagram.tsx
├── Register 'userIntentNode' custom type
└── Map UserIntent nodes to component
```

```
packages/frontend/src/components/flow/UserIntentNodeComponent.tsx (NEW or rename existing)
└── Editable node component for UserIntent
```

## Code Snippets

### NodeTypeCategory Type

```typescript
// packages/shared/src/types/node.ts
export type NodeTypeCategory = 'trigger' | 'interface' | 'action' | 'return';
```

### UserIntentNode Definition

```typescript
// packages/nodes/src/nodes/UserIntentNode.ts
import { NodeTypeDefinition } from '../types';

export const UserIntentNode: NodeTypeDefinition = {
  name: 'UserIntent',
  displayName: 'User Intent',
  icon: 'zap',
  group: ['flow', 'trigger'],
  category: 'trigger',
  description: 'Defines when the AI should trigger this flow based on user intent',
  inputs: [],  // No inputs - trigger node
  outputs: ['main'],
  defaultParameters: {
    whenToUse: '',
    whenNotToUse: '',
  },
  async execute(context) {
    // Trigger nodes don't execute - they define activation conditions
    return { success: true, output: context.input };
  },
};
```

### Updated InterfaceNode

```typescript
// packages/nodes/src/nodes/InterfaceNode.ts
export const InterfaceNode: NodeTypeDefinition = {
  name: 'Interface',
  displayName: 'Agentic Interface',  // Changed from 'Display Interface'
  // ... rest unchanged
  category: 'interface',  // NEW
};
```

### AddStepModal Grouping

```typescript
// packages/frontend/src/components/flow/AddStepModal.tsx
const groupedNodes = useMemo(() => {
  const groups: Record<string, NodeTypeInfo[]> = {
    trigger: [],
    interface: [],
    action: [],
    return: [],
  };

  nodeTypes.forEach(node => {
    groups[node.category].push(node);
  });

  return groups;
}, [nodeTypes]);

// Render with category headers
{categories.map(category => (
  <div key={category.id}>
    <h3>{category.displayName}</h3>
    {groupedNodes[category.id].map(node => (
      <NodeOption key={node.name} node={node} onSelect={onSelect} />
    ))}
  </div>
))}
```

### Connection Validation

```typescript
// packages/backend/src/node/node.service.ts
async createConnection(flowId: string, dto: CreateConnectionDto) {
  const targetNode = await this.nodeRepo.findOne({
    where: { id: dto.targetNodeId }
  });

  if (targetNode?.type === 'UserIntent') {
    throw new BadRequestException(
      'Cannot create connection to trigger node. Trigger nodes do not accept incoming connections.'
    );
  }

  // ... existing connection logic
}
```

## Migration Script

```typescript
// Run before deploying schema changes
async function migrateUserIntentToNodes(dataSource: DataSource) {
  const flowRepo = dataSource.getRepository(FlowEntity);
  const nodeRepo = dataSource.getRepository(NodeEntity);

  const flows = await flowRepo.find({
    where: [
      { whenToUse: Not(IsNull()) },
      { whenNotToUse: Not(IsNull()) },
    ],
  });

  for (const flow of flows) {
    // Create UserIntentNode
    const node = nodeRepo.create({
      id: uuidv4(),
      flowId: flow.id,
      type: 'UserIntent',
      name: 'User Intent',
      position: { x: 50, y: 200 },
      parameters: {
        whenToUse: flow.whenToUse || '',
        whenNotToUse: flow.whenNotToUse || '',
      },
    });

    await nodeRepo.save(node);

    // Clear flow-level properties
    flow.whenToUse = null;
    flow.whenNotToUse = null;
    await flowRepo.save(flow);
  }
}
```

## Testing Checklist (Manual for POC)

- [ ] Can add UserIntent node from AddStepModal
- [ ] AddStepModal shows nodes grouped by category
- [ ] UserIntent node displays with only output handle
- [ ] Cannot connect to UserIntent node's input (no target handle)
- [ ] Can edit UserIntent node's whenToUse/whenNotToUse
- [ ] Can add multiple UserIntent nodes to same flow
- [ ] Existing nodes show new display names
- [ ] Migration creates UserIntentNodes for existing flows
- [ ] Flow API no longer returns whenToUse/whenNotToUse
