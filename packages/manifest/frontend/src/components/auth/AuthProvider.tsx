import { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication wrapper that redirects to login if not authenticated.
 * Shows loading state while checking session.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking session
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth page if not authenticated
  if (!isAuthenticated) {
    // Check if we're already on the auth page to prevent redirect loop
    if (window.location.pathname !== '/auth') {
      window.location.href = '/auth';
      return null;
    }
  }

  return <>{children}</>;
}
