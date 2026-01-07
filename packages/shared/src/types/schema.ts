/**
 * JSON Schema types and schema validation result types for node I/O validation.
 */

// =============================================================================
// JSON Schema Types (draft-07 compatible subset)
// =============================================================================

/**
 * Primitive JSON Schema types.
 */
export type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

/**
 * JSON Schema type definition (draft-07 compatible subset).
 * Covers the most common schema patterns used in node I/O.
 */
export interface JSONSchema {
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

// =============================================================================
// Schema Compatibility Types
// =============================================================================

/**
 * Compatibility status for a connection.
 */
export type CompatibilityStatus = 'compatible' | 'warning' | 'error' | 'unknown';

/**
 * Type of compatibility issue.
 */
export type CompatibilityIssueType =
  | 'missing_field'
  | 'type_mismatch'
  | 'format_mismatch'
  | 'constraint_violation';

/**
 * A single compatibility issue (error or warning).
 */
export interface CompatibilityIssue {
  /** Type of issue */
  type: CompatibilityIssueType;

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
export interface SchemaCompatibilityResult {
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

// =============================================================================
// Node Schema Info Types
// =============================================================================

/**
 * Schema state for a node.
 */
export type SchemaState = 'defined' | 'unknown' | 'pending';

/**
 * Schema information for a node instance.
 */
export interface NodeSchemaInfo {
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

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response for node schema endpoint.
 * Alias for NodeSchemaInfo for API response semantics.
 */
export type NodeSchemaResponse = NodeSchemaInfo;

/**
 * Response for flow schemas endpoint.
 */
export interface FlowSchemasResponse {
  flowId: string;
  nodes: NodeSchemaInfo[];
}

/**
 * Request to validate a connection.
 */
export interface ValidateConnectionRequest {
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}

/**
 * Response for connection validation.
 */
export interface ValidateConnectionResponse {
  status: CompatibilityStatus;
  issues: CompatibilityIssue[];
  sourceSchema: JSONSchema | null;
  targetSchema: JSONSchema | null;
}

/**
 * Response for flow-level validation.
 */
export interface FlowValidationResponse {
  flowId: string;
  status: 'valid' | 'warnings' | 'errors';
  summary: {
    total: number;
    compatible: number;
    warnings: number;
    errors: number;
    unknown: number;
  };
  connections: ConnectionValidationResult[];
}

/**
 * Validation result for a single connection.
 */
export interface ConnectionValidationResult {
  connectionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: CompatibilityStatus;
  issues: CompatibilityIssue[];
}

/**
 * Node type schema information (for node type endpoint).
 */
export interface NodeTypeSchemaResponse {
  nodeType: string;
  inputSchema: JSONSchema | null;
  outputSchema: JSONSchema | null;
  hasDynamicInput: boolean;
  hasDynamicOutput: boolean;
}

/**
 * Request to resolve dynamic schema.
 */
export interface ResolveSchemaRequest {
  /** Sample request configuration (for making the actual API call) */
  sampleRequest?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
  /** Sample response data to infer schema from (JSON string or object) */
  sampleResponse?: unknown;
}

/**
 * Response for schema resolution.
 */
export interface ResolveSchemaResponse {
  nodeId: string;
  resolved: boolean;
  outputSchema: JSONSchema | null;
  error?: string;
}

// =============================================================================
// Flattened Schema Types (for UI display)
// =============================================================================

/**
 * Source indicator for schema fields.
 * - 'static': Always present on the node type regardless of configuration
 * - 'dynamic': Generated from user configuration (e.g., parameters on trigger nodes)
 */
export type FieldSource = 'static' | 'dynamic';

/**
 * A flattened schema field for UI display (e.g., in "Use Previous Outputs" dropdown).
 * Converts nested JSON Schema properties into a flat list with dot-notation paths.
 */
export interface FlattenedSchemaField {
  /** Dot notation path to the field (e.g., "response.data.items") */
  path: string;

  /** JSON Schema type (e.g., "string", "number", "object", "array") */
  type: string;

  /** Human-readable description (from JSON Schema description) */
  description?: string;

  /** Source of the field - static (always present) or dynamic (from user config) */
  source?: FieldSource;

  /** Whether the field is required in the schema */
  required: boolean;
}
