/**
 * Analytics types for app execution metrics dashboard
 */

/** Time range options for filtering analytics data */
export type AnalyticsTimeRange = '24h' | '7d' | '30d' | '3mo';

/** Metric types for chart display selection */
export type SelectedMetric = 'executions' | 'uniqueUsers' | 'completionRate' | 'avgDuration';

/** Single data point for the area chart */
export interface ChartDataPoint {
  /** Time bucket (ISO string or formatted date) */
  timestamp: string;
  /** Display label for x-axis */
  label: string;
  /** Number of executions in this bucket */
  executions: number;
  /** Number of unique users (distinct fingerprints) in this bucket */
  uniqueUsers: number;
  /** Completion rate percentage (0-100) in this bucket */
  completionRate: number;
  /** Average execution duration in milliseconds */
  avgDuration: number;
}

/** Trend comparison data */
export interface TrendData {
  /** Percentage change from prior period */
  percentage: number;
  /** Direction of change */
  direction: 'up' | 'down' | 'unchanged';
  /** Whether this trend is positive (e.g., more executions = good, fewer errors = good) */
  isPositive: boolean;
}

/** Individual metric with optional trend */
export interface AnalyticsMetric {
  /** Current value */
  value: number;
  /** Formatted display value */
  displayValue: string;
  /** Trend compared to prior period (null if no prior data) */
  trend: TrendData | null;
}

/** Summary metrics for analytics dashboard */
export interface AnalyticsMetrics {
  totalExecutions: AnalyticsMetric;
  successRate: AnalyticsMetric;
  avgDuration: AnalyticsMetric;
  uniqueUsers: AnalyticsMetric;
}

/** Flow option for filter dropdown */
export interface FlowOption {
  id: string;
  name: string;
}

/** Per-flow analytics metrics for the flows table */
export interface FlowAnalytics {
  /** Flow ID */
  id: string;
  /** Flow name */
  name: string;
  /** Total executions in the time range */
  executions: number;
  /** Completion rate percentage (0-100) */
  completionRate: number;
  /** Average execution duration in milliseconds */
  avgDuration: number;
  /** Formatted display values */
  displayValues: {
    executions: string;
    completionRate: string;
    avgDuration: string;
  };
}

/** Complete analytics response from API */
export interface AppAnalyticsResponse {
  /** App ID */
  appId: string;
  /** Selected time range */
  timeRange: AnalyticsTimeRange;
  /** Selected flow ID (null = all flows) */
  flowId: string | null;
  /** Summary metrics */
  metrics: AnalyticsMetrics;
  /** Time series data for chart */
  chartData: ChartDataPoint[];
  /** Available flows for filter dropdown */
  flows: FlowOption[];
  /** Per-flow analytics for the flows table */
  flowsWithMetrics: FlowAnalytics[];
}

/** Request parameters for analytics endpoint */
export interface AnalyticsQueryParams {
  timeRange?: AnalyticsTimeRange;
  flowId?: string;
}
