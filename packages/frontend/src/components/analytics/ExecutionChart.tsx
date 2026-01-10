import { LineChart } from '@tremor/react';
import type { ChartDataPoint } from '@chatgpt-app-builder/shared';

interface ExecutionChartProps {
  data: ChartDataPoint[];
  isLoading?: boolean;
}

/**
 * Line chart component showing execution volume over time.
 */
export function ExecutionChart({ data, isLoading }: ExecutionChartProps) {
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
          <p className="text-muted-foreground">No execution data available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Executions will appear here once flows are used
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Executions Over Time
      </h3>
      <style>{`
        .executions-line-chart svg path.recharts-curve {
          stroke: #6366f1 !important;
          stroke-width: 2 !important;
        }
        .executions-line-chart .recharts-line-curve {
          stroke: #6366f1 !important;
          stroke-width: 2 !important;
        }
      `}</style>
      <LineChart
        className="h-72 executions-line-chart"
        data={data}
        index="label"
        categories={['executions']}
        colors={['indigo']}
        showLegend={false}
        yAxisWidth={40}
      />
    </div>
  );
}
