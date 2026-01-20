import { ChevronRight, Zap, LayoutTemplate, GitBranch, CornerDownLeft, HelpCircle, Shuffle } from 'lucide-react';
import type { CategoryInfo } from '../../../lib/api';
import type { NodeTypeCategory } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';

// Map category IDs to Lucide React icons
const categoryIconMap: Record<NodeTypeCategory, React.ElementType> = {
  trigger: Zap,
  interface: LayoutTemplate,
  action: GitBranch,
  return: CornerDownLeft,
  transform: Shuffle,
};

interface NodeColor {
  bg: string;
  bgHover: string;
  text: string;
}

interface NodeGroupProps {
  category: CategoryInfo;
  displayName: string;
  color: NodeColor;
  onClick: () => void;
}

/**
 * NodeGroup component - displays a single category group in the library
 */
export function NodeGroup({ category, displayName, color, onClick }: NodeGroupProps) {
  const Icon = categoryIconMap[category.id] || HelpCircle;

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="w-full p-3 h-auto rounded-lg border cursor-pointer transition-all group text-left justify-start hover:border-primary hover:bg-primary/5"
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            transition-colors
            ${color.bg} group-hover:${color.bgHover}
          `}
        >
          <Icon className={`w-5 h-5 ${color.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground">{displayName}</h3>
          <p className="text-sm text-muted-foreground truncate">Browse {displayName.toLowerCase()}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Button>
  );
}
