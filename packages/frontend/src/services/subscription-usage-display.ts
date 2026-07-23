import type { SubscriptionUsageConnection, SubscriptionUsageWindow } from './api/providers.js';
import { formatNumber } from './formatters.js';

export interface SubscriptionLimitPace {
  usedPercent: number | null;
  projectedPercent: number | null;
  willRunOut: boolean;
  exhausted: boolean;
}

export interface SubscriptionLimitTone {
  color: string;
  foreground: string;
  background: string;
}

export const clampLimitPercent = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped * 10) / 10;
};

export const formatLimitPercent = (value: number | null | undefined): string | null => {
  const rounded = clampLimitPercent(value);
  if (rounded === null) return null;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
};

export const formatLimitAmount = (value: number | null, unit: string | null): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const formatted =
    Math.abs(value) >= 100 || Number.isInteger(value)
      ? formatNumber(Math.round(value))
      : value.toFixed(1);
  return unit ? `${formatted} ${unit}` : formatted;
};

export const formatProjectedLimitPercent = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(Math.max(0, value) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
};

const resetCountdown = (
  iso: string | null,
): { value: string; unit: 'now' | 'minute' | 'hour' | 'day' } | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60_000));
  if (minutes === 0) return { value: '', unit: 'now' };
  if (minutes < 60) return { value: `${minutes}m`, unit: 'minute' };
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return { value: `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`, unit: 'hour' };
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return { value: `${days}d${remainingHours ? ` ${remainingHours}h` : ''}`, unit: 'day' };
};

export const formatLimitResetRelative = (iso: string | null): string => {
  const countdown = resetCountdown(iso);
  if (!countdown) return '-';
  return countdown.unit === 'now' ? 'now' : `in ${countdown.value}`;
};

export const formatLimitResetTime = (iso: string | null): string | null => {
  const countdown = resetCountdown(iso);
  if (!countdown) return null;
  return countdown.unit === 'now' ? 'reset now' : `resets in ${countdown.value}`;
};

export const formatLimitResetAbsolute = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const formatLimitWindowDuration = (seconds: number | null): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '-';
  if (seconds % 604_800 === 0) return `${seconds / 604_800}w`;
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
};

export const subscriptionLimitPaceLabel = (pace: SubscriptionLimitPace): string => {
  if (pace.usedPercent === null) return 'Balance';
  if (pace.exhausted) return 'Exhausted';
  if (pace.willRunOut) return 'At risk';
  if (pace.projectedPercent === null) return 'Tracked';
  return 'On track';
};

export const subscriptionLimitPaceDetail = (pace: SubscriptionLimitPace): string | null => {
  if (pace.projectedPercent === null) return null;
  return `Projected ${formatProjectedLimitPercent(pace.projectedPercent) ?? '-'} by reset`;
};

export const formatLimitAmountLine = (window: SubscriptionUsageWindow): string | null => {
  const current = formatLimitAmount(window.current, window.unit);
  const limit = formatLimitAmount(window.limit, window.unit);
  if (current && limit) return `${current} / ${limit}`;
  if (current) return current;
  if (limit) return `${limit} limit`;
  return null;
};

export const formatLimitWindowDetails = (window: SubscriptionUsageWindow): string[] => {
  const parts: string[] = [];
  const amount = formatLimitAmountLine(window);
  const remaining = formatLimitPercent(window.remaining_percent);
  const reset = formatLimitResetTime(window.resets_at);
  if (amount) parts.push(amount);
  if (remaining) parts.push(`${remaining} left`);
  if (reset) parts.push(reset);
  return parts;
};

export const subscriptionConnectionLimitMessage = (
  connection: SubscriptionUsageConnection,
): string | null => {
  if (connection.status === 'ok') return null;
  return connection.message ?? 'Not available';
};

export const subscriptionLimitPace = (window: SubscriptionUsageWindow): SubscriptionLimitPace => {
  const usedPercent = clampLimitPercent(window.used_percent);
  if (usedPercent === null) {
    return {
      usedPercent: null,
      projectedPercent: null,
      willRunOut: false,
      exhausted: false,
    };
  }

  const exhausted = usedPercent >= 99.5;
  const resetTime = window.resets_at ? new Date(window.resets_at).getTime() : NaN;
  const windowSeconds = window.window_seconds;
  if (
    exhausted ||
    typeof windowSeconds !== 'number' ||
    !Number.isFinite(windowSeconds) ||
    windowSeconds <= 0 ||
    !Number.isFinite(resetTime)
  ) {
    return {
      usedPercent,
      projectedPercent: null,
      willRunOut: false,
      exhausted,
    };
  }

  const remainingSeconds = Math.max(0, (resetTime - Date.now()) / 1000);
  const elapsedSeconds = Math.max(0, windowSeconds - remainingSeconds);
  const elapsedRatio = elapsedSeconds / windowSeconds;
  if (elapsedRatio <= 0 || usedPercent <= 0) {
    return {
      usedPercent,
      projectedPercent: usedPercent <= 0 ? 0 : null,
      willRunOut: false,
      exhausted,
    };
  }

  const projectedPercent = usedPercent / elapsedRatio;
  return {
    usedPercent,
    projectedPercent,
    willRunOut: projectedPercent > 100.5,
    exhausted,
  };
};

export const subscriptionLimitTone = (pace: SubscriptionLimitPace): SubscriptionLimitTone => {
  if (pace.usedPercent === null) {
    return {
      color: 'hsl(var(--muted-foreground))',
      foreground: 'hsl(var(--muted-foreground))',
      background: 'hsl(var(--muted) / 0.65)',
    };
  }
  if (pace.exhausted) {
    return {
      color: 'hsl(var(--destructive))',
      foreground: 'hsl(var(--destructive))',
      background: 'hsl(var(--destructive) / 0.12)',
    };
  }
  if (pace.willRunOut) {
    return {
      color: 'hsl(38 92% 48%)',
      foreground: 'hsl(35 92% 38%)',
      background: 'hsl(38 92% 48% / 0.14)',
    };
  }
  return {
    color: 'hsl(var(--success))',
    foreground: 'hsl(178 70% 32%)',
    background: 'hsl(var(--success) / 0.14)',
  };
};
