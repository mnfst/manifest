# Data Model: UI Component Actions

**Feature**: 015-ui-actions
**Date**: 2025-12-28

## Entity Overview

```
┌─────────────┐      ┌─────────────┐      ┌───────────────────┐
│    Flow     │──1:N─│    View     │──1:N─│ ActionConnection  │
└─────────────┘      └─────────────┘      └───────────────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                              ┌─────▼─────┐  ┌─────▼─────┐        │
                              │ReturnValue│  │ CallFlow  │        │
                              └───────────┘  └───────────┘        │
                                    (target: SET NULL on delete)
```

---

## Entities

### ActionConnection (NEW)

Represents a link between a View's action and its target (ReturnValue or CallFlow).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| viewId | UUID | FK → View, NOT NULL | Parent view |
| actionName | VARCHAR(100) | NOT NULL | Action identifier (e.g., "onReadMore") |
| targetType | VARCHAR(20) | NOT NULL, CHECK | Either "return-value" or "call-flow" |
| targetReturnValueId | UUID | FK → ReturnValue, NULLABLE | Target return value (if targetType = "return-value") |
| targetCallFlowId | UUID | FK → CallFlow, NULLABLE | Target call flow (if targetType = "call-flow") |
| createdAt | TIMESTAMP | NOT NULL, auto | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL, auto | Last update timestamp |

**Constraints**:
- UNIQUE(viewId, actionName) - One target per action per view
- CHECK: (targetType = 'return-value' AND targetReturnValueId IS NOT NULL) OR (targetType = 'call-flow' AND targetCallFlowId IS NOT NULL)

**Relationships**:
- View (parent): CASCADE DELETE - Deleting a view deletes all its action connections
- ReturnValue (target): SET NULL - Deleting a return value clears the connection
- CallFlow (target): SET NULL - Deleting a call flow clears the connection

---

### View (EXTENDED)

Existing entity with conceptual extension via LAYOUT_REGISTRY.

| Existing Field | Type | Notes |
|----------------|------|-------|
| id | UUID | PK |
| flowId | UUID | FK → Flow |
| name | VARCHAR(100) | Optional display name |
| layoutTemplate | VARCHAR(20) | "table" or "post-list" |
| mockData | JSON | Component-specific data |
| order | INT | Position in flow |
| createdAt | TIMESTAMP | - |
| updatedAt | TIMESTAMP | - |

**New Relationship**:
- ActionConnections: 1:N - View can have multiple action connections (one per action name)

**Actions Derived From**:
Actions are not stored in View entity. They are derived from `LAYOUT_REGISTRY[layoutTemplate].actions`.

---

### LayoutAction (NEW - Type Only, Not Entity)

Defines an action available on a layout template.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Action identifier (e.g., "onReadMore") |
| label | string | Display label (e.g., "Read More") |
| description | string | Human-readable description |

**Storage**: Hardcoded in LAYOUT_REGISTRY, not persisted to database.

---

## LAYOUT_REGISTRY Extension

```typescript
// packages/shared/src/types/app.ts

export interface LayoutAction {
  name: string;
  label: string;
  description: string;
}

export interface LayoutTemplateConfig {
  manifestBlock: string;
  installCommand: string;
  useCase: string;
  actions: LayoutAction[];
}

export const LAYOUT_REGISTRY: Record<LayoutTemplate, LayoutTemplateConfig> = {
  table: {
    manifestBlock: '@manifest/table',
    installCommand: 'npx shadcn@latest add @manifest/table',
    useCase: 'Tabular data, lists, order history',
    actions: [],  // No actions for MVP
  },
  'post-list': {
    manifestBlock: '@manifest/blog-post-list',
    installCommand: 'npx shadcn@latest add @manifest/blog-post-list',
    useCase: 'Content feeds, articles, blog posts',
    actions: [
      {
        name: 'onReadMore',
        label: 'Read More',
        description: 'Triggered when user clicks Read More button',
      },
    ],
  },
};
```

---

## Shared Types

```typescript
// packages/shared/src/types/action-connection.ts

export type ActionTargetType = 'return-value' | 'call-flow';

export interface ActionConnection {
  id: string;
  viewId: string;
  actionName: string;
  targetType: ActionTargetType;
  targetReturnValueId?: string;
  targetCallFlowId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionConnectionRequest {
  viewId: string;
  actionName: string;
  targetType: ActionTargetType;
  targetReturnValueId?: string;
  targetCallFlowId?: string;
}

export interface UpdateActionConnectionRequest {
  targetType: ActionTargetType;
  targetReturnValueId?: string;
  targetCallFlowId?: string;
}
```

---

## State Transitions

### ActionConnection Lifecycle

```
                    ┌─────────────────┐
                    │    (none)       │
                    └────────┬────────┘
                             │ CREATE
                             ▼
                    ┌─────────────────┐
        ┌──────────│   Connected     │──────────┐
        │          └────────┬────────┘          │
        │ UPDATE            │ DELETE            │ TARGET DELETED
        │ (change target)   │                   │ (SET NULL)
        │                   ▼                   ▼
        │          ┌─────────────────┐  ┌─────────────────┐
        └─────────▶│   Connected     │  │  Disconnected   │
                   │  (new target)   │  │  (orphaned)     │
                   └─────────────────┘  └────────┬────────┘
                                                 │ CLEANUP (periodic)
                                                 ▼
                                        ┌─────────────────┐
                                        │    (deleted)    │
                                        └─────────────────┘
```

**Notes**:
- "Disconnected" state occurs when target is deleted (SET NULL behavior)
- Orphaned connections (with null targets) can be cleaned up periodically or left as inactive
- UI should show disconnected actions differently (grayed out or with warning indicator)

---

## Validation Rules

### ActionConnection

| Rule | Description |
|------|-------------|
| VR-001 | `viewId` must reference an existing View |
| VR-002 | `actionName` must be a valid action for the View's layoutTemplate |
| VR-003 | `targetType` must be either "return-value" or "call-flow" |
| VR-004 | If `targetType` is "return-value", `targetReturnValueId` must be provided and valid |
| VR-005 | If `targetType` is "call-flow", `targetCallFlowId` must be provided and valid |
| VR-006 | Only one ActionConnection per (viewId, actionName) combination |
| VR-007 | Target must belong to the same Flow as the View |

---

## Indexes

### ActionConnection Table

| Index | Columns | Type | Purpose |
|-------|---------|------|---------|
| PK | id | PRIMARY | Unique identifier |
| UQ_view_action | viewId, actionName | UNIQUE | One target per action |
| IX_view | viewId | INDEX | Query by view |
| IX_target_rv | targetReturnValueId | INDEX | Find by return value |
| IX_target_cf | targetCallFlowId | INDEX | Find by call flow |

---

## Migration Notes

### POC Mode (synchronize: true)

TypeORM will auto-create the table. No explicit migration needed.

### Production Migration (future)

```sql
CREATE TABLE action_connections (
  id TEXT PRIMARY KEY,
  view_id TEXT NOT NULL,
  action_name TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('return-value', 'call-flow')),
  target_return_value_id TEXT,
  target_call_flow_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE,
  FOREIGN KEY (target_return_value_id) REFERENCES return_values(id) ON DELETE SET NULL,
  FOREIGN KEY (target_call_flow_id) REFERENCES call_flows(id) ON DELETE SET NULL,
  UNIQUE (view_id, action_name),
  CHECK (
    (target_type = 'return-value' AND target_return_value_id IS NOT NULL AND target_call_flow_id IS NULL) OR
    (target_type = 'call-flow' AND target_call_flow_id IS NOT NULL AND target_return_value_id IS NULL)
  )
);

CREATE INDEX ix_action_connections_view ON action_connections(view_id);
CREATE INDEX ix_action_connections_rv ON action_connections(target_return_value_id);
CREATE INDEX ix_action_connections_cf ON action_connections(target_call_flow_id);
```
