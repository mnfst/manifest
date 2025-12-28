import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { View } from '@chatgpt-app-builder/shared';
import { LayoutGrid, FileText } from 'lucide-react';
import { ViewNodeDropdown } from './ViewNodeDropdown';

export interface ViewNodeData extends Record<string, unknown> {
  view: View;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Custom React Flow node for displaying a view
 * Square card design matching placeholder nodes
 */
export function ViewNode({ data }: NodeProps) {
  const { view, canDelete, onEdit, onDelete } = data as ViewNodeData;

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 hover:border-gray-400 shadow-sm hover:shadow-md transition-all w-[200px] nopan">
      {/* Left handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            {view.layoutTemplate === 'table' ? (
              <LayoutGrid className="w-6 h-6 text-gray-500" />
            ) : (
              <FileText className="w-6 h-6 text-gray-500" />
            )}
          </div>

          {/* View info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              {view.name || 'Untitled View'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{view.layoutTemplate}</p>
          </div>

          {/* Action buttons */}
          <ViewNodeDropdown canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Right handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />
    </div>
  );
}
