import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Plus, Layers } from 'lucide-react';

export interface AddStepNodeData extends Record<string, unknown> {
  onClick: () => void;
}

/**
 * Placeholder React Flow node for adding the next step (View or Return Value)
 * Displayed when a flow has user intent but no steps yet
 * Positioned to the right of the UserIntentNode with a connecting edge
 */
export function AddStepNode({ data }: NodeProps) {
  const { onClick } = data as AddStepNodeData;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-primary shadow-sm hover:shadow-md transition-all w-[180px] cursor-pointer group nopan nodrag"
    >
      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <div className="relative">
              <Layers className="w-5 h-5 text-gray-400 group-hover:text-primary" />
              <Plus className="w-3 h-3 text-gray-600 group-hover:text-primary absolute -top-1 -right-1 bg-gray-100 group-hover:bg-primary/20 rounded-full" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center">
            <h3 className="font-medium text-gray-600 group-hover:text-primary text-sm transition-colors">
              Add next step
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              View or return value
            </p>
          </div>
        </div>
      </div>

      {/* Left handle for incoming connection from UserIntent */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-300 !w-2 !h-2 !border-0"
      />

      {/* Right handle for future connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-300 !w-2 !h-2 !border-0 opacity-0"
      />
    </div>
  );
}
