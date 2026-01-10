import { useEffect } from 'react';
import { AuthTabs } from '../components/auth/AuthTabs';
import { useAuth } from '../hooks/useAuth';

/**
 * Authentication page with login/signup tabs.
 * Redirects to home if already authenticated.
 */
export function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = '/';
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state while checking session
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and title */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <img
              src="/favicon.svg"
              alt="Manifest"
              className="h-16 w-16"
            />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Manifest
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account or create a new one
          </p>
        </div>

        {/* Auth tabs card */}
        <div className="rounded-lg bg-white p-8 shadow dark:bg-gray-800">
          <AuthTabs />
        </div>

        {/* Default credentials hint */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Default admin: admin@manifest.build / admin
          </p>
        </div>
      </div>
    </div>
  );
}
