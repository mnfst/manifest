/**
 * Duration - Displays execution duration in a human-readable format.
 *
 * Formats milliseconds nicely:
 * - <1ms: "<1ms"
 * - <1s: "234ms"
 * - <1m: "1.23s"
 * - >=1m: "2m 34s"
 */

import { Clock } from 'lucide-react';

interface DurationProps {
  ms: number | undefined;
  showIcon?: boolean;
  className?: string;
}

/**
 * Format duration for display.
 */
function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function Duration({ ms, showIcon = false, className = '' }: DurationProps) {
  if (ms === undefined || ms === null) {
    return null;
  }

  const formattedDuration = formatDuration(ms);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {showIcon && <Clock className="w-3 h-3" />}
      {formattedDuration}
    </span>
  );
}
