import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { App } from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';

interface AppSwitcherProps {
  currentApp: App;
}

/**
 * Dropdown component for switching between apps
 * Shows current app name, click to open dropdown with all apps
 */
export function AppSwitcher({ currentApp }: AppSwitcherProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load apps when dropdown opens
  useEffect(() => {
    if (isOpen && apps.length === 0) {
      setIsLoading(true);
      api.listApps()
        .then(setApps)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, apps.length]);

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
    if (app.id !== currentApp.id) {
      navigate(`/app/${app.id}`);
    }
  };

  const otherApps = apps.filter((a) => a.id !== currentApp.id);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="font-medium truncate max-w-[200px]" title={currentApp.name}>
          {currentApp.name}
        </span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-card border rounded-lg shadow-lg overflow-hidden z-50"
          role="listbox"
        >
          {isLoading ? (
            <div className="p-3 text-center text-muted-foreground text-sm">
              Loading apps...
            </div>
          ) : otherApps.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-sm">
              No other apps
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {otherApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => handleAppSelect(app)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                  role="option"
                >
                  <div className="font-medium truncate">{app.name}</div>
                  {app.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {app.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
