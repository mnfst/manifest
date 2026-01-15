import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { UserAvatar } from './UserAvatar';
import { SidebarAppSelector } from './SidebarAppSelector';
import { CreateAppModal } from '../app/CreateAppModal';
import { api } from '../../lib/api';

/**
 * Flows icon - workflow/branch style
 */
function FlowsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 2.5a.75.75 0 01.75.75v6.19l2.97-2.97a.75.75 0 011.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0l-4.25-4.25a.75.75 0 011.06-1.06l2.97 2.97V3.25A.75.75 0 0110 2.5zm0 9.5a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Settings icon - gear style
 */
function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Analytics icon - bar chart style
 */
function AnalyticsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
    </svg>
  );
}

/**
 * Collaborators icon - users style
 */
function CollaboratorsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
    </svg>
  );
}

/**
 * Theme icon - palette style
 */
function ThemeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 002 3.5V15a3 3 0 003 3h10a3 3 0 003-3V3.5A1.5 1.5 0 0016.5 2h-13zm7 3.5a.5.5 0 01.5.5v4.5a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm-4.5 3a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v4a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-4zm8-.5a.5.5 0 00-.5.5v2.5a.5.5 0 001 0V8.5a.5.5 0 00-.5-.5z" clipRule="evenodd" />
    </svg>
  );
}

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
  const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/');

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
            icon={<FlowsIcon />}
            isActive={!!isFlowsActive}
          />
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}/analytics` : '/'}
            label="Analytics"
            icon={<AnalyticsIcon />}
            isActive={!!isAnalyticsActive}
          />
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}/collaborators` : '/'}
            label="Collaborators"
            icon={<CollaboratorsIcon />}
            isActive={!!isCollaboratorsActive}
          />
          <SidebarItem
            to={currentAppId ? `/app/${currentAppId}/theme` : '/'}
            label="Theme"
            icon={<ThemeIcon />}
            isActive={!!isThemeActive}
          />
          <SidebarItem
            to="/settings"
            label="Settings"
            icon={<SettingsIcon />}
            isActive={isSettingsActive}
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
