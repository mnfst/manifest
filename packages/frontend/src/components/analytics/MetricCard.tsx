import type { AnalyticsMetric } from '@chatgpt-app-builder/shared';
import { Badge } from '@/components/ui/shadcn/badge';

interface MetricCardProps {
  title: string;
  metric: AnalyticsMetric;
  isLoading?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

/**
 * Metric card component displaying a value with optional trend indicator.
 * Supports click-to-select behavior for chart switching.
 */
export function MetricCard({
  title,
  metric,
  isLoading,
  onClick,
  isSelected,
}: MetricCardProps) {
  const isClickable = Boolean(onClick);
  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-3" />
        <div className="h-8 bg-muted rounded w-32 mb-2" />
        <div className="h-5 bg-muted rounded w-16" />
      </div>
    );
  }

  const formatTrendPercentage = () => {
    if (!metric.trend) return 'N/A';
    const sign = metric.trend.direction === 'up' ? '+' : metric.trend.direction === 'down' ? '-' : '';
    return `${sign}${metric.trend.percentage.toFixed(1)}%`;
  };

  const getTrendStyles = () => {
    if (!metric.trend) return 'bg-muted text-muted-foreground';
    if (metric.trend.direction === 'unchanged') return 'bg-gray-100 text-gray-700';
    if (metric.trend.isPositive) return 'bg-green-100 text-green-700';
    return 'bg-red-100 text-red-700';
  };

  const getTrendArrow = () => {
    if (!metric.trend || metric.trend.direction === 'unchanged') return null;
    return metric.trend.direction === 'up' ? '↑' : '↓';
  };

  return (
    <div
      className={`bg-card border rounded-xl p-6 transition-all
        ${isClickable ? 'cursor-pointer hover:border-primary/50' : ''}
        ${isSelected ? 'ring-2 ring-primary border-primary' : ''}
      `}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      aria-pressed={isSelected}
    >
      <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
      <p className="text-3xl font-semibold tracking-tight mb-2">
        {metric.displayValue}
      </p>
      <Badge className={getTrendStyles()}>
        {getTrendArrow()}
        {formatTrendPercentage()}
      </Badge>
    </div>
  );
}
