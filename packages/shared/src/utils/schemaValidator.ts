/**
 * Schema validation utilities for node I/O compatibility checking.
 *
 * NOTE: The Ajv-based runtime validation (validateDataAgainstSchema, getAjv) is only
 * available in Node.js environments. The schema compatibility checking functions
 * (checkSchemaCompatibility, flowParametersToSchema, etc.) work in both Node and browser.
 */

import type {
  JSONSchema,
  CompatibilityStatus,
  CompatibilityIssue,
  SchemaCompatibilityResult,
} from '../types/schema.js';
import type { FlowParameter, ParameterType } from '../types/flow.js';

// =============================================================================
// Ajv Instance (lazy-loaded, Node.js only)
// =============================================================================

// Types for the Ajv instance
interface AjvInstance {
  compile: (schema: JSONSchema) => ValidateFunction;
}

interface ValidateFunction {
  (data: unknown): boolean;
  errors?: Array<{ instancePath: string; message?: string }> | null;
}

let ajvInstance: AjvInstance | null = null;
let ajvLoadError: Error | null = null;

/**
 * Get or create the Ajv validator instance.
 * Only available in Node.js environments.
 * @throws Error if called in browser environment
 */
async function getAjvAsync(): Promise<AjvInstance> {
  if (ajvLoadError) {
    throw ajvLoadError;
  }

  if (ajvInstance) {
    return ajvInstance;
  }

  try {
    // Dynamic imports for Ajv - works in Node.js, will fail in browser
    const [AjvModule, addFormatsModule] = await Promise.all([
      import('ajv'),
      import('ajv-formats'),
    ]);

    // Handle CJS/ESM interop
    const AjvClass = (AjvModule as unknown as { default: { default?: new (opts?: object) => AjvInstance } }).default.default ??
      (AjvModule as unknown as { default: new (opts?: object) => AjvInstance }).default;
    const addFormats = (addFormatsModule as unknown as { default: { default?: (ajv: AjvInstance) => void } }).default.default ??
      (addFormatsModule as unknown as { default: (ajv: AjvInstance) => void }).default;

    ajvInstance = new AjvClass({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(ajvInstance);

    return ajvInstance;
  } catch (error) {
    ajvLoadError = error instanceof Error ? error : new Error('Failed to load Ajv');
    throw ajvLoadError;
  }
}

/**
 * Synchronous getter for cached Ajv instance.
 * Returns null if Ajv hasn't been loaded yet.
 */
function getAjv(): AjvInstance | null {
  return ajvInstance;
}

// =============================================================================
// Type Coercion Rules
// =============================================================================

/**
 * Type coercion rules: maps source type to target types that can be coerced.
 * Keys are source types, values are arrays of target types that can accept the source.
 */
const TYPE_COERCION_RULES: Record<string, string[]> = {
  // Numbers can be coerced to strings
  number: ['string'],
  integer: ['string', 'number'],
  // Booleans can be coerced to strings
  boolean: ['string'],
  // Strings can sometimes be coerced (warning, not error)
  string: ['number', 'integer', 'boolean'],
};

/**
 * Check if a source type can be coerced to a target type.
 * Returns 'safe' for safe coercions, 'unsafe' for risky coercions, null if incompatible.
 */
function checkTypeCoercion(
  sourceType: string,
  targetType: string
): 'safe' | 'unsafe' | null {
  if (sourceType === targetType) {
    return 'safe';
  }

  const coercibleTo = TYPE_COERCION_RULES[sourceType];
  if (coercibleTo?.includes(targetType)) {
    // Number/integer/boolean to string is safe
    if (
      (sourceType === 'number' ||
        sourceType === 'integer' ||
        sourceType === 'boolean') &&
      targetType === 'string'
    ) {
      return 'safe';
    }
    // Integer to number is safe
    if (sourceType === 'integer' && targetType === 'number') {
      return 'safe';
    }
    // String to number/integer/boolean is unsafe (may fail at runtime)
    return 'unsafe';
  }

  return null;
}

// =============================================================================
// Schema Compatibility Checking
// =============================================================================

/**
 * Check compatibility between a source output schema and target input schema.
 *
 * Rules:
 * 1. If either schema is null/undefined, status is 'unknown'
 * 2. All required fields in target must exist in source
 * 3. Field types must match or be safely coercible
 * 4. Extra fields in source are allowed (structural subtyping)
 */
export function checkSchemaCompatibility(
  sourceSchema: JSONSchema | null | undefined,
  targetSchema: JSONSchema | null | undefined
): SchemaCompatibilityResult {
  const now = new Date().toISOString();

  // Handle unknown schemas
  if (!sourceSchema || !targetSchema) {
    return {
      status: 'unknown',
      issues: [],
      sourceSchema: sourceSchema ?? null,
      targetSchema: targetSchema ?? null,
      validatedAt: now,
    };
  }

  const issues: CompatibilityIssue[] = [];

  // Check required fields
  const targetRequired = targetSchema.required ?? [];
  const sourceProperties = sourceSchema.properties ?? {};
  const targetProperties = targetSchema.properties ?? {};

  // Check each required field in target exists in source
  for (const field of targetRequired) {
    if (!(field in sourceProperties)) {
      issues.push({
        type: 'missing_field',
        severity: 'error',
        path: field,
        message: `Required field '${field}' is missing from source output`,
      });
    }
  }

  // Check type compatibility for matching fields
  for (const [field, targetFieldSchema] of Object.entries(targetProperties)) {
    const sourceFieldSchema = sourceProperties[field];

    if (!sourceFieldSchema) {
      // Field not in source - only an error if required (already checked above)
      continue;
    }

    // Check type compatibility
    const sourceType = getSchemaType(sourceFieldSchema);
    const targetType = getSchemaType(targetFieldSchema);

    if (sourceType && targetType && sourceType !== targetType) {
      const coercion = checkTypeCoercion(sourceType, targetType);

      if (coercion === 'unsafe') {
        issues.push({
          type: 'type_mismatch',
          severity: 'warning',
          path: field,
          message: `Type coercion: '${field}' is ${sourceType} in source, ${targetType} in target - may fail at runtime`,
          sourceValue: sourceType,
          targetValue: targetType,
        });
      } else if (coercion === null) {
        issues.push({
          type: 'type_mismatch',
          severity: 'error',
          path: field,
          message: `Type mismatch: '${field}' is ${sourceType} in source, expected ${targetType}`,
          sourceValue: sourceType,
          targetValue: targetType,
        });
      }
      // 'safe' coercion - no issue
    }

    // Check format compatibility (warning only)
    const sourceFormat = (sourceFieldSchema as JSONSchema).format;
    const targetFormat = (targetFieldSchema as JSONSchema).format;
    if (targetFormat && sourceFormat && sourceFormat !== targetFormat) {
      issues.push({
        type: 'format_mismatch',
        severity: 'warning',
        path: field,
        message: `Format mismatch: '${field}' has format '${sourceFormat}' in source, expected '${targetFormat}'`,
        sourceValue: sourceFormat,
        targetValue: targetFormat,
      });
    }
  }

  // Determine overall status
  let status: CompatibilityStatus = 'compatible';
  const hasErrors = issues.some((i) => i.severity === 'error');
  const hasWarnings = issues.some((i) => i.severity === 'warning');

  if (hasErrors) {
    status = 'error';
  } else if (hasWarnings) {
    status = 'warning';
  }

  return {
    status,
    issues,
    sourceSchema,
    targetSchema,
    validatedAt: now,
  };
}

/**
 * Get the primary type from a JSON Schema.
 */
function getSchemaType(schema: JSONSchema): string | null {
  if (!schema.type) {
    return null;
  }
  if (Array.isArray(schema.type)) {
    // Return first non-null type
    return schema.type.find((t) => t !== 'null') ?? null;
  }
  return schema.type;
}

// =============================================================================
// FlowParameter to JSONSchema Conversion
// =============================================================================

/**
 * Convert a ParameterType to JSONSchema type.
 */
function parameterTypeToSchemaType(
  paramType: ParameterType
): JSONSchema['type'] {
  switch (paramType) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

/**
 * Convert an array of FlowParameter to JSONSchema properties.
 * Used for dynamic schema generation from UserIntent parameters.
 */
export function flowParametersToSchema(
  parameters: FlowParameter[]
): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const param of parameters) {
    properties[param.name] = {
      type: parameterTypeToSchemaType(param.type),
      description: param.description,
    };

    if (!param.optional) {
      required.push(param.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Create a complete UserIntent output schema including static fields and dynamic parameters.
 */
export function createUserIntentOutputSchema(
  parameters: FlowParameter[] = []
): JSONSchema {
  const paramSchema = flowParametersToSchema(parameters);

  // Merge with static trigger fields
  const staticProperties: Record<string, JSONSchema> = {
    type: { type: 'string', const: 'trigger' },
    triggered: { type: 'boolean' },
    toolName: { type: 'string' },
  };

  const staticRequired = ['type', 'triggered', 'toolName'];

  return {
    type: 'object',
    properties: {
      ...staticProperties,
      ...(paramSchema.properties ?? {}),
    },
    required: [...staticRequired, ...(paramSchema.required ?? [])],
  };
}

// =============================================================================
// Schema Validation (using Ajv - Node.js only)
// =============================================================================

/**
 * Validate data against a JSON Schema.
 * Returns null if valid, or an array of error messages if invalid.
 *
 * NOTE: This function is async and only available in Node.js environments.
 * It will throw an error if called in a browser.
 */
export async function validateDataAgainstSchema(
  data: unknown,
  schema: JSONSchema
): Promise<string[] | null> {
  const ajv = await getAjvAsync();
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return null;
  }

  return (
    validate.errors?.map(
      (err) => `${err.instancePath || '/'}: ${err.message}`
    ) ?? ['Unknown validation error']
  );
}

// =============================================================================
// Schema Inference from Sample Data
// =============================================================================

/**
 * Infer a JSON Schema from a sample JSON value.
 * Used for dynamic schema discovery from API responses.
 *
 * @param sample - The sample JSON value to infer schema from
 * @param maxDepth - Maximum depth to traverse (default: 5)
 */
export function inferSchemaFromSample(
  sample: unknown,
  maxDepth = 5
): JSONSchema {
  return inferSchemaRecursive(sample, 0, maxDepth);
}

/**
 * Recursive helper for schema inference.
 */
function inferSchemaRecursive(
  value: unknown,
  depth: number,
  maxDepth: number
): JSONSchema {
  if (depth >= maxDepth) {
    return {}; // Any type at max depth
  }

  if (value === null) {
    return { type: 'null' };
  }

  if (value === undefined) {
    return {};
  }

  const valueType = typeof value;

  switch (valueType) {
    case 'string':
      return inferStringSchema(value as string);

    case 'number':
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };

    case 'boolean':
      return { type: 'boolean' };

    case 'object':
      if (Array.isArray(value)) {
        return inferArraySchema(value, depth, maxDepth);
      }
      return inferObjectSchema(value as Record<string, unknown>, depth, maxDepth);

    default:
      return {};
  }
}

/**
 * Infer schema for a string value, detecting common formats.
 */
function inferStringSchema(value: string): JSONSchema {
  const schema: JSONSchema = { type: 'string' };

  // Check for common formats
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    schema.format = 'date-time';
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    schema.format = 'date';
  } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    schema.format = 'email';
  } else if (/^https?:\/\//.test(value)) {
    schema.format = 'uri';
  } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    schema.format = 'uuid';
  }

  return schema;
}

/**
 * Infer schema for an array value.
 */
function inferArraySchema(
  value: unknown[],
  depth: number,
  maxDepth: number
): JSONSchema {
  if (value.length === 0) {
    return { type: 'array' };
  }

  // Infer item schema from first element
  const itemSchema = inferSchemaRecursive(value[0], depth + 1, maxDepth);

  return {
    type: 'array',
    items: itemSchema,
  };
}

/**
 * Infer schema for an object value.
 */
function inferObjectSchema(
  value: Record<string, unknown>,
  depth: number,
  maxDepth: number
): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const [key, propValue] of Object.entries(value)) {
    properties[key] = inferSchemaRecursive(propValue, depth + 1, maxDepth);

    // All fields present in sample are considered required
    if (propValue !== null && propValue !== undefined) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

// =============================================================================
// Exports
// =============================================================================

export { getAjv, getAjvAsync };
