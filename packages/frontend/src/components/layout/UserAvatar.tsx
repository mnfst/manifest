import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/shadcn/button';

/**
 * User avatar component showing authenticated user info
 * Displays user email/initials and provides logout access
 */
export function UserAvatar() {
  const { user, isLoading, logout, getInitials } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Handle Escape key to close menu - must be declared before early returns
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMenuOpen, handleKeyDown]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-gray-600" />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const initials = getInitials();
  const displayName = user.name || user.email;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-3 w-full text-left text-nav-foreground hover:bg-nav-hover rounded-lg p-1 -m-1 h-auto"
      >
        <div
          className="w-9 h-9 rounded-full bg-nav-active flex items-center justify-center text-sm font-medium text-white"
          title={displayName}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">
            {displayName}
          </span>
          {user.name && (
            <span className="text-xs text-muted-foreground block truncate">
              {user.email}
            </span>
          )}
        </div>
      </Button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Menu */}
          <div className="absolute bottom-full left-0 mb-2 w-48 rounded-lg bg-nav border border-nav-foreground/20 shadow-lg z-20">
            <div className="py-1">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/settings?tab=account');
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-nav-foreground hover:bg-nav-hover justify-start rounded-none h-auto"
              >
                <svg
                  className="mr-3 h-4 w-4 text-nav-foreground/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                User Settings
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsMenuOpen(false);
                  logout();
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-nav-foreground hover:bg-nav-hover justify-start rounded-none h-auto"
              >
                <svg
                  className="mr-3 h-4 w-4 text-nav-foreground/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
