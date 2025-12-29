# Quickstart: Call Flow End Action

**Feature**: 014-call-flow-action
**Estimated Implementation**: Follow task order in tasks.md

## Overview

This feature adds a "Call Flow" end action that enables flows to trigger other flows from the same app. It mirrors the existing ReturnValue pattern with additional target flow selection.

## Prerequisites

- Existing monorepo with backend, frontend, shared packages
- Node.js 18+, npm
- Running development environment (`npm run dev`)

## Key Implementation Steps

### 1. Shared Types (packages/shared)

Create `packages/shared/src/types/call-flow.ts`:
```typescript
export interface CallFlow {
  id: string;
  flowId: string;
  targetFlowId: string;
  targetFlow?: { id: string; name: string; toolName: string };
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCallFlowRequest {
  targetFlowId: string;
}

export interface UpdateCallFlowRequest {
  targetFlowId?: string;
}

export interface ReorderCallFlowsRequest {
  orderedIds: string[];
}
```

Update `flow.ts` to add `callFlows?: CallFlow[]` to Flow interface.

### 2. Backend Entity (packages/backend)

Create `packages/backend/src/call-flow/call-flow.entity.ts`:
```typescript
@Entity('call_flows')
export class CallFlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  flowId!: string;

  @Column({ type: 'uuid', nullable: true })
  targetFlowId!: string;

  @Column({ type: 'int', default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => FlowEntity, (flow) => flow.callFlows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow?: FlowEntity;

  @ManyToOne(() => FlowEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetFlowId' })
  targetFlow?: FlowEntity;
}
```

### 3. Backend Service

Create `packages/backend/src/call-flow/call-flow.service.ts`:

Key validations:
- No Views in parent flow
- No ReturnValues in parent flow
- Cannot reference self
- Target must be in same app

### 4. Backend Controller

Create `packages/backend/src/call-flow/call-flow.controller.ts`:

Endpoints:
- `GET /flows/:flowId/call-flows`
- `POST /flows/:flowId/call-flows`
- `GET /call-flows/:callFlowId`
- `PATCH /call-flows/:callFlowId`
- `DELETE /call-flows/:callFlowId`
- `POST /flows/:flowId/call-flows/reorder`

### 5. Update Mutual Exclusivity

In `ReturnValueService.create()`:
```typescript
if (flow.callFlows?.length > 0) {
  throw new BadRequestException('Cannot add return values to a flow with call flows');
}
```

In `ViewService.create()`:
```typescript
if (flow.callFlows?.length > 0) {
  throw new BadRequestException('Cannot add views to a flow with call flows');
}
```

### 6. Frontend Components

Create `CallFlowNode.tsx`:
- Purple theme
- Left handle only (no right handle - end action)
- Display target flow name
- Edit/Delete dropdown

Create `CallFlowEditor.tsx`:
- Dropdown to select target flow
- Filter out current flow from options

### 7. Update FlowDiagram

Register `callFlowNode` in nodeTypes:
```typescript
const nodeTypes = {
  // ...existing
  callFlowNode: CallFlowNode,
};
```

Add node creation logic in getFlowState:
```typescript
const hasCallFlows = Boolean(flow.callFlows?.length);
```

### 8. Update ReturnValueNode

Remove right Handle to indicate end action:
```tsx
// Remove this:
<Handle type="source" position={Position.Right} ... />
```

### 9. MCP Execution

In `mcp.tool.ts`, add execution branch for CallFlows:
```typescript
const callFlows = flow.callFlows?.sort((a, b) => a.order - b.order) || [];
if (callFlows.length > 0) {
  return this.executeCallFlowFlow(flow, callFlows, allFlows);
}
```

Generate HTML with callTool invocation:
```typescript
private executeCallFlowFlow(...): McpToolResponse {
  // Generate script that calls window.openai.callTool(targetFlow.toolName)
}
```

## Testing Checklist

1. [ ] Create flow with Call Flow action - should save
2. [ ] Try adding View to flow with Call Flow - should fail
3. [ ] Try adding Return Value to flow with Call Flow - should fail
4. [ ] Try self-referencing - should fail
5. [ ] Delete target flow - should show error state
6. [ ] Visual: Call Flow node has no right handle
7. [ ] Visual: Return Value node has no right handle (after update)

## Files to Create

```
packages/shared/src/types/call-flow.ts         # NEW
packages/backend/src/call-flow/                # NEW directory
  ├── call-flow.entity.ts
  ├── call-flow.service.ts
  ├── call-flow.controller.ts
  └── call-flow.module.ts
packages/frontend/src/components/flow/
  ├── CallFlowNode.tsx                         # NEW
  └── CallFlowEditor.tsx                       # NEW
```

## Files to Modify

```
packages/shared/src/types/flow.ts              # Add callFlows field
packages/shared/src/types/index.ts             # Export new types
packages/backend/src/app/app.module.ts         # Register module + entity
packages/backend/src/flow/flow.entity.ts       # Add relation
packages/backend/src/return-value/return-value.service.ts  # Add callFlows check
packages/backend/src/view/view.service.ts      # Add callFlows check
packages/backend/src/mcp/mcp.tool.ts           # Add execution logic
packages/frontend/src/lib/api.ts               # Add API methods
packages/frontend/src/pages/FlowDetail.tsx     # Add CRUD handling
packages/frontend/src/components/flow/FlowDiagram.tsx  # Register node type
packages/frontend/src/components/flow/ReturnValueNode.tsx  # Remove right handle
```

## Verification

After implementation, run:
```bash
.specify/scripts/bash/serve-app.sh
```

Then test the feature in browser.
