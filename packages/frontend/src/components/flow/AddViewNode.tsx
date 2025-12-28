import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Plus, Layout } from 'lucide-react';

export interface AddViewNodeData extends Record<string, unknown> {
  onClick: () => void;
}

/**
 * Placeholder React Flow node for adding the first view
 * Displayed when a flow has user intent but no views
 * Positioned to the right of the UserIntentNode with a connecting edge
 */
export function AddViewNode({ data }: NodeProps) {
  const { onClick } = data as AddViewNodeData;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-primary shadow-sm hover:shadow-md transition-all w-[180px] cursor-pointer group nopan"
    >
      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <div className="relative">
              <Layout className="w-5 h-5 text-gray-400 group-hover:text-primary" />
              <Plus className="w-3 h-3 text-gray-600 group-hover:text-primary absolute -top-1 -right-1 bg-gray-100 group-hover:bg-primary/20 rounded-full" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center">
            <h3 className="font-medium text-gray-600 group-hover:text-primary text-sm transition-colors">
              Add first view
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Create your first view
            </p>
          </div>
        </div>
      </div>

      {/* Left handle for incoming connection from UserIntent */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-300 !w-2 !h-2 !border-0"
      />

      {/* Right handle for future connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-300 !w-2 !h-2 !border-0 opacity-0"
      />
    </div>
  );
}
