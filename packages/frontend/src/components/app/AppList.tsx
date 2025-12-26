import type { App } from '@chatgpt-app-builder/shared';
import { AppCard } from './AppCard';

interface AppListProps {
  apps: App[];
  onAppClick: (app: App) => void;
}

/**
 * Grid layout component for displaying a list of apps
 * Shows empty state when no apps exist
 */
export function AppList({ apps, onAppClick }: AppListProps) {
  if (apps.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-muted-foreground space-y-2">
          <p className="text-lg font-medium">No apps yet</p>
          <p className="text-sm">
            Create your first app to get started building MCP servers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} onClick={onAppClick} />
      ))}
    </div>
  );
}
