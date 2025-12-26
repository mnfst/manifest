import type { App } from '@chatgpt-app-builder/shared';

interface AppCardProps {
  app: App;
  onClick: (app: App) => void;
}

/**
 * Card component for displaying an app in the list
 * Shows name, description, status badge, and navigates on click
 */
export function AppCard({ app, onClick }: AppCardProps) {
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
            {app.updatedAt && (
              <span>
                Updated {new Date(app.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
            app.status === 'published'
              ? 'bg-green-500/20 text-green-600'
              : 'bg-amber-500/20 text-amber-600'
          }`}
        >
          {app.status}
        </span>
      </div>
    </button>
  );
}
