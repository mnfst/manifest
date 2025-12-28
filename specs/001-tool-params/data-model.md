# Data Model: MCP Tool Parameters

**Feature**: 001-tool-params
**Date**: 2025-12-28

## Entity Changes

### FlowParameter (New Type)

A parameter definition for an MCP tool flow.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| name | string | Required, 1-50 chars, unique within flow | Parameter identifier |
| type | ParameterType | Required, enum value | Data type of the parameter |
| optional | boolean | Required, default: false | Whether parameter is optional |

**ParameterType Enum**:
- `string` - Text values
- `number` - Numeric values (integers and floats)
- `integer` - Integer values only
- `boolean` - True/false values

### Flow (Extended)

Existing Flow entity extended with parameters field.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| ... | ... | ... | (existing fields unchanged) |
| parameters | FlowParameter[] | Optional, default: [] | Ordered list of parameter definitions |

## Validation Rules

### Parameter Name
- Must be non-empty
- Maximum 50 characters
- Must be unique within the flow's parameter list
- Whitespace-only names are invalid

### Parameter Type
- Must be exactly one of: `string`, `number`, `integer`, `boolean`
- No other values accepted

### Parameter List
- May be empty (flow with no parameters)
- Order is significant and must be preserved
- Maximum reasonable limit: 50 parameters (soft limit for UX)

## State Transitions

Parameters do not have independent lifecycle states. They exist as part of Flow:

```
Flow Created → Parameters can be added/modified/removed → Flow Updated
                          ↓
                    Flow Deleted → Parameters deleted (cascade)
```

## Relationships

```
App (1) ─────────< Flow (N) ─────────< View (N)
                     │
                     └── parameters: FlowParameter[] (embedded JSON)
```

- Flow has 0..N parameters (stored as JSON array)
- Parameters are not a separate entity with foreign key
- Deleting a flow deletes its parameters (embedded data)

## Migration Notes

- No database migration required (TypeORM auto-sync in POC mode)
- Existing flows will have `parameters` as `null` or `[]`
- Backend should treat null as empty array for backwards compatibility

## Type Definitions

```typescript
// packages/shared/src/types/flow.ts

export type ParameterType = 'string' | 'number' | 'integer' | 'boolean';

export interface FlowParameter {
  name: string;
  type: ParameterType;
  optional: boolean;
}

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
  parameters?: FlowParameter[];  // NEW FIELD
  views?: View[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlowRequest {
  name: string;
  description?: string;
  parameters?: FlowParameter[];  // NEW FIELD
}

export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  toolName?: string;
  toolDescription?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  isActive?: boolean;
  parameters?: FlowParameter[];  // NEW FIELD
}
```

## Entity Changes

```typescript
// packages/backend/src/flow/flow.entity.ts

@Entity('flows')
export class FlowEntity {
  // ... existing fields ...

  @Column({ type: 'simple-json', nullable: true })
  parameters?: FlowParameter[];  // NEW COLUMN
}
```
