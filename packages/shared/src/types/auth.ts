/**
 * Authentication and authorization types
 */

/**
 * User role for app access
 * - owner: Full access, cannot be removed
 * - admin: Full access, can be removed by owner or other admins
 */
export type AppRole = 'owner' | 'admin';

/**
 * User with access to an app (for user management)
 */
export interface AppUser {
  id: string;
  email: string;
  name?: string | null;
  role: AppRole;
  isOwner: boolean;
  createdAt: string;
}

/**
 * Request to add a user to an app
 */
export interface AddUserRequest {
  email: string;
  role: AppRole;
}

/**
 * Current user profile
 */
export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  createdAt: string;
}
