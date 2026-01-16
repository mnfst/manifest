/**
 * Unit tests for AnalyticsService
 *
 * Tests analytics aggregation and trend calculation with mocked repositories.
 * No database connections are made - all repository calls are mocked.
 *
 * Test organization:
 * - Each public method has its own describe block
 * - Helper methods tested indirectly through public methods
 * - Edge cases for empty data and trend calculation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { FlowEntity } from '../flow/flow.entity';
import { AppEntity } from '../app/app.entity';
import {
  createMockQueryBuilder,
  createMockRepository,
  type MockQueryBuilder,
} from './test/mock-repository';
import {
  createMockAppEntity,
  createMockFlowEntity,
  createMockMetricsResult,
  createMockChartQueryResults,
} from './test/fixtures';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockExecutionRepository: ReturnType<typeof createMockRepository>;
  let mockFlowRepository: ReturnType<typeof createMockRepository>;
  let mockAppRepository: ReturnType<typeof createMockRepository>;
  let mockExecutionQueryBuilder: MockQueryBuilder;
  let mockChartQueryBuilder: MockQueryBuilder;

  beforeEach(async () => {
    mockExecutionRepository = createMockRepository();
    mockFlowRepository = createMockRepository();
    mockAppRepository = createMockRepository();

    // Create separate query builders for metrics and chart queries
    mockExecutionQueryBuilder = createMockQueryBuilder();
    mockChartQueryBuilder = createMockQueryBuilder();

    // Setup execution repository to return different query builders based on call order
    let queryBuilderCallCount = 0;
    mockExecutionRepository.createQueryBuilder.mockImplementation(() => {
      queryBuilderCallCount++;
      // First two calls are for current and prior metrics, third+ are for chart/flows
      if (queryBuilderCallCount <= 2) {
        return mockExecutionQueryBuilder;
      }
      return mockChartQueryBuilder;
    });

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
    beforeEach(() => {
      // Default mock setup for metrics and chart queries
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(100, 85, 1500, 50),
      );
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);
    });

    it('should return analytics for an app', async () => {
      const app = createMockAppEntity({ id: 'app-1' });
      const flows = [
        createMockFlowEntity({ id: 'flow-1', name: 'Flow 1' }),
        createMockFlowEntity({ id: 'flow-2', name: 'Flow 2' }),
      ];

      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue(flows);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result).toBeDefined();
      expect(result.appId).toBe('app-1');
      expect(result.timeRange).toBe('7d');
      expect(result.metrics).toBeDefined();
      expect(result.chartData).toBeDefined();
      expect(result.flows).toHaveLength(2);
    });

    it('should throw NotFoundException when app not found', async () => {
      mockAppRepository.findOne!.mockResolvedValue(null);

      await expect(service.getAppAnalytics('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use default time range of 7d', async () => {
      const app = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1');

      expect(result.timeRange).toBe('7d');
    });

    it('should filter by flowId when provided', async () => {
      const app = createMockAppEntity();
      const flows = [
        createMockFlowEntity({ id: 'flow-1' }),
        createMockFlowEntity({ id: 'flow-2' }),
      ];

      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue(flows);

      const result = await service.getAppAnalytics('app-1', '7d', 'flow-1');

      expect(result.flowId).toBe('flow-1');
    });

    it('should return flowId as null when not filtering', async () => {
      const app = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.flowId).toBeNull();
    });

    it('should return flow options', async () => {
      const app = createMockAppEntity();
      const flows = [
        createMockFlowEntity({ id: 'f1', name: 'First Flow' }),
        createMockFlowEntity({ id: 'f2', name: 'Second Flow' }),
      ];

      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue(flows);

      const result = await service.getAppAnalytics('app-1');

      expect(result.flows).toEqual([
        { id: 'f1', name: 'First Flow' },
        { id: 'f2', name: 'Second Flow' },
      ]);
    });

    it('should handle app with no flows', async () => {
      const app = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1');

      expect(result.flows).toEqual([]);
      expect(result.metrics.totalExecutions.value).toBe(0);
    });
  });

  // ============================================================
  // Tests for metrics calculation
  // ============================================================
  describe('metrics', () => {
    beforeEach(() => {
      const app = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue([
        createMockFlowEntity({ id: 'flow-1' }),
      ]);
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);
    });

    it('should calculate total executions', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(250, 200, 1000, 100),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.totalExecutions.value).toBe(250);
      expect(result.metrics.totalExecutions.displayValue).toBe('250');
    });

    it('should calculate success rate', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(100, 85, 1000, 50),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.successRate.value).toBe(85);
      expect(result.metrics.successRate.displayValue).toBe('85.0%');
    });

    it('should handle zero executions for success rate', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(0, 0, 0, 0),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.successRate.value).toBe(0);
      expect(result.metrics.successRate.displayValue).toBe('0.0%');
    });

    it('should calculate average duration in ms', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(100, 85, 2500, 50),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.avgDuration.value).toBe(2500);
      expect(result.metrics.avgDuration.displayValue).toBe('2.50s');
    });

    it('should format duration as ms for small values', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(100, 85, 500, 50),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.avgDuration.displayValue).toBe('500ms');
    });

    it('should format large numbers with commas', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(12345, 10000, 1000, 1234),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.totalExecutions.displayValue).toBe('12,345');
    });

    it('should calculate unique users', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(100, 85, 1000, 42),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.uniqueUsers.value).toBe(42);
      expect(result.metrics.uniqueUsers.displayValue).toBe('42');
    });

    it('should format large unique users with commas', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(10000, 9500, 100, 1234),
      );

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.uniqueUsers.displayValue).toBe('1,234');
    });

    it('should handle null uniqueUsers from database', async () => {
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue({
        total: '10',
        fulfilled: '10',
        avgDuration: '100',
        uniqueUsers: null,
      });

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.uniqueUsers.value).toBe(0);
    });
  });

  // ============================================================
  // Tests for trend calculation
  // ============================================================
  describe('trends', () => {
    beforeEach(() => {
      const app = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue([
        createMockFlowEntity({ id: 'flow-1' }),
      ]);
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);
    });

    it('should calculate upward trend', async () => {
      // Current: 100, Prior: 50 = 100% increase
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 50))
        .mockResolvedValueOnce(createMockMetricsResult(50, 40, 1200, 25));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.totalExecutions.trend).toBeDefined();
      expect(result.metrics.totalExecutions.trend?.direction).toBe('up');
      expect(result.metrics.totalExecutions.trend?.percentage).toBe(100);
      expect(result.metrics.totalExecutions.trend?.isPositive).toBe(true);
    });

    it('should calculate downward trend', async () => {
      // Current: 50, Prior: 100 = 50% decrease
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(50, 40, 1000, 25))
        .mockResolvedValueOnce(createMockMetricsResult(100, 80, 1200, 50));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.totalExecutions.trend?.direction).toBe('down');
      expect(result.metrics.totalExecutions.trend?.percentage).toBe(50);
      expect(result.metrics.totalExecutions.trend?.isPositive).toBe(false);
    });

    it('should return null trend when prior period has no data', async () => {
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 50))
        .mockResolvedValueOnce(createMockMetricsResult(0, 0, 0, 0));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.totalExecutions.trend).toBeNull();
    });

    it('should treat duration decrease as positive', async () => {
      // Current: 1000ms, Prior: 2000ms = 50% decrease (faster is better)
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 50))
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 2000, 50));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.avgDuration.trend?.direction).toBe('down');
      expect(result.metrics.avgDuration.trend?.isPositive).toBe(true);
    });

    it('should treat duration increase as negative', async () => {
      // Current: 2000ms, Prior: 1000ms = 100% increase (slower is worse)
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 2000, 50))
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 50));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.avgDuration.trend?.direction).toBe('up');
      expect(result.metrics.avgDuration.trend?.isPositive).toBe(false);
    });

    it('should calculate trend for unique users', async () => {
      // Current: 50, Prior: 40 = 25% increase
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 50))
        .mockResolvedValueOnce(createMockMetricsResult(80, 70, 1000, 40));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.uniqueUsers.trend).toBeDefined();
      expect(result.metrics.uniqueUsers.trend?.direction).toBe('up');
      expect(result.metrics.uniqueUsers.trend?.isPositive).toBe(true);
      expect(result.metrics.uniqueUsers.trend?.percentage).toBe(25);
    });

    it('should show negative trend when uniqueUsers decreases', async () => {
      // Current: 30, Prior: 40 = 25% decrease
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 30))
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 40));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.uniqueUsers.trend?.direction).toBe('down');
      expect(result.metrics.uniqueUsers.trend?.isPositive).toBe(false);
    });

    it('should return null trend when no prior uniqueUsers data', async () => {
      mockExecutionQueryBuilder.getRawOne
        .mockResolvedValueOnce(createMockMetricsResult(100, 85, 1000, 42))
        .mockResolvedValueOnce(createMockMetricsResult(0, 0, 0, 0));

      const result = await service.getAppAnalytics('app-1');

      expect(result.metrics.uniqueUsers.trend).toBeNull();
    });
  });

  // ============================================================
  // Tests for chart data
  // ============================================================
  describe('chartData', () => {
    beforeEach(() => {
      const app = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue([
        createMockFlowEntity({ id: 'flow-1' }),
      ]);
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(100, 85, 1000, 50),
      );
    });

    it('should return chart data with correct number of buckets for 7d', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.chartData.length).toBe(7);
    });

    it('should return chart data with correct number of buckets for 24h', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '24h');

      expect(result.chartData.length).toBe(24);
    });

    it('should return chart data with correct number of buckets for 30d', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '30d');

      expect(result.chartData.length).toBe(30);
    });

    it('should return chart data with correct number of buckets for 3mo', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '3mo');

      expect(result.chartData.length).toBe(13);
    });

    it('should merge query results into bucket data', async () => {
      const today = new Date();
      const bucketDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      mockChartQueryBuilder.getRawMany.mockResolvedValue(
        createMockChartQueryResults([{ bucket: bucketDate, executions: 42 }]),
      );

      const result = await service.getAppAnalytics('app-1', '7d');

      const matchingBucket = result.chartData.find(
        (d) => d.timestamp === bucketDate,
      );
      expect(matchingBucket?.executions).toBe(42);
    });

    it('should default missing buckets to 0 executions', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '7d');

      result.chartData.forEach((point) => {
        expect(point.executions).toBe(0);
      });
    });

    it('should include labels for each data point', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '7d');

      result.chartData.forEach((point) => {
        expect(point.label).toBeDefined();
        expect(point.label.length).toBeGreaterThan(0);
      });
    });

    it('should format 24h labels as time', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '24h');

      // Labels should be in format like "14:00"
      result.chartData.forEach((point) => {
        expect(point.label).toMatch(/^\d{2}:00$/);
      });
    });

    it('should format 3mo labels as week numbers', async () => {
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getAppAnalytics('app-1', '3mo');

      // Labels should be in format like "Week 2"
      result.chartData.forEach((point) => {
        expect(point.label).toMatch(/^Week \d+$/);
      });
    });
  });

  // ============================================================
  // Tests for different time ranges
  // ============================================================
  describe('time ranges', () => {
    beforeEach(() => {
      const app = createMockAppEntity();
      mockAppRepository.findOne!.mockResolvedValue(app);
      mockFlowRepository.find!.mockResolvedValue([
        createMockFlowEntity({ id: 'flow-1' }),
      ]);
      mockExecutionQueryBuilder.getRawOne.mockResolvedValue(
        createMockMetricsResult(100, 85, 1000, 50),
      );
      mockChartQueryBuilder.getRawMany.mockResolvedValue([]);
    });

    it('should handle 24h time range', async () => {
      const result = await service.getAppAnalytics('app-1', '24h');

      expect(result.timeRange).toBe('24h');
      expect(result.chartData.length).toBe(24);
    });

    it('should handle 7d time range', async () => {
      const result = await service.getAppAnalytics('app-1', '7d');

      expect(result.timeRange).toBe('7d');
      expect(result.chartData.length).toBe(7);
    });

    it('should handle 30d time range', async () => {
      const result = await service.getAppAnalytics('app-1', '30d');

      expect(result.timeRange).toBe('30d');
      expect(result.chartData.length).toBe(30);
    });

    it('should handle 3mo time range', async () => {
      const result = await service.getAppAnalytics('app-1', '3mo');

      expect(result.timeRange).toBe('3mo');
      expect(result.chartData.length).toBe(13);
    });
  });
});
