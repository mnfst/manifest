/**
 * Unit tests for AppController
 *
 * Tests all HTTP endpoints with mocked AppService.
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
  CurrentUser: () => () => ({}),
  AppAccessService: class MockAppAccessService {
    isOwner = jest.fn();
  },
}));

import { AppAccessService } from '../auth';

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  createMockApp,
  createMockAppWithFlowCount,
  createMockDeleteAppResponse,
  createMockPublishResult,
} from './test/fixtures';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: Record<string, jest.Mock>;
  let mockAppAccessService: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockAppService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      publish: jest.fn(),
      updateIcon: jest.fn(),
      generateUniqueSlug: jest.fn(),
      getAppsForUser: jest.fn(),
      createWithOwner: jest.fn(),
    };

    mockAppAccessService = {
      isOwner: jest.fn(),
      hasAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
        {
          provide: AppAccessService,
          useValue: mockAppAccessService,
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
    const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', image: null, createdAt: new Date(), updatedAt: new Date(), emailVerified: false };

    it('should return array of apps with flow counts', async () => {
      const mockApps = [
        createMockAppWithFlowCount({ id: '1', flowCount: 2 }),
        createMockAppWithFlowCount({ id: '2', flowCount: 0 }),
      ];
      mockAppService.getAppsForUser.mockResolvedValue(mockApps);

      const result = await controller.listApps(mockUser);

      expect(result).toHaveLength(2);
      expect(result[0].flowCount).toBe(2);
      expect(mockAppService.getAppsForUser).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array when no apps exist', async () => {
      mockAppService.getAppsForUser.mockResolvedValue([]);

      const result = await controller.listApps(mockUser);

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // T026: Tests for createApp() - POST /api/apps
  // ============================================================
  describe('createApp (POST /api/apps)', () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', image: null, createdAt: new Date(), updatedAt: new Date(), emailVerified: false };

    it('should create app with valid request', async () => {
      const request = { name: 'New App', description: 'Description' };
      const mockApp = createMockApp({ name: 'New App' });
      mockAppService.create.mockResolvedValue(mockApp);

      const result = await controller.createApp(request, mockUser);

      expect(result.name).toBe('New App');
      expect(mockAppService.create).toHaveBeenCalledWith(request, 'user-1');
    });

    it('should throw BadRequestException for empty name', async () => {
      const request = { name: '' };

      await expect(controller.createApp(request, mockUser)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAppService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for whitespace-only name', async () => {
      const request = { name: '   ' };

      await expect(controller.createApp(request, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for name exceeding 100 characters', async () => {
      const request = { name: 'A'.repeat(101) };

      await expect(controller.createApp(request, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept name with exactly 100 characters', async () => {
      const request = { name: 'A'.repeat(100) };
      const mockApp = createMockApp({ name: request.name });
      mockAppService.create.mockResolvedValue(mockApp);

      const result = await controller.createApp(request, mockUser);

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
    const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', image: null, createdAt: new Date(), updatedAt: new Date(), emailVerified: false };

    it('should delete app and return success response when user is owner', async () => {
      const mockResponse = createMockDeleteAppResponse({ deletedFlowCount: 3 });
      mockAppAccessService.isOwner.mockResolvedValue(true);
      mockAppService.delete.mockResolvedValue(mockResponse);

      const result = await controller.deleteApp('delete-id', mockUser);

      expect(result.success).toBe(true);
      expect(result.deletedFlowCount).toBe(3);
      expect(mockAppAccessService.isOwner).toHaveBeenCalledWith('user-1', 'delete-id');
      expect(mockAppService.delete).toHaveBeenCalledWith('delete-id');
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockAppAccessService.isOwner.mockResolvedValue(false);

      await expect(controller.deleteApp('app-id', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockAppService.delete).not.toHaveBeenCalled();
    });

    it('should pass through NotFoundException from service', async () => {
      mockAppAccessService.isOwner.mockResolvedValue(true);
      mockAppService.delete.mockRejectedValue(
        new NotFoundException('App not found'),
      );

      await expect(controller.deleteApp('non-existent', mockUser)).rejects.toThrow(
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
});
