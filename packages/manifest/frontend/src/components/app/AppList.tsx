import type { App } from '@manifest/shared';
import { AppCard } from './AppCard';
import { FolderOpen } from 'lucide-react';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/shadcn/empty';

interface AppListProps {
  apps: App[];
  onAppClick: (app: App) => void;
  onAppEdit?: (app: App) => void;
  onAppDelete?: (app: App) => void;
}

/**
 * Grid layout component for displaying a list of apps
 * Shows empty state when no apps exist
 */
export function AppList({ apps, onAppClick, onAppEdit, onAppDelete }: AppListProps) {
  if (apps.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen />
          </EmptyMedia>
          <EmptyTitle>No apps yet</EmptyTitle>
          <EmptyDescription>
            Create your first app to get started building MCP servers.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} onClick={onAppClick} onEdit={onAppEdit} onDelete={onAppDelete} />
      ))}
    </div>
  );
}
