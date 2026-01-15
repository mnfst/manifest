/**
 * Unit tests for UserManagementService
 *
 * Tests user management operations including app access, profile updates,
 * email changes, and password changes.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { UserAppRoleEntity } from './user-app-role.entity';
import { PendingInvitationEntity } from './pending-invitation.entity';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { AppAccessService } from './app-access.service';
import { EmailService } from '../email/email.service';
import {
  createMockUserAppRoleRepository,
  createMockInvitationRepository,
  createMockEmailVerificationTokenRepository,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockUserAppRole,
  createMockInvitation,
  createMockEmailVerificationToken,
} from './test/fixtures';

// Mock better-sqlite3 - returns null by default (no user found)
const mockDbPrepare = jest.fn();
const mockDbClose = jest.fn();
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: mockDbPrepare,
    close: mockDbClose,
  }));
});

// Mock auth module
jest.mock('./auth', () => ({
  auth: {
    api: {
      changePassword: jest.fn(),
      signInEmail: jest.fn(),
    },
  },
}));

describe('UserManagementService', () => {
  let service: UserManagementService;
  let mockUserAppRoleRepo: MockRepository<UserAppRoleEntity>;
  let mockInvitationRepo: MockRepository<PendingInvitationEntity>;
  let mockEmailVerificationRepo: MockRepository<EmailVerificationTokenEntity>;
  let mockAppAccessService: {
    getUserAppRole: jest.Mock;
    assignRole: jest.Mock;
    removeAccess: jest.Mock;
    canManageUsers: jest.Mock;
  };
  let mockEmailService: { sendEmailChangeVerification: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    // Reset better-sqlite3 mock
    mockDbPrepare.mockReturnValue({
      get: jest.fn().mockReturnValue(null),
      run: jest.fn(),
    });

    mockUserAppRoleRepo = createMockUserAppRoleRepository();
    mockInvitationRepo = createMockInvitationRepository();
    mockEmailVerificationRepo = createMockEmailVerificationTokenRepository();
    mockAppAccessService = {
      getUserAppRole: jest.fn(),
      assignRole: jest.fn(),
      removeAccess: jest.fn(),
      canManageUsers: jest.fn(),
    };
    mockEmailService = { sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined) };
    mockConfigService = { get: jest.fn().mockReturnValue('http://localhost:5173') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserManagementService,
        {
          provide: getRepositoryToken(UserAppRoleEntity),
          useValue: mockUserAppRoleRepo,
        },
        {
          provide: getRepositoryToken(PendingInvitationEntity),
          useValue: mockInvitationRepo,
        },
        {
          provide: getRepositoryToken(EmailVerificationTokenEntity),
          useValue: mockEmailVerificationRepo,
        },
        {
          provide: AppAccessService,
          useValue: mockAppAccessService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UserManagementService>(UserManagementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for getAppUsers()
  // ============================================================
  describe('getAppUsers', () => {
    it('should return users sorted with owners first', async () => {
      const roles = [
        createMockUserAppRole({ userId: 'user-1', role: 'viewer' }),
        createMockUserAppRole({ userId: 'user-2', role: 'owner' }),
      ];
      mockUserAppRoleRepo.find!.mockResolvedValue(roles);
      mockDbPrepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'user-1', email: 'viewer@example.com', name: 'Viewer' })
          .mockReturnValueOnce({ id: 'user-2', email: 'owner@example.com', name: 'Owner' }),
      });

      const result = await service.getAppUsers('app-1');

      expect(result.length).toBe(2);
      expect(result[0].isOwner).toBe(true);
      expect(result[1].isOwner).toBe(false);
    });

    it('should return empty array when no users have access', async () => {
      mockUserAppRoleRepo.find!.mockResolvedValue([]);

      const result = await service.getAppUsers('app-1');

      expect(result).toEqual([]);
    });

    it('should filter out users not found in database', async () => {
      const roles = [
        createMockUserAppRole({ userId: 'user-1', role: 'viewer' }),
      ];
      mockUserAppRoleRepo.find!.mockResolvedValue(roles);
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      });

      const result = await service.getAppUsers('app-1');

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // Tests for getAppUsersWithPending()
  // ============================================================
  describe('getAppUsersWithPending', () => {
    it('should return both active users and pending invitations', async () => {
      const roles = [createMockUserAppRole({ userId: 'user-1', role: 'owner' })];
      const invitations = [createMockInvitation({ email: 'pending@example.com' })];
      mockUserAppRoleRepo.find!.mockResolvedValue(roles);
      mockInvitationRepo.find!.mockResolvedValue(invitations);
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'user-1', email: 'owner@example.com', name: 'Owner' }),
      });

      const result = await service.getAppUsersWithPending('app-1');

      expect(result.length).toBe(2);
      const activeUsers = result.filter(u => u.status === 'active');
      const pendingUsers = result.filter(u => u.status === 'pending');
      expect(activeUsers.length).toBe(1);
      expect(pendingUsers.length).toBe(1);
    });

    it('should sort with owners first, then active, then pending', async () => {
      const roles = [
        createMockUserAppRole({ userId: 'user-1', role: 'viewer' }),
        createMockUserAppRole({ userId: 'user-2', role: 'owner' }),
      ];
      const invitations = [createMockInvitation({ email: 'pending@example.com' })];
      mockUserAppRoleRepo.find!.mockResolvedValue(roles);
      mockInvitationRepo.find!.mockResolvedValue(invitations);
      mockDbPrepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'user-1', email: 'viewer@example.com', name: 'Viewer' })
          .mockReturnValueOnce({ id: 'user-2', email: 'owner@example.com', name: 'Owner' })
          .mockReturnValueOnce({ id: 'inviter', email: 'inviter@example.com', name: 'Inviter' }),
      });

      const result = await service.getAppUsersWithPending('app-1');

      expect(result[0].isOwner).toBe(true);
      expect(result[result.length - 1].status).toBe('pending');
    });
  });

  // ============================================================
  // Tests for addUserToApp()
  // ============================================================
  describe('addUserToApp', () => {
    it('should add user to app', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'user-2', email: 'new@example.com', name: 'New User' }),
      });
      mockAppAccessService.getUserAppRole.mockResolvedValue(null);
      mockAppAccessService.assignRole.mockResolvedValue(
        createMockUserAppRole({ userId: 'user-2', role: 'editor' }),
      );

      const result = await service.addUserToApp('app-1', 'new@example.com', 'editor');

      expect(result.email).toBe('new@example.com');
      expect(result.role).toBe('editor');
      expect(mockAppAccessService.assignRole).toHaveBeenCalledWith('user-2', 'app-1', 'editor');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      });

      await expect(
        service.addUserToApp('app-1', 'nonexistent@example.com', 'viewer'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user already has access', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'user-2', email: 'existing@example.com', name: 'User' }),
      });
      mockAppAccessService.getUserAppRole.mockResolvedValue('editor');

      await expect(
        service.addUserToApp('app-1', 'existing@example.com', 'viewer'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to assign owner role', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'user-2', email: 'new@example.com', name: 'User' }),
      });
      mockAppAccessService.getUserAppRole.mockResolvedValue(null);

      await expect(
        service.addUserToApp('app-1', 'new@example.com', 'owner'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // Tests for removeUserFromApp()
  // ============================================================
  describe('removeUserFromApp', () => {
    it('should remove user from app', async () => {
      mockAppAccessService.getUserAppRole.mockResolvedValue('editor');
      mockAppAccessService.removeAccess.mockResolvedValue(undefined);

      await service.removeUserFromApp('app-1', 'user-2');

      expect(mockAppAccessService.removeAccess).toHaveBeenCalledWith('user-2', 'app-1');
    });

    it('should throw NotFoundException when user not found in app', async () => {
      mockAppAccessService.getUserAppRole.mockResolvedValue(null);

      await expect(
        service.removeUserFromApp('app-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when trying to remove owner', async () => {
      mockAppAccessService.getUserAppRole.mockResolvedValue('owner');

      await expect(
        service.removeUserFromApp('app-1', 'owner-user'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // Tests for searchUserByEmail()
  // ============================================================
  describe('searchUserByEmail', () => {
    it('should return user when found', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'user-1', email: 'found@example.com', name: 'Found' }),
      });

      const result = await service.searchUserByEmail('found@example.com');

      expect(result).toEqual({
        id: 'user-1',
        email: 'found@example.com',
        name: 'Found',
      });
    });

    it('should return null when user not found', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      });

      const result = await service.searchUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // Tests for requestEmailChange()
  // ============================================================
  describe('requestEmailChange', () => {
    it('should create verification token and send email', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null), // No existing user with new email
      });
      mockEmailVerificationRepo.update!.mockResolvedValue({ affected: 0 });
      mockEmailVerificationRepo.create!.mockReturnValue(createMockEmailVerificationToken());
      mockEmailVerificationRepo.save!.mockResolvedValue(createMockEmailVerificationToken());

      const result = await service.requestEmailChange(
        'user-1',
        'old@example.com',
        { newEmail: 'new@example.com' },
      );

      expect(result.pendingEmail).toBe('new@example.com');
      expect(mockEmailService.sendEmailChangeVerification).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid email format', async () => {
      await expect(
        service.requestEmailChange('user-1', 'old@example.com', { newEmail: 'invalid-email' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when new email is same as current', async () => {
      await expect(
        service.requestEmailChange('user-1', 'same@example.com', { newEmail: 'same@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when email is already in use', async () => {
      mockDbPrepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'other-user', email: 'taken@example.com' }),
      });

      await expect(
        service.requestEmailChange('user-1', 'old@example.com', { newEmail: 'taken@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // Tests for verifyEmailChange()
  // ============================================================
  describe('verifyEmailChange', () => {
    it('should throw BadRequestException for invalid token', async () => {
      mockEmailVerificationRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.verifyEmailChange('invalid-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already used token', async () => {
      const usedToken = createMockEmailVerificationToken({ usedAt: new Date() });
      mockEmailVerificationRepo.findOne!.mockResolvedValue(usedToken);

      await expect(
        service.verifyEmailChange('used-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 25); // 25 hours ago
      const expiredToken = createMockEmailVerificationToken({ expiresAt: expiredDate });
      mockEmailVerificationRepo.findOne!.mockResolvedValue(expiredToken);

      await expect(
        service.verifyEmailChange('expired-token'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // Tests for cleanupExpiredTokens()
  // ============================================================
  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      mockEmailVerificationRepo.delete!.mockResolvedValue({ affected: 5 });

      const result = await service.cleanupExpiredTokens();

      expect(result.deleted).toBe(5);
    });

    it('should return 0 when no expired tokens', async () => {
      mockEmailVerificationRepo.delete!.mockResolvedValue({ affected: 0 });

      const result = await service.cleanupExpiredTokens();

      expect(result.deleted).toBe(0);
    });
  });
});
