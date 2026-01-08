import { useCallback, useMemo } from 'react';
import type { NodeType, NodeTypeCategory, LayoutTemplate as LayoutTemplateType } from '@chatgpt-app-builder/shared';
import { LAYOUT_REGISTRY } from '@chatgpt-app-builder/shared';
import type { NodeTypeInfo } from '../../../lib/api';
import { Zap, LayoutTemplate, GitBranch, CornerDownLeft, HelpCircle, Globe, GripVertical, Shuffle, LayoutList, ExternalLink } from 'lucide-react';

// Map icon names from API to Lucide React components
const iconMap: Record<string, React.ElementType> = {
  'zap': Zap,
  'layout-template': LayoutTemplate,
  'layout-list': LayoutList,
  'git-branch': GitBranch,
  'corner-down-left': CornerDownLeft,
  'globe': Globe,
  'shuffle': Shuffle,
  'external-link': ExternalLink,
};

/**
 * Get the action label for a UI node based on its layout template.
 * Returns "1 action", "2 actions", or "read only" for interface nodes.
 * Returns null for non-interface nodes.
 */
function getActionLabel(node: NodeTypeInfo): string | null {
  if (node.category !== 'interface') {
    return null;
  }

  // Get the layout template from default parameters
  const layoutTemplate = node.defaultParameters?.layoutTemplate as LayoutTemplateType | undefined;
  if (!layoutTemplate) {
    return 'read only';
  }

  const config = LAYOUT_REGISTRY[layoutTemplate];
  const actionCount = config?.actions?.length ?? 0;

  if (actionCount === 0) {
    return 'read only';
  }

  return actionCount === 1 ? '1 action' : `${actionCount} actions`;
}

// Category-based styling
const categoryStyles: Record<NodeTypeCategory, { color: string; bgColor: string }> = {
  trigger: { color: 'text-blue-600', bgColor: 'bg-blue-50' },
  interface: { color: 'text-gray-600', bgColor: 'bg-gray-50' },
  action: { color: 'text-purple-600', bgColor: 'bg-purple-50' },
  return: { color: 'text-green-600', bgColor: 'bg-green-50' },
  transform: { color: 'text-teal-600', bgColor: 'bg-teal-50' },
};

interface NodeItemProps {
  node: NodeTypeInfo;
  onClick: (nodeType: NodeType) => void;
  disabled?: boolean;
}

/**
 * NodeItem component - displays a single node type in the library
 * Supports drag-and-drop to canvas or "+" buttons
 */
export function NodeItem({ node, onClick, disabled = false }: NodeItemProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick(node.name as NodeType);
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    // Set the node type as drag data
    e.dataTransfer.setData('application/x-node-type', node.name);
    e.dataTransfer.effectAllowed = 'copy';
  }, [disabled, node.name]);

  const Icon = iconMap[node.icon] || HelpCircle;
  const styles = categoryStyles[node.category];

  // Get action label for UI nodes
  const actionLabel = useMemo(() => getActionLabel(node), [node]);

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={`
        w-full p-4 border rounded-lg text-left transition-all group
        ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-muted'
            : 'hover:border-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle indicator */}
        <div className={`flex-shrink-0 ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>
          <GripVertical className="w-4 h-4" />
        </div>
        <div
          className={`
            flex items-center justify-center
            transition-colors flex-shrink-0
            ${node.category === 'transform'
              ? 'w-10 h-10 rotate-45 rounded-sm'
              : 'w-10 h-10 rounded-lg'
            }
            ${disabled ? 'bg-gray-100' : `${styles?.bgColor || 'bg-gray-50'} group-hover:bg-gray-100`}
          `}
        >
          <Icon
            className={`w-5 h-5 ${node.category === 'transform' ? '-rotate-45' : ''} ${disabled ? 'text-gray-400' : styles?.color || 'text-gray-600'}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={`font-medium ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              {node.displayName}
            </h3>
            {/* Action label badge for UI nodes */}
            {actionLabel && (
              <span
                className={`
                  text-[10px] font-medium px-1.5 py-0.5 rounded-full
                  ${actionLabel === 'read only'
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-purple-100 text-purple-600'
                  }
                `}
              >
                {actionLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{node.description}</p>
        </div>
      </div>
    </div>
  );
}
