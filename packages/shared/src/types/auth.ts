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
  firstName?: string | null;
  lastName?: string | null;
  image?: string | null;
  createdAt: string;
}

/**
 * Request to update user profile
 */
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
}

/**
 * Response after updating user profile
 */
export interface UpdateProfileResponse {
  user: UserProfile;
  message: string;
}

/**
 * Request to change email address
 */
export interface ChangeEmailRequest {
  newEmail: string;
}

/**
 * Response after requesting email change
 */
export interface ChangeEmailResponse {
  message: string;
  pendingEmail: string;
  expiresAt: string;
}

/**
 * Request to verify email change
 */
export interface VerifyEmailChangeRequest {
  token: string;
}

/**
 * Response after verifying email change
 */
export interface VerifyEmailChangeResponse {
  user: UserProfile;
  message: string;
}

/**
 * Request to change password
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}

/**
 * Response after changing password
 */
export interface ChangePasswordResponse {
  message: string;
}
