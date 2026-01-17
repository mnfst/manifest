import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { NodeType } from '@chatgpt-app-builder/shared';
import { Button } from '@/components/ui/shadcn/button';

interface AddNodeButtonProps {
  /** Click handler to open node library */
  onClick: () => void;
  /** Color theme - matches node accent color */
  color?: 'blue' | 'orange' | 'gray' | 'purple';
  /** Handler for when a node type is dropped on the button */
  onDrop?: (nodeType: NodeType) => void;
}

/**
 * Small "+" button that appears next to node output handles.
 * Clicking opens the node library to add a connected node.
 * Also serves as a drop target for dragged nodes from the library.
 */
export function AddNodeButton({ onClick, color = 'blue', onDrop }: AddNodeButtonProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const colorClasses = {
    blue: 'bg-blue-100 hover:bg-blue-200 text-blue-600 border-blue-300',
    orange: 'bg-orange-100 hover:bg-orange-200 text-orange-600 border-orange-300',
    gray: 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300',
    purple: 'bg-purple-100 hover:bg-purple-200 text-purple-600 border-purple-300',
  };

  const dragOverClasses = {
    blue: 'bg-blue-300 border-blue-500 scale-125',
    orange: 'bg-orange-300 border-orange-500 scale-125',
    gray: 'bg-gray-300 border-gray-500 scale-125',
    purple: 'bg-purple-300 border-purple-500 scale-125',
  };

  const lineColorClasses = {
    blue: 'bg-blue-300',
    orange: 'bg-orange-300',
    gray: 'bg-gray-300',
    purple: 'bg-purple-300',
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nodeType = e.dataTransfer.types.includes('application/x-node-type');
    if (nodeType) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const nodeType = e.dataTransfer.getData('application/x-node-type') as NodeType;
    if (nodeType && onDrop) {
      onDrop(nodeType);
    }
  }, [onDrop]);

  return (
    <div className="absolute right-[-52px] top-1/2 -translate-y-1/2 nodrag nopan flex items-center">
      {/* Connecting line between handle and button */}
      <div className={`w-5 h-0.5 ${lineColorClasses[color]}`} />
      {/* Tooltip shown during drag */}
      {isDragOver && (
        <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
          Drop to connect
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          w-7 h-7 rounded-full border-2
          flex items-center justify-center
          transition-all duration-150
          shadow-sm hover:shadow-md
          ${isDragOver ? dragOverClasses[color] : colorClasses[color]}
        `}
        title="Add connected node"
      >
        <Plus className={`transition-all duration-150 ${isDragOver ? 'w-5 h-5' : 'w-4 h-4'}`} strokeWidth={2.5} />
      </Button>
    </div>
  );
}
