import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { NodeInstance, CallFlowNodeParameters } from '@chatgpt-app-builder/shared';
import { PhoneForwarded, Pencil, Trash2, MoreHorizontal, AlertCircle } from 'lucide-react';

export interface CallFlowNodeData extends Record<string, unknown> {
  node: NodeInstance;
  targetFlowName?: string;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Custom React Flow node for displaying a CallFlow node
 * Purple-themed card design to distinguish from Interface and Return nodes
 * No right-side handle as it's a terminal/end action
 */
export const CallFlowNode = memo(function CallFlowNode({ data }: NodeProps) {
  const { node, targetFlowName, canDelete, onEdit, onDelete } = data as CallFlowNodeData;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get parameters with type safety
  const params = node.parameters as unknown as CallFlowNodeParameters;
  const targetFlowId = params?.targetFlowId;

  const hasTarget = Boolean(targetFlowId && targetFlowName);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  return (
    <div className="bg-white rounded-lg border-2 border-purple-200 hover:border-purple-400 shadow-sm hover:shadow-md transition-colors transition-shadow w-[200px] nopan">
      {/* Left handle for incoming connections from UserIntent/other nodes */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-200"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            hasTarget ? 'bg-purple-100' : 'bg-amber-50'
          }`}>
            {hasTarget ? (
              <PhoneForwarded className="w-6 h-6 text-purple-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-500" />
            )}
          </div>

          {/* Call flow info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              {node.name || 'Call Flow'}
            </h3>
            {hasTarget ? (
              <p className="text-xs text-gray-500 mt-1 truncate" title={targetFlowName}>
                {targetFlowName}
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-1">
                {targetFlowId ? 'Target deleted' : 'Not configured'}
              </p>
            )}
          </div>

          {/* Action dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 nodrag"
              aria-label="Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 nodrag"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                {canDelete && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 nodrag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NO right handle - this is an end action */}
    </div>
  );
});
