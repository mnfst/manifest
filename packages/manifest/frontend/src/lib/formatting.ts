// Re-export shared formatters
export { formatDuration, truncateString } from '@manifest/shared';

/**
 * Format a flow count for display.
 */
export function formatFlowCount(count: number): string {
  if (count === 0) return 'No flows';
  if (count === 1) return '1 flow';
  return `${count} flows`;
}

/**
 * Format an ISO date string relative to the current time.
 * Shows "HH:MM" for today, "Mon DD HH:MM" for other days.
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format an ISO date string to a precise time with seconds.
 */
export function formatTimePrecise(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
