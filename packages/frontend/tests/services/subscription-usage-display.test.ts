import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionUsageWindow } from '../../src/services/api/providers';
import {
  clampLimitPercent,
  formatLimitAmount,
  formatLimitPercent,
  subscriptionLimitPace,
  subscriptionLimitTone,
} from '../../src/services/subscription-usage-display';

const usageWindow = (
  overrides: Partial<SubscriptionUsageWindow> = {},
): SubscriptionUsageWindow => ({
  id: 'weekly',
  label: 'Weekly',
  used_percent: 40,
  remaining_percent: 60,
  resets_at: '2026-07-01T12:00:00.000Z',
  window_seconds: 86_400,
  current: null,
  limit: null,
  unit: null,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('subscription usage display', () => {
  it('clamps and formats percentages', () => {
    expect(clampLimitPercent(undefined)).toBeNull();
    expect(clampLimitPercent(Number.NaN)).toBeNull();
    expect(clampLimitPercent(-2)).toBe(0);
    expect(clampLimitPercent(101)).toBe(100);
    expect(clampLimitPercent(33.36)).toBe(33.4);
    expect(formatLimitPercent(null)).toBeNull();
    expect(formatLimitPercent(33)).toBe('33%');
    expect(formatLimitPercent(33.36)).toBe('33.4%');
  });

  it('formats balances with optional units', () => {
    expect(formatLimitAmount(null, 'credits')).toBeNull();
    expect(formatLimitAmount(Number.POSITIVE_INFINITY, 'credits')).toBeNull();
    expect(formatLimitAmount(12, 'credits')).toBe('12 credits');
    expect(formatLimitAmount(1.25, 'USD')).toBe('1.3 USD');
    expect(formatLimitAmount(1.25, null)).toBe('1.3');
  });

  it('projects whether usage will run out before reset', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-01T00:00:00.000Z');

    expect(subscriptionLimitPace(usageWindow({ used_percent: 60 }))).toEqual({
      usedPercent: 60,
      projectedPercent: 120,
      willRunOut: true,
      exhausted: false,
    });
    expect(subscriptionLimitPace(usageWindow({ used_percent: 40 }))).toEqual({
      usedPercent: 40,
      projectedPercent: 80,
      willRunOut: false,
      exhausted: false,
    });
  });

  it('handles balances, exhausted quotas, and unknown windows', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-01T00:00:00.000Z');

    expect(subscriptionLimitPace(usageWindow({ used_percent: null }))).toEqual({
      usedPercent: null,
      projectedPercent: null,
      willRunOut: false,
      exhausted: false,
    });
    expect(subscriptionLimitPace(usageWindow({ used_percent: 100 }))).toEqual({
      usedPercent: 100,
      projectedPercent: null,
      willRunOut: false,
      exhausted: true,
    });
    expect(subscriptionLimitPace(usageWindow({ window_seconds: null }))).toEqual({
      usedPercent: 40,
      projectedPercent: null,
      willRunOut: false,
      exhausted: false,
    });
  });

  it('does not project before a window starts and tracks zero usage', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-01T00:00:00.000Z');

    expect(
      subscriptionLimitPace(
        usageWindow({
          used_percent: 10,
          resets_at: '2026-07-03T00:00:00.000Z',
        }),
      ),
    ).toEqual({
      usedPercent: 10,
      projectedPercent: null,
      willRunOut: false,
      exhausted: false,
    });
    expect(subscriptionLimitPace(usageWindow({ used_percent: 0 }))).toEqual({
      usedPercent: 0,
      projectedPercent: 0,
      willRunOut: false,
      exhausted: false,
    });
  });

  it('maps quota pace to neutral, danger, warning, and healthy tones', () => {
    expect(
      subscriptionLimitTone({
        usedPercent: null,
        projectedPercent: null,
        willRunOut: false,
        exhausted: false,
      }).color,
    ).toBe('hsl(var(--muted-foreground))');
    expect(
      subscriptionLimitTone({
        usedPercent: 100,
        projectedPercent: null,
        willRunOut: false,
        exhausted: true,
      }).color,
    ).toBe('hsl(var(--destructive))');
    expect(
      subscriptionLimitTone({
        usedPercent: 60,
        projectedPercent: 120,
        willRunOut: true,
        exhausted: false,
      }).color,
    ).toBe('hsl(38 92% 48%)');
    expect(
      subscriptionLimitTone({
        usedPercent: 40,
        projectedPercent: 80,
        willRunOut: false,
        exhausted: false,
      }).color,
    ).toBe('hsl(var(--success))');
  });
});
