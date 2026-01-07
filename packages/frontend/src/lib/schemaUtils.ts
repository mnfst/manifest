import type { JSONSchema, JSONSchemaType } from '@chatgpt-app-builder/shared';

/**
 * Schema field display information for UI rendering.
 */
export interface SchemaFieldInfo {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  format?: string;
  nested?: SchemaFieldInfo[];
  isArray: boolean;
  arrayItemType?: string;
  /** True if nested children were truncated due to depth limit */
  truncated?: boolean;
}

/**
 * Format a JSON Schema type to a human-readable string.
 */
export function formatType(type: JSONSchemaType | JSONSchemaType[] | undefined): string {
  if (!type) return 'any';
  if (Array.isArray(type)) {
    return type.join(' | ');
  }
  return type;
}

/**
 * Get a short summary of a field from its schema.
 */
export function getFieldSummary(schema: JSONSchema): string {
  const parts: string[] = [];

  // Type
  parts.push(formatType(schema.type));

  // Enum
  if (schema.enum) {
    parts.push(`(${schema.enum.map(String).join(' | ')})`);
  }

  // Const
  if (schema.const !== undefined) {
    parts.push(`= ${JSON.stringify(schema.const)}`);
  }

  // Format
  if (schema.format) {
    parts.push(`[${schema.format}]`);
  }

  return parts.join(' ');
}

/**
 * Extract field information from a JSON Schema for display.
 */
export function extractFieldInfo(
  name: string,
  schema: JSONSchema,
  required: boolean,
  depth = 0,
  maxDepth = 5
): SchemaFieldInfo {
  const result: SchemaFieldInfo = {
    name,
    type: formatType(schema.type),
    required,
    description: schema.description,
    format: schema.format,
    isArray: schema.type === 'array',
    nested: undefined,
    truncated: false,
  };

  // Handle array items
  if (schema.type === 'array' && schema.items && !Array.isArray(schema.items)) {
    const itemSchema = schema.items;
    result.arrayItemType = formatType(itemSchema.type);

    // If array items are objects, extract their fields
    if (itemSchema.type === 'object' && itemSchema.properties) {
      if (depth < maxDepth) {
        const itemRequiredFields = itemSchema.required ?? [];
        result.nested = Object.entries(itemSchema.properties).map(([key, propSchema]) =>
          extractFieldInfo(
            key,
            propSchema as JSONSchema,
            itemRequiredFields.includes(key),
            depth + 1,
            maxDepth
          )
        );
      } else {
        // Depth limit reached
        result.truncated = true;
      }
    }
  }

  // Handle nested object properties
  if (schema.type === 'object' && schema.properties) {
    if (depth < maxDepth) {
      const requiredFields = schema.required ?? [];
      result.nested = Object.entries(schema.properties).map(([key, propSchema]) =>
        extractFieldInfo(
          key,
          propSchema as JSONSchema,
          requiredFields.includes(key),
          depth + 1,
          maxDepth
        )
      );
    } else {
      // Depth limit reached
      result.truncated = true;
    }
  }

  return result;
}

/**
 * Format a JSON Schema for display, extracting all field information.
 */
export function formatSchemaForDisplay(schema: JSONSchema | null): SchemaFieldInfo[] {
  if (!schema) return [];

  // For object schemas, extract all properties
  if (schema.type === 'object' && schema.properties) {
    const requiredFields = schema.required ?? [];
    return Object.entries(schema.properties).map(([name, propSchema]) =>
      extractFieldInfo(name, propSchema as JSONSchema, requiredFields.includes(name))
    );
  }

  // For array schemas, show item schema
  if (schema.type === 'array' && schema.items && !Array.isArray(schema.items)) {
    return [extractFieldInfo('items', schema.items as JSONSchema, false)];
  }

  // For primitive schemas, return the whole schema as a single field
  return [
    {
      name: 'value',
      type: formatType(schema.type),
      required: true,
      description: schema.description,
      format: schema.format,
      isArray: false,
    },
  ];
}

/**
 * Get a color class for a type badge.
 */
export function getTypeColor(type: string): string {
  switch (type) {
    case 'string':
      return 'bg-green-100 text-green-800';
    case 'number':
    case 'integer':
      return 'bg-blue-100 text-blue-800';
    case 'boolean':
      return 'bg-purple-100 text-purple-800';
    case 'object':
      return 'bg-orange-100 text-orange-800';
    case 'array':
      return 'bg-yellow-100 text-yellow-800';
    case 'null':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get a user-friendly label for a schema state.
 */
export function getSchemaStateLabel(state: 'defined' | 'unknown' | 'pending' | null): string {
  switch (state) {
    case 'defined':
      return 'Defined';
    case 'unknown':
      return 'Unknown';
    case 'pending':
      return 'Pending';
    default:
      return 'N/A';
  }
}

/**
 * Get a color class for a schema state badge.
 */
export function getSchemaStateColor(state: 'defined' | 'unknown' | 'pending' | null): string {
  switch (state) {
    case 'defined':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
