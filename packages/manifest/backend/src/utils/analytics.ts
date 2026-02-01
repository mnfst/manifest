import type { AnalyticsTimeRange, ChartDataPoint, TrendData } from '@manifest/shared';

/**
 * Calculate trend between current and prior values.
 * Returns null when there's no prior data to compare against.
 */
export function calculateTrend(
  current: number,
  prior: number,
  increaseIsPositive: boolean,
): TrendData | null {
  if (prior === 0) {
    return null;
  }

  const percentage = ((current - prior) / prior) * 100;
  const direction: TrendData['direction'] =
    percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'unchanged';

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
 * Get ISO week number for a date.
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}

/**
 * Format bucket timestamp to display label based on the time range.
 */
export function formatBucketLabel(
  bucket: string,
  timeRange: AnalyticsTimeRange,
): string {
  if (timeRange === '24h') {
    return bucket.split(' ')[1] || bucket;
  }

  if (timeRange === '3mo') {
    const weekMatch = bucket.match(/W(\d+)$/);
    return weekMatch ? `Week ${parseInt(weekMatch[1], 10)}` : bucket;
  }

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
 * Generate all expected time buckets for a time range with 0 values.
 */
export function generateAllBuckets(
  timeRange: AnalyticsTimeRange,
): ChartDataPoint[] {
  const now = new Date();
  const buckets: ChartDataPoint[] = [];

  const createBucket = (timestamp: string): ChartDataPoint => ({
    timestamp,
    label: formatBucketLabel(timestamp, timeRange),
    executions: 0,
    uniqueUsers: 0,
    completionRate: 0,
    avgDuration: 0,
  });

  if (timeRange === '24h') {
    for (let i = 23; i >= 0; i--) {
      const date = new Date(now);
      date.setHours(date.getHours() - i, 0, 0, 0);
      const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      buckets.push(createBucket(timestamp));
    }
  } else if (timeRange === '7d') {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      buckets.push(createBucket(timestamp));
    }
  } else if (timeRange === '30d') {
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      buckets.push(createBucket(timestamp));
    }
  } else if (timeRange === '3mo') {
    for (let i = 12; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      const weekNum = getISOWeekNumber(date);
      const timestamp = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      buckets.push(createBucket(timestamp));
    }
  }

  return buckets;
}
