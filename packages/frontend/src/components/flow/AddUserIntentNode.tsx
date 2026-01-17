import { memo } from 'react';
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
export const AddUserIntentNode = memo(function AddUserIntentNode({ data }: NodeProps) {
  const { onClick } = data as AddUserIntentNodeData;

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="bg-white rounded-lg border-2 border-dashed border-blue-300 hover:border-blue-500 shadow-sm hover:shadow-md transition-shadow transition-colors w-[200px] cursor-pointer group nopan nodrag text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-12 h-12 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
            <div className="relative">
              <MessageCircle className="w-6 h-6 text-blue-400 group-hover:text-blue-500" />
              <Plus className="w-3 h-3 text-blue-600 absolute -top-1 -right-1 bg-blue-100 rounded-full" aria-hidden="true" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center">
            <span className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors block">
              Add user intent
            </span>
            <span className="text-xs text-gray-400 mt-1 block">
              Define what user intent detection will trigger this flow
            </span>
          </div>
        </div>
      </div>

      {/* Right handle for future connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-300 !w-2 !h-2 !border-0 opacity-0"
      />
    </button>
  );
});
