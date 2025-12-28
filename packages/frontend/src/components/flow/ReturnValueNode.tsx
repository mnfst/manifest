import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ReturnValue } from '@chatgpt-app-builder/shared';
import { FileText, Pencil, Trash2, MoreHorizontal, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface ReturnValueNodeData extends Record<string, unknown> {
  returnValue: ReturnValue;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Custom React Flow node for displaying a return value
 * Green-themed card design to distinguish from views
 */
export function ReturnValueNode({ data }: NodeProps) {
  const { returnValue, canDelete, onEdit, onDelete } = data as ReturnValueNodeData;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isEmpty = !returnValue.text?.trim();
  const previewText = returnValue.text?.slice(0, 50) || '';
  const hasMore = (returnValue.text?.length || 0) > 50;

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
    <div className="bg-white rounded-lg border-2 border-green-200 hover:border-green-400 shadow-sm hover:shadow-md transition-all w-[200px] nopan">
      {/* Left handle for incoming connections from UserIntent/other nodes */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-green-400 !w-2 !h-2 !border-0"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isEmpty ? 'bg-amber-50' : 'bg-green-100'
          }`}>
            {isEmpty ? (
              <AlertCircle className="w-6 h-6 text-amber-500" />
            ) : (
              <FileText className="w-6 h-6 text-green-600" />
            )}
          </div>

          {/* Return value info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              Return Value
            </h3>
            {isEmpty ? (
              <p className="text-xs text-amber-600 mt-1">
                Not configured
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1 truncate" title={returnValue.text}>
                {previewText}{hasMore ? '...' : ''}
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

      {/* Right handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-green-400 !w-2 !h-2 !border-0"
      />
    </div>
  );
}
