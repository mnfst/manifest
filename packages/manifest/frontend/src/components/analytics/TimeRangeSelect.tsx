import type { AnalyticsTimeRange } from '@manifest/shared';
import { TIME_RANGE_LABELS } from '@manifest/shared';

interface TimeRangeSelectProps {
  value: AnalyticsTimeRange;
  onChange: (value: AnalyticsTimeRange) => void;
}

const TIME_RANGE_OPTIONS: AnalyticsTimeRange[] = ['24h', '7d', '30d', '3mo'];

/**
 * Dropdown select for analytics time range.
 */
export function TimeRangeSelect({ value, onChange }: TimeRangeSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AnalyticsTimeRange)}
      className="px-3 py-1.5 text-sm border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
    >
      {TIME_RANGE_OPTIONS.map((range) => (
        <option key={range} value={range}>
          {TIME_RANGE_LABELS[range]}
        </option>
      ))}
    </select>
  );
}
