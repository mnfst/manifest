# Data Model: Flow Return Value Support

**Feature Branch**: `001-flow-return-value`
**Created**: 2025-12-28
**Updated**: 2025-12-28 (changed to separate entity model for extensibility)

## Entity Changes

### ReturnValue (NEW Entity)

A new entity to store return value steps for flows. Designed for extensibility - additional fields may be added in the future (templates, variables, conditional logic, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| flowId | UUID | FK to Flow, required | Parent flow |
| text | text | required | Text content to return to LLM |
| order | int | default: 0 | Position in the return values sequence |
| createdAt | datetime | auto-generated | Creation timestamp |
| updatedAt | datetime | auto-updated | Last update timestamp |

**Relationships**:
- ManyToOne: Flow (cascade delete)

**Design Notes**:
- Separate entity allows multiple return values per flow
- `order` field enables reordering of return values
- Extensible: future fields can be added without schema migration issues
- Follows the same pattern as View entity

### Flow (Modified)

The Flow entity is extended with a one-to-many relationship to ReturnValue entities.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| appId | UUID | FK to App, required | Parent application |
| name | string | max 300 chars, required | Flow display name |
| description | string | max 500 chars, nullable | Flow description |
| toolName | string | max 100 chars, required | MCP tool identifier |
| toolDescription | string | max 500 chars, required | Tool description for LLM |
| whenToUse | string | max 500 chars, nullable | Usage guidance |
| whenNotToUse | string | max 500 chars, nullable | Non-usage guidance |
| isActive | boolean | default: true | Whether tool is available |
| parameters | JSON | nullable | Array of FlowParameter |
| createdAt | datetime | auto-generated | Creation timestamp |
| updatedAt | datetime | auto-updated | Last update timestamp |

**Relationships**:
- ManyToOne: App (cascade delete)
- OneToMany: View[] (cascade delete)
- **OneToMany: ReturnValue[] (cascade delete)** - NEW

**Validation Rules**:
- `returnValues` is mutually exclusive with `views`:
  - If `returnValues.length > 0`, `views` must be empty
  - If `views.length > 0`, `returnValues` must be empty
- A flow can have zero or more return values

### State Transitions

```
Flow States (after user intent is set):
┌─────────────────┐
│  No Steps       │ ← Initial state after user intent
│  (empty)        │
└────────┬────────┘
         │
    Add Step (drawer)
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌─────────────┐
│ Has     │ │ Has Return  │
│ View(s) │ │ Value(s)    │
└─────────┘ └─────────────┘
     │            │
     │  (mutual exclusivity enforced)
     │            │
     ▼            ▼
  Can add      Can add more
  more views   return values
```

## Type Definitions

### Shared Types

#### `packages/shared/src/types/return-value.ts` (NEW)

```typescript
export interface ReturnValue {
  id: string;
  flowId: string;
  text: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateReturnValueRequest {
  text: string;
}

export interface UpdateReturnValueRequest {
  text?: string;
  order?: number;
}

export interface ReorderReturnValuesRequest {
  orderedIds: string[];
}
```

#### `packages/shared/src/types/flow.ts` (Modified)

```typescript
import { View } from './view';
import { ReturnValue } from './return-value';

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
  returnValues?: ReturnValue[];  // NEW
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FlowParameter {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  description: string;
  optional: boolean;
}
```

### MCP Response Types

```typescript
// MCP text content (per protocol spec)
export interface McpTextContent {
  type: 'text';
  text: string;
}

// MCP tool result
export interface McpToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

// Existing McpToolResponse - used for view-based flows
export interface McpToolResponse {
  structuredContent?: MockData;
  content?: McpTextContent[];
  _meta?: Record<string, unknown>;
}
```

## Database Schema

### SQLite Migration (TypeORM auto-sync)

Since the project uses TypeORM with `synchronize: true` for POC, no manual migration is needed. The entity changes will be automatically applied.

**Conceptual changes**:
```sql
-- New table for return values
CREATE TABLE return_values (
  id TEXT PRIMARY KEY,
  flowId TEXT NOT NULL,
  text TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flowId) REFERENCES flows(id) ON DELETE CASCADE
);

CREATE INDEX idx_return_values_flow ON return_values(flowId);
```

## Validation Logic

### ReturnValueService Validation

```typescript
// Before creating a return value
async validateReturnValueCreation(flowId: string): Promise<void> {
  const flow = await this.flowService.findById(flowId);
  if (!flow) {
    throw new NotFoundException('Flow not found');
  }

  // Check mutual exclusivity with views
  if (flow.views && flow.views.length > 0) {
    throw new BadRequestException(
      'Cannot add return values to a flow that has views'
    );
  }
}
```

### ViewService Validation (Modified)

```typescript
// Before creating a view
async validateViewCreation(flowId: string): Promise<void> {
  const flow = await this.flowService.findById(flowId);
  if (!flow) {
    throw new NotFoundException('Flow not found');
  }

  // Check mutual exclusivity with return values
  if (flow.returnValues && flow.returnValues.length > 0) {
    throw new BadRequestException(
      'Cannot add views to a flow that has return values'
    );
  }
}
```

## Query Patterns

### Get Flow with Return Values

```typescript
// FlowService.findById - extended to load return values
const flow = await this.flowRepository.findOne({
  where: { id },
  relations: ['views', 'views.mockDataEntity', 'returnValues'],
  order: {
    returnValues: { order: 'ASC' }
  }
});
```

### Get Return Values by Flow

```typescript
// ReturnValueService.findByFlowId
const returnValues = await this.returnValueRepository.find({
  where: { flowId },
  order: { order: 'ASC' }
});
```

### Check Flow Step Type

```typescript
// Utility functions
hasReturnValues(flow: Flow): boolean {
  return (flow.returnValues?.length ?? 0) > 0;
}

hasViews(flow: Flow): boolean {
  return (flow.views?.length ?? 0) > 0;
}

hasNoSteps(flow: Flow): boolean {
  return !hasReturnValues(flow) && !hasViews(flow);
}
```

## MCP Execution Logic

When a tool is called for a flow with return values:

```typescript
// McpToolService.executeTool (modified)
if (flow.returnValues && flow.returnValues.length > 0) {
  // Return all return values as text content array
  return {
    content: flow.returnValues
      .sort((a, b) => a.order - b.order)
      .map(rv => ({
        type: 'text' as const,
        text: rv.text
      })),
    isError: false
  };
}
```

Example response with multiple return values:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "First return value" },
      { "type": "text", "text": "Second return value" }
    ],
    "isError": false
  }
}
```
