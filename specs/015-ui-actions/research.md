# Research: UI Component Actions

**Feature**: 015-ui-actions
**Date**: 2025-12-28

## Research Summary

This document consolidates research findings for implementing UI component actions in the flow diagram.

---

## 1. @xyflow/react Handle System

### Decision: Use Dynamic Multiple Handles with Labels

**Rationale**: The @xyflow/react library (v12.10.0) fully supports multiple handles per node. The existing codebase already uses this pattern effectively (ViewNode has top, left, and right handles).

**Implementation Pattern**:
```tsx
// Multiple source handles on right side with labels
<div className="mt-4 space-y-2">
  {actions.map((action, index) => (
    <div key={action.name} className="flex items-center justify-between">
      <span className="text-xs font-medium text-gray-600">{action.label}</span>
      <Handle
        type="source"
        position={Position.Right}
        id={action.name}
        className="!bg-purple-400 !w-2 !h-2"
      />
    </div>
  ))}
</div>
```

**Key Requirements**:
- Each handle must have a unique `id` prop (use action name)
- Use `type="source"` for outgoing action connections
- Use `position={Position.Right}` for right-side placement
- Call `useUpdateNodeInternals(id)` when actions change dynamically
- Use `sourceHandle` in edges to specify which action handle is connected

**Alternatives Considered**:
1. Single handle with dropdown menu - Rejected: Less visual clarity, doesn't show connections
2. Modal-based connection configuration - Rejected: More clicks, less intuitive than drag-and-drop

---

## 2. Layout Registry Actions Extension

### Decision: Add `actions` Array to LAYOUT_REGISTRY

**Rationale**: The existing registry structure is minimal but extensible. Adding an `actions` array allows each layout template to define its available actions declaratively.

**Current Structure** (in `/packages/shared/src/types/app.ts`):
```typescript
export const LAYOUT_REGISTRY: Record<LayoutTemplate, {
  manifestBlock: string;
  installCommand: string;
  useCase: string;
}> = { ... };
```

**Extended Structure**:
```typescript
export interface LayoutAction {
  name: string;        // e.g., "onReadMore"
  label: string;       // e.g., "Read More"
  description: string; // Human-readable description
}

export const LAYOUT_REGISTRY: Record<LayoutTemplate, {
  manifestBlock: string;
  installCommand: string;
  useCase: string;
  actions: LayoutAction[];
}> = {
  table: {
    // ... existing fields
    actions: [],  // No actions for MVP
  },
  'post-list': {
    // ... existing fields
    actions: [
      { name: 'onReadMore', label: 'Read More', description: 'Triggered when Read More button clicked' },
    ],
  },
};
```

**Alternatives Considered**:
1. Store actions in View entity - Rejected: Actions are intrinsic to component type, not instance
2. Hardcode in ViewNode component - Rejected: Not maintainable, violates single source of truth

---

## 3. ActionConnection Entity Design

### Decision: Create ActionConnectionEntity with Polymorphic Target

**Rationale**: Follow existing CallFlowEntity pattern with dual nullable foreign keys and discriminator column.

**Recommended Entity Structure**:
```typescript
@Entity('action_connections')
export class ActionConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  viewId!: string;

  @Column({ type: 'varchar', length: 100 })
  actionName!: string;

  @Column({ type: 'varchar', length: 20 })
  targetType!: 'return-value' | 'call-flow';

  @Column({ type: 'uuid', nullable: true })
  targetReturnValueId?: string;

  @Column({ type: 'uuid', nullable: true })
  targetCallFlowId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => ViewEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'viewId' })
  view?: ViewEntity;

  @ManyToOne(() => ReturnValueEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetReturnValueId' })
  targetReturnValue?: ReturnValueEntity;

  @ManyToOne(() => CallFlowEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetCallFlowId' })
  targetCallFlow?: CallFlowEntity;
}
```

**Key Design Decisions**:
- Parent (`viewId`) uses CASCADE: deleting a view deletes its action connections
- Targets use SET NULL: deleting a target clears the connection but preserves the action
- `targetType` discriminator enables type-safe queries
- Unique constraint on (viewId, actionName) - one target per action

**Alternatives Considered**:
1. Single `targetId` with `targetType` string - Rejected: No referential integrity
2. Separate tables for ReturnValueConnections and CallFlowConnections - Rejected: Duplication, harder to query
3. Embed connections in View entity as JSON - Rejected: No cascading deletes, harder to query

---

## 4. Edge Connection Pattern

### Decision: Use Existing smoothstep Edge with Purple Styling

**Rationale**: Consistency with existing edge styles. Purple color distinguishes action connections from other edge types.

**Edge Configuration**:
```typescript
{
  id: `action-${viewId}-${actionName}-${targetId}`,
  source: viewId,
  sourceHandle: actionName,  // Links to action handle
  target: targetId,
  targetHandle: 'left',      // Standard input handle
  type: 'smoothstep',
  style: { stroke: '#a855f7', strokeWidth: 2 },  // Purple for actions
  markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
}
```

**Existing Color Scheme**:
- Blue (#60a5fa): Primary flow connections
- Amber (#f59e0b): Mock data connections
- Green (#22c55e): Return value connections
- Purple (#a855f7): Call flow connections → **Reuse for action connections**

**Alternatives Considered**:
1. Custom edge component with labels - Rejected: Over-engineering for MVP
2. Animated edges - Rejected: Distracting, no additional information conveyed

---

## 5. Widget Action Trigger Mechanism

### Decision: Use data-action Attribute Pattern with JavaScript Handler

**Rationale**: The existing CallFlow widget uses auto-triggering via `window.openai.callTool()`. Action triggers should follow a similar pattern but be user-initiated.

**Pattern**:
```html
<!-- In rendered widget HTML -->
<button
  data-action="onReadMore"
  data-view-id="view-uuid"
  data-post-id="123"
  onclick="triggerAction(this)"
>
  Read More
</button>

<script>
function triggerAction(button) {
  const action = button.dataset.action;
  const viewId = button.dataset.viewId;
  const context = button.dataset.postId;
  // Trigger appropriate response based on connected target
  window.openai?.callTool?.('flow_action', { action, viewId, context });
}
</script>
```

**Alternatives Considered**:
1. Custom event system - Rejected: More complex, less portable across MCP clients
2. Form submission - Rejected: Page reload, not suitable for interactive widgets

---

## 6. Backward Compatibility

### Decision: Non-Breaking Extension

**Rationale**: Existing flows must continue to work. Actions are optional additions.

**Approach**:
- LAYOUT_REGISTRY `actions` array defaults to empty `[]`
- Views without action connections render and execute normally
- ViewNode only shows action handles if `actions.length > 0`
- Existing edges and connections unaffected
- No migration required - new table, new columns only

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `packages/backend/src/action-connection/action-connection.entity.ts` | Entity definition |
| `packages/backend/src/action-connection/action-connection.module.ts` | NestJS module |
| `packages/backend/src/action-connection/action-connection.service.ts` | CRUD operations |
| `packages/backend/src/action-connection/action-connection.controller.ts` | REST endpoints |
| `packages/shared/src/types/action-connection.ts` | Shared types |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/types/app.ts` | Add `actions` to LAYOUT_REGISTRY |
| `packages/shared/src/index.ts` | Export new types |
| `packages/backend/src/app/app.module.ts` | Register ActionConnectionEntity |
| `packages/frontend/src/components/flow-diagram/ViewNode.tsx` | Add action handles |
| `packages/frontend/src/components/flow-diagram/FlowDiagram.tsx` | Add action edges |
| `packages/frontend/src/services/api.ts` | Add action connection endpoints |
