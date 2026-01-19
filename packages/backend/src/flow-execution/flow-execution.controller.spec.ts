/**
 * Unit tests for FlowExecutionController
 *
 * Tests HTTP endpoint behavior with mocked FlowExecutionService.
 * No database connections are made - all service calls are mocked.
 *
 * Test organization:
 * - Each endpoint has its own describe block
 * - Success paths tested first, then error paths
 * - Query parameter parsing tested
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FlowExecutionController } from './flow-execution.controller';
import { FlowExecutionService } from './flow-execution.service';
import {
  createMockFlowExecution,
  createMockExecutionListItem,
} from './test/fixtures';
import type { ExecutionListResponse } from '@manifest/shared';

describe('FlowExecutionController', () => {
  let controller: FlowExecutionController;
  let mockService: {
    findByFlow: jest.Mock;
    findOne: jest.Mock;
    markTimedOutExecutions: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      findByFlow: jest.fn(),
      findOne: jest.fn(),
      markTimedOutExecutions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlowExecutionController],
      providers: [
        {
          provide: FlowExecutionService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<FlowExecutionController>(FlowExecutionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for GET /api/flows/:flowId/executions
  // ============================================================
  describe('listExecutions', () => {
    const flowId = 'test-flow-id';

    it('should return paginated executions', async () => {
      const mockResponse: ExecutionListResponse = {
        items: [
          createMockExecutionListItem({ id: '1' }),
          createMockExecutionListItem({ id: '2' }),
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasPendingExecutions: false,
      };

      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue(mockResponse);

      const result = await controller.listExecutions(flowId);

      expect(result).toEqual(mockResponse);
      expect(result.items).toHaveLength(2);
    });

    it('should mark timed out executions before querying', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(2);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(flowId);

      expect(mockService.markTimedOutExecutions).toHaveBeenCalled();
      expect(mockService.findByFlow).toHaveBeenCalled();
    });

    it('should parse page query parameter', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 3,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(flowId, '3');

      expect(mockService.findByFlow).toHaveBeenCalledWith(flowId, {
        page: 3,
        limit: 20,
        status: undefined,
        isPreview: undefined,
      });
    });

    it('should parse limit query parameter', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(flowId, undefined, '50');

      expect(mockService.findByFlow).toHaveBeenCalledWith(flowId, {
        page: 1,
        limit: 50,
        status: undefined,
        isPreview: undefined,
      });
    });

    it('should pass status filter to service', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(
        flowId,
        undefined,
        undefined,
        'success',
      );

      expect(mockService.findByFlow).toHaveBeenCalledWith(flowId, {
        page: 1,
        limit: 20,
        status: 'success',
        isPreview: undefined,
      });
    });

    it('should parse isPreview=true to boolean', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(
        flowId,
        undefined,
        undefined,
        undefined,
        'true',
      );

      expect(mockService.findByFlow).toHaveBeenCalledWith(flowId, {
        page: 1,
        limit: 20,
        status: undefined,
        isPreview: true,
      });
    });

    it('should parse isPreview=false to boolean', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(
        flowId,
        undefined,
        undefined,
        undefined,
        'false',
      );

      expect(mockService.findByFlow).toHaveBeenCalledWith(flowId, {
        page: 1,
        limit: 20,
        status: undefined,
        isPreview: false,
      });
    });

    it('should leave isPreview undefined when not provided', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(flowId);

      expect(mockService.findByFlow).toHaveBeenCalledWith(flowId, {
        page: 1,
        limit: 20,
        status: undefined,
        isPreview: undefined,
      });
    });

    it('should use default page 1 when not provided', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(flowId);

      expect(mockService.findByFlow).toHaveBeenCalledWith(
        flowId,
        expect.objectContaining({ page: 1 }),
      );
    });

    it('should use default limit 20 when not provided', async () => {
      mockService.markTimedOutExecutions.mockResolvedValue(0);
      mockService.findByFlow.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasPendingExecutions: false,
      });

      await controller.listExecutions(flowId);

      expect(mockService.findByFlow).toHaveBeenCalledWith(
        flowId,
        expect.objectContaining({ limit: 20 }),
      );
    });
  });

  // ============================================================
  // Tests for GET /api/flows/:flowId/executions/:executionId
  // ============================================================
  describe('getExecution', () => {
    const flowId = 'test-flow-id';
    const executionId = 'test-execution-id';

    it('should return execution details', async () => {
      const mockExecution = createMockFlowExecution({
        id: executionId,
        flowId,
      });
      mockService.findOne.mockResolvedValue(mockExecution);

      const result = await controller.getExecution(flowId, executionId);

      expect(result).toEqual(mockExecution);
      expect(mockService.findOne).toHaveBeenCalledWith(executionId);
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockService.findOne.mockResolvedValue(null);

      await expect(
        controller.getExecution(flowId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when flowId does not match', async () => {
      const mockExecution = createMockFlowExecution({
        id: executionId,
        flowId: 'different-flow-id',
      });
      mockService.findOne.mockResolvedValue(mockExecution);

      await expect(
        controller.getExecution(flowId, executionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return execution when flowId is null (flow deleted)', async () => {
      const mockExecution = createMockFlowExecution({
        id: executionId,
        flowId: undefined,
      });
      mockService.findOne.mockResolvedValue(mockExecution);

      const result = await controller.getExecution(flowId, executionId);

      expect(result).toEqual(mockExecution);
    });

    it('should return all execution fields', async () => {
      const mockExecution = createMockFlowExecution({
        id: executionId,
        flowId,
        status: 'success',
        nodeExecutions: [
          {
            nodeId: 'node-1',
            nodeName: 'Test Node',
            nodeType: 'ApiCall',
            status: 'success',
            startedAt: '2026-01-08T00:00:00.000Z',
            endedAt: '2026-01-08T00:00:01.000Z',
            duration: 1000,
            inputData: {},
            outputData: { result: 'ok' },
          },
        ],
        errorInfo: undefined,
      });
      mockService.findOne.mockResolvedValue(mockExecution);

      const result = await controller.getExecution(flowId, executionId);

      expect(result.status).toBe('success');
      expect(result.nodeExecutions).toHaveLength(1);
      expect(result.nodeExecutions[0].outputData).toEqual({ result: 'ok' });
    });
  });
});
