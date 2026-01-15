/**
 * Unit tests for AnalyticsService
 *
 * Tests analytics aggregation with mocked TypeORM repositories.
 * Focuses on metrics calculation including unique user tracking.
 *
 * Test organization:
 * - Each public method has its own describe block
 * - Success paths tested first, then error paths
 * - Edge cases for empty data and various time ranges
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { FlowEntity } from '../flow/flow.entity';
import { AppEntity } from '../app/app.entity';
import type { MockRepository } from '../flow/test/mock-repository';
import { createMockRepository } from '../flow/test/mock-repository';
import type { AnalyticsTimeRange } from '@chatgpt-app-builder/shared';

/**
 * Creates a mock QueryBuilder for testing
 */
function createMockQueryBuilder(mockResult: Record<string, unknown> | null = null) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(mockResult),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return builder;
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockExecutionRepository: MockRepository<FlowExecutionEntity>;
  let mockFlowRepository: MockRepository<FlowEntity>;
  let mockAppRepository: MockRepository<AppEntity>;

  beforeEach(async () => {
    mockExecutionRepository = createMockRepository<FlowExecutionEntity>();
    mockFlowRepository = createMockRepository<FlowEntity>();
    mockAppRepository = createMockRepository<AppEntity>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(FlowExecutionEntity),
          useValue: mockExecutionRepository,
        },
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

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // Tests for getAppAnalytics() method
  // ============================================================
  describe('getAppAnalytics', () => {
    const mockApp = {
      id: 'app-1',
      name: 'Test App',
      slug: 'test-app',
      status: 'published',
    };

    const mockFlows = [
      { id: 'flow-1', name: 'Flow 1' },
      { id: 'flow-2', name: 'Flow 2' },
    ];

    beforeEach(() => {
      mockAppRepository.findOne!.mockResolvedValue(mockApp);
      mockFlowRepository.find!.mockResolvedValue(mockFlows);
    });

    it('should throw NotFoundException when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      await expect(service.getAppAnalytics('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return analytics with uniqueUsers metric', async () => {
      const currentMetricsBuilder = createMockQueryBuilder({
        total: '100',
        fulfilled: '95',
        avgDuration: '250.5',
        uniqueUsers: '42',
      });
      const priorMetricsBuilder = createMockQueryBuilder({
        total: '80',
        fulfilled: '75',
        avgDuration: '300.0',
        uniqueUsers: '35',
      });
      const chartBuilder = createMockQueryBuilder();

      let callCount = 0;
      mockExecutionRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return currentMetricsBuilder;
        if (callCount === 2) return priorMetricsBuilder;
        return chartBuilder;
      });

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers).toBeDefined();
      expect(result.metrics.uniqueUsers.value).toBe(42);
      expect(result.metrics.uniqueUsers.displayValue).toBe('42');
    });

    it('should include uniqueUsers in COUNT DISTINCT query', async () => {
      const mockBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: '5',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      await service.getAppAnalytics('app-1', '7d');

      expect(mockBuilder.addSelect).toHaveBeenCalledWith(
        'COUNT(DISTINCT e.userFingerprint)',
        'uniqueUsers',
      );
    });

    it('should calculate trend for uniqueUsers', async () => {
      const currentMetricsBuilder = createMockQueryBuilder({
        total: '100',
        fulfilled: '95',
        avgDuration: '250.5',
        uniqueUsers: '50',
      });
      const priorMetricsBuilder = createMockQueryBuilder({
        total: '80',
        fulfilled: '75',
        avgDuration: '300.0',
        uniqueUsers: '40',
      });
      const chartBuilder = createMockQueryBuilder();

      let callCount = 0;
      mockExecutionRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return currentMetricsBuilder;
        if (callCount === 2) return priorMetricsBuilder;
        return chartBuilder;
      });

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers.trend).toBeDefined();
      expect(result.metrics.uniqueUsers.trend?.direction).toBe('up');
      expect(result.metrics.uniqueUsers.trend?.isPositive).toBe(true);
      // (50 - 40) / 40 * 100 = 25%
      expect(result.metrics.uniqueUsers.trend?.percentage).toBe(25);
    });

    it('should show negative trend when uniqueUsers decreases', async () => {
      const currentMetricsBuilder = createMockQueryBuilder({
        total: '100',
        fulfilled: '95',
        avgDuration: '250.5',
        uniqueUsers: '30',
      });
      const priorMetricsBuilder = createMockQueryBuilder({
        total: '100',
        fulfilled: '95',
        avgDuration: '250.5',
        uniqueUsers: '40',
      });
      const chartBuilder = createMockQueryBuilder();

      let callCount = 0;
      mockExecutionRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return currentMetricsBuilder;
        if (callCount === 2) return priorMetricsBuilder;
        return chartBuilder;
      });

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers.trend?.direction).toBe('down');
      expect(result.metrics.uniqueUsers.trend?.isPositive).toBe(false);
    });

    it('should return null trend when no prior uniqueUsers data', async () => {
      const currentMetricsBuilder = createMockQueryBuilder({
        total: '100',
        fulfilled: '95',
        avgDuration: '250.5',
        uniqueUsers: '42',
      });
      const priorMetricsBuilder = createMockQueryBuilder({
        total: '0',
        fulfilled: '0',
        avgDuration: '0',
        uniqueUsers: '0',
      });
      const chartBuilder = createMockQueryBuilder();

      let callCount = 0;
      mockExecutionRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return currentMetricsBuilder;
        if (callCount === 2) return priorMetricsBuilder;
        return chartBuilder;
      });

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers.trend).toBeNull();
    });

    it('should return zero uniqueUsers when no executions', async () => {
      const mockBuilder = createMockQueryBuilder({
        total: '0',
        fulfilled: '0',
        avgDuration: null,
        uniqueUsers: '0',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers.value).toBe(0);
      expect(result.metrics.uniqueUsers.displayValue).toBe('0');
    });

    it('should handle null uniqueUsers from database', async () => {
      const currentMetricsBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: null,
      });
      const priorMetricsBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: null,
      });
      const chartBuilder = createMockQueryBuilder();

      let callCount = 0;
      mockExecutionRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return currentMetricsBuilder;
        if (callCount === 2) return priorMetricsBuilder;
        return chartBuilder;
      });

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers.value).toBe(0);
    });

    it('should filter executions by flowId when provided', async () => {
      const mockBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: '5',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      const result = await service.getAppAnalytics('app-1', '7d', 'flow-1');

      expect(result.flowId).toBe('flow-1');
    });

    it('should return all flows as options', async () => {
      const mockBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: '5',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.flows).toHaveLength(2);
      expect(result.flows[0]).toEqual({ id: 'flow-1', name: 'Flow 1' });
      expect(result.flows[1]).toEqual({ id: 'flow-2', name: 'Flow 2' });
    });

    describe('time range handling', () => {
      const timeRanges: AnalyticsTimeRange[] = ['24h', '7d', '30d', '3mo'];

      it.each(timeRanges)('should accept %s time range', async (timeRange) => {
        const mockBuilder = createMockQueryBuilder({
          total: '10',
          fulfilled: '10',
          avgDuration: '100',
          uniqueUsers: '5',
        });
        mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

        const result = await service.getAppAnalytics('app-1', timeRange);

        expect(result.timeRange).toBe(timeRange);
      });
    });

    it('should return chartData with timestamps and labels', async () => {
      const mockMetricsBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: '5',
      });
      const chartBuilder = createMockQueryBuilder();
      chartBuilder.getRawMany.mockResolvedValue([
        { bucket: '2026-01-10', executions: '5' },
        { bucket: '2026-01-11', executions: '3' },
      ]);

      let callCount = 0;
      mockExecutionRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) return mockMetricsBuilder;
        return chartBuilder;
      });

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.chartData).toBeDefined();
      expect(Array.isArray(result.chartData)).toBe(true);
    });

    it('should exclude preview executions from analytics', async () => {
      const mockBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: '5',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      await service.getAppAnalytics('app-1', '7d');

      expect(mockBuilder.andWhere).toHaveBeenCalledWith(
        'e.isPreview = :isPreview',
        { isPreview: false },
      );
    });

    it('should return empty metrics when no flows exist', async () => {
      mockFlowRepository.find!.mockResolvedValue([]);
      const mockBuilder = createMockQueryBuilder({
        total: '0',
        fulfilled: '0',
        avgDuration: '0',
        uniqueUsers: '0',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.totalExecutions.value).toBe(0);
      expect(result.metrics.uniqueUsers.value).toBe(0);
    });
  });

  // ============================================================
  // Tests for uniqueUsers metric formatting
  // ============================================================
  describe('uniqueUsers metric formatting', () => {
    const mockApp = { id: 'app-1', name: 'Test App', slug: 'test-app', status: 'published' };
    const mockFlows = [{ id: 'flow-1', name: 'Flow 1' }];

    beforeEach(() => {
      mockAppRepository.findOne!.mockResolvedValue(mockApp);
      mockFlowRepository.find!.mockResolvedValue(mockFlows);
    });

    it('should format large uniqueUsers with commas', async () => {
      const mockBuilder = createMockQueryBuilder({
        total: '10000',
        fulfilled: '9500',
        avgDuration: '100',
        uniqueUsers: '1234',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers.displayValue).toBe('1,234');
    });

    it('should handle single digit uniqueUsers', async () => {
      const mockBuilder = createMockQueryBuilder({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: '3',
      });
      mockExecutionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockBuilder);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.metrics.uniqueUsers.displayValue).toBe('3');
    });
  });
});
