import { LineChart } from '@tremor/react';
import type { ChartDataPoint, SelectedMetric } from '@manifest/shared';

/** Configuration for each metric type */
const METRIC_CONFIG: Record<
  SelectedMetric,
  {
    label: string;
    valueFormatter: (value: number) => string;
  }
> = {
  executions: {
    label: 'Sessions',
    valueFormatter: (v: number) => v.toLocaleString(),
  },
  uniqueUsers: {
    label: 'Unique Users',
    valueFormatter: (v: number) => v.toLocaleString(),
  },
  completionRate: {
    label: 'Completion Rate',
    valueFormatter: (v: number) => `${v.toFixed(1)}%`,
  },
  avgDuration: {
    label: 'Avg. Session Time',
    valueFormatter: (v: number) =>
      v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(2)}s`,
  },
};

interface AnalyticsChartProps {
  data: ChartDataPoint[];
  selectedMetric: SelectedMetric;
  isLoading?: boolean;
}

/**
 * Line chart component showing analytics metrics over time.
 * Supports switching between executions, unique users, completion rate, and duration.
 */
export function AnalyticsChart({
  data,
  selectedMetric,
  isLoading,
}: AnalyticsChartProps) {
  const config = METRIC_CONFIG[selectedMetric];

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl p-6 h-80 animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-4" />
        <div className="h-full bg-muted rounded" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-6 h-80 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No data available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Data will appear here once flows are used
          </p>
        </div>
      </div>
    );
  }

  // Transform data to use 'value' key for the selected metric
  const chartData = data.map((point) => ({
    label: point.label,
    value: point[selectedMetric],
  }));

  return (
    <div className="bg-card border rounded-xl p-6 transition-all">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        {config.label} Over Time
      </h3>
      <style>{`
        .analytics-line-chart svg path.recharts-curve {
          stroke: #6366f1 !important;
          stroke-width: 2 !important;
        }
        .analytics-line-chart .recharts-line-curve {
          stroke: #6366f1 !important;
          stroke-width: 2 !important;
        }
      `}</style>
      <LineChart
        key={selectedMetric}
        className="h-72 analytics-line-chart"
        data={chartData}
        index="label"
        categories={['value']}
        colors={['indigo']}
        valueFormatter={config.valueFormatter}
        showAnimation={true}
        animationDuration={500}
        curveType="monotone"
        showLegend={false}
        yAxisWidth={60}
      />
    </div>
  );
}
