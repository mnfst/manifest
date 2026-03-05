import { computePeriodBoundaries, computePeriodResetDate } from './period.util';

describe('computePeriodBoundaries', () => {
  it('returns periodStart and periodEnd as formatted strings', () => {
    const { periodStart, periodEnd } = computePeriodBoundaries('day');
    expect(periodStart).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(periodEnd).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('hour: start is 1 hour before current hour', () => {
    const now = new Date();
    const { periodStart } = computePeriodBoundaries('hour');
    const start = new Date(periodStart.replace(' ', 'T') + 'Z');
    const expectedHour = now.getUTCHours() - 1;
    expect(start.getUTCHours()).toBe(expectedHour < 0 ? expectedHour + 24 : expectedHour);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
  });

  it('day: start is midnight UTC today', () => {
    const now = new Date();
    const { periodStart } = computePeriodBoundaries('day');
    const start = new Date(periodStart.replace(' ', 'T') + 'Z');
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCDate()).toBe(now.getUTCDate());
  });

  it('week: start is Monday at midnight UTC', () => {
    const { periodStart } = computePeriodBoundaries('week');
    const start = new Date(periodStart.replace(' ', 'T') + 'Z');
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    // Monday is day 1
    expect(start.getUTCDay()).toBe(1);
  });

  it('month: start is first of month at midnight UTC', () => {
    const now = new Date();
    const { periodStart } = computePeriodBoundaries('month');
    const start = new Date(periodStart.replace(' ', 'T') + 'Z');
    expect(start.getUTCDate()).toBe(1);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMonth()).toBe(now.getUTCMonth());
  });

  it('unknown period: defaults to hour-like behavior', () => {
    const { periodStart } = computePeriodBoundaries('unknown');
    expect(periodStart).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('periodEnd is close to now', () => {
    const before = Date.now();
    const { periodEnd } = computePeriodBoundaries('day');
    const after = Date.now();
    const end = new Date(periodEnd.replace(' ', 'T') + 'Z').getTime();
    expect(end).toBeGreaterThanOrEqual(before - 1000);
    expect(end).toBeLessThanOrEqual(after + 1000);
  });
});

describe('computePeriodResetDate', () => {
  it('returns a formatted datetime string', () => {
    const result = computePeriodResetDate('day');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('hour: returns start of next hour UTC', () => {
    const now = new Date();
    const result = computePeriodResetDate('hour');
    const reset = new Date(result.replace(' ', 'T') + 'Z');
    const expectedHour = (now.getUTCHours() + 1) % 24;
    expect(reset.getUTCHours()).toBe(expectedHour);
    expect(reset.getUTCMinutes()).toBe(0);
    expect(reset.getUTCSeconds()).toBe(0);
  });

  it('day: returns midnight UTC next day', () => {
    const now = new Date();
    const result = computePeriodResetDate('day');
    const reset = new Date(result.replace(' ', 'T') + 'Z');
    expect(reset.getUTCHours()).toBe(0);
    expect(reset.getUTCMinutes()).toBe(0);
    const expectedDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    expect(reset.getUTCDate()).toBe(expectedDate.getUTCDate());
  });

  it('week: returns next Monday at midnight UTC', () => {
    const result = computePeriodResetDate('week');
    const reset = new Date(result.replace(' ', 'T') + 'Z');
    expect(reset.getUTCDay()).toBe(1); // Monday
    expect(reset.getUTCHours()).toBe(0);
    expect(reset.getUTCMinutes()).toBe(0);
    expect(reset.getTime()).toBeGreaterThan(Date.now());
  });

  it('month: returns first of next month UTC', () => {
    const now = new Date();
    const result = computePeriodResetDate('month');
    const reset = new Date(result.replace(' ', 'T') + 'Z');
    expect(reset.getUTCDate()).toBe(1);
    expect(reset.getUTCHours()).toBe(0);
    const expectedMonth = (now.getUTCMonth() + 1) % 12;
    expect(reset.getUTCMonth()).toBe(expectedMonth);
  });

  it('week on a Monday: daysUntilMonday falls back to 7', () => {
    // 2026-03-02 is a Monday (UTC day = 1)
    const monday = new Date(Date.UTC(2026, 2, 2, 12, 0, 0));
    jest.useFakeTimers();
    jest.setSystemTime(monday);

    const result = computePeriodResetDate('week');
    const reset = new Date(result.replace(' ', 'T') + 'Z');

    // Should be next Monday, exactly 7 days later
    expect(reset.getUTCDay()).toBe(1);
    expect(reset.getUTCDate()).toBe(monday.getUTCDate() + 7);

    jest.useRealTimers();
  });

  it('unknown period: defaults to hour-like behavior', () => {
    const result = computePeriodResetDate('unknown');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('reset date is always in the future', () => {
    for (const period of ['hour', 'day', 'week', 'month']) {
      const result = computePeriodResetDate(period);
      const reset = new Date(result.replace(' ', 'T') + 'Z');
      expect(reset.getTime()).toBeGreaterThan(Date.now() - 1000);
    }
  });
});
