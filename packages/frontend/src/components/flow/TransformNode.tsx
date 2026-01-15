import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { NodeInstance, JavaScriptCodeTransformParameters } from '@chatgpt-app-builder/shared';
import { Shuffle, AlertTriangle } from 'lucide-react';
import { ViewNodeDropdown } from './ViewNodeDropdown';

export interface TransformNodeData extends Record<string, unknown> {
  node: NodeInstance;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** Error message if this transform node has a validation error (e.g., no input connection) */
  validationError?: string;
}

/**
 * Custom React Flow node for displaying a Transform node.
 * Diamond-shaped (45-degree rotated square) with teal color scheme.
 * Smaller than standard nodes to visually distinguish transformer nodes.
 */
export function TransformNode({ data }: NodeProps) {
  const { node, canDelete, onEdit, onDelete, validationError } = data as TransformNodeData;

  // Get parameters with type safety
  const params = node.parameters as unknown as JavaScriptCodeTransformParameters;
  const hasCode = params?.code && params.code !== 'return input;';
  const hasError = Boolean(validationError);

  return (
    <div className="relative w-[100px] h-[100px] nopan">
      {/* Left handle for incoming connections - positioned at the left point of the diamond */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={`!w-3 !h-3 !border-2 ${hasError ? '!bg-red-400 !border-red-200' : '!bg-teal-400 !border-teal-200'}`}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* Diamond container - rotated 45 degrees */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-[70px] h-[70px] rounded-lg shadow-sm hover:shadow-md transition-colors transition-shadow cursor-pointer ${
            hasError
              ? 'bg-red-50 border-2 border-red-400 hover:border-red-500'
              : 'bg-teal-50 border-2 border-teal-300 hover:border-teal-400'
          }`}
          style={{ transform: 'rotate(45deg)' }}
          onClick={onEdit}
        >
          {/* Counter-rotate content to keep it upright */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ transform: 'rotate(-45deg)' }}
          >
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasError ? 'bg-red-100' : 'bg-teal-100'}`}>
              <Shuffle className={`w-4 h-4 ${hasError ? 'text-red-600' : 'text-teal-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Node name tooltip - positioned below the diamond */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <span className={`text-xs font-medium bg-white/80 px-1 rounded ${hasError ? 'text-red-600' : 'text-gray-600'}`}>
          {node.name || 'Transform'}
        </span>
      </div>

      {/* Error indicator - shows warning icon when validation error */}
      {hasError && (
        <div
          className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 rounded-full border border-white flex items-center justify-center cursor-help"
          title={validationError}
        >
          <AlertTriangle className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Status indicator - shows if code is configured (only when no error) */}
      {hasCode && !hasError && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full border border-white" title="Code configured" />
      )}

      {/* Dropdown menu - positioned at top right */}
      <div className="absolute -top-2 -right-2">
        <ViewNodeDropdown canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} />
      </div>

      {/* Right handle for outgoing connections - positioned at the right point of the diamond */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={`!w-3 !h-3 !border-2 ${hasError ? '!bg-red-400 !border-red-200' : '!bg-teal-400 !border-teal-200'}`}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
}
