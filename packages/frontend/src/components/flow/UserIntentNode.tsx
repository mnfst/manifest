import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { Flow } from '@chatgpt-app-builder/shared';
import { MessageCircle, Pencil } from 'lucide-react';

export interface UserIntentNodeData extends Record<string, unknown> {
  flow: Flow;
  onEdit: () => void;
}

/**
 * Custom React Flow node for displaying user intent configuration
 * Shows the trigger that initiates the flow with chat bubble icon and blue accent
 * Square card design matching placeholder nodes
 */
export function UserIntentNode({ data }: NodeProps) {
  const { flow, onEdit } = data as UserIntentNodeData;

  // Truncate description for display
  const displayDescription = flow.toolDescription
    ? flow.toolDescription.length > 60
      ? flow.toolDescription.substring(0, 60) + '...'
      : flow.toolDescription
    : 'Click to configure';

  return (
    <div className="bg-white rounded-lg border-2 border-blue-200 hover:border-blue-400 shadow-sm hover:shadow-md transition-all w-[200px] nopan">
      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-blue-500" />
          </div>

          {/* Node info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">User Intent</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{displayDescription}</p>
          </div>

          {/* Edit button */}
          <button
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
        </div>
      </div>

      {/* Right handle for outgoing connections only */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-400 !w-2 !h-2 !border-0"
      />
    </div>
  );
}
