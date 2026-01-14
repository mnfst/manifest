/**
 * Unit tests for FlowService
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
import { NotFoundException } from '@nestjs/common';
import { FlowService } from './flow.service';
import { FlowEntity } from './flow.entity';
import { AppEntity } from '../app/app.entity';
import {
  createMockRepository,
  createMockAppRepository,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockFlowEntity,
  createMockAppEntity,
  createMockStatCardNode,
} from './test/fixtures';

describe('FlowService', () => {
  let service: FlowService;
  let mockFlowRepository: MockRepository<FlowEntity>;
  let mockAppRepository: MockRepository<AppEntity>;

  beforeEach(async () => {
    mockFlowRepository = createMockRepository<FlowEntity>();
    mockAppRepository = createMockAppRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowService,
        {
          provide: getRepositoryToken(FlowEntity),
          useValue: mockFlowRepository,
        },
        {
          provide: getRepositoryToken(AppEntity),
          useValue: mockAppRepository,
        },
      ],
    }).compile();

    service = module.get<FlowService>(FlowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for create() method
  // ============================================================
  describe('create', () => {
    it('should create a flow with name and description', async () => {
      const appId = 'test-app-id';
      const mockEntity = createMockFlowEntity({
        id: 'new-flow-id',
        appId,
        name: 'My New Flow',
        description: 'Flow description',
        nodes: [],
        connections: [],
      });

      mockFlowRepository.create!.mockReturnValue(mockEntity);
      mockFlowRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.create(appId, {
        name: 'My New Flow',
        description: 'Flow description',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('My New Flow');
      expect(result.description).toBe('Flow description');
      expect(result.appId).toBe(appId);
      expect(result.nodes).toEqual([]);
      expect(result.connections).toEqual([]);
      expect(mockFlowRepository.create).toHaveBeenCalledWith({
        appId,
        name: 'My New Flow',
        description: 'Flow description',
        nodes: [],
        connections: [],
      });
      expect(mockFlowRepository.save).toHaveBeenCalled();
    });

    it('should create a flow with only name (no description)', async () => {
      const appId = 'test-app-id';
      const mockEntity = createMockFlowEntity({
        id: 'new-flow-id',
        appId,
        name: 'Simple Flow',
        description: undefined,
      });

      mockFlowRepository.create!.mockReturnValue(mockEntity);
      mockFlowRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.create(appId, { name: 'Simple Flow' });

      expect(result.name).toBe('Simple Flow');
      expect(result.description).toBeUndefined();
    });

    it('should initialize nodes and connections as empty arrays', async () => {
      const mockEntity = createMockFlowEntity({
        nodes: [],
        connections: [],
      });

      mockFlowRepository.create!.mockReturnValue(mockEntity);
      mockFlowRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.create('app-id', { name: 'Test' });

      expect(result.nodes).toEqual([]);
      expect(result.connections).toEqual([]);
    });
  });

  // ============================================================
  // Tests for findById() method
  // ============================================================
  describe('findById', () => {
    it('should return flow when found', async () => {
      const mockEntity = createMockFlowEntity({ id: 'found-id', name: 'Found Flow' });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findById('found-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('found-id');
      expect(result?.name).toBe('Found Flow');
      expect(mockFlowRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'found-id' },
      });
    });

    it('should return null when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should convert entity dates to ISO strings', async () => {
      const now = new Date('2026-01-08T12:00:00.000Z');
      const mockEntity = createMockFlowEntity({
        createdAt: now,
        updatedAt: now,
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findById('test-id');

      expect(result?.createdAt).toBe('2026-01-08T12:00:00.000Z');
      expect(result?.updatedAt).toBe('2026-01-08T12:00:00.000Z');
    });
  });

  // ============================================================
  // Tests for findByAppId() method
  // ============================================================
  describe('findByAppId', () => {
    it('should return array of flows for an app', async () => {
      const mockEntities = [
        createMockFlowEntity({ id: '1', name: 'Flow 1' }),
        createMockFlowEntity({ id: '2', name: 'Flow 2' }),
      ];
      mockFlowRepository.find!.mockResolvedValue(mockEntities);

      const result = await service.findByAppId('app-id');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Flow 1');
      expect(result[1].name).toBe('Flow 2');
      expect(mockFlowRepository.find).toHaveBeenCalledWith({
        where: { appId: 'app-id' },
        order: { createdAt: 'ASC' },
      });
    });

    it('should return empty array when no flows exist', async () => {
      mockFlowRepository.find!.mockResolvedValue([]);

      const result = await service.findByAppId('app-id');

      expect(result).toEqual([]);
    });

    it('should order flows by createdAt ASC', async () => {
      mockFlowRepository.find!.mockResolvedValue([]);

      await service.findByAppId('app-id');

      expect(mockFlowRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'ASC' },
        }),
      );
    });
  });

  // ============================================================
  // Tests for update() method
  // ============================================================
  describe('update', () => {
    it('should update flow name successfully', async () => {
      const mockEntity = createMockFlowEntity({ id: 'update-id', name: 'Old Name' });
      const updatedEntity = createMockFlowEntity({ id: 'update-id', name: 'New Name' });

      mockFlowRepository.findOne!
        .mockResolvedValueOnce(mockEntity)
        .mockResolvedValueOnce(updatedEntity);
      mockFlowRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('update-id', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(mockFlowRepository.save).toHaveBeenCalled();
    });

    it('should update flow description', async () => {
      const mockEntity = createMockFlowEntity({ id: 'id', description: 'Old' });
      const updatedEntity = createMockFlowEntity({ id: 'id', description: 'New Desc' });

      mockFlowRepository.findOne!
        .mockResolvedValueOnce(mockEntity)
        .mockResolvedValueOnce(updatedEntity);
      mockFlowRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('id', { description: 'New Desc' });

      expect(result.description).toBe('New Desc');
    });

    it('should update flow isActive status', async () => {
      const mockEntity = createMockFlowEntity({ id: 'id', isActive: true });
      const updatedEntity = createMockFlowEntity({ id: 'id', isActive: false });

      mockFlowRepository.findOne!
        .mockResolvedValueOnce(mockEntity)
        .mockResolvedValueOnce(updatedEntity);
      mockFlowRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('id', { isActive: false });

      expect(result.isActive).toBe(false);
    });

    it('should update multiple fields at once', async () => {
      const mockEntity = createMockFlowEntity({ id: 'id', name: 'Old', isActive: true });
      const updatedEntity = createMockFlowEntity({
        id: 'id',
        name: 'New',
        description: 'Updated desc',
        isActive: false,
      });

      mockFlowRepository.findOne!
        .mockResolvedValueOnce(mockEntity)
        .mockResolvedValueOnce(updatedEntity);
      mockFlowRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('id', {
        name: 'New',
        description: 'Updated desc',
        isActive: false,
      });

      expect(result.name).toBe('New');
      expect(result.description).toBe('Updated desc');
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not modify fields that are undefined in updates', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'id',
        name: 'Original',
        description: 'Original Desc',
        isActive: true,
      });
      const updatedEntity = createMockFlowEntity({
        id: 'id',
        name: 'Updated',
        description: 'Original Desc', // unchanged
        isActive: true, // unchanged
      });

      mockFlowRepository.findOne!
        .mockResolvedValueOnce(mockEntity)
        .mockResolvedValueOnce(updatedEntity);
      mockFlowRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.update('id', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(result.description).toBe('Original Desc');
      expect(result.isActive).toBe(true);
    });
  });

  // ============================================================
  // Tests for checkDeletion() method
  // ============================================================
  describe('checkDeletion', () => {
    it('should return canDelete true for any flow', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'flow-id',
        appId: 'app-id',
        app: createMockAppEntity({ status: 'draft' }),
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.count!.mockResolvedValue(2);

      const result = await service.checkDeletion('flow-id');

      expect(result.canDelete).toBe(true);
      expect(result.isLastFlow).toBe(false);
      expect(result.appIsPublished).toBe(false);
    });

    it('should detect when it is the last flow', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'flow-id',
        appId: 'app-id',
        app: createMockAppEntity({ status: 'draft' }),
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.count!.mockResolvedValue(1);

      const result = await service.checkDeletion('flow-id');

      expect(result.isLastFlow).toBe(true);
      expect(result.warningMessage).toBe('This is the last flow in this app.');
    });

    it('should detect when app is published', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'flow-id',
        appId: 'app-id',
        app: createMockAppEntity({ status: 'published' }),
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.count!.mockResolvedValue(2);

      const result = await service.checkDeletion('flow-id');

      expect(result.appIsPublished).toBe(true);
    });

    it('should show warning for last flow in published app', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'flow-id',
        appId: 'app-id',
        app: createMockAppEntity({ status: 'published' }),
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.count!.mockResolvedValue(1);

      const result = await service.checkDeletion('flow-id');

      expect(result.isLastFlow).toBe(true);
      expect(result.appIsPublished).toBe(true);
      expect(result.warningMessage).toContain('unpublishing the app');
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(service.checkDeletion('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Tests for delete() method
  // ============================================================
  describe('delete', () => {
    it('should delete flow successfully', async () => {
      const mockEntity = createMockFlowEntity({ id: 'delete-id', nodes: [] });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.remove!.mockResolvedValue(mockEntity);

      const result = await service.delete('delete-id');

      expect(result.success).toBe(true);
      expect(result.deletedViewCount).toBe(0);
      expect(mockFlowRepository.remove).toHaveBeenCalledWith(mockEntity);
    });

    it('should return correct view count when deleting flow with StatCard nodes', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'with-views',
        nodes: [
          createMockStatCardNode({ id: '1' }),
          createMockStatCardNode({ id: '2' }),
          createMockStatCardNode({ id: '3' }),
        ],
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.remove!.mockResolvedValue(mockEntity);

      const result = await service.delete('with-views');

      expect(result.deletedViewCount).toBe(3);
    });

    it('should only count StatCard nodes in deletedViewCount', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'mixed-nodes',
        nodes: [
          createMockStatCardNode({ id: '1' }),
          { id: '2', type: 'UserIntent', name: 'Trigger', slug: 'trigger', position: { x: 0, y: 0 }, parameters: {} },
          { id: '3', type: 'Return', name: 'Return', slug: 'return', position: { x: 0, y: 0 }, parameters: {} },
        ],
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.remove!.mockResolvedValue(mockEntity);

      const result = await service.delete('mixed-nodes');

      expect(result.deletedViewCount).toBe(1);
    });

    it('should throw NotFoundException when flow not found', async () => {
      mockFlowRepository.findOne!.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle null nodes array', async () => {
      const mockEntity = createMockFlowEntity({
        id: 'null-nodes',
        nodes: null as any,
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);
      mockFlowRepository.remove!.mockResolvedValue(mockEntity);

      const result = await service.delete('null-nodes');

      expect(result.success).toBe(true);
      expect(result.deletedViewCount).toBe(0);
    });
  });

  // ============================================================
  // Tests for entityToFlow() (private, tested via public methods)
  // ============================================================
  describe('entityToFlow (via findById)', () => {
    it('should handle null nodes array', async () => {
      const mockEntity = createMockFlowEntity({
        nodes: null as any,
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findById('test-id');

      expect(result?.nodes).toEqual([]);
    });

    it('should handle null connections array', async () => {
      const mockEntity = createMockFlowEntity({
        connections: null as any,
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findById('test-id');

      expect(result?.connections).toEqual([]);
    });

    it('should default isActive to true when null', async () => {
      const mockEntity = createMockFlowEntity({
        isActive: null as any,
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findById('test-id');

      expect(result?.isActive).toBe(true);
    });

    it('should preserve isActive false when set', async () => {
      const mockEntity = createMockFlowEntity({
        isActive: false,
      });
      mockFlowRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findById('test-id');

      expect(result?.isActive).toBe(false);
    });
  });
});
