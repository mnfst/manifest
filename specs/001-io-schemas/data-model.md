# Data Model: Node I/O Schema Validation

**Feature**: 001-io-schemas
**Date**: 2026-01-06

## Entity Overview

This feature extends existing entities rather than creating new database tables. Schema data is stored inline with node type definitions.

## Extended Entities

### NodeTypeDefinition (packages/nodes/src/types.ts)

Extended with input/output schema declarations.

```typescript
interface NodeTypeDefinition {
  // Existing fields
  name: string;
  displayName: string;
  icon: string;
  group: string[];
  category: NodeTypeCategory;
  description: string;
  inputs: string[];
  outputs: string[];
  defaultParameters: Record<string, unknown>;
  execute: (context: ExecutionContext) => Promise<ExecutionResult>;

  // NEW: Schema declarations
  /**
   * JSON Schema describing the expected input data structure.
   * If undefined, input schema is considered "unknown".
   * For trigger nodes (no inputs), should be null.
   */
  inputSchema?: JSONSchema | null;

  /**
   * JSON Schema describing the guaranteed output data structure.
   * If undefined, output schema is considered "unknown".
   * For Return nodes (no outputs), should be null.
   */
  outputSchema?: JSONSchema | null;

  /**
   * For dynamic schemas: function to compute schema from node parameters.
   * Takes precedence over static inputSchema/outputSchema when present.
   */
  getInputSchema?: (parameters: Record<string, unknown>) => JSONSchema | null;
  getOutputSchema?: (parameters: Record<string, unknown>) => JSONSchema | null;
}
```

### Connection (packages/shared/src/types/node.ts)

Extended with validation state for persisted connections.

```typescript
interface Connection {
  // Existing fields
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;

  // NEW: Validation state (computed, not persisted to DB)
  // This is set by the frontend when loading/validating connections
}
```

## New Types

### JSONSchema (packages/shared/src/types/schema.ts)

Standard JSON Schema type definition for TypeScript.

```typescript
/**
 * JSON Schema type definition (draft-07 compatible subset).
 * Covers the most common schema patterns used in node I/O.
 */
interface JSONSchema {
  $schema?: string;
  $ref?: string;
  $id?: string;

  // Type
  type?: JSONSchemaType | JSONSchemaType[];
  enum?: unknown[];
  const?: unknown;

  // Object properties
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  patternProperties?: Record<string, JSONSchema>;

  // Array items
  items?: JSONSchema | JSONSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  // Number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Composition
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;

  // Metadata
  title?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];
}

type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
```

### SchemaCompatibilityResult (packages/shared/src/types/schema.ts)

Result of comparing two schemas for connection compatibility.

```typescript
/**
 * Compatibility status for a connection.
 */
type CompatibilityStatus = 'compatible' | 'warning' | 'error' | 'unknown';

/**
 * A single compatibility issue (error or warning).
 */
interface CompatibilityIssue {
  /** Type of issue */
  type: 'missing_field' | 'type_mismatch' | 'format_mismatch' | 'constraint_violation';

  /** Severity level */
  severity: 'error' | 'warning';

  /** Field path (e.g., "user.email", "items[0].id") */
  path: string;

  /** Human-readable description */
  message: string;

  /** Source schema value (for type mismatches) */
  sourceValue?: string;

  /** Target schema value (for type mismatches) */
  targetValue?: string;
}

/**
 * Complete result of schema compatibility check.
 */
interface SchemaCompatibilityResult {
  /** Overall status */
  status: CompatibilityStatus;

  /** List of issues found (empty if compatible) */
  issues: CompatibilityIssue[];

  /** Source schema (null if unknown) */
  sourceSchema: JSONSchema | null;

  /** Target schema (null if unknown) */
  targetSchema: JSONSchema | null;

  /** Timestamp of validation */
  validatedAt: string;
}
```

### NodeSchemaInfo (packages/shared/src/types/schema.ts)

Schema information for a node (returned by API).

```typescript
/**
 * Schema state for a node.
 */
type SchemaState = 'defined' | 'unknown' | 'pending';

/**
 * Schema information for a node instance.
 */
interface NodeSchemaInfo {
  /** Node instance ID */
  nodeId: string;

  /** Node type name */
  nodeType: string;

  /** Input schema state */
  inputState: SchemaState;

  /** Input schema (null if unknown/pending) */
  inputSchema: JSONSchema | null;

  /** Output schema state */
  outputState: SchemaState;

  /** Output schema (null if unknown/pending) */
  outputSchema: JSONSchema | null;
}
```

### ConnectionValidationState (frontend only)

Validation state attached to edges in the flow canvas.

```typescript
/**
 * Validation state for a connection edge (frontend only).
 */
interface ConnectionValidationState {
  /** Compatibility status */
  status: CompatibilityStatus;

  /** Number of errors */
  errorCount: number;

  /** Number of warnings */
  warningCount: number;

  /** Summary message for tooltip */
  summary: string;

  /** Full compatibility result (for detail panel) */
  details: SchemaCompatibilityResult;
}
```

## Example Schemas for Existing Nodes

### UserIntentNode (Trigger)

```typescript
// No input (trigger node)
inputSchema: null;

// Static output
outputSchema: {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'trigger' },
    triggered: { type: 'boolean' },
  },
  required: ['type', 'triggered'],
};
```

### InterfaceNode

```typescript
// Input from previous node (layout data)
inputSchema: {
  type: 'object',
  additionalProperties: true,  // Accepts any data to display
};

// Output depends on layout template actions
getOutputSchema: (params) => {
  const template = params.layoutTemplate;
  // Returns action output schema based on template
  // e.g., form submission, button clicks
};
```

### ReturnNode

```typescript
// Accepts any input to return
inputSchema: {
  type: 'object',
  additionalProperties: true,
};

// No output (terminal node)
outputSchema: null;
```

### ApiCallNode

```typescript
// Input for URL/header template resolution
inputSchema: {
  type: 'object',
  additionalProperties: true,  // Accepts any upstream data
};

// Dynamic output - requires test call or user-defined schema
outputSchema: undefined;  // Unknown until resolved

getOutputSchema: (params) => {
  // If user has defined expected response schema, return it
  if (params.responseSchema) {
    return params.responseSchema;
  }
  return null;  // Unknown
};
```

### CallFlowNode

```typescript
// Input passed to target flow
inputSchema: {
  type: 'object',
  additionalProperties: true,
};

// Output matches target flow's return value
getOutputSchema: (params) => {
  // Would need to look up target flow's return schema
  // For now, return unknown
  return null;
};
```

## Validation Rules

1. **Required Field Check**: All fields in `targetSchema.required` must exist in `sourceSchema.properties`
2. **Type Compatibility**: Matching fields must have compatible types (see coercion rules in research.md)
3. **Format Compatibility**: If target specifies a format, source should match (warning if not)
4. **Structural Subtyping**: Extra fields in source are allowed (not an error)
5. **Unknown Handling**: If either schema is unknown, status is "unknown" (no validation)
6. **Null Schema**: If target has no input schema or source has no output schema, skip validation

## State Transitions

```
Connection Lifecycle:

  [User drags connection]
         │
         ▼
  ┌─────────────────┐
  │ Get source      │
  │ output schema   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Get target      │
  │ input schema    │
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  [Either    [Both
  unknown]   known]
     │           │
     ▼           ▼
  status:    ┌──────────┐
  'unknown'  │ Validate │
     │       │ compat.  │
     │       └────┬─────┘
     │            │
     │      ┌─────┼─────┐
     │      │     │     │
     │      ▼     ▼     ▼
     │   'error' 'warn' 'compatible'
     │      │     │     │
     └──────┴─────┴─────┘
                  │
                  ▼
           [Create edge with status]
                  │
                  ▼
           [Display visual feedback]
```

## Summary

- No new database tables (schemas stored in node type definitions)
- Extended `NodeTypeDefinition` with `inputSchema`, `outputSchema`, and dynamic schema getters
- New types: `JSONSchema`, `SchemaCompatibilityResult`, `NodeSchemaInfo`, `ConnectionValidationState`
- Validation follows structural subtyping with required field checking
- Unknown schemas result in "unknown" status (gray), not validation errors
