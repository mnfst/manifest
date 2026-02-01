import type { AnalyticsTimeRange } from '../types/analytics.js';

/** Time range display labels */
export const TIME_RANGE_LABELS: Record<AnalyticsTimeRange, string> = {
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '3mo': 'Last 3 Months',
};
