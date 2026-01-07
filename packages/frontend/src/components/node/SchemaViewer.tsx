import { useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { JSONSchema } from '@chatgpt-app-builder/shared';
import {
  formatSchemaForDisplay,
  getTypeColor,
  type SchemaFieldInfo,
} from '../../lib/schemaUtils';

interface SchemaViewerProps {
  schema: JSONSchema | null;
  title?: string;
  emptyMessage?: string;
  defaultExpanded?: boolean;
}

interface FieldRowProps {
  field: SchemaFieldInfo;
  depth?: number;
}

function FieldRow({ field, depth = 0 }: FieldRowProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = field.nested && field.nested.length > 0;
  const paddingLeft = depth * 16 + 8;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-gray-50 transition-colors"
        style={{ paddingLeft }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-500" />
            )}
          </button>
        ) : field.truncated ? (
          <span title="Nested content truncated (depth limit reached)">
            <MoreHorizontal className="w-3 h-3 text-gray-400" />
          </span>
        ) : (
          <span className="w-4" />
        )}

        <span className="text-sm font-mono text-gray-800">
          {field.name}
          {field.required && <span className="text-red-500">*</span>}
        </span>

        <span
          className={`px-1.5 py-0.5 text-xs rounded font-medium ${getTypeColor(field.type)}`}
        >
          {field.isArray ? `${field.arrayItemType || 'any'}[]` : field.type}
        </span>

        {field.format && (
          <span className="text-xs text-gray-500">({field.format})</span>
        )}

        {/* Static/Dynamic source badge (T027, T028) */}
        {field.source && (
          <span
            className={`px-1.5 py-0.5 text-xs rounded font-medium ${
              field.source === 'static'
                ? 'bg-gray-100 text-gray-600'  // T027: muted gray for static
                : 'bg-blue-100 text-blue-700'  // T028: highlighted blue for dynamic
            }`}
            title={field.source === 'static' ? 'Static field (always present)' : 'Dynamic field (from parameters)'}
          >
            {field.source === 'static' ? 'Static' : 'From Parameters'}
          </span>
        )}

        {field.truncated && (
          <span className="text-xs text-gray-400 italic" title="Depth limit reached">
            (nested)
          </span>
        )}

        {field.description && (
          <span className="text-xs text-gray-400 truncate" title={field.description}>
            {field.description}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {field.nested!.map((child, index) => (
            <FieldRow key={`${child.name}-${index}`} field={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaViewer({
  schema,
  title,
  emptyMessage = 'No schema defined',
  defaultExpanded = true,
}: SchemaViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!schema) {
    return (
      <div className="text-sm text-gray-400 italic py-2">
        {emptyMessage}
      </div>
    );
  }

  const fields = formatSchemaForDisplay(schema);

  if (fields.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-2">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      {title && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700">{title}</span>
          <span className="text-xs text-gray-400">
            ({fields.length} field{fields.length !== 1 ? 's' : ''})
          </span>
        </button>
      )}

      {(!title || isExpanded) && (
        <div className="divide-y divide-gray-100">
          {fields.map((field, index) => (
            <FieldRow key={`${field.name}-${index}`} field={field} />
          ))}
        </div>
      )}
    </div>
  );
}
