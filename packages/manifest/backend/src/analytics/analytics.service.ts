import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { FlowEntity } from '../flow/flow.entity';
import { AppEntity } from '../app/app.entity';
import {
  TIME_RANGE_CONFIGS,
  formatNumber,
  type AnalyticsTimeRange,
  type AppAnalyticsResponse,
  type ChartDataPoint,
  type AnalyticsMetric,
  type FlowOption,
  type FlowAnalytics,
} from '@manifest/shared';
import {
  calculateTrend,
  generateAllBuckets,
} from '../utils/analytics';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(FlowExecutionEntity)
    private readonly executionRepository: Repository<FlowExecutionEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>
  ) {}

  /**
   * Get analytics data for an app
   */
  async getAppAnalytics(
    appId: string,
    timeRange: AnalyticsTimeRange = '7d',
    flowId?: string
  ): Promise<AppAnalyticsResponse> {
    // Verify app exists
    const app = await this.appRepository.findOne({ where: { id: appId } });
    if (!app) {
      throw new NotFoundException(`App not found: ${appId}`);
    }

    // Get all flows for this app
    const flows = await this.flowRepository.find({
      where: { appId },
      select: ['id', 'name'],
    });

    const flowIds = flowId ? [flowId] : flows.map((f) => f.id);

    // Get metrics for current period
    const currentMetrics = await this.getMetrics(flowIds, timeRange);

    // Get metrics for prior period (for trend calculation)
    const priorMetrics = await this.getPriorPeriodMetrics(flowIds, timeRange);

    // Calculate trend data
    const metrics = this.calculateMetricsWithTrend(currentMetrics, priorMetrics);

    // Get chart data
    const chartData = await this.getChartData(flowIds, timeRange);

    // Map flows to FlowOption format
    const flowOptions: FlowOption[] = flows.map((f) => ({
      id: f.id,
      name: f.name,
    }));

    // Get per-flow metrics for the table
    const flowsWithMetrics = await this.getFlowsWithMetrics(flows, timeRange);

    return {
      appId,
      timeRange,
      flowId: flowId ?? null,
      metrics,
      chartData,
      flows: flowOptions,
      flowsWithMetrics,
    };
  }

  /**
   * Get aggregated metrics for a time range
   */
  private async getMetrics(
    flowIds: string[],
    timeRange: AnalyticsTimeRange
  ): Promise<{ total: number; fulfilled: number; avgDuration: number; uniqueUsers: number }> {
    if (flowIds.length === 0) {
      return { total: 0, fulfilled: 0, avgDuration: 0, uniqueUsers: 0 };
    }

    const config = TIME_RANGE_CONFIGS[timeRange];

    const result = await this.executionRepository
      .createQueryBuilder('e')
      .select('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN e.status = 'fulfilled' THEN 1 ELSE 0 END)",
        'fulfilled'
      )
      .addSelect(
        "AVG(CASE WHEN e.endedAt IS NOT NULL THEN (julianday(e.endedAt) - julianday(e.startedAt)) * 86400000 ELSE NULL END)",
        'avgDuration'
      )
      .addSelect(
        'COUNT(DISTINCT e.userFingerprint)',
        'uniqueUsers'
      )
      .where('e.flowId IN (:...flowIds)', { flowIds })
      .andWhere('e.isPreview = :isPreview', { isPreview: false })
      .andWhere(`e.startedAt >= datetime('now', :modifier)`, {
        modifier: config.modifier,
      })
      .getRawOne();

    return {
      total: parseInt(result?.total ?? '0', 10),
      fulfilled: parseInt(result?.fulfilled ?? '0', 10),
      avgDuration: parseFloat(result?.avgDuration ?? '0'),
      uniqueUsers: parseInt(result?.uniqueUsers ?? '0', 10),
    };
  }

  /**
   * Get metrics for the prior equivalent period
   */
  private async getPriorPeriodMetrics(
    flowIds: string[],
    timeRange: AnalyticsTimeRange
  ): Promise<{ total: number; fulfilled: number; avgDuration: number; uniqueUsers: number }> {
    if (flowIds.length === 0) {
      return { total: 0, fulfilled: 0, avgDuration: 0, uniqueUsers: 0 };
    }

    // Map time range to prior period modifiers
    const priorRangeMap: Record<
      AnalyticsTimeRange,
      { start: string; end: string }
    > = {
      '24h': { start: '-48 hours', end: '-24 hours' },
      '7d': { start: '-14 days', end: '-7 days' },
      '30d': { start: '-60 days', end: '-30 days' },
      '3mo': { start: '-6 months', end: '-3 months' },
    };

    const priorRange = priorRangeMap[timeRange];

    const result = await this.executionRepository
      .createQueryBuilder('e')
      .select('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN e.status = 'fulfilled' THEN 1 ELSE 0 END)",
        'fulfilled'
      )
      .addSelect(
        "AVG(CASE WHEN e.endedAt IS NOT NULL THEN (julianday(e.endedAt) - julianday(e.startedAt)) * 86400000 ELSE NULL END)",
        'avgDuration'
      )
      .addSelect(
        'COUNT(DISTINCT e.userFingerprint)',
        'uniqueUsers'
      )
      .where('e.flowId IN (:...flowIds)', { flowIds })
      .andWhere('e.isPreview = :isPreview', { isPreview: false })
      .andWhere(`e.startedAt >= datetime('now', :start)`, {
        start: priorRange.start,
      })
      .andWhere(`e.startedAt < datetime('now', :end)`, { end: priorRange.end })
      .getRawOne();

    return {
      total: parseInt(result?.total ?? '0', 10),
      fulfilled: parseInt(result?.fulfilled ?? '0', 10),
      avgDuration: parseFloat(result?.avgDuration ?? '0'),
      uniqueUsers: parseInt(result?.uniqueUsers ?? '0', 10),
    };
  }

  /**
   * Calculate metrics with trend data
   */
  private calculateMetricsWithTrend(
    current: { total: number; fulfilled: number; avgDuration: number; uniqueUsers: number },
    prior: { total: number; fulfilled: number; avgDuration: number; uniqueUsers: number }
  ): {
    totalExecutions: AnalyticsMetric;
    successRate: AnalyticsMetric;
    avgDuration: AnalyticsMetric;
    uniqueUsers: AnalyticsMetric;
  } {
    const currentSuccessRate =
      current.total > 0 ? (current.fulfilled / current.total) * 100 : 0;
    const priorSuccessRate =
      prior.total > 0 ? (prior.fulfilled / prior.total) * 100 : 0;

    return {
      totalExecutions: {
        value: current.total,
        displayValue: formatNumber(current.total),
        trend: calculateTrend(current.total, prior.total, true),
      },
      successRate: {
        value: currentSuccessRate,
        displayValue: `${currentSuccessRate.toFixed(1)}%`,
        trend: calculateTrend(currentSuccessRate, priorSuccessRate, true),
      },
      avgDuration: {
        value: current.avgDuration,
        displayValue: this.formatDuration(current.avgDuration),
        trend: calculateTrend(
          current.avgDuration,
          prior.avgDuration,
          false // Lower duration is better
        ),
      },
      uniqueUsers: {
        value: current.uniqueUsers,
        displayValue: formatNumber(current.uniqueUsers),
        trend: calculateTrend(current.uniqueUsers, prior.uniqueUsers, true),
      },
    };
  }


  /**
   * Get time-bucketed chart data with all 4 metrics
   */
  private async getChartData(
    flowIds: string[],
    timeRange: AnalyticsTimeRange
  ): Promise<ChartDataPoint[]> {
    const config = TIME_RANGE_CONFIGS[timeRange];

    // Generate all expected buckets with 0 values for all metrics
    const allBuckets = generateAllBuckets(timeRange);

    if (flowIds.length === 0) {
      return allBuckets;
    }

    const results = await this.executionRepository
      .createQueryBuilder('e')
      .select(`strftime('${config.bucketFormat}', e.startedAt)`, 'bucket')
      .addSelect('COUNT(*)', 'executions')
      .addSelect('COUNT(DISTINCT e.userFingerprint)', 'uniqueUsers')
      .addSelect(
        `CASE WHEN COUNT(*) = 0 THEN 0 ELSE
         (SUM(CASE WHEN e.status = 'fulfilled' THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
         END`,
        'completionRate'
      )
      .addSelect(
        `AVG(CASE WHEN e.endedAt IS NOT NULL
             THEN (julianday(e.endedAt) - julianday(e.startedAt)) * 86400000
             ELSE NULL END)`,
        'avgDuration'
      )
      .where('e.flowId IN (:...flowIds)', { flowIds })
      .andWhere('e.isPreview = :isPreview', { isPreview: false })
      .andWhere(`e.startedAt >= datetime('now', :modifier)`, {
        modifier: config.modifier,
      })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    // Create a map of bucket -> metrics from query results
    const metricsMap = new Map<
      string,
      { executions: number; uniqueUsers: number; completionRate: number; avgDuration: number }
    >();
    for (const row of results) {
      metricsMap.set(row.bucket, {
        executions: parseInt(row.executions, 10),
        uniqueUsers: parseInt(row.uniqueUsers ?? '0', 10),
        completionRate: parseFloat(row.completionRate ?? '0'),
        avgDuration: parseFloat(row.avgDuration ?? '0'),
      });
    }

    // Merge query results into all buckets with 0 defaults
    return allBuckets.map((bucket) => {
      const metrics = metricsMap.get(bucket.timestamp);
      return {
        ...bucket,
        executions: metrics?.executions ?? 0,
        uniqueUsers: metrics?.uniqueUsers ?? 0,
        completionRate: metrics?.completionRate ?? 0,
        avgDuration: metrics?.avgDuration ?? 0,
      };
    });
  }

  /**
   * Get per-flow metrics for the flows table
   */
  private async getFlowsWithMetrics(
    flows: { id: string; name: string }[],
    timeRange: AnalyticsTimeRange
  ): Promise<FlowAnalytics[]> {
    if (flows.length === 0) {
      return [];
    }

    const config = TIME_RANGE_CONFIGS[timeRange];
    const flowIds = flows.map((f) => f.id);

    // Query metrics grouped by flow
    const results = await this.executionRepository
      .createQueryBuilder('e')
      .select('e.flowId', 'flowId')
      .addSelect('COUNT(*)', 'executions')
      .addSelect(
        `CASE WHEN COUNT(*) = 0 THEN 0 ELSE
         (SUM(CASE WHEN e.status = 'fulfilled' THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
         END`,
        'completionRate'
      )
      .addSelect(
        `AVG(CASE WHEN e.endedAt IS NOT NULL
             THEN (julianday(e.endedAt) - julianday(e.startedAt)) * 86400000
             ELSE NULL END)`,
        'avgDuration'
      )
      .where('e.flowId IN (:...flowIds)', { flowIds })
      .andWhere('e.isPreview = :isPreview', { isPreview: false })
      .andWhere(`e.startedAt >= datetime('now', :modifier)`, {
        modifier: config.modifier,
      })
      .groupBy('e.flowId')
      .getRawMany();

    // Create a map of flowId -> metrics
    const metricsMap = new Map<
      string,
      { executions: number; completionRate: number; avgDuration: number }
    >();
    for (const row of results) {
      metricsMap.set(row.flowId, {
        executions: parseInt(row.executions, 10),
        completionRate: parseFloat(row.completionRate ?? '0'),
        avgDuration: parseFloat(row.avgDuration ?? '0'),
      });
    }

    // Map flows with their metrics, sorted by executions descending
    return flows
      .map((flow) => {
        const metrics = metricsMap.get(flow.id);
        const executions = metrics?.executions ?? 0;
        const completionRate = metrics?.completionRate ?? 0;
        const avgDuration = metrics?.avgDuration ?? 0;

        return {
          id: flow.id,
          name: flow.name,
          executions,
          completionRate,
          avgDuration,
          displayValues: {
            executions: formatNumber(executions),
            completionRate: `${completionRate.toFixed(1)}%`,
            avgDuration: this.formatDuration(avgDuration),
          },
        };
      })
      .sort((a, b) => b.executions - a.executions);
  }

  /**
   * Format duration in ms to human readable
   */
  private formatDuration(ms: number): string {
    if (ms === 0) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}
