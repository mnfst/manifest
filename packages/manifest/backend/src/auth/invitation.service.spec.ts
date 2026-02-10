/**
 * Unit tests for InvitationService
 *
 * Tests invitation lifecycle including creation, validation,
 * acceptance, and revocation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { normalizeEmail } from '@manifest/shared';
import { PendingInvitationEntity } from './pending-invitation.entity';
import { UserAppRoleEntity } from './user-app-role.entity';
import { AppEntity } from '../app/app.entity';
import { EmailService } from '../email/email.service';
import {
  createMockInvitationRepository,
  createMockUserAppRoleRepository,
  createMockAppRepository,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockInvitation,
  createMockUserAppRole,
  createMockAppEntity,
} from './test/fixtures';
import * as bcrypt from 'bcrypt';

// Mock better-sqlite3 to avoid actual database access
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    }),
    close: jest.fn(),
  }));
});

// Mock bcrypt for faster tests with predictable results
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$mockedhash'),
  compare: jest.fn(),
}));

// Get mocked bcrypt
const mockedBcrypt = jest.mocked(bcrypt);

describe('InvitationService', () => {
  let service: InvitationService;
  let mockInvitationRepo: MockRepository<PendingInvitationEntity>;
  let mockUserAppRoleRepo: MockRepository<UserAppRoleEntity>;
  let mockAppRepo: MockRepository<AppEntity>;
  let mockEmailService: { sendInvitation: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockInvitationRepo = createMockInvitationRepository();
    mockUserAppRoleRepo = createMockUserAppRoleRepository();
    mockAppRepo = createMockAppRepository();
    mockEmailService = { sendInvitation: jest.fn().mockResolvedValue(undefined) };
    mockConfigService = { get: jest.fn().mockReturnValue('http://localhost:5173') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: getRepositoryToken(PendingInvitationEntity),
          useValue: mockInvitationRepo,
        },
        {
          provide: getRepositoryToken(UserAppRoleEntity),
          useValue: mockUserAppRoleRepo,
        },
        {
          provide: getRepositoryToken(AppEntity),
          useValue: mockAppRepo,
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

    service = module.get<InvitationService>(InvitationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for generateToken()
  // ============================================================
  describe('generateToken', () => {
    it('should generate a non-empty token', () => {
      const token = service.generateToken();

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate base64url encoded token', () => {
      const token = service.generateToken();

      // base64url uses alphanumeric, - and _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  // ============================================================
  // Tests for hashToken()
  // ============================================================
  describe('hashToken', () => {
    it('should hash a token', async () => {
      const token = 'test-token';

      const hash = await service.hashToken(token);

      expect(hash).toBeDefined();
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(token, 10);
    });
  });

  // ============================================================
  // Tests for verifyToken()
  // ============================================================
  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.verifyToken('token', 'hash');

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('token', 'hash');
    });

    it('should reject invalid token', async () => {
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await service.verifyToken('wrong-token', 'hash');

      expect(result).toBe(false);
    });
  });

  // ============================================================
  // Tests for normalizeEmail() (now in @manifest/shared)
  // ============================================================
  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      const result = normalizeEmail('USER@EXAMPLE.COM');

      expect(result).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      const result = normalizeEmail('  user@example.com  ');

      expect(result).toBe('user@example.com');
    });

    it('should handle mixed case and whitespace', () => {
      const result = normalizeEmail('  User@Example.COM  ');

      expect(result).toBe('user@example.com');
    });
  });

  // ============================================================
  // Tests for toDto()
  // ============================================================
  describe('toDto', () => {
    it('should convert entity to DTO', () => {
      const entity = createMockInvitation();

      const dto = service.toDto(entity, 'Inviter Name');

      expect(dto.id).toBe(entity.id);
      expect(dto.email).toBe(entity.email);
      expect(dto.role).toBe(entity.role);
      expect(dto.appId).toBe(entity.appId);
      expect(dto.invitedBy).toBe(entity.inviterId);
      expect(dto.inviterName).toBe('Inviter Name');
      expect(dto.createdAt).toBe(entity.createdAt.toISOString());
    });

    it('should handle undefined inviter name', () => {
      const entity = createMockInvitation();

      const dto = service.toDto(entity);

      expect(dto.inviterName).toBeUndefined();
    });
  });

  // ============================================================
  // Tests for createInvitation()
  // ============================================================
  describe('createInvitation', () => {
    it('should create invitation and send email', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(null);
      mockAppRepo.findOne!.mockResolvedValue(createMockAppEntity());
      mockInvitationRepo.create!.mockReturnValue(createMockInvitation());
      mockInvitationRepo.save!.mockResolvedValue(createMockInvitation());

      const result = await service.createInvitation(
        'app-1',
        'new@example.com',
        'editor',
        'inviter-id',
        'Inviter Name',
      );

      expect(result).toBeDefined();
      expect(mockInvitationRepo.create).toHaveBeenCalled();
      expect(mockInvitationRepo.save).toHaveBeenCalled();
      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith(
        'new@example.com',
        expect.objectContaining({
          inviterName: 'Inviter Name',
          appName: 'Test App',
        }),
      );
    });

    it('should throw ConflictException if invitation already exists', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(createMockInvitation());

      await expect(
        service.createInvitation('app-1', 'existing@example.com', 'viewer', 'user-1', 'Inviter'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if app not found', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(null);
      mockAppRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.createInvitation('non-existent', 'email@example.com', 'viewer', 'user-1', 'Inviter'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should normalize email before creating invitation', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(null);
      mockAppRepo.findOne!.mockResolvedValue(createMockAppEntity());
      mockInvitationRepo.create!.mockReturnValue(createMockInvitation());
      mockInvitationRepo.save!.mockResolvedValue(createMockInvitation());

      await service.createInvitation(
        'app-1',
        '  USER@EXAMPLE.COM  ',
        'viewer',
        'user-1',
        'Inviter',
      );

      expect(mockInvitationRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com', appId: 'app-1' },
      });
    });
  });

  // ============================================================
  // Tests for listPendingInvitations()
  // ============================================================
  describe('listPendingInvitations', () => {
    it('should return list of pending invitations', async () => {
      const invitations = [
        createMockInvitation({ id: 'inv-1' }),
        createMockInvitation({ id: 'inv-2' }),
      ];
      mockInvitationRepo.find!.mockResolvedValue(invitations);

      const result = await service.listPendingInvitations('app-1');

      expect(result).toHaveLength(2);
      expect(mockInvitationRepo.find).toHaveBeenCalledWith({
        where: { appId: 'app-1' },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when no invitations exist', async () => {
      mockInvitationRepo.find!.mockResolvedValue([]);

      const result = await service.listPendingInvitations('app-1');

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // Tests for revokeInvitation()
  // ============================================================
  describe('revokeInvitation', () => {
    it('should delete invitation', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(createMockInvitation());
      mockInvitationRepo.delete!.mockResolvedValue({ affected: 1 });

      await service.revokeInvitation('inv-1', 'app-1');

      expect(mockInvitationRepo.delete).toHaveBeenCalledWith('inv-1');
    });

    it('should throw NotFoundException if invitation not found', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.revokeInvitation('non-existent', 'app-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for resendInvitation()
  // ============================================================
  describe('resendInvitation', () => {
    it('should update token and resend email', async () => {
      const invitation = createMockInvitation();
      mockInvitationRepo.findOne!.mockResolvedValue(invitation);
      mockAppRepo.findOne!.mockResolvedValue(createMockAppEntity());
      mockInvitationRepo.save!.mockResolvedValue(invitation);

      const result = await service.resendInvitation('inv-1', 'app-1', 'Inviter');

      expect(result).toBeDefined();
      expect(mockInvitationRepo.save).toHaveBeenCalled();
      expect(mockEmailService.sendInvitation).toHaveBeenCalled();
    });

    it('should throw NotFoundException if invitation not found', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.resendInvitation('non-existent', 'app-1', 'Inviter'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if app not found', async () => {
      mockInvitationRepo.findOne!.mockResolvedValue(createMockInvitation());
      mockAppRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.resendInvitation('inv-1', 'app-1', 'Inviter'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for validateToken()
  // ============================================================
  describe('validateToken', () => {
    it('should validate correct token', async () => {
      const invitation = createMockInvitation();
      mockInvitationRepo.find!.mockResolvedValue([invitation]);
      mockAppRepo.findOne!.mockResolvedValue(createMockAppEntity());
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe(invitation.email);
      expect(result.appId).toBe(invitation.appId);
      expect(result.role).toBe(invitation.role);
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockInvitationRepo.find!.mockResolvedValue([createMockInvitation()]);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when no invitations exist', async () => {
      mockInvitationRepo.find!.mockResolvedValue([]);

      await expect(service.validateToken('any-token')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Tests for acceptInvitation()
  // ============================================================
  describe('acceptInvitation', () => {
    it('should create user app role and delete invitation', async () => {
      const invitation = createMockInvitation({ email: 'user@example.com' });
      mockInvitationRepo.find!.mockResolvedValue([invitation]);
      mockUserAppRoleRepo.findOne!.mockResolvedValue(null);
      mockUserAppRoleRepo.create!.mockReturnValue(createMockUserAppRole());
      mockUserAppRoleRepo.save!.mockResolvedValue(createMockUserAppRole());
      mockInvitationRepo.delete!.mockResolvedValue({ affected: 1 });
      mockAppRepo.findOne!.mockResolvedValue(createMockAppEntity());
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.acceptInvitation(
        'valid-token',
        'user-id',
        'user@example.com',
      );

      expect(result.success).toBe(true);
      expect(result.appId).toBe(invitation.appId);
      expect(mockUserAppRoleRepo.create).toHaveBeenCalled();
      expect(mockUserAppRoleRepo.save).toHaveBeenCalled();
      expect(mockInvitationRepo.delete).toHaveBeenCalledWith(invitation.id);
    });

    it('should throw BadRequestException if email does not match', async () => {
      const invitation = createMockInvitation({ email: 'other@example.com' });
      mockInvitationRepo.find!.mockResolvedValue([invitation]);
      mockedBcrypt.compare.mockResolvedValue(true);

      await expect(
        service.acceptInvitation('token', 'user-id', 'different@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle user already having access', async () => {
      const invitation = createMockInvitation({ email: 'user@example.com' });
      mockInvitationRepo.find!.mockResolvedValue([invitation]);
      mockUserAppRoleRepo.findOne!.mockResolvedValue(createMockUserAppRole());
      mockInvitationRepo.delete!.mockResolvedValue({ affected: 1 });
      mockAppRepo.findOne!.mockResolvedValue(createMockAppEntity());
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.acceptInvitation(
        'token',
        'user-id',
        'user@example.com',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('already have access');
      expect(mockUserAppRoleRepo.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockInvitationRepo.find!.mockResolvedValue([createMockInvitation()]);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.acceptInvitation('invalid', 'user-id', 'email@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
