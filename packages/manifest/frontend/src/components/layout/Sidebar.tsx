import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Workflow, Settings, BarChart3, Users, Palette } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { UserAvatar } from './UserAvatar';
import { SidebarAppSelector } from './SidebarAppSelector';
import { CreateAppModal } from '../app/CreateAppModal';
import { api } from '../../lib/api';

/**
 * Extract appId from URL pathname
 */
function extractAppIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/app\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Navigation sidebar component
 * Provides quick access to Apps and Flows sections
 */
export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const currentAppId = extractAppIdFromPath(pathname);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Determine active section based on current route
  const isFlowsActive = currentAppId && (
    pathname === `/app/${currentAppId}` ||
    pathname === `/app/${currentAppId}/flows` ||
    pathname.startsWith(`/app/${currentAppId}/flow/`)
  );
  const isAnalyticsActive = currentAppId && pathname === `/app/${currentAppId}/analytics`;
  const isCollaboratorsActive = currentAppId && pathname === `/app/${currentAppId}/collaborators`;
  const isThemeActive = currentAppId && pathname === `/app/${currentAppId}/theme`;
  const isAppSettingsActive = currentAppId && pathname === `/app/${currentAppId}/settings`;
  const isUserSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/');

  // Handle app creation
  const handleCreateApp = async (data: { name: string; description?: string }) => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const app = await api.createApp(data);
      setIsCreateModalOpen(false);
      navigate(`/app/${app.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create app');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <aside className="w-56 bg-nav text-nav-foreground flex-shrink-0">
      <div className="h-full flex flex-col">
        {/* Logo/Brand */}
        <div className="h-14 px-4 flex items-center border-b border-nav-foreground/10">
          <img
            src="/logotype-dark.svg"
            alt="Manifest"
            className="h-8"
          />
        </div>

        {/* App Selector */}
        <div className="py-2 border-b border-nav-foreground/10">
          <SidebarAppSelector onCreateApp={() => setIsCreateModalOpen(true)} />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1">
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}` : '/'}
            label="Flows"
            icon={<Workflow className="w-5 h-5" />}
            isActive={!!isFlowsActive}
          />
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}/analytics` : '/'}
            label="Analytics"
            icon={<BarChart3 className="w-5 h-5" />}
            isActive={!!isAnalyticsActive}
          />
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}/collaborators` : '/'}
            label="Collaborators"
            icon={<Users className="w-5 h-5" />}
            isActive={!!isCollaboratorsActive}
          />
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}/theme` : '/'}
            label="Theme"
            icon={<Palette className="w-5 h-5" />}
            isActive={!!isThemeActive}
          />
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}/settings` : '/settings'}
            label="Settings"
            icon={<Settings className="w-5 h-5" />}
            isActive={!!isAppSettingsActive || isUserSettingsActive}
          />
        </nav>

        {/* User Avatar at bottom */}
        <div className="p-3 border-t border-nav-foreground/10">
          <UserAvatar />
        </div>
      </div>

      {/* Create App Modal */}
      <CreateAppModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateError(null);
        }}
        onSubmit={handleCreateApp}
        isLoading={isCreating}
        error={createError}
      />
    </aside>
  );
}
