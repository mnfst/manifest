# Quickstart: Flow Execution Tracking

**Feature Branch**: `001-flow-executions`
**Date**: 2026-01-06

## Overview

This feature adds execution tracking to flows invoked via MCP server. When a flow is executed, the system creates a `FlowExecution` record capturing initial parameters, node-by-node data progression, and final status. Users view execution history in the "Usage" tab of the flow detail page.

## Key Components

### Backend

| Component | Location | Purpose |
|-----------|----------|---------|
| `FlowExecutionEntity` | `packages/backend/src/flow-execution/flow-execution.entity.ts` | TypeORM entity for execution records |
| `FlowExecutionService` | `packages/backend/src/flow-execution/flow-execution.service.ts` | CRUD operations and pagination |
| `FlowExecutionController` | `packages/backend/src/flow-execution/flow-execution.controller.ts` | REST API endpoints |
| `FlowExecutionModule` | `packages/backend/src/flow-execution/flow-execution.module.ts` | NestJS module registration |
| `McpToolService` (modified) | `packages/backend/src/mcp/mcp.tool.ts` | Integration point for tracking |

### Frontend

| Component | Location | Purpose |
|-----------|----------|---------|
| `ExecutionList` | `packages/frontend/src/components/execution/ExecutionList.tsx` | Left panel list with pagination |
| `ExecutionListItem` | `packages/frontend/src/components/execution/ExecutionListItem.tsx` | Individual execution row |
| `ExecutionDetail` | `packages/frontend/src/components/execution/ExecutionDetail.tsx` | Right panel details view |
| `ExecutionStatusBadge` | `packages/frontend/src/components/execution/ExecutionStatusBadge.tsx` | Colored status indicator |
| `ExecutionDataViewer` | `packages/frontend/src/components/execution/ExecutionDataViewer.tsx` | JSON data display |

### Shared Types

| Type | Location | Purpose |
|------|----------|---------|
| `FlowExecution` | `packages/shared/src/types/execution.ts` | Core execution type |
| `ExecutionStatus` | `packages/shared/src/types/execution.ts` | Status enum |
| `NodeExecutionData` | `packages/shared/src/types/execution.ts` | Node snapshot type |

## API Endpoints

```
GET /api/flows/:flowId/executions
    Query: page, limit, status
    Returns: Paginated execution list

GET /api/flows/:flowId/executions/:executionId
    Returns: Full execution details
```

## Implementation Order

### Phase 1: Backend Foundation
1. Create `FlowExecutionEntity` with TypeORM decorators
2. Create `FlowExecutionModule` and register in `AppModule`
3. Implement `FlowExecutionService` with:
   - `createExecution(flowId, initialParams)` - creates pending execution
   - `updateExecution(id, updates)` - updates status, nodeExecutions, etc.
   - `findByFlow(flowId, options)` - paginated list
   - `findOne(id)` - single execution
4. Create `FlowExecutionController` with REST endpoints

### Phase 2: MCP Integration
1. Inject `FlowExecutionService` into `McpToolService`
2. Modify `executeTool()` to:
   - Create execution before node traversal
   - Track node executions during traversal
   - Update final status on completion/error

### Phase 3: Frontend UI
1. Add execution types to `packages/shared`
2. Add API methods to `packages/frontend/src/lib/api.ts`
3. Create execution components under `components/execution/`
4. Integrate into `FlowDetail.tsx` Usage tab

### Phase 4: Polish (P3)
1. Add polling for real-time updates
2. Handle timeout marking
3. Empty state and loading states

## Database Schema

```sql
CREATE TABLE flow_executions (
  id TEXT PRIMARY KEY,
  flowId TEXT,
  flowName TEXT NOT NULL,
  flowToolName TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  endedAt DATETIME,
  initialParams TEXT NOT NULL,  -- JSON
  nodeExecutions TEXT NOT NULL DEFAULT '[]',  -- JSON array
  errorInfo TEXT,  -- JSON
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flowId) REFERENCES flows(id) ON DELETE SET NULL
);

CREATE INDEX idx_flow_executions_flow_started
  ON flow_executions(flowId, startedAt DESC);
```

## Usage Example

### Creating an execution (backend)
```typescript
// In McpToolService.executeTool()
const execution = await this.flowExecutionService.createExecution({
  flowId: flow.id,
  flowName: flow.name,
  flowToolName: flow.toolName,
  initialParams: input,
});

try {
  // Execute nodes...
  await this.flowExecutionService.updateExecution(execution.id, {
    status: 'fulfilled',
    endedAt: new Date(),
    nodeExecutions: [...],
  });
} catch (error) {
  await this.flowExecutionService.updateExecution(execution.id, {
    status: 'error',
    endedAt: new Date(),
    errorInfo: { message: error.message, nodeId: currentNodeId },
  });
  throw error;
}
```

### Fetching executions (frontend)
```typescript
// In ExecutionList component
const { data, isLoading } = useExecutions(flowId, { page, limit });

return (
  <div className="flex h-full">
    <div className="w-1/3 border-r">
      {data?.items.map(execution => (
        <ExecutionListItem
          key={execution.id}
          execution={execution}
          selected={selectedId === execution.id}
          onClick={() => setSelectedId(execution.id)}
        />
      ))}
      <Pagination {...data} onPageChange={setPage} />
    </div>
    <div className="w-2/3 p-4">
      {selectedId ? (
        <ExecutionDetail executionId={selectedId} />
      ) : (
        <EmptyState message="Select an execution to view details" />
      )}
    </div>
  </div>
);
```

## Status Colors

| Status | Color | Tailwind Class | Tooltip |
|--------|-------|----------------|---------|
| pending | Orange | `bg-orange-500` | "Execution in progress" |
| fulfilled | Green | `bg-green-500` | "Completed successfully" |
| error | Red | `bg-red-500` | "Execution failed" |

## Testing Checklist

### Manual Testing (POC)
- [ ] Execute flow via MCP → verify execution created
- [ ] View Usage tab → verify list shows execution
- [ ] Click execution → verify details panel shows data
- [ ] Trigger error → verify error status and info captured
- [ ] Delete flow → verify executions retained with name
- [ ] Pagination → verify page navigation works
- [ ] Status filter → verify filter works (if implemented)

## References

- Feature Spec: `specs/001-flow-executions/spec.md`
- Data Model: `specs/001-flow-executions/data-model.md`
- API Contract: `specs/001-flow-executions/contracts/openapi.yaml`
- Research: `specs/001-flow-executions/research.md`
