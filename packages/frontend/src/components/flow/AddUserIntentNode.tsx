import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Plus, MessageCircle } from 'lucide-react';

export interface AddUserIntentNodeData extends Record<string, unknown> {
  onClick: () => void;
}

/**
 * Placeholder React Flow node for adding user intent
 * Displayed when a flow has no toolDescription set
 * Centered in the canvas with "+" icon and "Add user intent" text
 */
export function AddUserIntentNode({ data }: NodeProps) {
  const { onClick } = data as AddUserIntentNodeData;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="bg-white rounded-lg border-2 border-dashed border-blue-300 hover:border-blue-500 shadow-sm hover:shadow-md transition-all w-[200px] cursor-pointer group nopan"
    >
      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-12 h-12 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
            <div className="relative">
              <MessageCircle className="w-6 h-6 text-blue-400 group-hover:text-blue-500" />
              <Plus className="w-3 h-3 text-blue-600 absolute -top-1 -right-1 bg-blue-100 rounded-full" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center">
            <h3 className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
              Add user intent
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Define how AI will use this tool
            </p>
          </div>
        </div>
      </div>

      {/* Right handle for future connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-300 !w-2 !h-2 !border-0 opacity-0"
      />
    </div>
  );
}
