# Data Model: Transform Node Category

**Feature**: 089-transform-nodes | **Date**: 2026-01-07

## Entities

### 1. Transform Category

A new node category grouping all transformer nodes.

| Attribute | Type | Description |
|-----------|------|-------------|
| name | string | `'transform'` - category identifier |
| displayName | string | `'Transform'` - UI display name |
| color | string | Teal/Emerald color scheme |
| description | string | Nodes that transform data between incompatible formats |

**Relationships**:
- Contains: Multiple TransformerNode instances

---

### 2. TransformerNode (Base Concept)

Specialized node type with distinctive visual representation.

| Attribute | Type | Description |
|-----------|------|-------------|
| id | string | Unique identifier (UUID) |
| type | NodeType | Specific transformer type (e.g., `'JavaScriptCodeTransform'`) |
| name | string | User-defined name |
| position | { x: number, y: number } | Canvas position |
| parameters | Record<string, unknown> | Type-specific configuration |

**Characteristics**:
- Visual: 45-degree rotated square (diamond shape)
- Size: Smaller than standard nodes (~100px vs ~200px)
- Handles: Exactly 2 (input left, output right)
- Icon: shuffle (lucide-react)
- Color: Teal border and background tint

**Validation Rules**:
- MUST have input connection (left handle connected)
- Output connection is optional
- Cannot create circular connections

---

### 3. JavaScriptCodeTransform Node

First implementation of a transformer node.

| Attribute | Type | Description |
|-----------|------|-------------|
| type | literal | `'JavaScriptCodeTransform'` |
| parameters.code | string | User-written JavaScript transformation code |
| parameters.resolvedOutputSchema | JSONSchema \| null | Inferred output schema from code execution |

**Default Parameters**:
```typescript
{
  code: 'return input;',
  resolvedOutputSchema: null
}
```

**State Transitions**:
1. **Unconfigured**: Default code, no output schema
2. **Configured**: User code written, syntax validated
3. **Schema Resolved**: Code tested, output schema inferred
4. **Invalid**: Syntax errors or runtime errors detected

---

### 4. TransformNodeExecution

Execution tracking for transformer nodes (extends existing NodeExecutionData).

| Attribute | Type | Description |
|-----------|------|-------------|
| nodeId | string | Reference to transformer node |
| nodeName | string | Display name at execution time |
| nodeType | string | `'JavaScriptCodeTransform'` |
| executedAt | string | ISO timestamp |
| inputData | Record<string, unknown> | Data received from upstream |
| outputData | Record<string, unknown> | Transformed result |
| status | NodeExecutionStatus | `'pending'` \| `'completed'` \| `'error'` |
| error | string \| undefined | Error message if failed |

**Note**: Uses existing NodeExecutionData interface - no schema changes needed.

---

### 5. SchemaCompatibilitySuggestion

New concept for suggesting transformers on incompatible connections.

| Attribute | Type | Description |
|-----------|------|-------------|
| sourceNodeId | string | Upstream node ID |
| targetNodeId | string | Downstream node ID |
| compatibilityStatus | CompatibilityStatus | `'error'` \| `'warning'` |
| suggestedTransformers | string[] | Applicable transformer types |
| issues | CompatibilityIssue[] | Specific incompatibility details |

---

## Type Definitions

### NodeType Extension

```typescript
// Add to existing NodeType union
type NodeType =
  | 'Interface'
  | 'Return'
  | 'CallFlow'
  | 'UserIntent'
  | 'ApiCall'
  | 'JavaScriptCodeTransform';  // NEW
```

### NodeTypeCategory Extension

```typescript
// Add to existing NodeTypeCategory union
type NodeTypeCategory =
  | 'trigger'
  | 'interface'
  | 'action'
  | 'return'
  | 'transform';  // NEW
```

### JavaScriptCodeTransformParameters

```typescript
interface JavaScriptCodeTransformParameters {
  code: string;
  resolvedOutputSchema: JSONSchema | null;
}
```

---

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Flow                                     │
│  nodes: NodeInstance[]                                          │
│  connections: Connection[]                                       │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
                              contains                            │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NodeInstance                                  │
│  type: NodeType (includes 'JavaScriptCodeTransform')            │
│  category: 'transform'                                          │
│  parameters: JavaScriptCodeTransformParameters                  │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
                        tracked by                                │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FlowExecution                                  │
│  nodeExecutions: NodeExecutionData[]                            │
│  (includes transformer execution data)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules Summary

| Rule | Entity | Description |
|------|--------|-------------|
| VR-001 | TransformerNode | Must have input connection before flow execution |
| VR-002 | TransformerNode | Cannot form circular connections |
| VR-003 | JavaScriptCodeTransform | Code must pass syntax validation (acorn parser) |
| VR-004 | JavaScriptCodeTransform | Code must execute without runtime errors |
| VR-005 | Connection | Schema compatibility checked on connection |
