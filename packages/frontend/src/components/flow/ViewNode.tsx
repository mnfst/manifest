import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { View } from '@chatgpt-app-builder/shared';
import { ViewNodeDropdown } from './ViewNodeDropdown';

export interface ViewNodeData extends Record<string, unknown> {
  view: View;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Custom React Flow node for displaying a view
 * Matches the styling of ViewCard component
 */
export function ViewNode({ data }: NodeProps) {
  const { view, canDelete, onEdit, onDelete } = data as ViewNodeData;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all w-[180px] nopan">
      {/* Left handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />

      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Layout icon */}
          <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
            {view.layoutTemplate === 'table' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4 text-gray-500"
              >
                <path
                  fillRule="evenodd"
                  d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 18.375V5.625zM21 9.375A.375.375 0 0020.625 9h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zm0 3.75a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zm0 3.75a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zM10.875 18.75a.375.375 0 00.375-.375v-1.5a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5zM3.375 15h7.5a.375.375 0 00.375-.375v-1.5a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375zm0-3.75h7.5a.375.375 0 00.375-.375v-1.5A.375.375 0 0010.875 9h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4 text-gray-500"
              >
                <path
                  fillRule="evenodd"
                  d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 003 3h15a3 3 0 01-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125zM12 9.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H12zm-.75-2.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H12a.75.75 0 01-.75-.75zM6 12.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5H6zm-.75 3.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5H6a.75.75 0 01-.75-.75zM6 6.75a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 00.75-.75v-3A.75.75 0 009 6.75H6z"
                  clipRule="evenodd"
                />
                <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 01-3 0V6.75z" />
              </svg>
            )}
          </div>

          {/* View info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 text-sm truncate">
              {view.name || 'Untitled View'}
            </h3>
            <p className="text-xs text-gray-500">{view.layoutTemplate}</p>
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
