import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Square, Code2 } from 'lucide-react';
import type { NodeInstance, BlankComponentNodeParameters } from '@chatgpt-app-builder/shared';
import { ViewNodeDropdown } from './ViewNodeDropdown';

interface BlankComponentNodeData {
  node: NodeInstance;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onEditCode?: () => void;
}

/**
 * React Flow node component for BlankComponent
 * Displays a customizable UI component template with edit/delete/editCode actions
 */
function BlankComponentNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as BlankComponentNodeData;
  const { node, canDelete, onEdit, onDelete, onEditCode } = nodeData;

  // Get parameters from the node
  const params = node?.parameters as unknown as BlankComponentNodeParameters | undefined;
  const nodeName = node?.name || 'Blank Component';

  // Check if there's custom code
  const hasCustomCode = params?.customCode && params.customCode.length > 0;

  return (
    <div
      className={`
        bg-white rounded-lg border-2 shadow-sm hover:shadow-md transition-colors transition-shadow w-[200px] nopan
        ${selected ? 'border-primary shadow-md' : 'border-amber-200 hover:border-amber-400'}
      `}
    >
      {/* Input handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-amber-400 !w-3 !h-3 !border-2 !border-amber-200"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Square className="w-6 h-6 text-amber-600" />
          </div>

          {/* Node info */}
          <div className="text-center w-full">
            {/* Main text: User-chosen node name */}
            <h3 className="font-medium text-gray-900 text-sm truncate max-w-[180px]" title={nodeName}>
              {nodeName}
            </h3>
            {/* Subtitle: Component type with custom code indicator */}
            <div className="flex items-center justify-center gap-1 mt-1">
              <p className="text-xs text-gray-500">Blank Component</p>
              {hasCustomCode && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                  title="Has custom code"
                >
                  <Code2 className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <ViewNodeDropdown
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            onEditCode={onEditCode}
          />
        </div>
      </div>

      {/* Output handle for connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="main"
        className="!bg-amber-400 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

export const BlankComponentNode = memo(BlankComponentNodeComponent);
