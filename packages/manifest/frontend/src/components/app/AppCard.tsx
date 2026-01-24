import type { App, AppWithFlowCount } from '@manifest/shared';
import { resolveIconUrl } from '../../lib/api';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { ImageIcon, Pencil, Trash2 } from 'lucide-react';

interface AppCardProps {
  app: App | AppWithFlowCount;
  onClick: (app: App) => void;
  onEdit?: (app: App) => void;
  onDelete?: (app: App) => void;
}

/**
 * Card component for displaying an app in the list
 * Shows name, description, status badge, and navigates on click
 * Optional edit button when onEdit is provided
 */
// Type guard to check if app has flowCount
function hasFlowCount(app: App | AppWithFlowCount): app is AppWithFlowCount {
  return 'flowCount' in app && typeof app.flowCount === 'number';
}

// Format flow count display
function formatFlowCount(count: number): string {
  if (count === 0) return 'No flows';
  if (count === 1) return '1 flow';
  return `${count} flows`;
}

export function AppCard({ app, onClick, onEdit, onDelete }: AppCardProps) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(app);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(app);
  };

  const flowCount = hasFlowCount(app) ? app.flowCount : undefined;

  return (
    <button
      onClick={() => onClick(app)}
      className="w-full text-left bg-card border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-colors transition-shadow group"
    >
      <div className="flex items-start justify-between gap-3">
        {/* App Icon */}
        <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
          {app.logoUrl ? (
            <img
              src={resolveIconUrl(app.logoUrl)}
              alt={`${app.name} icon`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {app.name}
          </h3>
          {app.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {app.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <code className="bg-muted px-1.5 py-0.5 rounded">{app.slug}</code>
            {flowCount !== undefined && (
              <span className={flowCount === 0 ? 'text-amber-600' : ''}>
                {formatFlowCount(flowCount)}
              </span>
            )}
            {app.updatedAt && (
              <span>
                Updated {new Date(app.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditClick}
              className="opacity-0 group-hover:opacity-100 h-8 w-8"
              aria-label={`Edit ${app.name}`}
              title="Edit app"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              className="opacity-0 group-hover:opacity-100 h-8 w-8 hover:text-destructive hover:bg-destructive/10"
              aria-label={`Delete ${app.name}`}
              title="Delete app"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Badge
            className={
              app.status === 'published'
                ? 'bg-green-500/20 text-green-600 hover:bg-green-500/20'
                : 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/20'
            }
          >
            {app.status}
          </Badge>
        </div>
      </div>
    </button>
  );
}
