import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { NodeInstance, LinkNodeParameters } from '@chatgpt-app-builder/shared';
import { ExternalLink, Pencil, Trash2, MoreHorizontal, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';

export interface LinkNodeData extends Record<string, unknown> {
  node: NodeInstance;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Custom handle component that displays "UI" text to indicate
 * this node only accepts connections from UI/interface nodes.
 */
function UIHandle() {
  return (
    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {/* Invisible React Flow handle for connection logic */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!absolute !w-full !h-full !bg-transparent !border-0 !rounded-md !opacity-0"
      />
      {/* Visual handle with "UI" text */}
      <div className="w-7 h-5 bg-gray-200 border-2 border-gray-300 rounded flex items-center justify-center pointer-events-none">
        <span className="text-[9px] font-bold text-gray-500">UI</span>
      </div>
    </div>
  );
}

/**
 * Custom React Flow node for displaying a Link node
 * Green-themed card design (output category)
 * No right-side handle as it's a terminal/end action
 */
export const LinkNode = memo(function LinkNode({ data }: NodeProps) {
  const { node, canDelete, onEdit, onDelete } = data as LinkNodeData;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const params = node.parameters as unknown as LinkNodeParameters;
  const href = params?.href || '';
  const isEmpty = !href.trim();

  // Truncate URL for display
  const displayUrl = href.length > 35 ? href.slice(0, 35) + '...' : href;

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
    <div className="bg-white rounded-lg border-2 border-green-200 hover:border-green-400 shadow-sm hover:shadow-md transition-colors transition-shadow w-[200px] nopan relative">
      {/* Left handle for incoming connections - UI nodes only */}
      <UIHandle />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isEmpty ? 'bg-amber-50' : 'bg-green-100'
          }`}>
            {isEmpty ? (
              <AlertCircle className="w-6 h-6 text-amber-500" />
            ) : (
              <ExternalLink className="w-6 h-6 text-green-600" />
            )}
          </div>

          {/* Link node info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              {node.name || 'Open Link'}
            </h3>
            {isEmpty ? (
              <p className="text-xs text-amber-600 mt-1">Not configured</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1 truncate" title={href}>
                {displayUrl}
              </p>
            )}
          </div>

          {/* Action dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              size="icon"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="h-8 w-8 nodrag"
              aria-label="Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>

            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10">
                <Button
                  variant="ghost"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 nodrag h-auto justify-start rounded-none"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 nodrag h-auto justify-start rounded-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NO right handle - this is a terminal/end action */}
    </div>
  );
});
