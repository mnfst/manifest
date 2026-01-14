/**
 * Unit tests for FlowController
 *
 * Tests all HTTP endpoints with mocked FlowService.
 * Verifies request handling, validation, and response shaping.
 *
 * Test organization:
 * - Each endpoint has its own describe block
 * - Success paths tested first, then error paths
 * - Validation tests included where applicable
 */

// Mock the auth module to avoid better-auth ESM import issues
jest.mock('../auth', () => ({
  AppAccessGuard: class MockAppAccessGuard {
    canActivate() {
      return true;
    }
  },
  FlowAccessGuard: class MockFlowAccessGuard {
    canActivate() {
      return true;
    }
  },
  Public: () => () => ({}),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import {
  createMockFlow,
  createMockFlowDeletionCheck,
  createMockDeleteFlowResponse,
} from './test/fixtures';

describe('FlowController', () => {
  let controller: FlowController;
  let mockFlowService: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockFlowService = {
      findByAppId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      checkDeletion: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlowController],
      providers: [
        {
          provide: FlowService,
          useValue: mockFlowService,
        },
      ],
    }).compile();

    controller = module.get<FlowController>(FlowController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for listFlows() - GET /api/apps/:appId/flows
  // ============================================================
  describe('listFlows (GET /api/apps/:appId/flows)', () => {
    it('should return array of flows for an app', async () => {
      const mockFlows = [
        createMockFlow({ id: '1', name: 'Flow 1' }),
        createMockFlow({ id: '2', name: 'Flow 2' }),
      ];
      mockFlowService.findByAppId.mockResolvedValue(mockFlows);

      const result = await controller.listFlows('app-id');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Flow 1');
      expect(result[1].name).toBe('Flow 2');
      expect(mockFlowService.findByAppId).toHaveBeenCalledWith('app-id');
    });

    it('should return empty array when no flows exist', async () => {
      mockFlowService.findByAppId.mockResolvedValue([]);

      const result = await controller.listFlows('app-id');

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // Tests for createFlow() - POST /api/apps/:appId/flows
  // ============================================================
  describe('createFlow (POST /api/apps/:appId/flows)', () => {
    it('should create flow with valid name and description', async () => {
      const mockFlow = createMockFlow({ id: 'new-flow', name: 'New Flow' });
      mockFlowService.create.mockResolvedValue(mockFlow);
      mockFlowService.findById.mockResolvedValue(mockFlow);

      const result = await controller.createFlow('app-id', {
        name: 'New Flow',
        description: 'A description',
      });

      expect(result.flow.name).toBe('New Flow');
      expect(result.redirectTo).toBe('/app/app-id/flow/new-flow');
      expect(mockFlowService.create).toHaveBeenCalledWith('app-id', {
        name: 'New Flow',
        description: 'A description',
      });
    });

    it('should trim whitespace from name', async () => {
      const mockFlow = createMockFlow({ name: 'Trimmed Name' });
      mockFlowService.create.mockResolvedValue(mockFlow);
      mockFlowService.findById.mockResolvedValue(mockFlow);

      await controller.createFlow('app-id', { name: '  Trimmed Name  ' });

      expect(mockFlowService.create).toHaveBeenCalledWith('app-id', {
        name: 'Trimmed Name',
        description: undefined,
      });
    });

    it('should trim whitespace from description', async () => {
      const mockFlow = createMockFlow({ description: 'Trimmed Desc' });
      mockFlowService.create.mockResolvedValue(mockFlow);
      mockFlowService.findById.mockResolvedValue(mockFlow);

      await controller.createFlow('app-id', {
        name: 'Test',
        description: '  Trimmed Desc  ',
      });

      expect(mockFlowService.create).toHaveBeenCalledWith('app-id', {
        name: 'Test',
        description: 'Trimmed Desc',
      });
    });

    it('should throw BadRequestException for empty name', async () => {
      await expect(
        controller.createFlow('app-id', { name: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockFlowService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for whitespace-only name', async () => {
      await expect(
        controller.createFlow('app-id', { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for name exceeding 300 characters', async () => {
      await expect(
        controller.createFlow('app-id', { name: 'A'.repeat(301) }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept name with exactly 300 characters', async () => {
      const longName = 'A'.repeat(300);
      const mockFlow = createMockFlow({ name: longName });
      mockFlowService.create.mockResolvedValue(mockFlow);
      mockFlowService.findById.mockResolvedValue(mockFlow);

      const result = await controller.createFlow('app-id', { name: longName });

      expect(result).toBeDefined();
      expect(mockFlowService.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for description exceeding 500 characters', async () => {
      await expect(
        controller.createFlow('app-id', {
          name: 'Valid Name',
          description: 'A'.repeat(501),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept description with exactly 500 characters', async () => {
      const longDesc = 'A'.repeat(500);
      const mockFlow = createMockFlow({ description: longDesc });
      mockFlowService.create.mockResolvedValue(mockFlow);
      mockFlowService.findById.mockResolvedValue(mockFlow);

      const result = await controller.createFlow('app-id', {
        name: 'Test',
        description: longDesc,
      });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if flow not found after creation', async () => {
      mockFlowService.create.mockResolvedValue(createMockFlow());
      mockFlowService.findById.mockResolvedValue(null);

      await expect(
        controller.createFlow('app-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for getFlow() - GET /api/flows/:flowId
  // ============================================================
  describe('getFlow (GET /api/flows/:flowId)', () => {
    it('should return flow when found', async () => {
      const mockFlow = createMockFlow({ id: 'flow-id', name: 'Found Flow' });
      mockFlowService.findById.mockResolvedValue(mockFlow);

      const result = await controller.getFlow('flow-id');

      expect(result.id).toBe('flow-id');
      expect(result.name).toBe('Found Flow');
      expect(mockFlowService.findById).toHaveBeenCalledWith('flow-id');
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowService.findById.mockResolvedValue(null);

      await expect(controller.getFlow('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Tests for updateFlow() - PATCH /api/flows/:flowId
  // ============================================================
  describe('updateFlow (PATCH /api/flows/:flowId)', () => {
    it('should update flow successfully', async () => {
      const updates = { name: 'Updated Name' };
      const mockFlow = createMockFlow({ id: 'flow-id', name: 'Updated Name' });
      mockFlowService.update.mockResolvedValue(mockFlow);

      const result = await controller.updateFlow('flow-id', updates);

      expect(result.name).toBe('Updated Name');
      expect(mockFlowService.update).toHaveBeenCalledWith('flow-id', updates);
    });

    it('should pass through NotFoundException from service', async () => {
      mockFlowService.update.mockRejectedValue(
        new NotFoundException('Flow not found'),
      );

      await expect(
        controller.updateFlow('non-existent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update isActive status', async () => {
      const mockFlow = createMockFlow({ isActive: false });
      mockFlowService.update.mockResolvedValue(mockFlow);

      const result = await controller.updateFlow('flow-id', { isActive: false });

      expect(result.isActive).toBe(false);
    });
  });

  // ============================================================
  // Tests for checkFlowDeletion() - GET /api/flows/:flowId/deletion-check
  // ============================================================
  describe('checkFlowDeletion (GET /api/flows/:flowId/deletion-check)', () => {
    it('should return deletion check info', async () => {
      const mockCheck = createMockFlowDeletionCheck({
        canDelete: true,
        isLastFlow: false,
        appIsPublished: false,
      });
      mockFlowService.checkDeletion.mockResolvedValue(mockCheck);

      const result = await controller.checkFlowDeletion('flow-id');

      expect(result.canDelete).toBe(true);
      expect(result.isLastFlow).toBe(false);
      expect(mockFlowService.checkDeletion).toHaveBeenCalledWith('flow-id');
    });

    it('should return warning message when present', async () => {
      const mockCheck = createMockFlowDeletionCheck({
        isLastFlow: true,
        warningMessage: 'This is the last flow',
      });
      mockFlowService.checkDeletion.mockResolvedValue(mockCheck);

      const result = await controller.checkFlowDeletion('flow-id');

      expect(result.warningMessage).toBe('This is the last flow');
    });

    it('should pass through NotFoundException from service', async () => {
      mockFlowService.checkDeletion.mockRejectedValue(
        new NotFoundException('Flow not found'),
      );

      await expect(
        controller.checkFlowDeletion('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for deleteFlow() - DELETE /api/flows/:flowId
  // ============================================================
  describe('deleteFlow (DELETE /api/flows/:flowId)', () => {
    it('should delete flow and return success response', async () => {
      const mockResponse = createMockDeleteFlowResponse({ deletedViewCount: 2 });
      mockFlowService.delete.mockResolvedValue(mockResponse);

      const result = await controller.deleteFlow('flow-id');

      expect(result.success).toBe(true);
      expect(result.deletedViewCount).toBe(2);
      expect(mockFlowService.delete).toHaveBeenCalledWith('flow-id');
    });

    it('should pass through NotFoundException from service', async () => {
      mockFlowService.delete.mockRejectedValue(
        new NotFoundException('Flow not found'),
      );

      await expect(controller.deleteFlow('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
