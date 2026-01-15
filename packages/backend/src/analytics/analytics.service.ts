import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { FlowEntity } from '../flow/flow.entity';
import { AppEntity } from '../app/app.entity';
import type {
  AnalyticsTimeRange,
  AppAnalyticsResponse,
  ChartDataPoint,
  AnalyticsMetric,
  TrendData,
  FlowOption,
} from '@chatgpt-app-builder/shared';

/** Time range configuration for aggregation */
interface TimeRangeConfig {
  /** SQLite datetime modifier (e.g., '-7 days') */
  modifier: string;
  /** SQLite strftime format for bucketing */
  bucketFormat: string;
  /** Number of expected buckets */
  expectedBuckets: number;
}

const TIME_RANGE_CONFIGS: Record<AnalyticsTimeRange, TimeRangeConfig> = {
  '24h': { modifier: '-24 hours', bucketFormat: '%Y-%m-%d %H:00', expectedBuckets: 24 },
  '7d': { modifier: '-7 days', bucketFormat: '%Y-%m-%d', expectedBuckets: 7 },
  '30d': { modifier: '-30 days', bucketFormat: '%Y-%m-%d', expectedBuckets: 30 },
  '3mo': { modifier: '-3 months', bucketFormat: '%Y-W%W', expectedBuckets: 13 },
};

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

    return {
      appId,
      timeRange,
      flowId: flowId ?? null,
      metrics,
      chartData,
      flows: flowOptions,
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
        displayValue: this.formatNumber(current.total),
        trend: this.calculateTrend(current.total, prior.total, true),
      },
      successRate: {
        value: currentSuccessRate,
        displayValue: `${currentSuccessRate.toFixed(1)}%`,
        trend: this.calculateTrend(currentSuccessRate, priorSuccessRate, true),
      },
      avgDuration: {
        value: current.avgDuration,
        displayValue: this.formatDuration(current.avgDuration),
        trend: this.calculateTrend(
          current.avgDuration,
          prior.avgDuration,
          false // Lower duration is better
        ),
      },
      uniqueUsers: {
        value: current.uniqueUsers,
        displayValue: this.formatNumber(current.uniqueUsers),
        trend: this.calculateTrend(current.uniqueUsers, prior.uniqueUsers, true),
      },
    };
  }

  /**
   * Calculate trend between current and prior values
   */
  private calculateTrend(
    current: number,
    prior: number,
    increaseIsPositive: boolean
  ): TrendData | null {
    if (prior === 0) {
      return null; // N/A - no prior data
    }

    const percentage = ((current - prior) / prior) * 100;
    const direction: TrendData['direction'] =
      percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'unchanged';

    // For some metrics like duration, decrease is positive
    const isPositive = increaseIsPositive
      ? percentage >= 0
      : percentage <= 0;

    return {
      percentage: Math.abs(percentage),
      direction,
      isPositive,
    };
  }

  /**
   * Get time-bucketed chart data
   */
  private async getChartData(
    flowIds: string[],
    timeRange: AnalyticsTimeRange
  ): Promise<ChartDataPoint[]> {
    const config = TIME_RANGE_CONFIGS[timeRange];

    // Generate all expected buckets with 0 executions
    const allBuckets = this.generateAllBuckets(timeRange);

    if (flowIds.length === 0) {
      return allBuckets;
    }

    const results = await this.executionRepository
      .createQueryBuilder('e')
      .select(`strftime('${config.bucketFormat}', e.startedAt)`, 'bucket')
      .addSelect('COUNT(*)', 'executions')
      .where('e.flowId IN (:...flowIds)', { flowIds })
      .andWhere('e.isPreview = :isPreview', { isPreview: false })
      .andWhere(`e.startedAt >= datetime('now', :modifier)`, {
        modifier: config.modifier,
      })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    // Create a map of bucket -> executions from query results
    const executionMap = new Map<string, number>();
    for (const row of results) {
      executionMap.set(row.bucket, parseInt(row.executions, 10));
    }

    // Merge query results into all buckets
    return allBuckets.map((bucket) => ({
      ...bucket,
      executions: executionMap.get(bucket.timestamp) ?? 0,
    }));
  }

  /**
   * Generate all expected time buckets for a time range
   */
  private generateAllBuckets(timeRange: AnalyticsTimeRange): ChartDataPoint[] {
    const now = new Date();
    const buckets: ChartDataPoint[] = [];

    if (timeRange === '24h') {
      // Generate 24 hourly buckets
      for (let i = 23; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(date.getHours() - i, 0, 0, 0);
        const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
        buckets.push({
          timestamp,
          label: this.formatBucketLabel(timestamp, timeRange),
          executions: 0,
        });
      }
    } else if (timeRange === '7d') {
      // Generate 7 daily buckets
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        buckets.push({
          timestamp,
          label: this.formatBucketLabel(timestamp, timeRange),
          executions: 0,
        });
      }
    } else if (timeRange === '30d') {
      // Generate 30 daily buckets
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        buckets.push({
          timestamp,
          label: this.formatBucketLabel(timestamp, timeRange),
          executions: 0,
        });
      }
    } else if (timeRange === '3mo') {
      // Generate 13 weekly buckets
      for (let i = 12; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);
        const weekNum = this.getISOWeekNumber(date);
        const timestamp = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        buckets.push({
          timestamp,
          label: this.formatBucketLabel(timestamp, timeRange),
          executions: 0,
        });
      }
    }

    return buckets;
  }

  /**
   * Get ISO week number for a date
   */
  private getISOWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Format bucket timestamp to display label
   */
  private formatBucketLabel(
    bucket: string,
    timeRange: AnalyticsTimeRange
  ): string {
    if (timeRange === '24h') {
      // Format: "2026-01-10 14:00" -> "14:00"
      return bucket.split(' ')[1] || bucket;
    }

    if (timeRange === '3mo') {
      // Format: "2026-W02" -> "Week 2"
      const weekMatch = bucket.match(/W(\d+)$/);
      return weekMatch ? `Week ${parseInt(weekMatch[1], 10)}` : bucket;
    }

    // Format: "2026-01-10" -> "Jan 10"
    const date = new Date(bucket);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    return bucket;
  }

  /**
   * Format number with comma separators
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US');
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
