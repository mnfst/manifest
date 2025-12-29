import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useEffect, useMemo } from 'react';
import { LAYOUT_REGISTRY, type View, type LayoutTemplate } from '@chatgpt-app-builder/shared';
import { LayoutGrid, FileText } from 'lucide-react';
import { ViewNodeDropdown } from './ViewNodeDropdown';

export interface ViewNodeData extends Record<string, unknown> {
  view: View;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Custom React Flow node for displaying a view
 * Square card design matching placeholder nodes
 * Displays action handles on the right side for views with actions
 */
export function ViewNode({ data, id }: NodeProps) {
  const { view, canDelete, onEdit, onDelete } = data as ViewNodeData;
  const updateNodeInternals = useUpdateNodeInternals();

  // Look up actions for this view's layout template
  const actions = useMemo(() => {
    const template = view.layoutTemplate as LayoutTemplate;
    const config = LAYOUT_REGISTRY[template];
    return config?.actions || [];
  }, [view.layoutTemplate]);

  // Update node internals when actions change (handles may have changed)
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, actions, updateNodeInternals]);

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 hover:border-gray-400 shadow-sm hover:shadow-md transition-all w-[200px] nopan">
      {/* Top handle for incoming connection from MockDataNode */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-amber-400 !w-2 !h-2 !border-0"
      />
      {/* Left handle for incoming connections from UserIntent/other Views */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container */}
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            {view.layoutTemplate === 'table' ? (
              <LayoutGrid className="w-6 h-6 text-gray-500" />
            ) : (
              <FileText className="w-6 h-6 text-gray-500" />
            )}
          </div>

          {/* View info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              {view.name || 'Untitled View'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{view.layoutTemplate}</p>
          </div>

          {/* Action buttons */}
          <ViewNodeDropdown canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Right handle for outgoing connections (default) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />

      {/* Action handles on the right side (purple themed) - labels outside node */}
      {actions.map((action, index) => (
        <div key={action.name}>
          {/* Action source handle */}
          <Handle
            type="source"
            position={Position.Right}
            id={`action:${action.name}`}
            className="!bg-purple-500 !w-2.5 !h-2.5 !border-2 !border-purple-300"
            style={{ top: `${60 + index * 24}%` }}
          />
          {/* Action label outside the node */}
          <span
            className="absolute text-[10px] text-purple-600 font-medium bg-white/90 px-1 rounded whitespace-nowrap"
            style={{
              right: '-70px',
              top: `${60 + index * 24}%`,
              transform: 'translateY(-50%)',
            }}
            title={action.description}
          >
            {action.label}
          </span>
        </div>
      ))}
    </div>
  );
}
