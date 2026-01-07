# Quickstart: Node I/O Schema Validation

**Feature**: 001-io-schemas
**Date**: 2026-01-06

## Overview

This guide provides a quick reference for implementing Node I/O Schema Validation. It covers the key components and their interactions.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │ FlowCanvas   │───►│ CustomEdge       │───►│ ConnectionValidator  │  │
│  │ (handles     │    │ (colored based   │    │ (tooltip/panel with  │  │
│  │  connections)│    │  on validation)  │    │  error details)      │  │
│  └──────────────┘    └──────────────────┘    └──────────────────────┘  │
│         │                                              ▲               │
│         ▼                                              │               │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                useSchemaValidation Hook                   │          │
│  │  - Fetches schemas from API                              │          │
│  │  - Validates connections client-side                     │          │
│  │  - Caches validation results                             │          │
│  └───────────────────────────┬──────────────────────────────┘          │
│                              │                                          │
│  ┌──────────────────┐        │        ┌────────────────────┐           │
│  │ NodeSchemaPanel  │        │        │ SchemaViewer       │           │
│  │ (displays I/O    │        │        │ (tree view of      │           │
│  │  schemas)        │        │        │  JSON Schema)      │           │
│  └──────────────────┘        │        └────────────────────┘           │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ HTTP API
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (NestJS)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                    SchemaController                       │          │
│  │  - GET /flows/:flowId/nodes/:nodeId/schema               │          │
│  │  - GET /flows/:flowId/schemas                            │          │
│  │  - POST /flows/:flowId/connections/validate              │          │
│  │  - GET /flows/:flowId/connections/validate               │          │
│  │  - POST /flows/:flowId/nodes/:nodeId/schema/resolve      │          │
│  └───────────────────────────┬──────────────────────────────┘          │
│                              │                                          │
│  ┌───────────────────────────▼──────────────────────────────┐          │
│  │                    SchemaService                          │          │
│  │  - getNodeSchema(flowId, nodeId)                         │          │
│  │  - validateConnection(source, target)                    │          │
│  │  - resolveSchema(flowId, nodeId)                         │          │
│  └───────────────────────────┬──────────────────────────────┘          │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        NODES PACKAGE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │              NodeTypeDefinition (extended)                │          │
│  │  + inputSchema?: JSONSchema | null                       │          │
│  │  + outputSchema?: JSONSchema | null                      │          │
│  │  + getInputSchema?(params): JSONSchema | null            │          │
│  │  + getOutputSchema?(params): JSONSchema | null           │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ UserIntent  │ │ Interface   │ │ Return      │ │ ApiCall     │       │
│  │ Node        │ │ Node        │ │ Node        │ │ Node        │       │
│  │             │ │             │ │             │ │             │       │
│  │ out: static │ │ in/out:     │ │ in: static  │ │ in: static  │       │
│  │             │ │ dynamic     │ │ out: null   │ │ out: dynamic│       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Implementation Steps

### Step 1: Add Schema Types (shared package)

Create `packages/shared/src/types/schema.ts`:

```typescript
// JSON Schema type (subset of draft-07)
export interface JSONSchema {
  type?: JSONSchemaType | JSONSchemaType[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema | JSONSchema[];
  // ... other fields
}

// Compatibility result
export interface SchemaCompatibilityResult {
  status: 'compatible' | 'warning' | 'error' | 'unknown';
  issues: CompatibilityIssue[];
  sourceSchema: JSONSchema | null;
  targetSchema: JSONSchema | null;
}
```

### Step 2: Extend NodeTypeDefinition (nodes package)

Update `packages/nodes/src/types.ts`:

```typescript
export interface NodeTypeDefinition {
  // ... existing fields

  // NEW: Schema declarations
  inputSchema?: JSONSchema | null;
  outputSchema?: JSONSchema | null;
  getInputSchema?: (params: Record<string, unknown>) => JSONSchema | null;
  getOutputSchema?: (params: Record<string, unknown>) => JSONSchema | null;
}
```

### Step 3: Add Schemas to Each Node Type

Example for UserIntentNode:

```typescript
export const UserIntentNode: NodeTypeDefinition = {
  name: 'UserIntent',
  // ... existing fields

  inputSchema: null,  // Trigger has no input
  outputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', const: 'trigger' },
      triggered: { type: 'boolean' },
    },
    required: ['type', 'triggered'],
  },
};
```

### Step 4: Create Schema Service (backend)

Create `packages/backend/src/node/schema/schema.service.ts`:

```typescript
@Injectable()
export class SchemaService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly nodeTypes: NodeTypesService,
  ) {}

  async getNodeSchema(flowId: string, nodeId: string): Promise<NodeSchemaInfo> {
    const node = await this.nodeService.findOne(flowId, nodeId);
    const nodeType = this.nodeTypes.get(node.type);

    return {
      nodeId,
      nodeType: node.type,
      inputState: nodeType.inputSchema ? 'defined' : 'unknown',
      inputSchema: this.resolveSchema(nodeType, node, 'input'),
      outputState: nodeType.outputSchema ? 'defined' : 'unknown',
      outputSchema: this.resolveSchema(nodeType, node, 'output'),
    };
  }

  async validateConnection(
    sourceSchema: JSONSchema | null,
    targetSchema: JSONSchema | null,
  ): Promise<SchemaCompatibilityResult> {
    // Implementation of compatibility algorithm
  }
}
```

### Step 5: Create Schema Controller (backend)

Create `packages/backend/src/node/schema/schema.controller.ts`:

```typescript
@Controller('flows/:flowId')
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}

  @Get('nodes/:nodeId/schema')
  async getNodeSchema(
    @Param('flowId') flowId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.schemaService.getNodeSchema(flowId, nodeId);
  }

  @Post('connections/validate')
  async validateConnection(
    @Param('flowId') flowId: string,
    @Body() body: ValidateConnectionRequest,
  ) {
    return this.schemaService.validateConnection(flowId, body);
  }
}
```

### Step 6: Create Custom Edge Component (frontend)

Create `packages/frontend/src/components/flow/CustomEdge.tsx`:

```typescript
import { BaseEdge, EdgeProps } from '@xyflow/react';

const statusColors = {
  compatible: '#22c55e',  // green
  warning: '#eab308',     // yellow
  error: '#ef4444',       // red
  unknown: '#6b7280',     // gray
};

export function CustomEdge({ data, ...props }: EdgeProps) {
  const status = data?.validationStatus || 'unknown';
  const color = statusColors[status];

  return (
    <BaseEdge
      {...props}
      style={{ stroke: color, strokeWidth: 2 }}
    />
  );
}
```

### Step 7: Create Schema Validation Hook (frontend)

Create `packages/frontend/src/hooks/useSchemaValidation.ts`:

```typescript
export function useSchemaValidation(flowId: string) {
  const [validationResults, setValidationResults] = useState<Map<string, ConnectionValidationState>>(new Map());

  const validateConnection = useCallback(async (
    sourceNodeId: string,
    targetNodeId: string,
  ) => {
    const result = await api.post(`/flows/${flowId}/connections/validate`, {
      sourceNodeId,
      sourceHandle: 'main',
      targetNodeId,
      targetHandle: 'main',
    });
    return result.data;
  }, [flowId]);

  return { validationResults, validateConnection };
}
```

## Validation Flow

```
1. User drags connection from Node A to Node B
   │
   ▼
2. onConnect callback triggered in FlowCanvas
   │
   ▼
3. Call validateConnection(nodeA, nodeB)
   │
   ▼
4. Backend SchemaService:
   a. Get Node A's output schema
   b. Get Node B's input schema
   c. Run compatibility check
   d. Return result with status and issues
   │
   ▼
5. Create edge with validation data attached
   │
   ▼
6. CustomEdge renders with color based on status
   │
   ▼
7. User hovers edge → ConnectionValidator shows details
```

## Color Coding Reference

| Status | Color | Hex | Meaning |
|--------|-------|-----|---------|
| Compatible | Green | #22c55e | All required fields present, types match |
| Warning | Yellow | #eab308 | Type coercion needed, optional fields missing |
| Error | Red | #ef4444 | Required fields missing, incompatible types |
| Unknown | Gray | #6b7280 | One or both schemas not defined |

## File Locations Summary

| File | Purpose |
|------|---------|
| `packages/shared/src/types/schema.ts` | Schema type definitions |
| `packages/nodes/src/types.ts` | Extended NodeTypeDefinition |
| `packages/nodes/src/nodes/*.ts` | Node schemas |
| `packages/backend/src/node/schema/schema.service.ts` | Validation logic |
| `packages/backend/src/node/schema/schema.controller.ts` | API endpoints |
| `packages/frontend/src/components/flow/CustomEdge.tsx` | Colored edges |
| `packages/frontend/src/hooks/useSchemaValidation.ts` | Validation hook |
| `packages/frontend/src/components/node/NodeSchemaPanel.tsx` | Schema display |

## Dependencies

Add to `packages/shared/package.json`:
```json
{
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1"
  }
}
```

## Testing the Feature

1. Start the app: `.specify/scripts/bash/serve-app.sh`
2. Create a new flow
3. Add UserIntent node (trigger)
4. Add Return node
5. Connect them - should show green line
6. Add ApiCall node between them
7. Connect UserIntent → ApiCall - should show gray (unknown output)
8. Connect ApiCall → Return - should show gray (unknown input from ApiCall)
