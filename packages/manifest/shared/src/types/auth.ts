/**
 * Authentication and authorization types
 */

/**
 * Default admin user credentials for development/POC.
 * Used by seed service and can be pre-filled on login page.
 */
export const DEFAULT_ADMIN_USER = {
  email: 'admin@manifest.build',
  password: 'manifest',
  firstName: 'Admin',
  lastName: 'User',
  name: 'Admin User',
} as const;

/**
 * Response from the default user check endpoint
 */
export interface DefaultUserCheckResponse {
  exists: boolean;
  email?: string;
  password?: string;
}

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
 * Pending invitation to an app
 */
export interface PendingInvitation {
  id: string;
  email: string;
  role: AppRole;
  appId: string;
  invitedBy: string;
  inviterName?: string;
  createdAt: string;
}

/**
 * Request to create an invitation
 */
export interface CreateInvitationRequest {
  email: string;
  role: AppRole;
}

/**
 * Request to accept an invitation
 */
export interface AcceptInvitationRequest {
  token: string;
}

/**
 * Combined user list item (active user or pending invitation)
 */
export interface AppUserListItem {
  id: string;
  email: string;
  role: AppRole;
  createdAt: string;
  status: 'active' | 'pending';
  // Active user fields
  name?: string | null;
  isOwner?: boolean;
  // Pending invitation fields
  invitedBy?: string;
  inviterName?: string;
}

/**
 * Invitation validation response
 */
export interface InvitationValidation {
  valid: boolean;
  email: string;
  appId: string;
  appName: string;
  inviterName: string;
  role: AppRole;
}

/**
 * Response after accepting an invitation
 */
export interface AcceptInvitationResponse {
  success: boolean;
  appId: string;
  appName: string;
  role: AppRole;
  message: string;
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
