import { useSession, signOut, type User } from '../lib/auth-client';

/**
 * Auth hook for accessing current user and authentication state
 * Wraps better-auth's useSession hook with additional convenience properties
 */
export function useAuth() {
  const { data: session, isPending, error, refetch } = useSession();

  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const isLoading = isPending;

  /**
   * Get user initials from email or name
   */
  const getInitials = (u: User | null): string => {
    if (!u) return '?';

    // If user has a name, use first letters of first and last name
    if (u.name) {
      const parts = u.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }

    // Fall back to first two characters of email
    return u.email.substring(0, 2).toUpperCase();
  };

  /**
   * Log out the current user
   */
  const logout = async () => {
    await signOut();
    // Redirect to auth page after logout
    window.location.href = '/auth';
  };

  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    error,
    refetch,
    logout,
    getInitials: () => getInitials(user),
  };
}
