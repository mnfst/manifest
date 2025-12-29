# Data Model: Call Flow End Action

**Feature**: 014-call-flow-action
**Date**: 2025-12-28

## Entities

### CallFlow (New Entity)

A CallFlow represents an end action that triggers another flow from the same app.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary Key, Auto-generated | Unique identifier |
| flowId | UUID | Foreign Key → Flow, NOT NULL | Parent flow this action belongs to |
| targetFlowId | UUID | Foreign Key → Flow, NOT NULL | Flow to be called when executed |
| order | Integer | Default: 0 | Position among multiple call flows |
| createdAt | DateTime | Auto-generated | Creation timestamp |
| updatedAt | DateTime | Auto-updated | Last update timestamp |

**Relationships**:
- Many CallFlows → One Flow (parent, via `flowId`)
- Many CallFlows → One Flow (target, via `targetFlowId`)

**Database Table**: `call_flows`

**TypeORM Entity Definition**:
```typescript
@Entity('call_flows')
export class CallFlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  flowId!: string;

  @Column({ type: 'uuid' })
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

**Deletion Behavior**:
- When parent flow is deleted → CallFlow is cascade deleted
- When target flow is deleted → targetFlowId set to NULL (triggers error state in UI)

---

### Flow (Extended Entity)

Add new relationship to existing FlowEntity.

**New Relationship**:
```typescript
@OneToMany(() => CallFlowEntity, (callFlow) => callFlow.flow, { cascade: true })
callFlows?: CallFlowEntity[];
```

**Updated Flow Interface** (shared types):
```typescript
export interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  toolName: string;
  toolDescription: string;
  whenToUse?: string;
  whenNotToUse?: string;
  isActive: boolean;
  parameters?: FlowParameter[];
  views?: View[];
  returnValues?: ReturnValue[];
  callFlows?: CallFlow[];  // NEW
  createdAt: string;
  updatedAt: string;
}
```

---

## Shared Type Definitions

### CallFlow Interface

```typescript
// packages/shared/src/types/call-flow.ts

export interface CallFlow {
  id: string;
  flowId: string;
  targetFlowId: string;
  targetFlow?: Flow;  // Populated when needed for display
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

---

## Validation Rules

### Creation Validation

```typescript
async validateCallFlowCreation(flowId: string, targetFlowId: string): Promise<void> {
  const flow = await this.flowService.findById(flowId);

  // Rule 1: Cannot add call flows to a flow with views
  if (flow.views && flow.views.length > 0) {
    throw new BadRequestException(
      'Cannot add call flows to a flow that has views. Flows must use either views or end actions, not both.'
    );
  }

  // Rule 2: Cannot add call flows to a flow with return values
  if (flow.returnValues && flow.returnValues.length > 0) {
    throw new BadRequestException(
      'Cannot add call flows to a flow that has return values. Flows can only have one type of end action.'
    );
  }

  // Rule 3: Cannot reference self
  if (flowId === targetFlowId) {
    throw new BadRequestException(
      'A flow cannot call itself. Please select a different target flow.'
    );
  }

  // Rule 4: Target must exist and be in same app
  const targetFlow = await this.flowService.findById(targetFlowId);
  if (flow.appId !== targetFlow.appId) {
    throw new BadRequestException(
      'Target flow must be in the same app.'
    );
  }
}
```

### Update Validation

```typescript
async validateCallFlowUpdate(callFlowId: string, newTargetFlowId?: string): Promise<void> {
  if (!newTargetFlowId) return;

  const callFlow = await this.findById(callFlowId);

  // Rule: Cannot reference self
  if (callFlow.flowId === newTargetFlowId) {
    throw new BadRequestException(
      'A flow cannot call itself. Please select a different target flow.'
    );
  }

  // Rule: Target must be in same app
  const parentFlow = await this.flowService.findById(callFlow.flowId);
  const targetFlow = await this.flowService.findById(newTargetFlowId);
  if (parentFlow.appId !== targetFlow.appId) {
    throw new BadRequestException(
      'Target flow must be in the same app.'
    );
  }
}
```

---

## Cross-Service Validation Updates

### ReturnValueService

Add check for CallFlows in create validation:

```typescript
async validateReturnValueCreation(flowId: string): Promise<void> {
  const flow = await this.flowService.findById(flowId);

  // Existing rule
  if (flow.views && flow.views.length > 0) {
    throw new BadRequestException(
      'Cannot add return values to a flow that has views.'
    );
  }

  // NEW rule
  if (flow.callFlows && flow.callFlows.length > 0) {
    throw new BadRequestException(
      'Cannot add return values to a flow that has call flows. Flows can only have one type of end action.'
    );
  }
}
```

### ViewService

Add check for CallFlows in create validation:

```typescript
async validateViewCreation(flowId: string): Promise<void> {
  const flow = await this.flowService.findById(flowId);

  // Existing rule
  if (flow.returnValues && flow.returnValues.length > 0) {
    throw new BadRequestException(
      'Cannot add views to a flow that has return values.'
    );
  }

  // NEW rule
  if (flow.callFlows && flow.callFlows.length > 0) {
    throw new BadRequestException(
      'Cannot add views to a flow that has call flows.'
    );
  }
}
```

---

## State Transitions

### CallFlow Lifecycle

```
[None] → CREATE → [Active]
                     ↓
               UPDATE (change target)
                     ↓
                  [Active]
                     ↓
                  DELETE → [None]
```

### Target Flow State Impact

When target flow is deleted:
1. CallFlow.targetFlowId becomes NULL (ON DELETE SET NULL)
2. UI displays error state: "Target flow has been deleted"
3. User can update to select new target or delete the CallFlow

---

## Entity Relationship Diagram

```
┌─────────────────────┐
│        App          │
│─────────────────────│
│ id                  │
│ name                │
│ slug                │
└─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│        Flow         │
│─────────────────────│
│ id                  │
│ appId (FK)          │
│ name                │
│ toolName            │
│ ...                 │
└─────────────────────┘
     │         │         │
     │ 1:N     │ 1:N     │ 1:N
     ▼         ▼         ▼
┌─────────┐ ┌──────────┐ ┌───────────┐
│  View   │ │ReturnVal │ │ CallFlow  │
│─────────│ │──────────│ │───────────│
│ id      │ │ id       │ │ id        │
│ flowId  │ │ flowId   │ │ flowId    │←─── parent flow
│ layout  │ │ text     │ │targetFlowId│──→ target flow
│ order   │ │ order    │ │ order     │
└─────────┘ └──────────┘ └───────────┘

Mutual Exclusivity:
Flow can have EITHER:
  - Views (0+)
  - OR ReturnValues (0+)
  - OR CallFlows (0+)
  - NOT a combination of different types
```

---

## Migration Notes

**POC Mode**: Using TypeORM synchronize=true, no manual migration needed.

**Production Migration** (future):
```sql
CREATE TABLE call_flows (
  id TEXT PRIMARY KEY,
  flowId TEXT NOT NULL,
  targetFlowId TEXT,
  "order" INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flowId) REFERENCES flows(id) ON DELETE CASCADE,
  FOREIGN KEY (targetFlowId) REFERENCES flows(id) ON DELETE SET NULL
);

CREATE INDEX idx_call_flows_flowId ON call_flows(flowId);
CREATE INDEX idx_call_flows_targetFlowId ON call_flows(targetFlowId);
```
