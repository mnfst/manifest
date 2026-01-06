# Data Model: Flow Execution Tracking

**Feature Branch**: `001-flow-executions`
**Date**: 2026-01-06

## Entity: FlowExecution

Represents a single invocation of a flow via MCP. Captures the complete execution lifecycle including initial parameters, node-by-node data progression, and final status.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier for the execution |
| `flowId` | UUID | FK (nullable), SET NULL on delete | Reference to the executed flow (null if flow deleted) |
| `flowName` | string(300) | NOT NULL | Denormalized flow name for retention after deletion |
| `flowToolName` | string(100) | NOT NULL | Denormalized tool name for retention |
| `status` | enum | NOT NULL | Execution state: 'pending', 'fulfilled', 'error' |
| `startedAt` | datetime | NOT NULL, auto | Timestamp when execution began |
| `endedAt` | datetime | nullable | Timestamp when execution completed (null if pending) |
| `initialParams` | JSON | NOT NULL | Parameters received from MCP client request |
| `nodeExecutions` | JSON | NOT NULL, default '[]' | Ordered array of node execution snapshots |
| `errorInfo` | JSON | nullable | Error details if status is 'error' |
| `createdAt` | datetime | auto | Record creation timestamp |
| `updatedAt` | datetime | auto | Record update timestamp |

### Relationships

```
FlowExecution >--o Flow : belongs to (nullable)
```

- **FlowExecution → Flow**: Many-to-one relationship. A flow can have many executions. When a flow is deleted, `flowId` is set to NULL but the execution record is retained.

### TypeORM Entity Definition

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { FlowEntity } from '../flow/flow.entity';

export type ExecutionStatus = 'pending' | 'fulfilled' | 'error';

export interface NodeExecutionData {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  executedAt: string;  // ISO datetime string
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  status: 'pending' | 'completed' | 'error';
  error?: string;
}

export interface ExecutionErrorInfo {
  message: string;
  nodeId?: string;
  nodeName?: string;
  stack?: string;
}

@Entity('flow_executions')
@Index(['flowId', 'startedAt'])
export class FlowExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  flowId?: string;

  @Column({ type: 'varchar', length: 300 })
  flowName!: string;

  @Column({ type: 'varchar', length: 100 })
  flowToolName!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ExecutionStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt?: Date;

  @Column({ type: 'simple-json' })
  initialParams!: Record<string, unknown>;

  @Column({ type: 'simple-json', default: '[]' })
  nodeExecutions!: NodeExecutionData[];

  @Column({ type: 'simple-json', nullable: true })
  errorInfo?: ExecutionErrorInfo;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => FlowEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'flowId' })
  flow?: FlowEntity;
}
```

## Nested Types

### NodeExecutionData

Represents the state of a single node during execution. Stored as array elements in `nodeExecutions`.

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | string | UUID of the executed node |
| `nodeName` | string | Human-readable node name |
| `nodeType` | string | Node type ('Interface', 'Return', 'CallFlow') |
| `executedAt` | string | ISO datetime when node executed |
| `inputData` | object | Data received by the node |
| `outputData` | object | Data produced by the node |
| `status` | enum | Node status: 'pending', 'completed', 'error' |
| `error` | string? | Error message if node failed |

### ExecutionErrorInfo

Detailed error information when execution fails.

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Human-readable error message |
| `nodeId` | string? | UUID of node that caused failure |
| `nodeName` | string? | Name of node that caused failure |
| `stack` | string? | Stack trace (development only) |

## Validation Rules

1. **Status Transitions**:
   - Initial: `pending`
   - Terminal: `fulfilled` or `error`
   - Once terminal, status cannot change

2. **Timestamps**:
   - `startedAt` set on creation
   - `endedAt` set when transitioning to terminal status
   - `endedAt` must be >= `startedAt`

3. **Node Executions**:
   - Array order matches execution order
   - Each node appears at most once
   - Final node determines overall status

4. **Error Info**:
   - Required when status = 'error'
   - Optional when status = 'pending' or 'fulfilled'

## State Transitions

```
┌─────────┐    success    ┌───────────┐
│ pending │──────────────>│ fulfilled │
└────┬────┘               └───────────┘
     │
     │ error/timeout
     v
┌─────────┐
│  error  │
└─────────┘
```

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| PK | `id` | Primary key lookup |
| `idx_flow_executions_flow_started` | `flowId`, `startedAt DESC` | List executions by flow, sorted by recency |

## Migration Notes

1. Create `flow_executions` table with all columns
2. Add foreign key constraint to `flows` table with `ON DELETE SET NULL`
3. Create composite index on `(flowId, startedAt)`

## Relationship Updates

### FlowEntity (existing)

Add inverse relation for navigation (optional - not required for core functionality):

```typescript
// In FlowEntity - optional, for eager loading scenarios
@OneToMany(() => FlowExecutionEntity, (execution) => execution.flow)
executions?: FlowExecutionEntity[];
```

**Note**: For the POC, we may skip adding the inverse relation to FlowEntity since:
- We query executions by flowId directly
- Avoids modifying existing entity
- Can be added post-POC if needed for performance optimization
