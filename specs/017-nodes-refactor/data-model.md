# Data Model: Nodes Package Refactor

**Feature**: 017-nodes-refactor
**Date**: 2025-12-29

## Overview

This refactor consolidates 5 separate database tables into 2 JSON columns within the Flow entity, following n8n's workflow storage pattern.

## Entity Changes

### FlowEntity (Modified)

**Table**: `flows`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| appId | UUID | FK → apps.id, CASCADE | Parent app reference |
| name | VARCHAR(300) | NOT NULL | Flow display name |
| description | VARCHAR(500) | NULL | Flow description |
| toolName | VARCHAR(100) | NOT NULL | MCP tool identifier |
| toolDescription | VARCHAR(500) | NOT NULL | MCP tool description |
| whenToUse | VARCHAR(500) | NULL | Usage guidance |
| whenNotToUse | VARCHAR(500) | NULL | Anti-usage guidance |
| isActive | BOOLEAN | DEFAULT TRUE | Whether flow is active |
| parameters | SIMPLE-JSON | NULL | FlowParameter[] |
| **nodes** | SIMPLE-JSON | DEFAULT '[]' | **NEW: NodeInstance[]** |
| **connections** | SIMPLE-JSON | DEFAULT '[]' | **NEW: Connection[]** |
| createdAt | TIMESTAMP | AUTO | Creation timestamp |
| updatedAt | TIMESTAMP | AUTO | Update timestamp |

### Entities to Remove

| Entity | Table | Reason |
|--------|-------|--------|
| ViewEntity | views | Migrated to Flow.nodes as Interface node |
| ReturnValueEntity | return_values | Migrated to Flow.nodes as Return node |
| CallFlowEntity | call_flows | Migrated to Flow.nodes as CallFlow node |
| ActionConnectionEntity | action_connections | Migrated to Flow.connections |
| MockDataEntity | mock_data | Embedded in Interface node parameters |

## JSON Data Structures

### NodeInstance (Flow.nodes array element)

```typescript
interface NodeInstance {
  id: string;           // UUID, unique within flow
  type: string;         // 'Interface' | 'Return' | 'CallFlow'
  name: string;         // Display name (unique within flow)
  position: {
    x: number;          // Canvas X coordinate
    y: number;          // Canvas Y coordinate
  };
  parameters: Record<string, unknown>;  // Type-specific configuration
}
```

### Connection (Flow.connections array element)

```typescript
interface Connection {
  id: string;           // UUID
  sourceNodeId: string; // ID of source node
  sourceHandle: string; // Handle identifier on source (e.g., 'action:submit')
  targetNodeId: string; // ID of target node
  targetHandle: string; // Handle identifier on target (e.g., 'left')
}
```

### Node Type Parameters

#### Interface Node Parameters

```typescript
interface InterfaceNodeParameters {
  layoutTemplate: 'table' | 'post-list';  // Layout type
  mockData: MockData;                      // Embedded mock data
}

type MockData = TableMockData | PostListMockData;

interface TableMockData {
  type: 'table';
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

interface TableColumn {
  key: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'badge' | 'action';
}

interface PostListMockData {
  type: 'post-list';
  posts: PostItem[];
}

interface PostItem {
  id: string;
  title: string;
  excerpt: string;
  author?: string;
  date?: string;
  image?: string;
  category?: string;
  tags?: string[];
}
```

#### Return Node Parameters

```typescript
interface ReturnNodeParameters {
  text: string;  // Return value text content
}
```

#### CallFlow Node Parameters

```typescript
interface CallFlowNodeParameters {
  targetFlowId: string | null;  // UUID of target flow (null if unset)
}
```

## Node Type Definitions (nodes package)

### NodeTypeDefinition Interface

```typescript
interface NodeTypeDefinition {
  name: string;           // 'Interface' | 'Return' | 'CallFlow'
  displayName: string;    // 'Display Interface' | 'Return Value' | 'Call Flow'
  icon: string;           // Lucide icon name
  group: string[];        // Category tags
  description: string;    // Human-readable description
  inputs: string[];       // Input handle types ['main']
  outputs: string[];      // Output handle types ['main'] or ['action:*']
  defaultParameters: Record<string, unknown>;  // Default parameter values
  execute: (context: ExecutionContext) => Promise<ExecutionResult>;
}
```

### Node Type Definitions

| Name | displayName | icon | group | description |
|------|-------------|------|-------|-------------|
| Interface | Display Interface | layout-template | ['views', 'ui'] | Renders a layout template with data |
| Return | Return Value | corner-down-left | ['outputs'] | Returns text content from the flow |
| CallFlow | Call Flow | git-branch | ['flows', 'logic'] | Invokes another flow |

## Validation Rules

### Node Instance Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| id | Valid UUID | "Node ID must be a valid UUID" |
| type | One of registered types | "Unknown node type: {type}" |
| name | 1-100 chars, unique in flow | "Node name must be unique within flow" |
| position.x | Number | "Position X must be a number" |
| position.y | Number | "Position Y must be a number" |
| parameters | Valid for node type | "Invalid parameters for {type} node" |

### Connection Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| sourceNodeId | Exists in flow.nodes | "Source node not found" |
| targetNodeId | Exists in flow.nodes | "Target node not found" |
| sourceHandle | Valid handle for source type | "Invalid source handle" |
| targetHandle | Valid handle for target type | "Invalid target handle" |
| (loop) | No circular connections | "Circular connection detected" |

## State Transitions

### Flow Node Lifecycle

```
[Empty] → [Has Nodes] → [Has Connections] → [Executable]

States:
- Empty: nodes=[], connections=[]
- Has Nodes: nodes.length > 0, connections=[]
- Has Connections: nodes.length > 0, connections.length > 0
- Executable: Has at least one complete path from entry to exit node
```

### Node Operations

| Operation | Precondition | Effect |
|-----------|--------------|--------|
| Add Node | Valid type, unique name | Appends to nodes array |
| Update Node | Node exists | Merges updates into node |
| Move Node | Node exists | Updates position only |
| Delete Node | Node exists | Removes node AND all its connections |
| Duplicate Node | Node exists | Creates copy with new ID and modified name |

### Connection Operations

| Operation | Precondition | Effect |
|-----------|--------------|--------|
| Add Connection | Both nodes exist, valid handles | Appends to connections array |
| Delete Connection | Connection exists | Removes from connections array |

## Cascade Behaviors

| Parent Action | Child Effect |
|---------------|--------------|
| Flow deleted | All nodes and connections removed (implicit - in JSON) |
| Node deleted | All connections referencing node removed |
| App deleted | All flows deleted (existing CASCADE on appId FK) |

## Migration Notes

### POC Mode (synchronize: true)

1. Add `nodes` and `connections` columns to FlowEntity
2. Remove OneToMany relations from FlowEntity (views, returnValues, callFlows)
3. Delete old modules/entities from app.module.ts entities array
4. TypeORM will drop old tables and create new columns automatically

### Data Migration (if needed later)

```sql
-- Example migration query (for reference, not needed in POC)
UPDATE flows SET
  nodes = json_array(
    -- Would need to query and transform old entity data
  ),
  connections = json_array(
    -- Would need to convert action_connections
  )
WHERE 1=1;

DROP TABLE action_connections;
DROP TABLE mock_data;
DROP TABLE views;
DROP TABLE return_values;
DROP TABLE call_flows;
```
