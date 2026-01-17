import { useState } from 'react';
import type { AnalyticsTimeRange, SelectedMetric } from '@chatgpt-app-builder/shared';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricCard } from './MetricCard';
import { AnalyticsChart } from './AnalyticsChart';
import { TimeRangeSelect } from './TimeRangeSelect';
import { FlowsTable } from './FlowsTable';
import { Button } from '@/components/ui/shadcn/button';

interface AnalyticsDashboardProps {
  appId: string;
}

/**
 * Analytics dashboard container component.
 * Displays metric cards and manages time range / flow filter state.
 */
export function AnalyticsDashboard({ appId }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('7d');
  const [selectedMetric, setSelectedMetric] = useState<SelectedMetric>('executions');

  const { data, isLoading, error } = useAnalytics({
    appId,
    timeRange,
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        <p className="font-medium">Failed to load analytics</p>
        <p className="text-sm mt-1">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="mt-3 text-sm underline hover:no-underline p-0 h-auto text-red-700 hover:text-red-700 hover:bg-transparent"
        >
          Refresh page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex justify-end">
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
          onClick={() => setSelectedMetric('executions')}
          isSelected={selectedMetric === 'executions'}
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
          onClick={() => setSelectedMetric('uniqueUsers')}
          isSelected={selectedMetric === 'uniqueUsers'}
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
          onClick={() => setSelectedMetric('completionRate')}
          isSelected={selectedMetric === 'completionRate'}
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
          onClick={() => setSelectedMetric('avgDuration')}
          isSelected={selectedMetric === 'avgDuration'}
        />
      </div>

      {/* Analytics Chart */}
      <AnalyticsChart
        data={data?.chartData ?? []}
        selectedMetric={selectedMetric}
        isLoading={isLoading}
      />

      {/* Flows Table */}
      <FlowsTable appId={appId} flows={data?.flowsWithMetrics ?? []} isLoading={isLoading} />
    </div>
  );
}
