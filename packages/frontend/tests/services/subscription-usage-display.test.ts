import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionUsageWindow } from '../../src/services/api/providers';
import {
  clampLimitPercent,
  formatLimitAmount,
  formatLimitAmountLine,
  formatLimitPercent,
  formatLimitResetAbsolute,
  formatLimitResetRelative,
  formatLimitResetTime,
  formatLimitWindowDetails,
  formatLimitWindowDuration,
  formatProjectedLimitPercent,
  subscriptionConnectionLimitMessage,
  subscriptionLimitPace,
  subscriptionLimitPaceDetail,
  subscriptionLimitPaceLabel,
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

  it('formats projected percentages, reset times, and window durations', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-01T00:00:00.000Z');

    expect(formatProjectedLimitPercent(null)).toBeNull();
    expect(formatProjectedLimitPercent(Number.NaN)).toBeNull();
    expect(formatProjectedLimitPercent(-1)).toBe('0%');
    expect(formatProjectedLimitPercent(120)).toBe('120%');
    expect(formatProjectedLimitPercent(120.04)).toBe('120%');
    expect(formatProjectedLimitPercent(120.06)).toBe('120.1%');

    expect(formatLimitResetRelative(null)).toBe('-');
    expect(formatLimitResetRelative('invalid')).toBe('-');
    expect(formatLimitResetRelative('2026-06-30T23:00:00.000Z')).toBe('now');
    expect(formatLimitResetRelative('2026-07-01T00:30:00.000Z')).toBe('in 30m');
    expect(formatLimitResetRelative('2026-07-01T01:00:00.000Z')).toBe('in 1h');
    expect(formatLimitResetRelative('2026-07-01T01:15:00.000Z')).toBe('in 1h 15m');
    expect(formatLimitResetRelative('2026-07-02T00:00:00.000Z')).toBe('in 1d');
    expect(formatLimitResetRelative('2026-07-02T02:00:00.000Z')).toBe('in 1d 2h');

    expect(formatLimitResetTime(null)).toBeNull();
    expect(formatLimitResetTime('invalid')).toBeNull();
    expect(formatLimitResetTime('2026-07-01T00:00:00.000Z')).toBe('reset now');
    expect(formatLimitResetTime('2026-07-01T00:30:00.000Z')).toBe('resets in 30m');

    expect(formatLimitResetAbsolute(null)).toBeNull();
    expect(formatLimitResetAbsolute('invalid')).toBeNull();
    expect(formatLimitResetAbsolute('2026-07-01T01:00:00.000Z')).toEqual(expect.any(String));

    expect(formatLimitWindowDuration(null)).toBe('-');
    expect(formatLimitWindowDuration(Number.NaN)).toBe('-');
    expect(formatLimitWindowDuration(0)).toBe('-');
    expect(formatLimitWindowDuration(604_800)).toBe('1w');
    expect(formatLimitWindowDuration(172_800)).toBe('2d');
    expect(formatLimitWindowDuration(7_200)).toBe('2h');
    expect(formatLimitWindowDuration(120)).toBe('2m');
    expect(formatLimitWindowDuration(45)).toBe('45s');
  });

  it('describes pace, balances, and connection messages', () => {
    const pace = (overrides: Partial<ReturnType<typeof subscriptionLimitPace>>) => ({
      usedPercent: 25,
      projectedPercent: 50,
      willRunOut: false,
      exhausted: false,
      ...overrides,
    });

    expect(subscriptionLimitPaceLabel(pace({ usedPercent: null }))).toBe('Balance');
    expect(subscriptionLimitPaceLabel(pace({ exhausted: true }))).toBe('Exhausted');
    expect(subscriptionLimitPaceLabel(pace({ willRunOut: true }))).toBe('At risk');
    expect(subscriptionLimitPaceLabel(pace({ projectedPercent: null }))).toBe('Tracked');
    expect(subscriptionLimitPaceLabel(pace({}))).toBe('On track');
    expect(subscriptionLimitPaceDetail(pace({ projectedPercent: null }))).toBeNull();
    expect(subscriptionLimitPaceDetail(pace({ projectedPercent: 82.56 }))).toBe(
      'Projected 82.6% by reset',
    );

    expect(formatLimitAmountLine(usageWindow({ current: 2, limit: 10, unit: 'USD' }))).toBe(
      '2 USD / 10 USD',
    );
    expect(formatLimitAmountLine(usageWindow({ current: 2, unit: 'credits' }))).toBe('2 credits');
    expect(formatLimitAmountLine(usageWindow({ limit: 10, unit: 'requests' }))).toBe(
      '10 requests limit',
    );
    expect(formatLimitAmountLine(usageWindow())).toBeNull();

    expect(
      formatLimitWindowDetails(
        usageWindow({ current: 2, limit: 10, unit: 'USD', resets_at: null }),
      ),
    ).toEqual(['2 USD / 10 USD', '60% left']);
    expect(
      formatLimitWindowDetails(usageWindow({ remaining_percent: null, resets_at: null })),
    ).toEqual([]);

    const connection = {
      id: 'connection-1',
      label: 'Primary',
      status: 'ok' as const,
      message: null,
      updated_at: null,
      windows: [],
    };
    expect(subscriptionConnectionLimitMessage(connection)).toBeNull();
    expect(subscriptionConnectionLimitMessage({ ...connection, status: 'error' })).toBe(
      'Not available',
    );
    expect(
      subscriptionConnectionLimitMessage({
        ...connection,
        status: 'unavailable',
        message: 'Expired',
      }),
    ).toBe('Expired');
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
