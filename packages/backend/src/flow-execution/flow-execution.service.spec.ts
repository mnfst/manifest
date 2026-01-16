/**
 * Unit tests for FlowExecutionService
 *
 * Tests all CRUD operations and business logic with mocked TypeORM repository.
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
import { FlowExecutionService } from './flow-execution.service';
import { FlowExecutionEntity } from './flow-execution.entity';
import {
  createMockRepository,
  createMockUpdateResult,
  type MockRepository,
} from './test/mock-repository';
import {
  createMockExecutionEntity,
  createMockCreateExecutionParams,
  createMockNodeExecutionData,
  createMockErrorInfo,
  createMockCompletedEntity,
} from './test/fixtures';

describe('FlowExecutionService', () => {
  let service: FlowExecutionService;
  let mockRepository: MockRepository<FlowExecutionEntity>;

  beforeEach(async () => {
    mockRepository = createMockRepository<FlowExecutionEntity>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowExecutionService,
        {
          provide: getRepositoryToken(FlowExecutionEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<FlowExecutionService>(FlowExecutionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for createExecution() method
  // ============================================================
  describe('createExecution', () => {
    it('should create execution with all params', async () => {
      const params = createMockCreateExecutionParams();
      const mockEntity = createMockExecutionEntity();

      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution(params);

      expect(result).toBeDefined();
      expect(result.flowId).toBe(params.flowId);
      expect(result.flowName).toBe(params.flowName);
      expect(result.flowToolName).toBe(params.flowToolName);
      expect(mockRepository.create).toHaveBeenCalledWith({
        flowId: params.flowId,
        flowName: params.flowName,
        flowToolName: params.flowToolName,
        initialParams: params.initialParams,
        status: 'pending',
        nodeExecutions: [],
        isPreview: false,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockEntity);
    });

    it('should set isPreview to true when specified', async () => {
      const params = createMockCreateExecutionParams({ isPreview: true });
      const mockEntity = createMockExecutionEntity({ isPreview: true });

      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution(params);

      expect(result.isPreview).toBe(true);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPreview: true }),
      );
    });

    it('should default isPreview to false when not specified', async () => {
      const params = createMockCreateExecutionParams();
      delete params.isPreview;
      const mockEntity = createMockExecutionEntity({ isPreview: false });

      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      await service.createExecution(params);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPreview: false }),
      );
    });

    it('should initialize with empty nodeExecutions array', async () => {
      const params = createMockCreateExecutionParams();
      const mockEntity = createMockExecutionEntity({ nodeExecutions: [] });

      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution(params);

      expect(result.nodeExecutions).toEqual([]);
    });

    it('should initialize with pending status', async () => {
      const params = createMockCreateExecutionParams();
      const mockEntity = createMockExecutionEntity({ status: 'pending' });

      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution(params);

      expect(result.status).toBe('pending');
    });

    it('should handle empty initialParams', async () => {
      const params = createMockCreateExecutionParams({ initialParams: {} });
      const mockEntity = createMockExecutionEntity({ initialParams: {} });

      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution(params);

      expect(result.initialParams).toEqual({});
    });
  });

  // ============================================================
  // Tests for updateExecution() method
  // ============================================================
  describe('updateExecution', () => {
    it('should update status successfully', async () => {
      const mockEntity = createMockExecutionEntity({ status: 'pending' });
      const updatedEntity = createMockExecutionEntity({ status: 'success' });

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.updateExecution('test-id', {
        status: 'success',
      });

      expect(result.status).toBe('success');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should update endedAt successfully', async () => {
      const endedAt = new Date('2026-01-08T01:00:00.000Z');
      const mockEntity = createMockExecutionEntity();
      const updatedEntity = createMockExecutionEntity({ endedAt });

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.updateExecution('test-id', { endedAt });

      expect(result.endedAt).toEqual(endedAt);
    });

    it('should update nodeExecutions successfully', async () => {
      const nodeExecutions = [
        createMockNodeExecutionData({ nodeId: 'node-1' }),
        createMockNodeExecutionData({ nodeId: 'node-2' }),
      ];
      const mockEntity = createMockExecutionEntity();
      const updatedEntity = createMockExecutionEntity({ nodeExecutions });

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.updateExecution('test-id', {
        nodeExecutions,
      });

      expect(result.nodeExecutions).toHaveLength(2);
      expect(result.nodeExecutions[0].nodeId).toBe('node-1');
    });

    it('should update errorInfo successfully', async () => {
      const errorInfo = createMockErrorInfo({
        message: 'API call failed',
        nodeId: 'api-node',
      });
      const mockEntity = createMockExecutionEntity();
      const updatedEntity = createMockExecutionEntity({
        status: 'error',
        errorInfo,
      });

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.updateExecution('test-id', {
        status: 'error',
        errorInfo,
      });

      expect(result.errorInfo).toEqual(errorInfo);
    });

    it('should update multiple fields at once', async () => {
      const endedAt = new Date();
      const nodeExecutions = [createMockNodeExecutionData()];
      const mockEntity = createMockExecutionEntity();
      const updatedEntity = createMockExecutionEntity({
        status: 'success',
        endedAt,
        nodeExecutions,
      });

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.updateExecution('test-id', {
        status: 'success',
        endedAt,
        nodeExecutions,
      });

      expect(result.status).toBe('success');
      expect(result.endedAt).toEqual(endedAt);
      expect(result.nodeExecutions).toHaveLength(1);
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.updateExecution('non-existent', { status: 'success' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not modify unspecified fields', async () => {
      const originalNodeExecutions = [createMockNodeExecutionData()];
      const mockEntity = createMockExecutionEntity({
        nodeExecutions: originalNodeExecutions,
      });

      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      await service.updateExecution('test-id', { status: 'success' });

      const savedEntity = mockRepository.save!.mock.calls[0][0];
      expect(savedEntity.nodeExecutions).toEqual(originalNodeExecutions);
    });
  });

  // ============================================================
  // Tests for findByFlow() method
  // ============================================================
  describe('findByFlow', () => {
    it('should return paginated executions for a flow', async () => {
      const executions = [
        createMockExecutionEntity({ id: '1' }),
        createMockExecutionEntity({ id: '2' }),
      ];

      mockRepository.findAndCount!.mockResolvedValue([executions, 2]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id');

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should use default pagination values', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-id');

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { flowId: 'flow-id' },
        order: { startedAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply custom pagination', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-id', { page: 3, limit: 10 });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { flowId: 'flow-id' },
        order: { startedAt: 'DESC' },
        skip: 20, // (3 - 1) * 10
        take: 10,
      });
    });

    it('should filter by status when provided', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-id', { status: 'success' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { flowId: 'flow-id', status: 'success' },
        }),
      );
    });

    it('should filter by isPreview when true', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-id', { isPreview: true });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { flowId: 'flow-id', isPreview: true },
        }),
      );
    });

    it('should filter by isPreview when false', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-id', { isPreview: false });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { flowId: 'flow-id', isPreview: false },
        }),
      );
    });

    it('should not filter by isPreview when undefined', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-id', { isPreview: undefined });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { flowId: 'flow-id' },
        }),
      );
    });

    it('should detect pending executions correctly', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(5);

      const result = await service.findByFlow('flow-id');

      expect(result.hasPendingExecutions).toBe(true);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { flowId: 'flow-id', status: 'pending' },
      });
    });

    it('should return hasPendingExecutions false when no pending', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id');

      expect(result.hasPendingExecutions).toBe(false);
    });

    it('should calculate totalPages correctly', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 55]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id', { limit: 20 });

      expect(result.totalPages).toBe(3); // Math.ceil(55 / 20)
    });

    it('should calculate duration for completed executions', async () => {
      const completedExecution = createMockCompletedEntity(1500);
      mockRepository.findAndCount!.mockResolvedValue([[completedExecution], 1]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id');

      expect(result.items[0].duration).toBe(1500);
    });

    it('should return undefined duration for pending executions', async () => {
      const pendingExecution = createMockExecutionEntity({
        status: 'pending',
        endedAt: undefined,
      });
      mockRepository.findAndCount!.mockResolvedValue([[pendingExecution], 1]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id');

      expect(result.items[0].duration).toBeUndefined();
    });

    it('should truncate long initialParamsPreview', async () => {
      const longParam = 'a'.repeat(100);
      const execution = createMockExecutionEntity({
        initialParams: { longKey: longParam },
      });
      mockRepository.findAndCount!.mockResolvedValue([[execution], 1]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id');

      expect(result.items[0].initialParamsPreview.length).toBeLessThanOrEqual(
        53,
      ); // 50 + '...'
      expect(result.items[0].initialParamsPreview.endsWith('...')).toBe(true);
    });

    it('should handle empty initialParams', async () => {
      const execution = createMockExecutionEntity({ initialParams: {} });
      mockRepository.findAndCount!.mockResolvedValue([[execution], 1]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id');

      expect(result.items[0].initialParamsPreview).toBe('');
    });

    it('should return empty array when no executions', async () => {
      mockRepository.findAndCount!.mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-id');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================
  // Tests for findOne() method
  // ============================================================
  describe('findOne', () => {
    it('should return execution when found', async () => {
      const mockEntity = createMockExecutionEntity({ id: 'found-id' });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findOne('found-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('found-id');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'found-id' },
      });
    });

    it('should return null when execution not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });

    it('should convert dates to ISO strings', async () => {
      const now = new Date('2026-01-08T12:00:00.000Z');
      const mockEntity = createMockExecutionEntity({
        startedAt: now,
        endedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findOne('test-id');

      expect(result?.startedAt).toBe('2026-01-08T12:00:00.000Z');
      expect(result?.endedAt).toBe('2026-01-08T12:00:00.000Z');
      expect(result?.createdAt).toBe('2026-01-08T12:00:00.000Z');
      expect(result?.updatedAt).toBe('2026-01-08T12:00:00.000Z');
    });

    it('should handle undefined endedAt', async () => {
      const mockEntity = createMockExecutionEntity({ endedAt: undefined });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findOne('test-id');

      expect(result?.endedAt).toBeUndefined();
    });

    it('should return all execution fields', async () => {
      const nodeExecutions = [createMockNodeExecutionData()];
      const errorInfo = createMockErrorInfo();
      const mockEntity = createMockExecutionEntity({
        nodeExecutions,
        errorInfo,
        isPreview: true,
      });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findOne('test-id');

      expect(result?.nodeExecutions).toEqual(nodeExecutions);
      expect(result?.errorInfo).toEqual(errorInfo);
      expect(result?.isPreview).toBe(true);
    });
  });

  // ============================================================
  // Tests for findOneOrFail() method
  // ============================================================
  describe('findOneOrFail', () => {
    it('should return execution when found', async () => {
      const mockEntity = createMockExecutionEntity({ id: 'found-id' });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findOneOrFail('found-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('found-id');
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(service.findOneOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOneOrFail('non-existent')).rejects.toThrow(
        'Execution not found: non-existent',
      );
    });
  });

  // ============================================================
  // Tests for markTimedOutExecutions() method
  // ============================================================
  describe('markTimedOutExecutions', () => {
    it('should mark timed out executions as error', async () => {
      mockRepository.update!.mockResolvedValue(createMockUpdateResult(3));

      const result = await service.markTimedOutExecutions(5);

      expect(result).toBe(3);
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should use default timeout of 5 minutes', async () => {
      mockRepository.update!.mockResolvedValue(createMockUpdateResult(0));

      await service.markTimedOutExecutions();

      const updateCall = mockRepository.update!.mock.calls[0];
      expect(updateCall[1]).toEqual(
        expect.objectContaining({
          status: 'error',
          errorInfo: { message: 'Execution timed out after 5 minutes' },
        }),
      );
    });

    it('should use custom timeout when provided', async () => {
      mockRepository.update!.mockResolvedValue(createMockUpdateResult(0));

      await service.markTimedOutExecutions(10);

      const updateCall = mockRepository.update!.mock.calls[0];
      expect(updateCall[1].errorInfo.message).toContain('10 minutes');
    });

    it('should set endedAt to current time', async () => {
      const beforeCall = Date.now();
      mockRepository.update!.mockResolvedValue(createMockUpdateResult(0));

      await service.markTimedOutExecutions();

      const updateCall = mockRepository.update!.mock.calls[0];
      const endedAt = updateCall[1].endedAt as Date;
      expect(endedAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(endedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should return 0 when no executions timed out', async () => {
      mockRepository.update!.mockResolvedValue(createMockUpdateResult(0));

      const result = await service.markTimedOutExecutions();

      expect(result).toBe(0);
    });

    it('should handle undefined affected count', async () => {
      mockRepository.update!.mockResolvedValue({ raw: [], generatedMaps: [] });

      const result = await service.markTimedOutExecutions();

      expect(result).toBe(0);
    });

    it('should only update pending executions', async () => {
      mockRepository.update!.mockResolvedValue(createMockUpdateResult(0));

      await service.markTimedOutExecutions();

      const whereClause = mockRepository.update!.mock.calls[0][0];
      expect(whereClause.status).toBe('pending');
    });
  });
});
