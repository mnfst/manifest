import type { NodeType, NodeTypeCategory } from '@chatgpt-app-builder/shared';
import type { NodeTypeInfo } from '../../../lib/api';
import { Zap, LayoutTemplate, GitBranch, CornerDownLeft, HelpCircle } from 'lucide-react';

// Map icon names from API to Lucide React components
const iconMap: Record<string, React.ElementType> = {
  'zap': Zap,
  'layout-template': LayoutTemplate,
  'git-branch': GitBranch,
  'corner-down-left': CornerDownLeft,
};

// Category-based styling
const categoryStyles: Record<NodeTypeCategory, { color: string; bgColor: string }> = {
  trigger: { color: 'text-blue-600', bgColor: 'bg-blue-50' },
  interface: { color: 'text-gray-600', bgColor: 'bg-gray-50' },
  action: { color: 'text-purple-600', bgColor: 'bg-purple-50' },
  return: { color: 'text-green-600', bgColor: 'bg-green-50' },
};

interface NodeItemProps {
  node: NodeTypeInfo;
  onClick: (nodeType: NodeType) => void;
  disabled?: boolean;
}

/**
 * NodeItem component - displays a single node type in the library
 */
export function NodeItem({ node, onClick, disabled = false }: NodeItemProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick(node.name as NodeType);
    }
  };

  const Icon = iconMap[node.icon] || HelpCircle;
  const styles = categoryStyles[node.category];

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        w-full p-4 border rounded-lg text-left transition-all group
        ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-muted'
            : 'hover:border-primary hover:bg-primary/5 cursor-pointer'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            transition-colors
            ${disabled ? 'bg-gray-100' : `${styles?.bgColor || 'bg-gray-50'} group-hover:bg-gray-100`}
          `}
        >
          <Icon
            className={`w-5 h-5 ${disabled ? 'text-gray-400' : styles?.color || 'text-gray-600'}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            {node.displayName}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{node.description}</p>
        </div>
      </div>
    </button>
  );
}
