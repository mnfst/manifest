# Data Model: Multiple Triggers per Flow

**Feature**: 029-multiple-triggers
**Date**: 2026-01-06

## Entity Changes

### FlowEntity (Modified)

**Location**: `packages/backend/src/flow/flow.entity.ts`

#### Fields to REMOVE

| Field | Type | Reason for Removal |
|-------|------|-------------------|
| `toolName` | varchar(100) | Moved to UserIntent node parameters |
| `toolDescription` | varchar(500) | Moved to UserIntent node parameters |
| `parameters` | simple-json | Moved to UserIntent node parameters |

#### Fields to KEEP (unchanged)

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `appId` | uuid | Foreign key to AppEntity |
| `name` | varchar(300) | Human-readable flow name |
| `description` | varchar(500) | Optional flow description |
| `isActive` | boolean | Whether flow is enabled (default: true) |
| `nodes` | simple-json | Array of NodeInstance |
| `connections` | simple-json | Array of Connection |
| `createdAt` | timestamp | Auto-generated |
| `updatedAt` | timestamp | Auto-updated |

#### Updated Entity Definition

```typescript
@Entity('flows')
export class FlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  appId!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // REMOVED: toolName, toolDescription, parameters

  @Column({ type: 'simple-json', default: '[]' })
  nodes!: NodeInstance[];

  @Column({ type: 'simple-json', default: '[]' })
  connections!: Connection[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => AppEntity, (app) => app.flows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app?: AppEntity;
}
```

---

### UserIntentNodeParameters (Modified)

**Location**: `packages/shared/src/types/node.ts` and `packages/nodes/src/nodes/UserIntentNode.ts`

#### Fields to ADD

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `toolName` | string | Yes | MCP tool identifier (auto-generated from node name, snake_case) |
| `toolDescription` | string | Yes | Tool description shown in MCP (max 500 chars) |
| `parameters` | FlowParameter[] | No | Input parameters for the tool |
| `isActive` | boolean | No | Whether this trigger is exposed as MCP tool (default: true) |

#### Fields to KEEP (unchanged)

| Field | Type | Description |
|-------|------|-------------|
| `whenToUse` | string | Scenarios when AI should trigger (max 500 chars) |
| `whenNotToUse` | string | Scenarios when AI should NOT trigger (max 500 chars) |

#### Updated Type Definition

```typescript
export interface UserIntentNodeParameters {
  // Existing fields
  whenToUse?: string;
  whenNotToUse?: string;

  // New fields (from Flow entity)
  toolName: string;           // Required, auto-generated from node name
  toolDescription: string;    // Required, user-provided
  parameters?: FlowParameter[];
  isActive?: boolean;         // Default: true
}

export interface FlowParameter {
  name: string;
  type: ParameterType;        // 'string' | 'number' | 'integer' | 'boolean'
  description: string;
  optional: boolean;
}

export type ParameterType = 'string' | 'number' | 'integer' | 'boolean';
```

---

### Flow Interface (Shared Types - Modified)

**Location**: `packages/shared/src/types/flow.ts`

#### Updated Interface

```typescript
export interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  isActive: boolean;
  // REMOVED: toolName, toolDescription, parameters
  nodes: NodeInstance[];
  connections: Connection[];
  createdAt: string;
  updatedAt: string;
}

// Helper type for computed properties
export interface FlowWithTools extends Flow {
  /** Computed: tool names from active UserIntent nodes */
  exposedTools: string[];
  /** Computed: whether flow has any trigger nodes */
  hasTriggers: boolean;
}
```

---

## Validation Rules

### Tool Name Validation

1. **Format**: Must be valid snake_case (lowercase, underscores, no leading/trailing underscores)
2. **Length**: 1-100 characters
3. **Uniqueness**: Must be unique across all UserIntent nodes within the same app
4. **Generation**: Auto-generated from node name; suffix added on conflict

```typescript
// Validation regex
const TOOL_NAME_REGEX = /^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$/;

function validateToolName(name: string): boolean {
  return TOOL_NAME_REGEX.test(name) && name.length <= 100;
}
```

### Tool Description Validation

1. **Required**: Non-empty string
2. **Length**: 1-500 characters

### Parameters Validation

1. **Name**: Non-empty string, unique within parameter list
2. **Type**: Must be one of: 'string', 'number', 'integer', 'boolean'
3. **Description**: Non-empty string

---

## State Transitions

### Trigger Node States

```
┌─────────────┐
│   Created   │ (toolName auto-generated, isActive=true)
└──────┬──────┘
       │
       ▼
┌─────────────┐     deactivate      ┌─────────────┐
│   Active    │ ───────────────────▶│  Inactive   │
│ (exposed)   │ ◀─────────────────── │ (hidden)    │
└──────┬──────┘     activate        └──────┬──────┘
       │                                   │
       │ delete                            │ delete
       ▼                                   ▼
┌─────────────┐                    ┌─────────────┐
│   Deleted   │                    │   Deleted   │
└─────────────┘                    └─────────────┘
```

### Flow Warning States

```
┌─────────────────────┐
│ Flow Created        │
│ (0 triggers)        │ ──▶ WARNING: "No triggers"
└──────────┬──────────┘
           │ add trigger
           ▼
┌─────────────────────┐
│ Flow with Triggers  │
│ (≥1 active trigger) │ ──▶ NORMAL: Tools exposed
└──────────┬──────────┘
           │ deactivate all / delete all
           ▼
┌─────────────────────┐
│ Flow with Inactive  │
│ (0 active triggers) │ ──▶ WARNING: "No active triggers"
└─────────────────────┘
```

---

## Database Migration

### Migration Script Structure

```typescript
// Migration: Move tool properties from Flow to UserIntent nodes
export async function up(queryRunner: QueryRunner): Promise<void> {
  // 1. Get all flows
  const flows = await queryRunner.query('SELECT * FROM flows');

  for (const flow of flows) {
    const nodes = JSON.parse(flow.nodes || '[]');
    const firstTrigger = nodes.find((n: any) => n.type === 'UserIntent');

    if (firstTrigger) {
      // Move properties to first trigger
      firstTrigger.parameters = {
        ...firstTrigger.parameters,
        toolName: flow.toolName,
        toolDescription: flow.toolDescription,
        parameters: JSON.parse(flow.parameters || '[]'),
        isActive: flow.isActive,
      };
    } else {
      // Create trigger node with flow's tool properties
      nodes.unshift({
        id: generateUuid(),
        type: 'UserIntent',
        name: flow.name,
        position: { x: 100, y: 100 },
        parameters: {
          toolName: flow.toolName,
          toolDescription: flow.toolDescription,
          parameters: JSON.parse(flow.parameters || '[]'),
          isActive: flow.isActive,
          whenToUse: '',
          whenNotToUse: '',
        },
      });
    }

    // Update nodes JSON
    await queryRunner.query(
      'UPDATE flows SET nodes = ? WHERE id = ?',
      [JSON.stringify(nodes), flow.id]
    );
  }

  // 2. Remove columns from flows table
  // Note: SQLite requires table recreation for column removal
}

export async function down(queryRunner: QueryRunner): Promise<void> {
  // Reverse migration: Extract tool properties from first trigger back to flow
}
```

---

## Computed Properties

### hasTriggers

```typescript
function hasTriggers(flow: Flow): boolean {
  return flow.nodes.some(node => node.type === 'UserIntent');
}
```

### hasActiveTriggers

```typescript
function hasActiveTriggers(flow: Flow): boolean {
  return flow.nodes.some(
    node => node.type === 'UserIntent' &&
            (node.parameters as UserIntentNodeParameters).isActive !== false
  );
}
```

### exposedTools

```typescript
function getExposedTools(flow: Flow): string[] {
  return flow.nodes
    .filter(node =>
      node.type === 'UserIntent' &&
      (node.parameters as UserIntentNodeParameters).isActive !== false
    )
    .map(node => (node.parameters as UserIntentNodeParameters).toolName);
}
```
