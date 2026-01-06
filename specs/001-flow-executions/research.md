# Research: Flow Execution Tracking

**Feature Branch**: `001-flow-executions`
**Date**: 2026-01-06

## Research Questions

### 1. How should execution data be structured for node-by-node tracking?

**Decision**: Store node execution data as an ordered array of node snapshots within the FlowExecution entity

**Rationale**:
- The spec requires showing "data state after each node in the execution sequence" (FR-006)
- Existing `McpToolService.executeTool()` already traverses nodes in topological order using `getConnectedNodes()`
- An array preserves execution order while allowing inspection of intermediate states
- JSON column (like existing `nodes` and `connections` in FlowEntity) is appropriate for SQLite

**Structure**:
```typescript
interface NodeExecutionData {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  executedAt: Date;
  inputData: Record<string, unknown>;  // Data received by node
  outputData: Record<string, unknown>; // Data produced by node
  status: 'pending' | 'completed' | 'error';
  error?: string;
}
```

**Alternatives considered**:
- Separate `NodeExecution` entity with FK to FlowExecution: Rejected - adds complexity for read-heavy use case, requires joins for detail view
- Single accumulated data object: Rejected - loses intermediate state visibility required by spec

### 2. How should the FlowExecution entity integrate with existing MCP execution?

**Decision**: Wrap MCP tool execution with FlowExecution lifecycle management in `McpToolService`

**Rationale**:
- The `executeTool()` method in `McpToolService` is the single entry point for all flow executions via MCP
- Integration at this level captures all executions without modifying node execution logic
- Maintains separation of concerns - execution tracking is observational, not behavioral

**Integration points**:
1. Before node traversal: Create FlowExecution with status='pending', capture initialParams
2. During node execution: Update `nodeExecutions` array after each node completes
3. After completion/error: Update status, endedAt, and errorInfo if applicable

**Alternatives considered**:
- Decorator pattern on node executors: Rejected - nodes are currently inline in McpToolService, no separate executor classes
- Event-based tracking: Rejected - adds unnecessary abstraction for POC, no other event consumers

### 3. What pagination strategy should be used for execution history?

**Decision**: Offset-based pagination with page numbers

**Rationale**:
- Spec explicitly requires "traditional pagination with page numbers and prev/next navigation" (FR-018)
- Simple to implement with TypeORM's `skip()` and `take()` methods
- Suitable for moderate volume (thousands per day per spec assumptions)
- Users expect stable page numbers for navigation

**Implementation**:
```typescript
// API: GET /flows/:flowId/executions?page=1&limit=20
// Response: { items: FlowExecution[], total: number, page: number, totalPages: number }
```

**Alternatives considered**:
- Cursor-based pagination: Rejected - spec explicitly requests page numbers
- Infinite scroll: Rejected - spec explicitly requests traditional pagination

### 4. How should real-time status updates be implemented?

**Decision**: Polling-based updates for P3 user story

**Rationale**:
- Real-time updates are P3 (lowest priority) - "nice-to-have enhancement"
- Most flows complete quickly (per spec assumptions)
- Polling is simpler to implement than WebSockets for POC
- Can poll at 2-3 second intervals when user is viewing execution list

**Implementation**:
- Frontend polls GET `/flows/:flowId/executions` when Usage tab is active
- Automatic refresh when pending executions exist
- Stop polling when no pending executions or user leaves tab

**Alternatives considered**:
- WebSockets: Deferred to post-POC - adds infrastructure complexity
- Server-Sent Events: Deferred - similar complexity to WebSockets

### 5. How should execution records be retained when flows are deleted?

**Decision**: Set `flowId` to NULL on flow deletion, preserve execution records

**Rationale**:
- Spec requires "Execution records should be retained for historical purposes with a reference to the deleted flow's name" (FR-011)
- Store `flowName` and `flowToolName` denormalized in FlowExecution for historical reference
- TypeORM `onDelete: 'SET NULL'` on the flow relation

**Implementation**:
```typescript
@Column({ type: 'uuid', nullable: true })
flowId?: string;

@Column({ type: 'varchar', length: 300 })
flowName: string;  // Denormalized for retention

@Column({ type: 'varchar', length: 100 })
flowToolName: string;  // Denormalized for retention
```

**Alternatives considered**:
- Cascade delete: Rejected - violates spec requirement for retention
- Soft delete flows: Rejected - adds complexity, flows should be fully removable

### 6. How should execution timeouts be handled?

**Decision**: 5-minute timeout with status transition to 'error'

**Rationale**:
- Spec edge case specifies "default: 5 minutes" timeout
- Executions in 'pending' status longer than timeout should auto-mark as 'error'
- Can be implemented via scheduled task or checked on read

**Implementation approach**:
- On query, check if any pending executions exceed 5 minutes
- Update those to 'error' status with message "Execution timed out"
- Alternatively, background cron job (more complex, deferred for POC)

**Alternatives considered**:
- No timeout: Rejected - creates indefinite pending states
- Shorter timeout: Rejected - spec explicitly states 5 minutes

### 7. How should concurrent executions be handled?

**Decision**: Each execution is fully independent with unique ID

**Rationale**:
- Spec states "Each execution is independent and tracked separately with its own data context" (edge case)
- No locking or serialization needed
- Multiple MCP requests can trigger the same flow simultaneously
- Each gets its own FlowExecution record

**Implementation**:
- UUID primary key ensures uniqueness
- No flow-level locking or queuing
- Status and data are per-execution

## Key Research Outcomes

1. **Entity Design**: Single `FlowExecution` entity with JSON column for node-by-node data, denormalized flow name for retention
2. **Integration Point**: Wrap existing `McpToolService.executeTool()` with execution lifecycle
3. **Pagination**: Offset-based with page numbers per spec requirement
4. **Real-time Updates**: Polling-based for POC (P3 priority)
5. **Retention**: SET NULL on flow deletion, preserve denormalized flow name
6. **Timeout**: 5-minute default, checked on read or via cron
7. **Concurrency**: Fully independent executions, no locking

## Dependencies Identified

- TypeORM for entity definition and queries
- Existing `McpToolService` for integration
- Frontend Tabs component for Usage tab
- Existing API patterns for REST endpoints
