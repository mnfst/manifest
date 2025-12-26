import type { View } from '@chatgpt-app-builder/shared';
import { ViewCard } from './ViewCard';

interface ViewListProps {
  views: View[];
  onViewClick: (view: View) => void;
  onViewDelete?: (view: View) => void;
  onReorder?: (viewIds: string[]) => void;
  canDelete?: boolean;
}

/**
 * List of views for a flow with navigation and management actions
 * Supports reordering and deletion (if more than one view exists)
 */
export function ViewList({
  views,
  onViewClick,
  onViewDelete,
  onReorder,
  canDelete = true,
}: ViewListProps) {
  const handleMoveUp = (index: number) => {
    if (index === 0 || !onReorder) return;
    const newOrder = [...views];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onReorder(newOrder.map((v) => v.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === views.length - 1 || !onReorder) return;
    const newOrder = [...views];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onReorder(newOrder.map((v) => v.id));
  };

  if (views.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No views yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {views.map((view, index) => (
        <ViewCard
          key={view.id}
          view={view}
          onClick={() => onViewClick(view)}
          onDelete={
            canDelete && views.length > 1 && onViewDelete
              ? () => onViewDelete(view)
              : undefined
          }
          isFirst={index === 0}
          isLast={index === views.length - 1}
          onMoveUp={onReorder ? () => handleMoveUp(index) : undefined}
          onMoveDown={onReorder ? () => handleMoveDown(index) : undefined}
        />
      ))}
    </div>
  );
}
