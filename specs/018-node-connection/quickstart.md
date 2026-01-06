# Quickstart: Manual Node Connection Workflow

**Feature Branch**: `018-node-connection`
**Date**: 2025-12-29

## Overview

This feature changes how nodes are created and connected in the flow diagram:
1. Nodes appear unconnected when created
2. Users manually drag between handles to create connections
3. Connections show a trash icon on hover for instant deletion

## User Workflow

### Creating Nodes

1. Navigate to a flow detail page
2. Click "Add Step" button
3. Select node type (Interface, Return, or CallFlow)
4. Node appears on canvas with NO automatic connections

### Connecting Nodes

1. Hover over a node's output handle (right side, circular dot)
2. Click and drag from the handle
3. A line follows your cursor
4. Drop on another node's input handle (left side)
5. Connection is created and saved automatically

### Deleting Connections

1. Hover over any connection line
2. A trash icon appears on the line
3. Click the trash icon
4. Connection is immediately deleted (no confirmation)

### Valid Connection Patterns

```
UserIntent → Interface → Interface → Return
UserIntent → Interface → CallFlow
UserIntent → Return
UserIntent → CallFlow
```

### Invalid Connections (Prevented)

- Circular: A → B → C → A
- Self-reference: A → A
- From terminal nodes: Return → (anything)

## Development Quick Reference

### Key Files to Modify

| File | Change |
|------|--------|
| `FlowDiagram.tsx` | Remove auto-edge generation, add edgeTypes |
| `DeletableEdge.tsx` | NEW - custom edge with delete button |
| `ViewNode.tsx` | Add standard input/output handles |
| `node.service.ts` | Add circular detection validation |

### React Flow Concepts

```tsx
// Custom edge type registration
const edgeTypes = { deletable: DeletableEdge };

// Using in ReactFlow component
<ReactFlow
  edgeTypes={edgeTypes}
  defaultEdgeOptions={{ type: 'deletable' }}
/>
```

### Testing Checklist

- [ ] Create 3+ nodes without any auto-connections
- [ ] Drag from node A output to node B input → connection appears
- [ ] Hover over connection → trash icon appears
- [ ] Click trash icon → connection deleted instantly
- [ ] Try to create A → B → A cycle → should be prevented
- [ ] Delete a node → its connections are also deleted
