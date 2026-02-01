import type { AnalyticsTimeRange, TimeRangeConfig } from '../types/analytics.js';

/** Time range display labels */
export const TIME_RANGE_LABELS: Record<AnalyticsTimeRange, string> = {
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '3mo': 'Last 3 Months',
};

/** Time range configuration for aggregation (used by backend analytics) */
export const TIME_RANGE_CONFIGS: Record<AnalyticsTimeRange, TimeRangeConfig> = {
  '24h': { modifier: '-24 hours', bucketFormat: '%Y-%m-%d %H:00', expectedBuckets: 24 },
  '7d': { modifier: '-7 days', bucketFormat: '%Y-%m-%d', expectedBuckets: 7 },
  '30d': { modifier: '-30 days', bucketFormat: '%Y-%m-%d', expectedBuckets: 30 },
  '3mo': { modifier: '-3 months', bucketFormat: '%Y-W%W', expectedBuckets: 13 },
};
