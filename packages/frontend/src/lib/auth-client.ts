import { createAuthClient } from 'better-auth/react';
import { BACKEND_URL } from './api';

/**
 * Better Auth client for frontend authentication
 * Provides React hooks and methods for login, signup, logout, session management
 */
export const authClient = createAuthClient({
  baseURL: BACKEND_URL,
});

// Export commonly used methods for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

// Type exports
export type Session = typeof authClient.$Infer.Session;
export type User = Session['user'];
