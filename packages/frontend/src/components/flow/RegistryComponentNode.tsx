import { memo, useEffect, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { LayoutTemplate, Code2 } from 'lucide-react';
import type { NodeInstance, RegistryNodeParameters } from '@chatgpt-app-builder/shared';
import { ViewNodeDropdown } from './ViewNodeDropdown';
import { parseComponentActions } from '../../services/registry';

interface RegistryComponentNodeData {
  node: NodeInstance;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onEditCode?: () => void;
}

/**
 * React Flow node component for registry UI components
 * Displays component metadata with edit/delete/editCode actions
 * Renders action handles on the right side for components with actions
 */
function RegistryComponentNodeComponent({ data, selected, id }: NodeProps) {
  const nodeData = data as unknown as RegistryComponentNodeData;
  const { node, canDelete, onEdit, onDelete, onEditCode } = nodeData;
  const updateNodeInternals = useUpdateNodeInternals();

  // Get parameters from the node
  const params = node?.parameters as unknown as RegistryNodeParameters | undefined;
  const nodeName = node?.name || 'UI Component';
  const registryTitle = params?.title; // Registry component name (e.g., "Contact Form")
  const version = params?.version;
  const previewUrl = params?.previewUrl;

  // Check if there's custom code (files with content)
  const hasCustomCode = params?.files && params.files.length > 0 && params.files[0]?.content;

  // Get actions - from stored params or fallback to parsing from source code
  const actions = useMemo(() => {
    if (params?.actions) return params.actions;
    // Fallback: parse from source code if not stored (for existing nodes)
    const sourceCode = params?.files?.[0]?.content || '';
    return parseComponentActions(sourceCode);
  }, [params?.actions, params?.files]);

  // Update node internals when actions change (handles may have changed)
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, actions, updateNodeInternals]);

  return (
    <div
      className={`
        bg-white rounded-lg border-2 shadow-sm hover:shadow-md transition-all w-[200px] nopan
        ${selected ? 'border-primary shadow-md' : 'border-gray-200 hover:border-gray-400'}
      `}
    >
      {/* Input handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-200"
      />

      <div className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Preview image or fallback icon */}
          {previewUrl ? (
            <div className="w-full h-24 rounded-lg overflow-hidden bg-gray-50">
              <img
                src={previewUrl}
                alt={registryTitle || nodeName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <LayoutTemplate className="w-6 h-6 text-gray-500" />
            </div>
          )}

          {/* Node info */}
          <div className="text-center w-full">
            {/* Main text: User-chosen node name */}
            <h3 className="font-medium text-gray-900 text-sm truncate max-w-[180px]" title={nodeName}>
              {nodeName}
            </h3>
            {/* Subtitle: Registry component name with version */}
            <div className="flex items-center justify-center gap-1 mt-1">
              {registryTitle ? (
                <p className="text-xs text-gray-500 truncate max-w-[120px]" title={registryTitle}>
                  {registryTitle}
                </p>
              ) : (
                <p className="text-xs text-gray-500">UI Component</p>
              )}
              {version && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                  v{version}
                </span>
              )}
              {hasCustomCode && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                  title="Has component code"
                >
                  <Code2 className="w-2.5 h-2.5" />
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

      {/* Action handles on the right side (purple themed) */}
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

      {/* Output handle - only show if no actions (read-only component) */}
      {actions.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          id="main"
          className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
        />
      )}
    </div>
  );
}

export const RegistryComponentNode = memo(RegistryComponentNodeComponent);
