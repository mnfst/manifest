import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useEffect, useMemo, memo } from 'react';
import { LAYOUT_REGISTRY, type NodeInstance, type LayoutTemplate, type NodeType } from '@manifest/shared';
import { LayoutGrid, Code2 } from 'lucide-react';
import { ViewNodeDropdown } from './ViewNodeDropdown';
import { AddNodeButton } from './AddNodeButton';

export interface ViewNodeData extends Record<string, unknown> {
  node: NodeInstance;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onEditCode?: () => void;
  /** Handler for "+" button click */
  onAddFromNode?: () => void;
  /** Handler for dropping a node type on the "+" button */
  onDropOnNode?: (nodeType: NodeType) => void;
}

/**
 * Custom React Flow node for displaying a StatCard node
 * Square card design matching placeholder nodes
 * Displays action handles on the right side for nodes with actions
 */
export const ViewNode = memo(function ViewNode({ data, id }: NodeProps) {
  const { node, canDelete, onEdit, onDelete, onEditCode, onAddFromNode, onDropOnNode } = data as ViewNodeData;
  const updateNodeInternals = useUpdateNodeInternals();

  // Get parameters (used for legacy StatCard/PostList nodes if any exist in DB)
  const params = node.parameters as Record<string, unknown>;
  const layoutTemplate = (params?.layoutTemplate as string) || 'stat-card';
  const hasCustomCode = Boolean((params as unknown as Record<string, unknown>)?.customCode);

  // Look up actions for this node's layout template
  const actions = useMemo(() => {
    const template = layoutTemplate as LayoutTemplate;
    const config = LAYOUT_REGISTRY[template];
    return config?.actions || [];
  }, [layoutTemplate]);

  // Update node internals when actions change (handles may have changed)
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, actions, updateNodeInternals]);

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 hover:border-gray-400 shadow-sm hover:shadow-md transition-colors transition-shadow w-[200px] nopan">
      {/* Left handle for incoming connections from UserIntent/other nodes */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-200"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon container - stat-card uses LayoutGrid icon */}
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <LayoutGrid className="w-6 h-6 text-gray-500" />
          </div>

          {/* Node info */}
          <div className="text-center w-full">
            <h3 className="font-medium text-gray-900 text-sm">
              {node.name || 'Stat Card'}
            </h3>
            <div className="flex items-center justify-center gap-1 mt-1">
              <p className="text-xs text-gray-500">UI Component</p>
              {hasCustomCode && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                  title="Has custom code"
                >
                  <Code2 className="w-2.5 h-2.5" />
                  <span className="text-[9px] font-medium">Custom</span>
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <ViewNodeDropdown
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            onEditCode={onEditCode}
          />
        </div>
      </div>

      {/* "+" button for adding connected nodes - only show if there are actions */}
      {onAddFromNode && actions.length > 0 && (
        <AddNodeButton
          onClick={onAddFromNode}
          onDrop={onDropOnNode}
          color="gray"
        />
      )}

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
});
