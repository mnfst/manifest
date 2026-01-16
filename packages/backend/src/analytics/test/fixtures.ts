/**
 * Test fixtures for Analytics module tests
 */

import type { AppEntity } from '../../app/app.entity';
import type { FlowEntity } from '../../flow/flow.entity';
import type {
  AnalyticsMetric,
  ChartDataPoint,
  TrendData,
} from '@chatgpt-app-builder/shared';

/**
 * Creates a mock AppEntity
 */
export function createMockAppEntity(
  overrides: Partial<AppEntity> = {},
): AppEntity {
  const now = new Date();
  return {
    id: 'test-app-id',
    name: 'Test App',
    description: 'Test app description',
    slug: 'test-app',
    themeVariables: {},
    status: 'published',
    logoUrl: '/icons/icon.png',
    createdAt: now,
    updatedAt: now,
    flows: [],
    ...overrides,
  } as AppEntity;
}

/**
 * Creates a mock FlowEntity
 */
export function createMockFlowEntity(
  overrides: Partial<FlowEntity> = {},
): FlowEntity {
  const now = new Date();
  return {
    id: 'test-flow-id',
    appId: 'test-app-id',
    name: 'Test Flow',
    description: 'Test flow description',
    isActive: true,
    nodes: [],
    connections: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FlowEntity;
}

/**
 * Creates a mock AnalyticsMetric
 */
export function createMockAnalyticsMetric(
  overrides: Partial<AnalyticsMetric> = {},
): AnalyticsMetric {
  return {
    value: 100,
    displayValue: '100',
    trend: null,
    ...overrides,
  };
}

/**
 * Creates a mock TrendData
 */
export function createMockTrendData(
  overrides: Partial<TrendData> = {},
): TrendData {
  return {
    percentage: 10,
    direction: 'up',
    isPositive: true,
    ...overrides,
  };
}

/**
 * Creates a mock ChartDataPoint
 */
export function createMockChartDataPoint(
  overrides: Partial<ChartDataPoint> = {},
): ChartDataPoint {
  return {
    timestamp: '2026-01-10',
    label: 'Jan 10',
    executions: 50,
    ...overrides,
  };
}

/**
 * Creates mock metrics query result (from SQL)
 */
export function createMockMetricsResult(
  total: number = 100,
  fulfilled: number = 85,
  avgDuration: number = 1500.5,
) {
  return {
    total: String(total),
    fulfilled: String(fulfilled),
    avgDuration: String(avgDuration),
  };
}

/**
 * Creates mock chart query results (from SQL)
 */
export function createMockChartQueryResults(
  data: { bucket: string; executions: number }[] = [],
) {
  return data.map((d) => ({
    bucket: d.bucket,
    executions: String(d.executions),
  }));
}
