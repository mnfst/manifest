import type { SubscriptionUsageWindow } from './api/providers.js';
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
