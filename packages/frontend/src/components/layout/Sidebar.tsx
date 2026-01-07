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
 * Connectors icon - database style
 */
function ConnectorsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 00-.629.74v.387c-.827.157-1.642.345-2.445.564a.75.75 0 00-.555.867c.326 2.083 1.1 3.947 2.228 5.51A10.954 10.954 0 002 13.5v.268a.75.75 0 00.629.74C4.377 14.851 6.171 15 10 15s5.623-.149 7.371-.492a.75.75 0 00.629-.74V13.5c0-1.68-.576-3.226-1.228-4.997a12.2 12.2 0 002.228-5.51.75.75 0 00-.555-.867 25.26 25.26 0 00-2.445-.564v-.387a.75.75 0 00-.629-.74A28.095 28.095 0 0010 1zM4.5 4.29v-.122c1.724-.242 3.576-.418 5.5-.418 1.924 0 3.776.176 5.5.418v.123a13.665 13.665 0 01-5.5.709 13.665 13.665 0 01-5.5-.71zm0 8.95v-.122c1.724-.242 3.576-.418 5.5-.418 1.924 0 3.776.176 5.5.418v.123a13.665 13.665 0 01-5.5.709 13.665 13.665 0 01-5.5-.71z" clipRule="evenodd" />
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
  // Flows is active when on app detail page or any flow page
  const isFlowsActive = pathname.startsWith('/app/') || pathname === '/flows' || pathname.startsWith('/flows/');
  const isConnectorsActive = pathname === '/connectors' || pathname.startsWith('/connectors/');
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
            src="https://manifest.build/assets/images/logo-transparent.svg"
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
            isActive={isFlowsActive}
          />
          <SidebarItem
            to="/connectors"
            label="Connectors"
            icon={<ConnectorsIcon />}
            isActive={isConnectorsActive}
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
