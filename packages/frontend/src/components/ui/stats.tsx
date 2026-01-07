import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Individual stat card data structure
 */
export interface StatCardData {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
}

/**
 * Props for the Stats component
 */
export interface StatsProps {
  data?: {
    stats?: StatCardData[];
  };
}

/**
 * Determines trend direction from change value
 */
function determineTrend(change?: number): 'up' | 'down' | 'neutral' {
  if (change === undefined || change === null || change === 0) return 'neutral';
  return change > 0 ? 'up' : 'down';
}

/**
 * Formats change value as percentage string
 */
function formatChange(change?: number): string {
  if (change === undefined || change === null) return '';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Stats component displays statistical metrics with trend indicators.
 *
 * Features:
 * - Responsive grid layout (2 columns mobile, 3 columns desktop)
 * - Color-coded trend indicators (green up, red down, gray neutral)
 * - Lucide React icons for trend direction
 */
export function Stats({ data }: StatsProps) {
  const stats = data?.stats ?? [];

  if (stats.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No statistics available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {stats.map((stat, index) => {
        const trend = stat.trend ?? determineTrend(stat.change);
        const changeValue = formatChange(stat.change);

        return (
          <div
            key={index}
            className="p-4 rounded-lg border border-border bg-card"
          >
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {stat.label}
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-card-foreground mb-1">
              {String(stat.value)}
            </div>
            {changeValue && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  trend === 'up' && 'text-green-600 dark:text-green-400',
                  trend === 'down' && 'text-red-600 dark:text-red-400',
                  trend === 'neutral' && 'text-muted-foreground'
                )}
              >
                {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                {trend === 'neutral' && <Minus className="h-4 w-4" />}
                <span>{changeValue}</span>
                {stat.changeLabel && (
                  <span className="text-muted-foreground ml-1">
                    {stat.changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
