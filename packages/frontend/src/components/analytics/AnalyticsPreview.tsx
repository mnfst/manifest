import { LineChart } from '@tremor/react';
import { ArrowRight } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';

interface AnalyticsPreviewProps {
  appId: string;
  onViewMore: () => void;
}

/**
 * Small analytics preview showing last 7 days execution chart.
 * Used on the flows tab with a link to the full analytics.
 */
export function AnalyticsPreview({ appId, onViewMore }: AnalyticsPreviewProps) {
  const { data, isLoading } = useAnalytics({ appId, timeRange: '7d' });

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-3" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const totalExecutions = data.metrics.totalExecutions.value;

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            Executions (Last 7 Days)
          </h3>
          <p className="text-2xl font-semibold">{totalExecutions}</p>
        </div>
        <button
          onClick={onViewMore}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View Analytics
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <style>{`
        .analytics-preview-chart svg path.recharts-curve {
          stroke: #6366f1 !important;
          stroke-width: 2 !important;
        }
        .analytics-preview-chart .recharts-line-curve {
          stroke: #6366f1 !important;
          stroke-width: 2 !important;
        }
      `}</style>
      <LineChart
        className="h-24 analytics-preview-chart"
        data={data.chartData}
        index="label"
        categories={['executions']}
        colors={['indigo']}
        showLegend={false}
        showYAxis={false}
        showXAxis={false}
        showGridLines={false}
        showTooltip={false}
      />
    </div>
  );
}
