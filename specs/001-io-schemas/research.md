# Research: Node I/O Schema Validation

**Feature**: 001-io-schemas
**Date**: 2026-01-06

## Research Tasks

### 1. JSON Schema Library Selection

**Decision**: Use Ajv (Another JSON Schema Validator)

**Rationale**:
- Most popular and fastest JSON Schema validator for JavaScript/TypeScript
- Supports JSON Schema draft-07 (and later drafts)
- Built-in schema compilation for performance
- Type-safe with TypeScript definitions
- Already used extensively in the Node.js ecosystem
- Provides detailed error messages for validation failures
- Supports schema references ($ref) for complex schemas

**Alternatives Considered**:
| Library | Why Rejected |
|---------|--------------|
| json-schema | Outdated, no TypeScript support, slower |
| jsonschema | Less performant, fewer features |
| Zod | Already in project but not JSON Schema compatible - different DSL |
| io-ts | Functional style doesn't match codebase, steeper learning curve |

**Implementation Notes**:
- Use `ajv` package (add as dependency to shared package)
- Use `ajv-formats` for format validation (email, uri, date-time, etc.)
- Compile schemas once at node registration, not per validation

### 2. Schema Compatibility Algorithm

**Decision**: Structural subtyping with required field checking

**Rationale**:
JSON Schema compatibility should follow these rules:
1. **Required fields**: Target's required fields must exist in source
2. **Type compatibility**: Field types must match or be safely coercible
3. **Extra fields allowed**: Source can have additional fields (structural subtyping)

**Algorithm**:
```
function checkCompatibility(sourceSchema, targetSchema):
  result = { status: 'compatible', errors: [], warnings: [] }

  // 1. Check all required fields in target exist in source
  for field in targetSchema.required:
    if field not in sourceSchema.properties:
      result.errors.push("Missing required field: " + field)
      result.status = 'error'

  // 2. Check type compatibility for matching fields
  for field in targetSchema.properties:
    if field in sourceSchema.properties:
      sourceType = sourceSchema.properties[field].type
      targetType = targetSchema.properties[field].type

      if sourceType != targetType:
        if isCoercible(sourceType, targetType):
          result.warnings.push("Type coercion: " + field)
          if result.status == 'compatible':
            result.status = 'warning'
        else:
          result.errors.push("Type mismatch: " + field)
          result.status = 'error'

  return result
```

**Type Coercion Rules** (warning, not error):
- number -> string (always safe)
- boolean -> string (always safe)
- integer -> number (always safe)
- string -> number/boolean (warning - may fail at runtime)

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|--------------|
| Exact schema match | Too restrictive - prevents valid structural subtyping |
| Full JSON Schema validation of sample data | Requires runtime data, not design-time |
| TypeScript structural typing | Not applicable to JSON data |

### 3. Dynamic Schema Resolution Pattern

**Decision**: Schema provider interface with async resolution

**Rationale**:
Nodes can have:
1. **Static schemas**: Defined at node type level (e.g., InterfaceNode)
2. **Dynamic schemas**: Computed from instance parameters (e.g., UserIntentNode with user-defined params)
3. **Unknown schemas**: Require runtime discovery (e.g., ApiCallNode response)

**Pattern**:
```typescript
interface SchemaProvider {
  // Returns schema, or null if schema is unknown/pending
  getInputSchema(node: NodeInstance): JSONSchema | null;
  getOutputSchema(node: NodeInstance): JSONSchema | null;

  // For nodes requiring async resolution (API discovery)
  resolveOutputSchema?(node: NodeInstance): Promise<JSONSchema>;
}
```

**Schema States**:
- `defined`: Schema is known (static or computed)
- `unknown`: Schema cannot be determined without runtime execution
- `pending`: Schema resolution in progress (async)

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|--------------|
| All schemas static | Doesn't support dynamic nodes like UserIntent |
| Always async resolution | Unnecessary complexity for static schemas |
| Schema inference from sample data | Requires execution, not design-time |

### 4. Visual Feedback Integration with @xyflow/react

**Decision**: Custom edge component with animated color states

**Rationale**:
@xyflow/react supports custom edge components via `edgeTypes` prop. This allows:
- Custom styling per edge (color based on validation status)
- Interactive elements (hover tooltips with error details)
- Animations (pulse for warnings, shake for errors)

**Implementation**:
```typescript
// Custom edge component
const ValidatedEdge = ({ data, ...props }) => {
  const status = data?.validationStatus || 'unknown';
  const color = {
    compatible: '#22c55e',  // green-500
    warning: '#eab308',     // yellow-500
    error: '#ef4444',       // red-500
    unknown: '#6b7280',     // gray-500
  }[status];

  return (
    <BaseEdge
      {...props}
      style={{ stroke: color, strokeWidth: 2 }}
    />
  );
};
```

**Integration Points**:
1. `onConnect` callback: Validate before creating edge
2. Edge data: Store validation result in edge data
3. Re-validation: Trigger when node schema changes

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|--------------|
| CSS class-based styling | Less control, can't access edge data |
| SVG markers only | Limited visual options |
| Separate validation overlay | More complex, worse UX |

### 5. Backward Compatibility Strategy

**Decision**: Opt-in schemas with "unknown" fallback

**Rationale**:
Existing nodes (5 types) don't have schemas. Strategy:
1. Add `inputSchema` and `outputSchema` as optional properties
2. Nodes without schemas treated as "unknown" (no validation)
3. Connections to/from unknown nodes show gray color, no blocking
4. Gradual migration: add schemas to nodes incrementally

**Migration Order** (by value/complexity):
1. ReturnNode - simplest, input only
2. InterfaceNode - well-defined input/output structure
3. CallFlowNode - depends on target flow (dynamic)
4. UserIntentNode - output is trigger context (static)
5. ApiCallNode - dynamic output from HTTP response

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|--------------|
| Require schemas for all nodes | Breaking change, blocks feature deployment |
| Infer schemas from existing code | Unreliable, may be incorrect |
| Default to "any" type | Provides no validation value |

### 6. Schema Display Format

**Decision**: Tree view with expandable properties + JSON toggle

**Rationale**:
Users need to understand schemas without JSON Schema expertise. Display as:
1. **Tree view (default)**: Hierarchical property list with types and required markers
2. **JSON toggle**: Raw JSON Schema for advanced users
3. **Summary line**: "5 properties, 3 required"

**Visual Design**:
```
┌─ Input Schema ────────────────────────┐
│  Summary: 5 properties, 3 required    │
│                                       │
│  ▼ user (object) *required            │
│    ├─ id (string) *required           │
│    ├─ name (string) *required         │
│    └─ email (string, format: email)   │
│  ▼ options (object)                   │
│    └─ notify (boolean, default: true) │
│                                       │
│  [View JSON] [Copy Schema]            │
└───────────────────────────────────────┘
```

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|--------------|
| JSON-only display | Not user-friendly for non-developers |
| Form-based display | Too complex for nested schemas |
| Natural language | Loses precision, hard to implement |

## Dependencies to Add

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| ajv | ^8.17.1 | packages/shared | JSON Schema validation |
| ajv-formats | ^3.0.1 | packages/shared | Format validators (email, uri, etc.) |

## Summary

All research tasks complete. Key decisions:
1. **Ajv** for JSON Schema validation (fast, TypeScript support)
2. **Structural subtyping** for compatibility (required fields + type checking)
3. **Schema provider interface** for static/dynamic/unknown schemas
4. **Custom edge component** in @xyflow/react for visual feedback
5. **Opt-in migration** with "unknown" fallback for backward compatibility
6. **Tree view display** with JSON toggle for schema visualization

No NEEDS CLARIFICATION items remain - all decisions made with documented rationale.
