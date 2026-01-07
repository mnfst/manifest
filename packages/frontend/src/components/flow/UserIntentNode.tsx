import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { NodeInstance, UserIntentNodeParameters, NodeType } from '@chatgpt-app-builder/shared';
import { Zap, Pencil } from 'lucide-react';
import { AddNodeButton } from './AddNodeButton';

export interface UserIntentNodeData extends Record<string, unknown> {
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
 * Custom React Flow node for displaying user intent trigger configuration
 * Shows the trigger that initiates the flow with zap icon and blue accent
 * Trigger nodes only have output handles (no incoming connections)
 */
export function UserIntentNode({ data }: NodeProps) {
  const { node, canDelete, onEdit, onDelete, onAddFromNode, onDropOnNode } = data as UserIntentNodeData;
  const params = node.parameters as unknown as UserIntentNodeParameters | undefined;

  // Show toolName if available
  const toolName = params?.toolName;
  const isActive = params?.isActive !== false;

  // Show toolDescription or whenToUse if available
  const displayDescription = params?.toolDescription
    ? params.toolDescription.length > 60
      ? params.toolDescription.substring(0, 60) + '...'
      : params.toolDescription
    : params?.whenToUse
      ? params.whenToUse.length > 60
        ? params.whenToUse.substring(0, 60) + '...'
        : params.whenToUse
      : 'Click to configure trigger';

  // Get slug for tooltip display (T034)
  const slug = node.slug || node.id;

  return (
    <div
      className={`bg-white rounded-lg border-2 ${isActive ? 'border-blue-200 hover:border-blue-400' : 'border-gray-300 hover:border-gray-400 opacity-75'} shadow-sm hover:shadow-md transition-all w-[200px] nopan`}
      title={`Slug: ${slug}\nUse {{ ${slug}.fieldName }} to reference outputs`}
    >
      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className={`w-12 h-12 rounded-full ${isActive ? 'bg-blue-50' : 'bg-gray-100'} flex items-center justify-center`}>
            <Zap className={`w-6 h-6 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>

          {/* Node info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">{node.name || 'User Intent'}</h3>
            {/* Tool name badge */}
            {toolName && (
              <code className={`inline-block mt-1 px-2 py-0.5 text-xs font-mono rounded ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {toolName}
              </code>
            )}
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{displayDescription}</p>
            {!isActive && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                Inactive
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              data-action="edit"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors nodrag"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            {canDelete && (
              <button
                data-action="delete"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors nodrag"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right handle for outgoing connections only - trigger nodes have no input handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="main"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-200"
      />

      {/* "+" button for adding connected nodes */}
      {onAddFromNode && (
        <AddNodeButton
          onClick={onAddFromNode}
          onDrop={onDropOnNode}
          color="blue"
        />
      )}
    </div>
  );
}
