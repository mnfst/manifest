/**
 * Format a duration in milliseconds to a human-readable string.
 * Examples: "42ms", "1.50s", "2m 30s"
 */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a number with locale-appropriate separators.
 * Example: 1234567 → "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Truncate a string to a maximum length, appending a suffix if truncated.
 * Returns the original string if it's already within the limit.
 */
export function truncateString(
  str: string,
  maxLength: number,
  suffix = '...',
): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + suffix;
}
