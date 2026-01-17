import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import type { App } from '@chatgpt-app-builder/shared';
import { api, resolveIconUrl } from '../../lib/api';
import { Button } from '@/components/ui/shadcn/button';

interface SidebarAppSelectorProps {
  onCreateApp: () => void;
}

/**
 * Extract appId from URL pathname
 * Matches /app/:appId and /app/:appId/flow/:flowId patterns
 */
function extractAppIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/app\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * App selector component for the sidebar
 * Shows current app with logo, name, and chevron dropdown indicator
 * Dropdown displays all apps and create new app option
 */
export function SidebarAppSelector({ onCreateApp }: SidebarAppSelectorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const appId = extractAppIdFromPath(location.pathname);
  const [isOpen, setIsOpen] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [currentApp, setCurrentApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all apps on mount and set current app
  useEffect(() => {
    setIsInitialLoading(true);
    api.listApps()
      .then((loadedApps) => {
        setApps(loadedApps);
        // Set current app based on URL or default to first app
        if (appId) {
          const app = loadedApps.find((a) => a.id === appId);
          setCurrentApp(app || loadedApps[0] || null);
        } else if (loadedApps.length > 0) {
          setCurrentApp(loadedApps[0]);
        }
      })
      .catch(console.error)
      .finally(() => setIsInitialLoading(false));
  }, [appId]);

  // Refresh apps list when dropdown opens (in case new apps were created)
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api.listApps()
        .then(setApps)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleAppSelect = (app: App) => {
    setIsOpen(false);
    if (app.id !== currentApp?.id) {
      navigate(`/app/${app.id}`);
    }
  };

  const handleCreateApp = () => {
    setIsOpen(false);
    onCreateApp();
  };

  return (
    <div ref={dropdownRef} className="relative px-2">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-nav-foreground hover:bg-nav-hover h-auto"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* App Logo */}
        {isInitialLoading ? (
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse flex-shrink-0" />
        ) : currentApp ? (
          currentApp.logoUrl ? (
            <img
              src={resolveIconUrl(currentApp.logoUrl)}
              alt={currentApp.name}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary">
                {currentApp.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )
        ) : (
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        {/* App Name */}
        <span className="flex-1 text-left font-medium text-sm truncate">
          {isInitialLoading ? 'Loading...' : currentApp?.name || 'No apps'}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute left-2 right-2 mt-1 bg-nav border border-nav-foreground/20 rounded-lg shadow-lg overflow-hidden z-50"
          role="listbox"
        >
          {isLoading ? (
            <div className="p-3 text-center text-nav-foreground/60 text-sm">
              Loading apps...
            </div>
          ) : (
            <>
              {/* Apps list */}
              <div className="max-h-48 overflow-y-auto">
                {apps.length === 0 ? (
                  <div className="p-3 text-center text-nav-foreground/60 text-sm">
                    No apps yet
                  </div>
                ) : (
                  apps.map((app) => (
                    <Button
                      key={app.id}
                      variant="ghost"
                      onClick={() => handleAppSelect(app)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-nav-foreground hover:bg-nav-hover h-auto justify-start rounded-none ${
                        app.id === currentApp?.id ? 'bg-nav-hover' : ''
                      }`}
                      role="option"
                      aria-selected={app.id === currentApp?.id}
                    >
                      {/* App Logo */}
                      {app.logoUrl ? (
                        <img
                          src={resolveIconUrl(app.logoUrl)}
                          alt={app.name}
                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {app.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* App Name */}
                      <span className="flex-1 text-left text-sm truncate">
                        {app.name}
                      </span>
                      {/* Current indicator */}
                      {app.id === currentApp?.id && (
                        <span className="text-xs text-nav-foreground/60">Current</span>
                      )}
                    </Button>
                  ))
                )}
              </div>

              {/* Create new app */}
              <div className="border-t border-nav-foreground/20">
                <Button
                  variant="ghost"
                  onClick={handleCreateApp}
                  className="w-full flex items-center gap-3 px-3 py-2 text-primary hover:bg-nav-hover h-auto justify-start rounded-none"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">Create new app</span>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
