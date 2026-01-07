# Data Model: Output Reference & Trigger Node UX Improvements

**Feature Branch**: `001-output-reference`
**Date**: 2026-01-07

---

## Entity Changes

### 1. NodeInstance (Modified)

**File**: `packages/shared/src/types/node.ts`

```typescript
export interface NodeInstance {
  id: string;              // UUID - existing primary identifier
  slug: string;            // NEW: Human-readable unique identifier (e.g., "weather_trigger")
  type: NodeType;          // Existing: 'Interface' | 'Return' | 'CallFlow' | 'UserIntent' | 'ApiCall'
  name: string;            // Existing: Display name
  position: Position;      // Existing: Canvas position
  parameters: Record<string, unknown>; // Existing: Node-specific config
}
```

**New Field: `slug`**
- **Type**: `string`
- **Format**: `^[a-z][a-z0-9_]*[0-9]*$` (lowercase letters, numbers, underscores)
- **Constraints**:
  - Unique within a flow
  - Auto-generated from `name` using snake_case conversion
  - 1-50 characters
- **Examples**: `"user_intent_1"`, `"api_call_weather"`, `"return_result"`

**Generation Rules**:
1. Convert `name` to snake_case: "Get Weather Data" → `"get_weather_data"`
2. If slug exists in flow, append suffix: `"get_weather_data_2"`, `"get_weather_data_3"`
3. Update slug when node is renamed (preserve references via migration)

---

### 2. OutputReference (New Concept)

**Not a stored entity - runtime concept for template variables**

```typescript
// Used in node parameters like ApiCall body/headers
type OutputReference = `{{ ${string}.${string} }}`;

// Examples:
// "{{ weather_trigger.city }}"
// "{{ api_call_1.response.data.temperature }}"
// "{{ user_intent_2.userId }}"
```

**Parsing Rules**:
1. Match pattern: `\{\{\s*([a-z][a-z0-9_]*)\.([\w.]+)\s*\}\}`
2. Group 1: Node slug
3. Group 2: Property path (dot notation for nested fields)

---

### 3. SchemaPropertyMetadata (Extended)

**File**: `packages/shared/src/types/schema.ts`

```typescript
// JSON Schema extension for field source tracking
interface SchemaProperty {
  type: string;
  description?: string;
  // NEW: Custom extension
  'x-field-source'?: 'static' | 'dynamic';
}
```

**Usage in UserIntent Output Schema**:
```typescript
{
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'trigger',
      'x-field-source': 'static'
    },
    triggered: {
      type: 'boolean',
      'x-field-source': 'static'
    },
    toolName: {
      type: 'string',
      'x-field-source': 'static'
    },
    // User-defined parameters get 'dynamic' source
    city: {
      type: 'string',
      description: 'Target city for weather',
      'x-field-source': 'dynamic'
    }
  }
}
```

---

### 4. FlattenedSchemaField (New Type)

**File**: `packages/frontend/src/lib/schemaUtils.ts`

```typescript
// Used for "Use Previous Outputs" dropdown population
interface FlattenedSchemaField {
  path: string;           // Dot notation path: "response.data.items"
  type: string;           // JSON Schema type: "string", "array", "object"
  description?: string;   // Human-readable description if available
  source?: 'static' | 'dynamic'; // From x-field-source extension
  required: boolean;      // Whether field is in schema's required array
}
```

**Example Flattened Output**:
```typescript
[
  { path: 'type', type: 'string', source: 'static', required: true },
  { path: 'triggered', type: 'boolean', source: 'static', required: true },
  { path: 'toolName', type: 'string', source: 'static', required: true },
  { path: 'city', type: 'string', source: 'dynamic', description: 'Target city', required: true },
  { path: 'units', type: 'string', source: 'dynamic', description: 'Temperature units', required: false }
]
```

---

### 5. UpstreamNodeInfo (New Type)

**File**: `packages/frontend/src/hooks/useUpstreamNodes.ts`

```typescript
// Returned by useUpstreamNodes hook
interface UpstreamNodeInfo {
  nodeId: string;         // UUID for internal use
  slug: string;           // Human-readable slug for display
  name: string;           // Display name
  type: NodeType;         // Node type for icon/styling
  outputFields: FlattenedSchemaField[]; // Available outputs
  distance: number;       // Hops from current node (1 = direct connection)
}
```

---

## State Transitions

### Node Slug Lifecycle

```
┌──────────────┐     Create Node      ┌───────────────┐
│   No Node    │ ─────────────────────▶│  slug: auto   │
└──────────────┘                       │  generated    │
                                       └───────┬───────┘
                                               │
                         Rename Node           │
                    ┌──────────────────────────┤
                    ▼                          │
              ┌─────────────┐                  │
              │ slug: new   │                  │
              │ (refs auto  │                  │
              │  migrated)  │                  │
              └─────────────┘                  │
                                               │
                         Delete Node           │
                    ┌──────────────────────────┘
                    ▼
              ┌─────────────┐
              │ References  │
              │ invalidated │
              └─────────────┘
```

---

## Validation Rules

### Slug Validation

| Rule | Constraint | Error Message |
|------|------------|---------------|
| Format | `/^[a-z][a-z0-9_]*$/` | "Slug must start with letter, contain only lowercase letters, numbers, underscores" |
| Length | 1-50 chars | "Slug must be 1-50 characters" |
| Uniqueness | Unique within flow | "Slug already exists in this flow" |
| Reserved | Not in reserved list | "Slug is reserved" |

**Reserved Slugs**: `flow`, `trigger`, `output`, `input`, `node`, `connection`

### Output Reference Validation

| Rule | Constraint | Error Message |
|------|------------|---------------|
| Format | `/\{\{\s*([a-z][a-z0-9_]*)\.([\w.]+)\s*\}\}/` | "Invalid reference format" |
| Slug exists | Slug resolves to node in flow | "Unknown node: {slug}" |
| Field exists | Path exists in node's output schema | "Unknown field: {slug}.{path}" |

---

## Migration Notes

### Existing Flows Without Slugs

When loading a flow that lacks slugs on nodes:
1. Generate slugs from existing `name` fields
2. Find and replace any `{{nodeId.path}}` references with `{{slug.path}}`
3. Save migrated flow automatically

### Backward Compatibility

- Keep `id` field as primary identifier for internal use
- Connections continue to reference nodes by `id` (no change)
- Only template variable syntax changes from UUID to slug
