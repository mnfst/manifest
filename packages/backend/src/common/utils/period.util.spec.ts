import { computePeriodBoundaries } from './period.util';

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
