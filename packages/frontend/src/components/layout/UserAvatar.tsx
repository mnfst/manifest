import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

/**
 * User avatar component showing authenticated user info
 * Displays user email/initials and provides logout access
 */
export function UserAvatar() {
  const { user, isLoading, logout, getInitials } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-3 w-full text-left hover:bg-nav-hover rounded-lg p-1 -m-1 transition-colors"
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
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsMenuOpen(false)}
          />
          {/* Menu */}
          <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  logout();
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg
                  className="mr-3 h-4 w-4 text-gray-400"
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
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
