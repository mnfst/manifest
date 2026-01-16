/**
 * Unit tests for InvitationController
 *
 * Tests HTTP endpoint behavior with mocked services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { AppAccessService } from './app-access.service';
import type { PendingInvitation, InvitationValidation, AcceptInvitationResponse } from '@chatgpt-app-builder/shared';

describe('InvitationController', () => {
  let controller: InvitationController;
  let mockInvitationService: {
    createInvitation: jest.Mock;
    listPendingInvitations: jest.Mock;
    revokeInvitation: jest.Mock;
    resendInvitation: jest.Mock;
    validateToken: jest.Mock;
    acceptInvitation: jest.Mock;
  };
  let mockAppAccessService: {
    canManageUsers: jest.Mock;
  };

  const mockUser = { id: 'user-1', email: 'user@example.com', name: 'Test User' };

  beforeEach(async () => {
    mockInvitationService = {
      createInvitation: jest.fn(),
      listPendingInvitations: jest.fn(),
      revokeInvitation: jest.fn(),
      resendInvitation: jest.fn(),
      validateToken: jest.fn(),
      acceptInvitation: jest.fn(),
    };

    mockAppAccessService = {
      canManageUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        {
          provide: InvitationService,
          useValue: mockInvitationService,
        },
        {
          provide: AppAccessService,
          useValue: mockAppAccessService,
        },
      ],
    }).compile();

    controller = module.get<InvitationController>(InvitationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for POST /apps/:appId/invitations
  // ============================================================
  describe('createInvitation', () => {
    const mockInvitation: PendingInvitation = {
      id: 'inv-1',
      email: 'invitee@example.com',
      role: 'editor',
      appId: 'app-1',
      invitedBy: 'user-1',
      inviterName: 'Test User',
      createdAt: new Date().toISOString(),
    };

    it('should create invitation when user can manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(true);
      mockInvitationService.createInvitation.mockResolvedValue(mockInvitation);

      const result = await controller.createInvitation(
        'app-1',
        { email: 'invitee@example.com', role: 'editor' },
        mockUser,
      );

      expect(result).toEqual(mockInvitation);
      expect(mockInvitationService.createInvitation).toHaveBeenCalledWith(
        'app-1',
        'invitee@example.com',
        'editor',
        'user-1',
        'Test User',
      );
    });

    it('should throw NotFoundException when user cannot manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(false);

      await expect(
        controller.createInvitation(
          'app-1',
          { email: 'invitee@example.com', role: 'viewer' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use email as inviter name when name is undefined', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(true);
      mockInvitationService.createInvitation.mockResolvedValue(mockInvitation);
      const userWithoutName = { id: 'user-1', email: 'user@example.com' };

      await controller.createInvitation(
        'app-1',
        { email: 'invitee@example.com', role: 'viewer' },
        userWithoutName,
      );

      expect(mockInvitationService.createInvitation).toHaveBeenCalledWith(
        'app-1',
        'invitee@example.com',
        'viewer',
        'user-1',
        'user@example.com',
      );
    });
  });

  // ============================================================
  // Tests for GET /apps/:appId/invitations
  // ============================================================
  describe('listInvitations', () => {
    const mockInvitations: PendingInvitation[] = [
      {
        id: 'inv-1',
        email: 'user1@example.com',
        role: 'viewer',
        appId: 'app-1',
        invitedBy: 'user-1',
        createdAt: new Date().toISOString(),
      },
    ];

    it('should return list of invitations', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(true);
      mockInvitationService.listPendingInvitations.mockResolvedValue(mockInvitations);

      const result = await controller.listInvitations('app-1', mockUser);

      expect(result).toEqual(mockInvitations);
      expect(mockInvitationService.listPendingInvitations).toHaveBeenCalledWith('app-1');
    });

    it('should throw NotFoundException when user cannot manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(false);

      await expect(
        controller.listInvitations('app-1', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for DELETE /apps/:appId/invitations/:invitationId
  // ============================================================
  describe('revokeInvitation', () => {
    it('should revoke invitation', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(true);
      mockInvitationService.revokeInvitation.mockResolvedValue(undefined);

      await controller.revokeInvitation('app-1', 'inv-1', mockUser);

      expect(mockInvitationService.revokeInvitation).toHaveBeenCalledWith('inv-1', 'app-1');
    });

    it('should throw NotFoundException when user cannot manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(false);

      await expect(
        controller.revokeInvitation('app-1', 'inv-1', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for POST /apps/:appId/invitations/:invitationId/resend
  // ============================================================
  describe('resendInvitation', () => {
    const mockInvitation: PendingInvitation = {
      id: 'inv-1',
      email: 'user@example.com',
      role: 'viewer',
      appId: 'app-1',
      invitedBy: 'user-1',
      createdAt: new Date().toISOString(),
    };

    it('should resend invitation', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(true);
      mockInvitationService.resendInvitation.mockResolvedValue(mockInvitation);

      const result = await controller.resendInvitation('app-1', 'inv-1', mockUser);

      expect(result).toEqual(mockInvitation);
      expect(mockInvitationService.resendInvitation).toHaveBeenCalledWith(
        'inv-1',
        'app-1',
        'Test User',
      );
    });

    it('should throw NotFoundException when user cannot manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(false);

      await expect(
        controller.resendInvitation('app-1', 'inv-1', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for GET /invitations/validate
  // ============================================================
  describe('validateToken', () => {
    const mockValidation: InvitationValidation = {
      valid: true,
      email: 'user@example.com',
      appId: 'app-1',
      appName: 'Test App',
      inviterName: 'Inviter',
      role: 'viewer',
    };

    it('should validate token', async () => {
      mockInvitationService.validateToken.mockResolvedValue(mockValidation);

      const result = await controller.validateToken('valid-token');

      expect(result).toEqual(mockValidation);
      expect(mockInvitationService.validateToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw NotFoundException when token is missing', async () => {
      await expect(controller.validateToken('')).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for POST /invitations/accept
  // ============================================================
  describe('acceptInvitation', () => {
    const mockResponse: AcceptInvitationResponse = {
      success: true,
      appId: 'app-1',
      appName: 'Test App',
      role: 'viewer',
      message: 'Welcome!',
    };

    it('should accept invitation', async () => {
      mockInvitationService.acceptInvitation.mockResolvedValue(mockResponse);

      const result = await controller.acceptInvitation(
        { token: 'valid-token' },
        mockUser,
      );

      expect(result).toEqual(mockResponse);
      expect(mockInvitationService.acceptInvitation).toHaveBeenCalledWith(
        'valid-token',
        'user-1',
        'user@example.com',
      );
    });
  });
});
