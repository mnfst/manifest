import {
  formatDate,
  formatDateTime,
  formatNumber as formatLocalizedNumber,
  formatRelativeTime as formatLocalizedRelativeTime,
  locale,
  t,
  type PlainTextMessageKey,
} from '../i18n/index.js';

/**
 * Format large numbers with suffix (1.2k, 304.3k, 1.2M).
 */
export function formatNumber(n: number): string {
  n = Number(n);
  if (locale() !== 'en') {
    return formatLocalizedNumber(n, {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
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
  n = Number(n);
  if (n < 0) return null;
  if (n > 0 && n < 0.01) return t('formatters.cost.lessThanCent');
  if (locale() === 'en') return `$${n.toFixed(2)}`;
  return formatLocalizedNumber(n, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a per-request subscription quota burn rate (e.g. OpenCode Go's
 * docs-attributed USD per call) as a compact included-plan label. Returns null
 * for a missing, zero, or negative value so callers fall back to a flat-fee label.
 */
export function formatPerRequestCost(cost: number | null | undefined): string | null {
  if (cost == null) return null;
  const n = Number(cost);
  if (!Number.isFinite(n) || n <= 0) return null;
  const amount =
    locale() === 'en'
      ? `$${n.toFixed(4)}`
      : formatLocalizedNumber(n, {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        });
  if (n < 0.0001) {
    const floor =
      locale() === 'en'
        ? '$0.0001'
        : formatLocalizedNumber(0.0001, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          });
    return t('formatters.quota.includedLessThan', { amount: floor });
  }
  return t('formatters.quota.included', { amount });
}

/**
 * Format a trend percentage (e.g., +18%, -7%).
 */
export function formatTrend(pct: number): string {
  if (locale() !== 'en') {
    return formatLocalizedNumber(pct / 100, {
      style: 'percent',
      signDisplay: 'always',
      maximumFractionDigits: 0,
    });
  }
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

/**
 * Format a timestamp to a date + time string (e.g., Feb 27, 09:22:41).
 */
export function formatTime(ts: string): string {
  const normalized = ts.replace(' ', 'T');
  const d = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
  const date = formatDate(d, {
    month: 'short',
    day: 'numeric',
  });
  const time = formatDateTime(d, {
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
const STATUS_LABELS: Record<string, PlainTextMessageKey> = {
  ok: 'formatters.status.success',
  retry: 'formatters.status.retried',
  error: 'formatters.status.failed',
  // A rate limit is just a provider failure — the origin pill ("Provider") and
  // the details drawer ("Type: Rate limit") carry the nuance, so the status
  // column stays the simple Success/Failed it was before.
  rate_limited: 'formatters.status.failed',
  fallback_error: 'formatters.status.handled',
  auto_fixed: 'formatters.status.autoFixed',
};

export function formatStatus(status: string): string {
  const key = STATUS_LABELS[status.toLowerCase()];
  return key ? t(key) : status;
}

/**
 * Map an error_origin to a user-facing label. Manifest-originated errors
 * (config/policy/internal) are labelled as Manifest's own so they read
 * distinctly from a provider's failure.
 */
const ERROR_ORIGIN_LABELS: Record<string, PlainTextMessageKey> = {
  provider: 'formatters.origin.provider',
  transport: 'formatters.origin.transport',
  config: 'formatters.origin.setup',
  // policy = a Manifest software limit (spend/token guardrail) was hit — labelled
  // "Limit" so it reads distinctly from a provider rate limit.
  policy: 'formatters.origin.limit',
  internal: 'formatters.origin.internal',
  // request = the caller's own payload was refused before routing. Not the
  // operator's setup, not a Manifest bug, and never a provider failure.
  request: 'formatters.origin.badRequest',
};

export function formatErrorOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  const key = ERROR_ORIGIN_LABELS[origin];
  return key ? t(key) : origin;
}

/** Map an error_class to a user-facing label. */
const ERROR_CLASS_LABELS: Record<string, PlainTextMessageKey> = {
  rate_limit: 'formatters.error.rateLimit',
  auth: 'formatters.error.authentication',
  invalid_request: 'formatters.error.invalidRequest',
  not_found: 'formatters.error.notFound',
  payload_too_large: 'formatters.error.payloadTooLarge',
  billing: 'formatters.error.billing',
  server_error: 'formatters.error.server',
  client_error: 'formatters.error.client',
  timeout: 'formatters.error.timeout',
  network: 'formatters.error.network',
  no_provider: 'formatters.error.noProvider',
  no_provider_key: 'formatters.error.noProviderKey',
  limit_exceeded: 'formatters.error.limitExceeded',
  plan_request_limit_exceeded: 'formatters.error.planRequestLimit',
  internal: 'formatters.error.internal',
};

export function formatErrorClass(errorClass: string | null | undefined): string | null {
  if (!errorClass) return null;
  const key = ERROR_CLASS_LABELS[errorClass];
  return key ? t(key) : errorClass.replace(/_/g, ' ');
}

/**
 * Map raw metric_type values to user-friendly labels.
 */
const METRIC_LABELS: Record<string, PlainTextMessageKey> = {
  tokens: 'formatters.metric.tokenUsage',
  cost: 'formatters.metric.cost',
};

export function formatMetricType(metricType: string): string {
  const key = METRIC_LABELS[metricType];
  return key ? t(key) : metricType;
}

/**
 * Format a duration in milliseconds (e.g., "423ms", "1.2s").
 */
export function formatDuration(ms: number): string {
  ms = Number(ms);
  if (locale() !== 'en') {
    return ms < 1000
      ? formatLocalizedNumber(ms, {
          style: 'unit',
          unit: 'millisecond',
          unitDisplay: 'short',
        })
      : formatLocalizedNumber(ms / 1000, {
          style: 'unit',
          unit: 'second',
          unitDisplay: 'short',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
  }
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
  if (diffDays === 1) return t('formatters.time.yesterday');
  return formatDate(d, { month: 'short', day: 'numeric' });
}

export function formatTimeAgo(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const normalized = ts.replace(' ', 'T');
  const d = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return t('formatters.time.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return formatLocalizedRelativeTime(-diffMin, 'minute', { style: 'narrow' });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return formatLocalizedRelativeTime(-diffHr, 'hour', { style: 'narrow' });
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return t('formatters.time.yesterday');
  if (diffDays < 7) return formatLocalizedRelativeTime(-diffDays, 'day', { style: 'narrow' });
  return formatDate(d, { month: 'short', day: 'numeric' });
}

export function sortedHeaderEntries(
  headers: Record<string, string> | null | undefined,
): Array<[string, string]> {
  if (!headers) return [];
  return Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));
}
