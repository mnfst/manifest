import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { NodeInstance, ApiCallNodeParameters, NodeType } from '@chatgpt-app-builder/shared';
import { Globe } from 'lucide-react';
import { ViewNodeDropdown } from './ViewNodeDropdown';
import { AddNodeButton } from './AddNodeButton';

export interface ApiCallNodeData extends Record<string, unknown> {
  node: NodeInstance;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** Handler for "+" button click */
  onAddFromNode?: () => void;
  /** Handler for dropping a node type on the "+" button */
  onDropOnNode?: (nodeType: NodeType) => void;
}

/**
 * Custom React Flow node for displaying an API Call node.
 * Orange-themed card design with left input handle and right output handle.
 * Displays the HTTP method and URL in a compact format.
 */
export function ApiCallNode({ data }: NodeProps) {
  const { node, canDelete, onEdit, onDelete, onAddFromNode, onDropOnNode } = data as ApiCallNodeData;

  // Get parameters with type safety
  const params = node.parameters as unknown as ApiCallNodeParameters;
  const method = params?.method || 'GET';
  const url = params?.url || '';

  // Truncate URL for display
  const displayUrl = url.length > 30 ? url.substring(0, 30) + '...' : url || 'No URL configured';

  // Get slug for tooltip display (T034)
  const slug = node.slug || node.id;

  return (
    <div
      className="bg-white rounded-lg border-2 border-orange-200 hover:border-orange-400 shadow-sm hover:shadow-md transition-colors transition-shadow w-[200px] nopan"
      title={`Slug: ${slug}\nUse {{ ${slug}.fieldName }} to reference outputs`}
    >
      {/* Left handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-orange-400 !w-3 !h-3 !border-2 !border-orange-200"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <Globe className="w-6 h-6 text-orange-600" />
          </div>

          {/* Node info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              {node.name || 'Untitled API Call'}
            </h3>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                {method}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate" title={url}>
              {displayUrl}
            </p>
          </div>

          {/* Action buttons */}
          <ViewNodeDropdown canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Right handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!bg-orange-400 !w-3 !h-3 !border-2 !border-orange-200"
      />

      {/* "+" button for adding connected nodes */}
      {onAddFromNode && (
        <AddNodeButton
          onClick={onAddFromNode}
          onDrop={onDropOnNode}
          color="orange"
        />
      )}
    </div>
  );
}
