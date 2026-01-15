/**
 * Unit tests for FlowExecutionService
 *
 * Tests execution tracking with mocked TypeORM repository.
 * Focuses on CRUD operations and userFingerprint handling.
 *
 * Test organization:
 * - Each public method has its own describe block
 * - Success paths tested first, then error paths
 * - Edge cases and complex scenarios included
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FlowExecutionService, CreateExecutionParams } from './flow-execution.service';
import { FlowExecutionEntity } from './flow-execution.entity';
import type { MockRepository } from '../flow/test/mock-repository';
import { createMockRepository } from '../flow/test/mock-repository';

/**
 * Creates a mock FlowExecutionEntity for tests
 */
function createMockExecutionEntity(
  overrides: Partial<FlowExecutionEntity> = {},
): FlowExecutionEntity {
  const now = new Date();
  return {
    id: 'exec-1',
    flowId: 'flow-1',
    flowName: 'Test Flow',
    flowToolName: 'test_tool',
    status: 'pending',
    startedAt: now,
    endedAt: undefined,
    initialParams: {},
    nodeExecutions: [],
    errorInfo: undefined,
    isPreview: false,
    userFingerprint: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FlowExecutionEntity;
}

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
    const baseParams: CreateExecutionParams = {
      flowId: 'flow-1',
      flowName: 'Test Flow',
      flowToolName: 'test_tool',
      initialParams: { message: 'hello' },
    };

    it('should create execution with default values', async () => {
      const mockEntity = createMockExecutionEntity();
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution(baseParams);

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(mockRepository.create).toHaveBeenCalledWith({
        flowId: 'flow-1',
        flowName: 'Test Flow',
        flowToolName: 'test_tool',
        initialParams: { message: 'hello' },
        status: 'pending',
        nodeExecutions: [],
        isPreview: false,
        userFingerprint: undefined,
      });
    });

    it('should save userFingerprint when provided', async () => {
      const fingerprint = 'abc123def456';
      const mockEntity = createMockExecutionEntity({ userFingerprint: fingerprint });
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution({
        ...baseParams,
        userFingerprint: fingerprint,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userFingerprint: fingerprint,
        }),
      );
      expect(result.userFingerprint).toBe(fingerprint);
    });

    it('should have undefined userFingerprint when not provided', async () => {
      const mockEntity = createMockExecutionEntity({ userFingerprint: undefined });
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution(baseParams);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userFingerprint: undefined,
        }),
      );
      expect(result.userFingerprint).toBeUndefined();
    });

    it('should set isPreview to true when provided', async () => {
      const mockEntity = createMockExecutionEntity({ isPreview: true });
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution({
        ...baseParams,
        isPreview: true,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPreview: true,
        }),
      );
      expect(result.isPreview).toBe(true);
    });

    it('should default isPreview to false when not provided', async () => {
      const mockEntity = createMockExecutionEntity({ isPreview: false });
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      await service.createExecution(baseParams);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPreview: false,
        }),
      );
    });

    it('should save both userFingerprint and isPreview together', async () => {
      const fingerprint = 'user_fp_123';
      const mockEntity = createMockExecutionEntity({
        userFingerprint: fingerprint,
        isPreview: false,
      });
      mockRepository.create!.mockReturnValue(mockEntity);
      mockRepository.save!.mockResolvedValue(mockEntity);

      const result = await service.createExecution({
        ...baseParams,
        userFingerprint: fingerprint,
        isPreview: false,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userFingerprint: fingerprint,
          isPreview: false,
        }),
      );
      expect(result.userFingerprint).toBe(fingerprint);
      expect(result.isPreview).toBe(false);
    });
  });

  // ============================================================
  // Tests for updateExecution() method
  // ============================================================
  describe('updateExecution', () => {
    it('should update execution status', async () => {
      const mockEntity = createMockExecutionEntity({ status: 'pending' });
      const updatedEntity = { ...mockEntity, status: 'fulfilled' as const };
      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue(updatedEntity);

      const result = await service.updateExecution('exec-1', { status: 'fulfilled' });

      expect(result.status).toBe('fulfilled');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should update endedAt timestamp', async () => {
      const mockEntity = createMockExecutionEntity();
      const endTime = new Date();
      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue({ ...mockEntity, endedAt: endTime });

      const result = await service.updateExecution('exec-1', { endedAt: endTime });

      expect(result.endedAt).toBe(endTime);
    });

    it('should update nodeExecutions array', async () => {
      const mockEntity = createMockExecutionEntity({ nodeExecutions: [] });
      const nodeExecutions = [{
        nodeId: 'node-1',
        nodeName: 'Test Node',
        nodeType: 'Return',
        executedAt: new Date().toISOString(),
        inputData: {},
        outputData: { result: 'success' },
        status: 'completed' as const,
      }];
      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue({ ...mockEntity, nodeExecutions });

      const result = await service.updateExecution('exec-1', { nodeExecutions });

      expect(result.nodeExecutions).toEqual(nodeExecutions);
    });

    it('should update errorInfo when execution fails', async () => {
      const mockEntity = createMockExecutionEntity();
      const errorInfo = { message: 'Something went wrong', nodeId: 'node-1' };
      mockRepository.findOne!.mockResolvedValue(mockEntity);
      mockRepository.save!.mockResolvedValue({ ...mockEntity, errorInfo });

      const result = await service.updateExecution('exec-1', { errorInfo });

      expect(result.errorInfo).toEqual(errorInfo);
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.updateExecution('non-existent', { status: 'fulfilled' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // Tests for findByFlow() method
  // ============================================================
  describe('findByFlow', () => {
    it('should return paginated executions for a flow', async () => {
      const executions = [
        createMockExecutionEntity({ id: 'exec-1' }),
        createMockExecutionEntity({ id: 'exec-2' }),
      ];
      mockRepository.findAndCount = jest.fn().mockResolvedValue([executions, 2]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-1');

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockRepository.findAndCount = jest.fn().mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-1', { status: 'fulfilled' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'fulfilled',
          }),
        }),
      );
    });

    it('should filter by isPreview when provided', async () => {
      mockRepository.findAndCount = jest.fn().mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(0);

      await service.findByFlow('flow-1', { isPreview: true });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPreview: true,
          }),
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      const executions = Array(20).fill(null).map((_, i) =>
        createMockExecutionEntity({ id: `exec-${i}` }),
      );
      mockRepository.findAndCount = jest.fn().mockResolvedValue([executions.slice(0, 10), 50]);
      mockRepository.count!.mockResolvedValue(0);

      const result = await service.findByFlow('flow-1', { page: 1, limit: 10 });

      expect(result.totalPages).toBe(5);
      expect(result.limit).toBe(10);
    });

    it('should indicate when pending executions exist', async () => {
      mockRepository.findAndCount = jest.fn().mockResolvedValue([[], 0]);
      mockRepository.count!.mockResolvedValue(3);

      const result = await service.findByFlow('flow-1');

      expect(result.hasPendingExecutions).toBe(true);
    });
  });

  // ============================================================
  // Tests for findOne() method
  // ============================================================
  describe('findOne', () => {
    it('should return execution when found', async () => {
      const mockEntity = createMockExecutionEntity({ id: 'exec-1' });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findOne('exec-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('exec-1');
    });

    it('should return null when execution not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // Tests for findOneOrFail() method
  // ============================================================
  describe('findOneOrFail', () => {
    it('should return execution when found', async () => {
      const mockEntity = createMockExecutionEntity({ id: 'exec-1' });
      mockRepository.findOne!.mockResolvedValue(mockEntity);

      const result = await service.findOneOrFail('exec-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('exec-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findOne!.mockResolvedValue(null);

      await expect(service.findOneOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Tests for markTimedOutExecutions() method
  // ============================================================
  describe('markTimedOutExecutions', () => {
    it('should update timed out pending executions', async () => {
      mockRepository.update = jest.fn().mockResolvedValue({ affected: 5 });

      const result = await service.markTimedOutExecutions(5);

      expect(result).toBe(5);
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return 0 when no executions timed out', async () => {
      mockRepository.update = jest.fn().mockResolvedValue({ affected: 0 });

      const result = await service.markTimedOutExecutions();

      expect(result).toBe(0);
    });

    it('should use default timeout of 5 minutes', async () => {
      mockRepository.update = jest.fn().mockResolvedValue({ affected: 0 });

      await service.markTimedOutExecutions();

      expect(mockRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
        }),
        expect.objectContaining({
          status: 'error',
          errorInfo: expect.objectContaining({
            message: expect.stringContaining('5 minutes'),
          }),
        }),
      );
    });
  });
});
