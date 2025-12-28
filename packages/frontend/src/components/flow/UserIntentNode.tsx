import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { Flow } from '@chatgpt-app-builder/shared';

export interface UserIntentNodeData extends Record<string, unknown> {
  flow: Flow;
  onEdit: () => void;
}

/**
 * Custom React Flow node for displaying user intent configuration
 * Shows the trigger that initiates the flow with chat bubble icon and blue accent
 */
export function UserIntentNode({ data }: NodeProps) {
  const { flow, onEdit } = data as UserIntentNodeData;

  // Truncate description for display
  const displayDescription = flow.toolDescription
    ? flow.toolDescription.length > 50
      ? flow.toolDescription.substring(0, 50) + '...'
      : flow.toolDescription
    : 'Click to configure';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all w-[180px] nopan">
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Chat bubble icon with blue accent */}
          <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-blue-600"
            >
              <path
                fillRule="evenodd"
                d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97zM6.75 8.25a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H7.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Node info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 text-sm">User Intent</h3>
            <p className="text-xs text-gray-500 truncate">{displayDescription}</p>
          </div>

          {/* Edit button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit user intent"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
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
