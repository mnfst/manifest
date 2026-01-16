/**
 * Mock TypeORM Repository factories for Auth module tests
 */

import type { Repository } from 'typeorm';
import type { PendingInvitationEntity } from '../pending-invitation.entity';
import type { UserAppRoleEntity } from '../user-app-role.entity';
import type { AppEntity } from '../../app/app.entity';
import type { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity';

/**
 * Type for mocked repository methods
 */
export type MockRepository<T> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

/**
 * Creates a mock TypeORM Repository for PendingInvitationEntity
 */
export function createMockInvitationRepository(): MockRepository<PendingInvitationEntity> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

/**
 * Creates a mock TypeORM Repository for UserAppRoleEntity
 */
export function createMockUserAppRoleRepository(): MockRepository<UserAppRoleEntity> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

/**
 * Creates a mock TypeORM Repository for AppEntity
 */
export function createMockAppRepository(): MockRepository<AppEntity> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
  };
}

/**
 * Creates a mock TypeORM Repository for EmailVerificationTokenEntity
 */
export function createMockEmailVerificationTokenRepository(): MockRepository<EmailVerificationTokenEntity> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}
