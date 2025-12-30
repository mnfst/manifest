# Research: Manual Node Connection Workflow

**Feature Branch**: `018-node-connection`
**Date**: 2025-12-29

## Research Topics

### 1. React Flow Custom Edge with Delete Button

**Decision**: Use React Flow's custom edge component with EdgeLabelRenderer for the delete button.

**Rationale**:
- React Flow supports custom edges via the `edgeTypes` prop
- EdgeLabelRenderer allows placing interactive elements on edges
- The delete button can be shown conditionally on hover using CSS or React state
- This approach is documented in the React Flow examples

**Alternatives Considered**:
- Using `onEdgeClick` to show a context menu → rejected because spec requires trash icon on hover, not click-based menu
- Using a floating toolbar → rejected because it's not intuitive for quick deletion

**Implementation Pattern**:
```tsx
// DeletableEdge.tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, ... }) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  return (
    <>
      <BaseEdge path={edgePath} ... />
      <EdgeLabelRenderer>
        <button style={{ position: 'absolute', left: labelX, top: labelY }}>
          <Trash2 />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
```

### 2. Connection Handles Configuration

**Decision**: Use React Flow's handle system with proper source/target configuration.

**Rationale**:
- Each node needs clearly defined source and target handles
- UserIntentNode: source handle (right side) to connect to other nodes
- Interface nodes (ViewNode): source handle (right) and target handle (left)
- Return/CallFlow nodes: target handle only (left side) - terminal nodes

**Handle Configuration**:
| Node Type | Source Handles | Target Handles |
|-----------|----------------|----------------|
| UserIntentNode | `output` (right) | None |
| ViewNode (Interface) | `output` (right) | `input` (left) |
| ReturnValueNode | None (terminal) | `input` (left) |
| CallFlowNode | None (terminal) | `input` (left) |

### 3. Circular Connection Detection

**Decision**: Implement client-side validation before connection creation + backend validation.

**Rationale**:
- React Flow's `isValidConnection` callback can prevent circular connections before they're made
- Backend should also validate to prevent invalid state
- Use a simple graph traversal (DFS) to detect if connecting would create a cycle

**Algorithm**:
```typescript
function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  connections: Connection[]
): boolean {
  // Check if there's a path from targetId back to sourceId
  const visited = new Set<string>();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all nodes this one connects to
    for (const conn of connections) {
      if (conn.sourceNodeId === current) {
        stack.push(conn.targetNodeId);
      }
    }
  }
  return false;
}
```

### 4. Node Positioning for New Unconnected Nodes

**Decision**: Position new nodes at a fixed offset from existing nodes or in a grid pattern.

**Rationale**:
- Nodes should appear in a predictable location
- Avoid overlapping with existing nodes
- Simple implementation: place at (lastNode.x + 280, 80) or calculate next grid position

**Implementation**:
- Track the rightmost node position
- New nodes appear 280px to the right of the last node
- If no nodes exist, start at a default position (330, 80)

### 5. Visual Distinction for Unconnected Nodes

**Decision**: No special styling needed - unconnected nodes simply have no edges.

**Rationale**:
- The absence of connecting lines is sufficient visual distinction
- Adding additional styling (dimming, borders) would add complexity without clear benefit
- Users can easily see which nodes have connections by the presence/absence of edges

**Alternative Considered**:
- Dimming or graying out unconnected nodes → rejected because it might suggest they're disabled

## Summary

All research topics are resolved. The implementation will:
1. Create a custom `DeletableEdge` component with trash icon on hover
2. Update node components with proper handle configurations
3. Implement circular detection in both frontend (`isValidConnection`) and backend
4. Remove automatic edge generation from FlowDiagram
5. Position new nodes at calculated offsets to avoid overlap
