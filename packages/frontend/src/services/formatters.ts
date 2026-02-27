/**
 * Format large numbers with suffix (1.2k, 304.3k, 1.2M).
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return n.toString();
}

/**
 * Format a USD cost value (e.g., $6.18, $17.50).
 */
export function formatCost(n: number): string {
  return `$${Math.max(0, n).toFixed(2)}`;
}

/**
 * Format a trend percentage (e.g., +18%, -7%).
 */
export function formatTrend(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${Math.round(pct)}%`;
}

/**
 * Format a timestamp to a date + time string (e.g., Feb 27, 09:22:41).
 */
export function formatTime(ts: string): string {
  const normalized = ts.replace(" ", "T");
  const d = new Date(normalized.endsWith("Z") ? normalized : normalized + "Z");
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date}, ${time}`;
}

/**
 * Map raw status codes to user-friendly labels.
 */
const STATUS_LABELS: Record<string, string> = {
  ok: "Success",
  retry: "Retried",
  error: "Failed",
  rate_limited: "Rate Limited",
};

export function formatStatus(status: string): string {
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

/**
 * Map raw metric_type values to user-friendly labels.
 */
const METRIC_LABELS: Record<string, string> = {
  tokens: "Token usage",
  cost: "Cost",
};

export function formatMetricType(metricType: string): string {
  return METRIC_LABELS[metricType] ?? metricType;
}

/**
 * Format a timestamp to relative display (e.g., "Yesterday", "09:14").
 */
export function formatRelativeTime(ts: string): string {
  const normalized = ts.replace(" ", "T");
  const d = new Date(normalized.endsWith("Z") ? normalized : normalized + "Z");
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return formatTime(ts);
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
