/**
 * Test fixtures for Auth module tests (InvitationService and UserManagementService)
 */

import type { AppRole } from '@chatgpt-app-builder/shared';
import type { PendingInvitationEntity } from '../pending-invitation.entity';
import type { UserAppRoleEntity } from '../user-app-role.entity';
import type { AppEntity } from '../../app/app.entity';
import type { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity';

/**
 * Creates a mock PendingInvitationEntity
 */
export function createMockInvitation(
  overrides: Partial<PendingInvitationEntity> = {},
): PendingInvitationEntity {
  const now = new Date();
  return {
    id: 'invitation-1',
    email: 'invitee@example.com',
    token: '$2b$10$hashedtoken123456789012345678901234567890',
    appId: 'app-1',
    inviterId: 'user-1',
    role: 'viewer' as AppRole,
    createdAt: now,
    ...overrides,
  } as PendingInvitationEntity;
}

/**
 * Creates a mock UserAppRoleEntity
 */
export function createMockUserAppRole(
  overrides: Partial<UserAppRoleEntity> = {},
): UserAppRoleEntity {
  const now = new Date();
  return {
    id: 'role-1',
    userId: 'user-1',
    appId: 'app-1',
    role: 'viewer' as AppRole,
    createdAt: now,
    ...overrides,
  } as UserAppRoleEntity;
}

/**
 * Creates a mock AppEntity
 */
export function createMockAppEntity(
  overrides: Partial<AppEntity> = {},
): AppEntity {
  const now = new Date();
  return {
    id: 'app-1',
    name: 'Test App',
    slug: 'test-app',
    description: 'Test app description',
    status: 'draft',
    isPublic: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as AppEntity;
}

/**
 * Creates a mock SessionUser
 */
export function createMockSessionUser(
  overrides: Partial<{ id: string; email: string; name?: string }> = {},
): { id: string; email: string; name?: string } {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    ...overrides,
  };
}

/**
 * Creates a mock database user record
 */
export function createMockDbUser(
  overrides: Partial<{ id: string; email: string; name?: string | null }> = {},
): { id: string; email: string; name?: string | null } {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    ...overrides,
  };
}

/**
 * Creates a mock EmailVerificationTokenEntity
 */
export function createMockEmailVerificationToken(
  overrides: Partial<EmailVerificationTokenEntity> = {},
): EmailVerificationTokenEntity {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    id: 'token-1',
    token: 'verification-token-123',
    userId: 'user-1',
    currentEmail: 'old@example.com',
    newEmail: 'new@example.com',
    expiresAt,
    createdAt: now,
    usedAt: null,
    ...overrides,
  } as EmailVerificationTokenEntity;
}
