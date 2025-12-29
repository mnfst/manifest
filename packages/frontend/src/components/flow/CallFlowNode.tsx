import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { CallFlow } from '@chatgpt-app-builder/shared';
import { PhoneForwarded, Pencil, Trash2, MoreHorizontal, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface CallFlowNodeData extends Record<string, unknown> {
  callFlow: CallFlow;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Custom React Flow node for displaying a call flow end action
 * Purple-themed card design to distinguish from views and return values
 * No right-side handle as it's a terminal/end action
 */
export function CallFlowNode({ data }: NodeProps) {
  const { callFlow, canDelete, onEdit, onDelete } = data as CallFlowNodeData;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasTarget = callFlow.targetFlowId && callFlow.targetFlow;
  const targetName = callFlow.targetFlow?.name || 'Unknown Flow';

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
    <div className="bg-white rounded-lg border-2 border-purple-200 hover:border-purple-400 shadow-sm hover:shadow-md transition-all w-[200px] nopan">
      {/* Left handle for incoming connections from UserIntent/other nodes */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-purple-400 !w-2 !h-2 !border-0"
      />
      {/* Action target handle - for incoming action connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="action-target"
        className="!bg-purple-500 !w-2.5 !h-2.5 !border-2 !border-purple-300"
        style={{ top: '70%' }}
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
              Call Flow
            </h3>
            {hasTarget ? (
              <p className="text-xs text-gray-500 mt-1 truncate" title={targetName}>
                {targetName}
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-1">
                {callFlow.targetFlowId ? 'Target deleted' : 'Not configured'}
              </p>
            )}
          </div>

          {/* Action dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              aria-label="Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
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
}
