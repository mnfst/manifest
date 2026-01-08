import type { JSONSchema } from '@chatgpt-app-builder/shared';
import { ChevronDown, ChevronRight, Hash, ToggleLeft, Type, List, Braces, HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface SchemaPreviewProps {
  /** The JSON Schema to preview */
  schema: JSONSchema | null | undefined;
  /** Title for the preview panel */
  title?: string;
  /** Whether to start expanded */
  defaultExpanded?: boolean;
}

/**
 * Get icon for a JSON Schema type.
 */
function getTypeIcon(type: string | string[] | undefined) {
  if (Array.isArray(type)) {
    return <HelpCircle className="w-3.5 h-3.5 text-gray-400" />;
  }

  switch (type) {
    case 'string':
      return <Type className="w-3.5 h-3.5 text-blue-500" />;
    case 'number':
    case 'integer':
      return <Hash className="w-3.5 h-3.5 text-green-500" />;
    case 'boolean':
      return <ToggleLeft className="w-3.5 h-3.5 text-purple-500" />;
    case 'array':
      return <List className="w-3.5 h-3.5 text-orange-500" />;
    case 'object':
      return <Braces className="w-3.5 h-3.5 text-teal-500" />;
    default:
      return <HelpCircle className="w-3.5 h-3.5 text-gray-400" />;
  }
}

/**
 * Get human-readable type label.
 */
function getTypeLabel(schema: JSONSchema): string {
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      return schema.type.join(' | ');
    }
    return schema.type;
  }
  if (schema.enum) {
    return 'enum';
  }
  if (schema.anyOf || schema.oneOf) {
    return 'union';
  }
  return 'any';
}

interface SchemaPropertyProps {
  name: string;
  schema: JSONSchema;
  required?: boolean;
  depth?: number;
}

/**
 * Render a single schema property with expandable children.
 */
function SchemaProperty({ name, schema, required = false, depth = 0 }: SchemaPropertyProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = schema.properties || (schema.items && typeof schema.items === 'object');
  const typeLabel = getTypeLabel(schema);

  return (
    <div className="text-sm">
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 ${
          hasChildren ? 'cursor-pointer' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-3" />
        )}
        {getTypeIcon(schema.type)}
        <span className="font-medium text-gray-700">{name}</span>
        <span className="text-gray-400">:</span>
        <span className="text-gray-500">{typeLabel}</span>
        {required && (
          <span className="text-xs text-red-500 font-medium">required</span>
        )}
        {schema.format && (
          <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
            {schema.format}
          </span>
        )}
      </div>

      {isExpanded && schema.properties && (
        <div>
          {Object.entries(schema.properties).map(([propName, propSchema]) => (
            <SchemaProperty
              key={propName}
              name={propName}
              schema={propSchema as JSONSchema}
              required={schema.required?.includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {isExpanded && schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items) && (
        <SchemaProperty
          name="[items]"
          schema={schema.items}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

/**
 * SchemaPreview component for displaying JSON Schema visually.
 * Shows a collapsible tree view of the schema structure.
 */
export function SchemaPreview({
  schema,
  title = 'Output Schema',
  defaultExpanded = true,
}: SchemaPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!schema) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <HelpCircle className="w-4 h-4" />
          <span>No schema available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="font-medium text-gray-700">{title}</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
          {getTypeLabel(schema)}
        </span>
      </button>

      {isExpanded && (
        <div className="p-2 max-h-64 overflow-y-auto">
          {schema.properties ? (
            Object.entries(schema.properties).map(([name, propSchema]) => (
              <SchemaProperty
                key={name}
                name={name}
                schema={propSchema as JSONSchema}
                required={schema.required?.includes(name)}
              />
            ))
          ) : schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items) ? (
            <SchemaProperty name="[items]" schema={schema.items} />
          ) : (
            <div className="px-2 py-1 text-sm text-gray-500">
              {getTypeIcon(schema.type)}
              <span className="ml-2">{getTypeLabel(schema)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
