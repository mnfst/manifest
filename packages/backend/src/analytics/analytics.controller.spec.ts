/**
 * Unit tests for AnalyticsController
 *
 * Tests HTTP endpoint behavior with mocked AnalyticsService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import type { AppAnalyticsResponse } from '@chatgpt-app-builder/shared';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let mockService: {
    getAppAnalytics: jest.Mock;
  };

  const mockAnalyticsResponse: AppAnalyticsResponse = {
    appId: 'test-app-id',
    timeRange: '7d',
    flowId: null,
    metrics: {
      totalExecutions: {
        value: 100,
        displayValue: '100',
        trend: { percentage: 10, direction: 'up', isPositive: true },
      },
      successRate: {
        value: 85,
        displayValue: '85.0%',
        trend: { percentage: 5, direction: 'up', isPositive: true },
      },
      avgDuration: {
        value: 1500,
        displayValue: '1.50s',
        trend: { percentage: 10, direction: 'down', isPositive: true },
      },
    },
    chartData: [
      { timestamp: '2026-01-10', label: 'Jan 10', executions: 50 },
    ],
    flows: [
      { id: 'flow-1', name: 'Flow 1' },
    ],
  };

  beforeEach(async () => {
    mockService = {
      getAppAnalytics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // Tests for GET /api/apps/:appId/analytics
  // ============================================================
  describe('getAppAnalytics', () => {
    it('should return analytics response', async () => {
      mockService.getAppAnalytics.mockResolvedValue(mockAnalyticsResponse);

      const result = await controller.getAppAnalytics('test-app-id');

      expect(result).toEqual(mockAnalyticsResponse);
      expect(mockService.getAppAnalytics).toHaveBeenCalledWith(
        'test-app-id',
        undefined,
        undefined,
      );
    });

    it('should pass timeRange to service', async () => {
      mockService.getAppAnalytics.mockResolvedValue(mockAnalyticsResponse);

      await controller.getAppAnalytics('app-id', '30d');

      expect(mockService.getAppAnalytics).toHaveBeenCalledWith(
        'app-id',
        '30d',
        undefined,
      );
    });

    it('should pass flowId to service', async () => {
      mockService.getAppAnalytics.mockResolvedValue(mockAnalyticsResponse);

      await controller.getAppAnalytics('app-id', '7d', 'flow-id');

      expect(mockService.getAppAnalytics).toHaveBeenCalledWith(
        'app-id',
        '7d',
        'flow-id',
      );
    });

    it('should pass all parameters to service', async () => {
      mockService.getAppAnalytics.mockResolvedValue(mockAnalyticsResponse);

      await controller.getAppAnalytics('app-id', '24h', 'flow-123');

      expect(mockService.getAppAnalytics).toHaveBeenCalledWith(
        'app-id',
        '24h',
        'flow-123',
      );
    });

    it('should return metrics data', async () => {
      mockService.getAppAnalytics.mockResolvedValue(mockAnalyticsResponse);

      const result = await controller.getAppAnalytics('app-id');

      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalExecutions).toBeDefined();
      expect(result.metrics.successRate).toBeDefined();
      expect(result.metrics.avgDuration).toBeDefined();
    });

    it('should return chart data', async () => {
      mockService.getAppAnalytics.mockResolvedValue(mockAnalyticsResponse);

      const result = await controller.getAppAnalytics('app-id');

      expect(result.chartData).toBeDefined();
      expect(Array.isArray(result.chartData)).toBe(true);
    });

    it('should return flows list', async () => {
      mockService.getAppAnalytics.mockResolvedValue(mockAnalyticsResponse);

      const result = await controller.getAppAnalytics('app-id');

      expect(result.flows).toBeDefined();
      expect(result.flows).toHaveLength(1);
      expect(result.flows[0]).toEqual({ id: 'flow-1', name: 'Flow 1' });
    });
  });
});
