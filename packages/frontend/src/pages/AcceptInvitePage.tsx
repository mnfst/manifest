import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { InvitationValidation } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

/**
 * Page for accepting an app invitation via email link.
 * Flow:
 * 1. Validate the token from URL query param
 * 2. If user is authenticated, accept the invitation
 * 3. If user is not authenticated, store invitation context and redirect to auth
 * 4. After auth, accept the invitation automatically
 */
export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [validation, setValidation] = useState<InvitationValidation | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    appId: string;
    appName: string;
    message: string;
  } | null>(null);

  const token = searchParams.get('token');

  // Validate the token on mount
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setIsValidating(false);
      return;
    }

    async function validateToken() {
      try {
        const result = await api.validateInvitation(token!);
        setValidation(result);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to validate invitation');
        }
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  // Accept the invitation when authenticated
  useEffect(() => {
    if (authLoading || isValidating || !validation || !token) return;

    // If user is authenticated, accept the invitation
    if (isAuthenticated && user) {
      // Check if the email matches
      if (user.email.toLowerCase() !== validation.email.toLowerCase()) {
        setError(
          `This invitation was sent to ${validation.email}, but you're signed in as ${user.email}. ` +
          `Please sign out and sign in with the correct email address.`
        );
        return;
      }

      acceptInvitation();
    } else {
      // Store invitation context and redirect to auth
      sessionStorage.setItem('pendingInvitation', JSON.stringify({ token, validation }));
      navigate('/auth');
    }
  }, [isAuthenticated, authLoading, isValidating, validation, token, user, navigate]);

  async function acceptInvitation() {
    if (!token) return;

    setIsAccepting(true);
    setError(null);

    try {
      const result = await api.acceptInvitation({ token });
      // Clear any stored invitation context
      sessionStorage.removeItem('pendingInvitation');
      setSuccess({
        appId: result.appId,
        appName: result.appName,
        message: result.message,
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to accept invitation');
      }
    } finally {
      setIsAccepting(false);
    }
  }

  function handleGoToApp() {
    if (success) {
      navigate(`/app/${success.appId}`);
    }
  }

  // Loading state
  if (authLoading || isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isValidating ? 'Validating invitation...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Invitation Error
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Welcome to {success.appName}!
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {success.message}
            </p>
          </div>
          <button
            onClick={handleGoToApp}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Open App
          </button>
        </div>
      </div>
    );
  }

  // Accepting state
  if (isAccepting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Accepting invitation...
          </p>
        </div>
      </div>
    );
  }

  // Default fallback (shouldn't normally reach here)
  return null;
}
