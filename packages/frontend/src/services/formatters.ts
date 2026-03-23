/**
 * Format large numbers with suffix (1.2k, 304.3k, 1.2M).
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`;
  }
  return n.toString();
}

/**
 * Format a USD cost value (e.g., $6.18, $17.50).
 * Returns null for negative costs (invalid/unknown pricing).
 * Returns "< $0.01" for small sub-cent positive costs to avoid misleading "$0.00".
 */
export function formatCost(n: number): string | null {
  if (n < 0) return null;
  if (n > 0 && n < 0.01) return '< $0.01';
  return `$${n.toFixed(2)}`;
}

/**
 * Format a trend percentage (e.g., +18%, -7%).
 */
export function formatTrend(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

/**
 * Format a timestamp to a date + time string (e.g., Feb 27, 09:22:41).
 */
export function formatTime(ts: string): string {
  const normalized = ts.replace(' ', 'T');
  const d = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
  const date = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${date}, ${time}`;
}

/**
 * Map raw status codes to user-friendly labels.
 */
const STATUS_LABELS: Record<string, string> = {
  ok: 'Success',
  retry: 'Retried',
  error: 'Failed',
  rate_limited: 'Rate Limited',
  fallback_error: 'Handled',
};

export function formatStatus(status: string): string {
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

/**
 * Map raw metric_type values to user-friendly labels.
 */
const METRIC_LABELS: Record<string, string> = {
  tokens: 'Token usage',
  cost: 'Cost',
};

export function formatMetricType(metricType: string): string {
  return METRIC_LABELS[metricType] ?? metricType;
}

/**
 * Format a duration in milliseconds (e.g., "423ms", "1.2s").
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Extract a human-readable error from a raw error_message string.
 * Provider APIs return JSON like {"error":{"message":"...","code":401}}.
 * Caught exceptions produce plain strings like "timeout".
 */
export function formatErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const err = parsed?.error?.error ?? parsed?.error ?? parsed;
    const msg = err?.message ?? err?.msg;
    if (typeof msg === 'string' && msg.length > 0) {
      const code = err?.code ?? err?.status ?? err?.type ?? parsed?.error?.code;
      return code != null ? `${msg} (${code})` : msg;
    }
  } catch {
    /* not JSON, fall through */
  }
  return raw;
}

/**
 * Deterministic color for custom provider avatars based on name.
 */
const CUSTOM_PROVIDER_COLORS = [
  '#2430F0', // indigo
  '#FF006E', // pink
  '#F0953A', // amber
  '#00CECB', // emerald
  '#3b82f6', // blue
  '#942FFA', // violet
  '#E44B4D', // red
  '#14b8a6', // teal
  '#ECBD23', // orange
  '#24BAF0', // cyan
];

export function customProviderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return CUSTOM_PROVIDER_COLORS[Math.abs(hash) % CUSTOM_PROVIDER_COLORS.length]!;
}

/**
 * Format a timestamp to relative display (e.g., "Yesterday", "09:14").
 */
export function formatRelativeTime(ts: string): string {
  const normalized = ts.replace(' ', 'T');
  const d = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return formatTime(ts);
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
