/**
 * Unit tests for AppController
 *
 * Tests all HTTP endpoints with mocked AppService and AgentService.
 * Verifies request handling, validation, and response shaping.
 *
 * Test organization:
 * - Each endpoint has its own describe block
 * - Success paths tested first, then error paths
 * - Validation tests included where applicable
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentService } from '../agent/agent.service';
import {
  createMockAgentService,
  createMockGenerateAppResult,
  createMockProcessChatResult,
} from './test/mock-agent.service';
import {
  createMockApp,
  createMockAppWithFlowCount,
  createMockDeleteAppResponse,
  createMockPublishResult,
} from './test/fixtures';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: Record<string, jest.Mock>;
  let mockAgentService: ReturnType<typeof createMockAgentService>;

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockAppService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      getCurrentApp: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      publish: jest.fn(),
      updateIcon: jest.fn(),
      setCurrentApp: jest.fn(),
      clearCurrentApp: jest.fn(),
      generateUniqueSlug: jest.fn(),
    };

    mockAgentService = createMockAgentService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
        {
          provide: AgentService,
          useValue: mockAgentService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // T025: Tests for listApps() - GET /api/apps
  // ============================================================
  describe('listApps (GET /api/apps)', () => {
    it('should return array of apps with flow counts', async () => {
      const mockApps = [
        createMockAppWithFlowCount({ id: '1', flowCount: 2 }),
        createMockAppWithFlowCount({ id: '2', flowCount: 0 }),
      ];
      mockAppService.findAll.mockResolvedValue(mockApps);

      const result = await controller.listApps();

      expect(result).toHaveLength(2);
      expect(result[0].flowCount).toBe(2);
      expect(mockAppService.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no apps exist', async () => {
      mockAppService.findAll.mockResolvedValue([]);

      const result = await controller.listApps();

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // T026: Tests for createApp() - POST /api/apps
  // ============================================================
  describe('createApp (POST /api/apps)', () => {
    it('should create app with valid request', async () => {
      const request = { name: 'New App', description: 'Description' };
      const mockApp = createMockApp({ name: 'New App' });
      mockAppService.create.mockResolvedValue(mockApp);

      const result = await controller.createApp(request);

      expect(result.name).toBe('New App');
      expect(mockAppService.create).toHaveBeenCalledWith(request);
    });

    it('should throw BadRequestException for empty name', async () => {
      const request = { name: '' };

      await expect(controller.createApp(request)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAppService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for whitespace-only name', async () => {
      const request = { name: '   ' };

      await expect(controller.createApp(request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for name exceeding 100 characters', async () => {
      const request = { name: 'A'.repeat(101) };

      await expect(controller.createApp(request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept name with exactly 100 characters', async () => {
      const request = { name: 'A'.repeat(100) };
      const mockApp = createMockApp({ name: request.name });
      mockAppService.create.mockResolvedValue(mockApp);

      const result = await controller.createApp(request);

      expect(result).toBeDefined();
      expect(mockAppService.create).toHaveBeenCalled();
    });
  });

  // ============================================================
  // T027: Tests for getApp() - GET /api/apps/:appId
  // ============================================================
  describe('getApp (GET /api/apps/:appId)', () => {
    it('should return app when found', async () => {
      const mockApp = createMockApp({ id: 'found-id' });
      mockAppService.findById.mockResolvedValue(mockApp);

      const result = await controller.getApp('found-id');

      expect(result.id).toBe('found-id');
      expect(mockAppService.findById).toHaveBeenCalledWith('found-id');
    });

    it('should throw NotFoundException when app not found', async () => {
      mockAppService.findById.mockResolvedValue(null);

      await expect(controller.getApp('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // T028: Tests for updateApp() - PATCH /api/apps/:appId
  // ============================================================
  describe('updateApp (PATCH /api/apps/:appId)', () => {
    it('should update app successfully', async () => {
      const updates = { name: 'Updated Name' };
      const mockApp = createMockApp({ id: 'update-id', name: 'Updated Name' });
      mockAppService.update.mockResolvedValue(mockApp);

      const result = await controller.updateApp('update-id', updates);

      expect(result.name).toBe('Updated Name');
      expect(mockAppService.update).toHaveBeenCalledWith('update-id', updates);
    });

    it('should pass through NotFoundException from service', async () => {
      mockAppService.update.mockRejectedValue(
        new NotFoundException('App not found'),
      );

      await expect(
        controller.updateApp('non-existent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // T029: Tests for deleteApp() - DELETE /api/apps/:appId
  // ============================================================
  describe('deleteApp (DELETE /api/apps/:appId)', () => {
    it('should delete app and return success response', async () => {
      const mockResponse = createMockDeleteAppResponse({ deletedFlowCount: 3 });
      mockAppService.delete.mockResolvedValue(mockResponse);

      const result = await controller.deleteApp('delete-id');

      expect(result.success).toBe(true);
      expect(result.deletedFlowCount).toBe(3);
      expect(mockAppService.delete).toHaveBeenCalledWith('delete-id');
    });

    it('should pass through NotFoundException from service', async () => {
      mockAppService.delete.mockRejectedValue(
        new NotFoundException('App not found'),
      );

      await expect(controller.deleteApp('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // T030: Tests for publishAppById() - POST /api/apps/:appId/publish
  // ============================================================
  describe('publishAppById (POST /api/apps/:appId/publish)', () => {
    it('should publish app and return URLs', async () => {
      const mockResult = createMockPublishResult();
      mockAppService.publish.mockResolvedValue(mockResult);

      const result = await controller.publishAppById('publish-id');

      expect(result.endpointUrl).toBeDefined();
      expect(result.uiUrl).toBeDefined();
      expect(result.app.status).toBe('published');
      expect(mockAppService.publish).toHaveBeenCalledWith('publish-id');
    });

    it('should pass through NotFoundException from service', async () => {
      mockAppService.publish.mockRejectedValue(
        new NotFoundException('App not found'),
      );

      await expect(controller.publishAppById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should pass through BadRequestException when no flows', async () => {
      mockAppService.publish.mockRejectedValue(
        new BadRequestException('App must have at least one flow'),
      );

      await expect(controller.publishAppById('no-flows')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================================
  // T031: Tests for uploadAppIcon() - POST /api/apps/:appId/icon
  // ============================================================
  describe('uploadAppIcon (POST /api/apps/:appId/icon)', () => {
    // Note: Full file upload testing would require integration tests
    // Here we test the controller logic with mocked file handling

    it('should throw BadRequestException when no file uploaded', async () => {
      await expect(
        controller.uploadAppIcon('app-id', undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // Legacy Endpoints (deprecated but still tested for coverage)
  // ============================================================
  describe('Legacy Endpoints', () => {
    describe('generateApp (POST /api/generate)', () => {
      it('should generate app from prompt', async () => {
        const mockGenResult = createMockGenerateAppResult({ name: 'Generated' });
        mockAgentService.generateApp.mockResolvedValue(mockGenResult);

        const mockApp = createMockApp({ name: 'Generated' });
        mockAppService.create.mockResolvedValue(mockApp);

        const result = await controller.generateApp({ prompt: 'Create an app' });

        expect(result.name).toBe('Generated');
        expect(mockAgentService.generateApp).toHaveBeenCalledWith('Create an app');
      });

      it('should throw BadRequestException for empty prompt', async () => {
        await expect(controller.generateApp({ prompt: '' })).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for prompt exceeding 10000 characters', async () => {
        await expect(
          controller.generateApp({ prompt: 'A'.repeat(10001) }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getCurrentApp (GET /api/current)', () => {
      it('should return current session app', async () => {
        const mockApp = createMockApp({ id: 'current-id' });
        mockAppService.getCurrentApp.mockResolvedValue(mockApp);

        const result = await controller.getCurrentApp();

        expect(result.id).toBe('current-id');
      });

      it('should throw NotFoundException when no current app', async () => {
        mockAppService.getCurrentApp.mockResolvedValue(null);

        await expect(controller.getCurrentApp()).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('chat (POST /api/chat)', () => {
      it('should process chat message and return response', async () => {
        const mockApp = createMockApp();
        mockAppService.getCurrentApp.mockResolvedValue(mockApp);

        const mockChatResult = createMockProcessChatResult({
          response: 'Updated',
          updates: { name: 'Chat Updated' },
          changes: ['name updated'],
        });
        mockAgentService.processChat.mockResolvedValue(mockChatResult);

        const updatedApp = createMockApp({ name: 'Chat Updated' });
        mockAppService.update.mockResolvedValue(updatedApp);

        const result = await controller.chat({ message: 'Update the name' });

        expect(result.response).toBe('Updated');
        expect(result.changes).toContain('name updated');
      });

      it('should throw BadRequestException for empty message', async () => {
        await expect(controller.chat({ message: '' })).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw NotFoundException when no current app', async () => {
        mockAppService.getCurrentApp.mockResolvedValue(null);

        await expect(controller.chat({ message: 'Hello' })).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('publishApp (POST /api/publish)', () => {
      it('should publish current app', async () => {
        const mockApp = createMockApp({ id: 'current-to-publish' });
        mockAppService.getCurrentApp.mockResolvedValue(mockApp);

        const mockResult = createMockPublishResult();
        mockAppService.publish.mockResolvedValue(mockResult);

        const result = await controller.publishApp();

        expect(result.app.status).toBe('published');
        expect(mockAppService.publish).toHaveBeenCalledWith('current-to-publish');
      });

      it('should throw NotFoundException when no current app', async () => {
        mockAppService.getCurrentApp.mockResolvedValue(null);

        await expect(controller.publishApp()).rejects.toThrow(NotFoundException);
      });
    });
  });
});
