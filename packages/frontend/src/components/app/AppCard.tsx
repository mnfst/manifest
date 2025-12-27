import type { App, AppWithFlowCount } from '@chatgpt-app-builder/shared';

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
      className="w-full text-left bg-card border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
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
            <button
              onClick={handleEditClick}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Edit ${app.name}`}
              title="Edit app"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Delete ${app.name}`}
              title="Delete app"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              app.status === 'published'
                ? 'bg-green-500/20 text-green-600'
                : 'bg-amber-500/20 text-amber-600'
            }`}
          >
            {app.status}
          </span>
        </div>
      </div>
    </button>
  );
}
