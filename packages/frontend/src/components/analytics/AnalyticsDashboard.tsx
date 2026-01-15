import { useState } from 'react';
import type { AnalyticsTimeRange } from '@chatgpt-app-builder/shared';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricCard } from './MetricCard';
import { ExecutionChart } from './ExecutionChart';
import { TimeRangeSelect } from './TimeRangeSelect';
import { FlowFilterSelect } from './FlowFilterSelect';

interface AnalyticsDashboardProps {
  appId: string;
}

/**
 * Analytics dashboard container component.
 * Displays metric cards and manages time range / flow filter state.
 */
export function AnalyticsDashboard({ appId }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('7d');
  const [flowId, setFlowId] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useAnalytics({
    appId,
    timeRange,
    flowId,
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        <p className="font-medium">Failed to load analytics</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm underline hover:no-underline"
        >
          Refresh page
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex justify-end gap-3">
        <FlowFilterSelect value={flowId} onChange={setFlowId} flows={data?.flows ?? []} />
        <TimeRangeSelect value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Executions"
          metric={
            data?.metrics.totalExecutions ?? {
              value: 0,
              displayValue: '0',
              trend: null,
            }
          }
          isLoading={isLoading}
        />
        <MetricCard
          title="Unique Users"
          metric={
            data?.metrics.uniqueUsers ?? {
              value: 0,
              displayValue: '0',
              trend: null,
            }
          }
          isLoading={isLoading}
        />
        <MetricCard
          title="Completion Rate"
          metric={
            data?.metrics.successRate ?? {
              value: 0,
              displayValue: '0%',
              trend: null,
            }
          }
          isLoading={isLoading}
        />
        <MetricCard
          title="Avg. Execution Time"
          metric={
            data?.metrics.avgDuration ?? {
              value: 0,
              displayValue: '0ms',
              trend: null,
            }
          }
          isLoading={isLoading}
        />
      </div>

      {/* Execution Chart */}
      <ExecutionChart data={data?.chartData ?? []} isLoading={isLoading} />
    </div>
  );
}
