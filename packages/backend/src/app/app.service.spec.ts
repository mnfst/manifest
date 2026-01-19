/**
 * Unit tests for AppService
 *
 * Tests all CRUD operations with mocked TypeORM repository.
 * No database connections are made - all repository calls are mocked.
 *
 * Test organization:
 * - Each public method has its own describe block
 * - Success paths tested first, then error paths
 * - Edge cases included where applicable
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppService } from './app.service';
import { AppEntity } from './app.entity';
import { UserAppRoleEntity } from '../auth/user-app-role.entity';
import {
  createMockRepository,
  getMockQueryBuilder,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockAppEntity,
  createMockCreateAppRequest,
} from './test/fixtures';
import { DEFAULT_THEME_VARIABLES } from '@manifest/shared';

describe('AppService', () => {
  let service: AppService;
  let mockRepository: MockRepository<AppEntity>;
  let mockUserAppRoleRepository: MockRepository<UserAppRoleEntity>;

  beforeEach(async () => {
    mockRepository = createMockRepository();
    mockUserAppRoleRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: getRepositoryToken(AppEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(UserAppRoleEntity),
          useValue: mockUserAppRoleRepository,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // T013: Tests for create() method
  // ============================================================
  describe('create', () => {
    const mockOwnerId = 'owner-user-id';

    it('should create an app with valid input and assign owner', async () => {
      const request = createMockCreateAppRequest({ name: 'My New App' });
      const mockEntity = createMockAppEntity({
        id: 'new-app-id',
        name: 'My New App',
        slug: 'my-new-app',
      });
      const mockOwnerRole = { userId: mockOwnerId, appId: 'new-app-id', role: 'owner' };

      // Mock generateUniqueSlug - no existing slug
      mockRepository.findOne!.mockResolvedValueOnce(null);
      // Mock create
      mockRepository.create!.mockReturnValue(mockEntity);
      // Mock save
      mockRepository.save!.mockResolvedValue(mockEntity);
      // Mock owner role creation
      mockUserAppRoleRepository.create!.mockReturnValue(mockOwnerRole);
      mockUserAppRoleRepository.save!.mockResolvedValue(mockOwnerRole);

      const result = await service.create(request, mockOwnerId);

      expect(result).toBeDefined();
      expect(result.name).toBe('My New App');
      expect(result.id).toBe('new-app-id');
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockUserAppRoleRepository.create).toHaveBeenCalledWith({
        userId: mockOwnerId,
        appId: 'new-app-id',
        role: 'owner',
      });
      expect(mockUserAppRoleRepository.save).toHaveBeenCalled();
    });

    it('should generate a unique slug from name', async () => {
      const request = createMockCreateAppRequest({ name: 'Test App Name' });
      const mockEntity = createMockAppEntity({
        name: 'Test App Name',
        slug: 'test-app-name',
      });

      mockRepository.findOne!.mockResolvedValueOnce(null);
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);
      mockUserAppRoleRepository.create!.mockReturnValue({});
      mockUserAppRoleRepository.save!.mockResolvedValue({});

      const result = await service.create(request, mockOwnerId);

      expect(result.slug).toBe('test-app-name');
    });

    it('should merge theme variables with defaults', async () => {
      const request = createMockCreateAppRequest({
        name: 'Themed App',
        themeVariables: { '--primary': '200 50% 50%' },
      });
      const mockEntity = createMockAppEntity({
        name: 'Themed App',
        themeVariables: {
          ...DEFAULT_THEME_VARIABLES,
          '--primary': '200 50% 50%',
        },
      });

      mockRepository.findOne!.mockResolvedValueOnce(null);
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);
      mockUserAppRoleRepository.create!.mockReturnValue({});
      mockUserAppRoleRepository.save!.mockResolvedValue({});

      const result = await service.create(request, mockOwnerId);

      expect(result.themeVariables['--primary']).toBe('200 50% 50%');
      expect(result.themeVariables['--background']).toBe(
        DEFAULT_THEME_VARIABLES['--background'],
      );
    });
  });

  // ============================================================
  // T014: Tests for findAll() method
  // ============================================================
  describe('findAll', () => {
    it('should return array of apps with flow counts', async () => {
      const mockEntities = [
        { ...createMockAppEntity({ id: '1', name: 'App 1' }), flowCount: 2 },
        { ...createMockAppEntity({ id: '2', name: 'App 2' }), flowCount: 0 },
      ];

      const queryBuilder = getMockQueryBuilder(mockRepository);
      queryBuilder.getMany.mockResolvedValue(mockEntities);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].flowCount).toBe(2);
      expect(result[1].flowCount).toBe(0);
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('app');
    });

    it('should return empty array when no apps exist', async () => {
      const queryBuilder = getMockQueryBuilder(mockRepository);
      queryBuilder.getMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should order apps by createdAt DESC', async () => {
      const queryBuilder = getMockQueryBuilder(mockRepository);
      queryBuilder.getMany.mockResolvedValue([]);

      await service.findAll();

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('app.createdAt', 'DESC');
    });
  });

  // ============================================================
  // T015: Tests for findById() method
  // ============================================================
  describe('findById', () => {
    it('should return app when found', async () => {
      const mockEntity = createMockAppEntity({ id: 'found-id' });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findById('found-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('found-id');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'found-id' },
      });
    });

    it('should return null when app not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // T016: Tests for findBySlug() method
  // ============================================================
  describe('findBySlug', () => {
    it('should return app when found by slug', async () => {
      const mockEntity = createMockAppEntity({ slug: 'my-app-slug' });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findBySlug('my-app-slug');

      expect(result).toBeDefined();
      expect(result?.slug).toBe('my-app-slug');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'my-app-slug' },
      });
    });

    it('should return null when slug not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      const result = await service.findBySlug('non-existent-slug');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // T018: Tests for update() method
  // ============================================================
  describe('update', () => {
    it('should update app name successfully', async () => {
      const mockEntity = createMockAppEntity({ id: 'update-id', name: 'Old Name' });
      const updatedEntity = { ...mockEntity, name: 'New Name' };

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('update-id', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should update partial fields only', async () => {
      const mockEntity = createMockAppEntity({
        id: 'partial-id',
        name: 'Original',
        description: 'Original Desc',
      });
      const updatedEntity = { ...mockEntity, description: 'Updated Desc' };

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('partial-id', {
        description: 'Updated Desc',
      });

      expect(result.name).toBe('Original');
      expect(result.description).toBe('Updated Desc');
    });

    it('should merge theme variables with existing', async () => {
      const mockEntity = createMockAppEntity({
        themeVariables: { ...DEFAULT_THEME_VARIABLES, '--primary': 'old' },
      });
      const updatedEntity = {
        ...mockEntity,
        themeVariables: { ...mockEntity.themeVariables, '--primary': 'new' },
      };

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('id', {
        themeVariables: { '--primary': 'new' },
      });

      expect(result.themeVariables['--primary']).toBe('new');
    });

    it('should throw NotFoundException when app not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // T019: Tests for delete() method
  // ============================================================
  describe('delete', () => {
    it('should delete app successfully', async () => {
      const mockEntity = createMockAppEntity({ id: 'delete-id', flows: [] });
      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.remove!.mockResolvedValue(mockEntity);

      const result = await service.delete('delete-id');

      expect(result.success).toBe(true);
      expect(result.deletedFlowCount).toBe(0);
      expect(mockRepository.remove).toHaveBeenCalledWith(mockEntity);
    });

    it('should return correct flow count when deleting app with flows', async () => {
      const mockEntity = createMockAppEntity({
        id: 'with-flows',
        flows: [{}, {}, {}] as any[], // 3 mock flows
      });
      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.remove!.mockResolvedValue(mockEntity);

      const result = await service.delete('with-flows');

      expect(result.deletedFlowCount).toBe(3);
    });

    it('should throw NotFoundException when app not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // T020: Tests for publish() method
  // ============================================================
  describe('publish', () => {
    it('should publish app with flows successfully', async () => {
      const mockEntity = createMockAppEntity({
        id: 'publish-id',
        slug: 'my-app',
        status: 'draft',
        flows: [{ views: [] }] as any[],
      });
      const publishedEntity = { ...mockEntity, status: 'published' as const };

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(publishedEntity);

      const result = await service.publish('publish-id');

      expect(result.app.status).toBe('published');
      expect(result.endpointUrl).toBe('/servers/my-app/mcp');
      expect(result.uiUrl).toBe('/servers/my-app/ui');
    });

    it('should throw BadRequestException when app has no flows', async () => {
      const mockEntity = createMockAppEntity({
        id: 'no-flows',
        flows: [],
      });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      await expect(service.publish('no-flows')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when app not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(service.publish('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // T021: Tests for generateUniqueSlug() method
  // ============================================================
  describe('generateUniqueSlug', () => {
    it('should generate slug from name', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      const slug = await service.generateUniqueSlug('My App Name');

      expect(slug).toBe('my-app-name');
    });

    it('should add suffix when slug already exists', async () => {
      // First call finds existing slug
      mockRepository.findOne!.mockResolvedValueOnce(createMockAppEntity());
      // Second call finds no slug (unique)
      mockRepository.findOne!.mockResolvedValueOnce(null);

      const slug = await service.generateUniqueSlug('Test App');

      expect(slug).toBe('test-app-1');
    });

    it('should increment suffix until unique', async () => {
      mockRepository.findOne!
        .mockResolvedValueOnce(createMockAppEntity()) // test-app exists
        .mockResolvedValueOnce(createMockAppEntity()) // test-app-1 exists
        .mockResolvedValueOnce(createMockAppEntity()) // test-app-2 exists
        .mockResolvedValueOnce(null); // test-app-3 is unique

      const slug = await service.generateUniqueSlug('Test App');

      expect(slug).toBe('test-app-3');
    });

    it('should truncate long names to 50 characters', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      const longName = 'A'.repeat(100);
      const slug = await service.generateUniqueSlug(longName);

      expect(slug.length).toBeLessThanOrEqual(50);
    });
  });

  // ============================================================
  // T022: Tests for updateIcon() method
  // ============================================================
  describe('updateIcon', () => {
    it('should update icon URL successfully', async () => {
      const mockEntity = createMockAppEntity({
        id: 'icon-id',
        logoUrl: '/old-icon.png',
      });
      const updatedEntity = { ...mockEntity, logoUrl: '/new-icon.png' };

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.updateIcon('icon-id', '/new-icon.png');

      expect(result.logoUrl).toBe('/new-icon.png');
    });

    it('should throw NotFoundException when app not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.updateIcon('non-existent', '/icon.png'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
