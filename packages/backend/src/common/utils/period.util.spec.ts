import { computePeriodBoundaries, computePeriodResetDate } from './period.util';

// Parse a local-time `YYYY-MM-DD HH:MM:SS` string (no tz suffix) back into a
// Date using the same local-timezone interpretation the formatter used.
const parseLocal = (s: string) => new Date(s.replace(' ', 'T'));

describe('computePeriodBoundaries', () => {
  it('returns periodStart and periodEnd as formatted strings', () => {
    const { periodStart, periodEnd } = computePeriodBoundaries('day');
    expect(periodStart).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(periodEnd).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('hour: start is 1 hour before the current local hour', () => {
    const now = new Date();
    const { periodStart } = computePeriodBoundaries('hour');
    const start = parseLocal(periodStart);
    const expectedHour = now.getHours() - 1;
    expect(start.getHours()).toBe(expectedHour < 0 ? expectedHour + 24 : expectedHour);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it('day: start is local midnight today', () => {
    const now = new Date();
    const { periodStart } = computePeriodBoundaries('day');
    const start = parseLocal(periodStart);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(now.getDate());
  });

  it('week: start is Monday at local midnight', () => {
    const { periodStart } = computePeriodBoundaries('week');
    const start = parseLocal(periodStart);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    // Monday is day 1
    expect(start.getDay()).toBe(1);
  });

  it('month: start is first of month at local midnight', () => {
    const now = new Date();
    const { periodStart } = computePeriodBoundaries('month');
    const start = parseLocal(periodStart);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMonth()).toBe(now.getMonth());
  });

  it('unknown period: defaults to hour-like behavior', () => {
    const { periodStart } = computePeriodBoundaries('unknown');
    expect(periodStart).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('periodEnd is close to now', () => {
    const before = Date.now();
    const { periodEnd } = computePeriodBoundaries('day');
    const after = Date.now();
    const end = parseLocal(periodEnd).getTime();
    expect(end).toBeGreaterThanOrEqual(before - 1000);
    expect(end).toBeLessThanOrEqual(after + 1000);
  });

  // Regression: the boundaries must be expressed in the process's LOCAL
  // timezone, not UTC. `agent_messages.timestamp` rows are stored as local-time
  // `timestamp without time zone`, so a UTC `periodEnd` (the old code formatted
  // via toISOString) sits behind the stored rows by the process TZ offset and
  // the consumption SUM silently reads ~0 — meaning token/cost limits never
  // trip. We assert that periodEnd, interpreted as a local-time string,
  // round-trips back to the real instant. With the old UTC formatting this only
  // holds when the host TZ is UTC; on any other zone (every broken real-world
  // deployment, and this CI host when run under TZ!=UTC) it fails.
  it('formats periodEnd in local wall-clock so it round-trips to the real instant', () => {
    const instant = new Date('2026-06-10T11:16:00.000Z');
    jest.useFakeTimers().setSystemTime(instant);

    const { periodEnd } = computePeriodBoundaries('day');
    expect(parseLocal(periodEnd).getTime()).toBe(instant.getTime());

    jest.useRealTimers();
  });
});

describe('computePeriodResetDate', () => {
  it('returns a formatted datetime string', () => {
    const result = computePeriodResetDate('day');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('hour: returns start of the next local hour', () => {
    const now = new Date();
    const reset = parseLocal(computePeriodResetDate('hour'));
    const expectedHour = (now.getHours() + 1) % 24;
    expect(reset.getHours()).toBe(expectedHour);
    expect(reset.getMinutes()).toBe(0);
    expect(reset.getSeconds()).toBe(0);
  });

  it('day: returns local midnight next day', () => {
    const now = new Date();
    const reset = parseLocal(computePeriodResetDate('day'));
    expect(reset.getHours()).toBe(0);
    expect(reset.getMinutes()).toBe(0);
    const expectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    expect(reset.getDate()).toBe(expectedDate.getDate());
  });

  it('week: returns next Monday at local midnight', () => {
    const reset = parseLocal(computePeriodResetDate('week'));
    expect(reset.getDay()).toBe(1); // Monday
    expect(reset.getHours()).toBe(0);
    expect(reset.getMinutes()).toBe(0);
    expect(reset.getTime()).toBeGreaterThan(Date.now());
  });

  it('month: returns first of next month', () => {
    const now = new Date();
    const reset = parseLocal(computePeriodResetDate('month'));
    expect(reset.getDate()).toBe(1);
    expect(reset.getHours()).toBe(0);
    const expectedMonth = (now.getMonth() + 1) % 12;
    expect(reset.getMonth()).toBe(expectedMonth);
  });

  it('week on a Monday: daysUntilMonday falls back to 7', () => {
    // 2026-03-02 is a Monday — pin local noon so the local day is Monday.
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 2, 12, 0, 0));

    const reset = parseLocal(computePeriodResetDate('week'));

    // Should be next Monday, exactly 7 days later
    expect(reset.getDay()).toBe(1);
    expect(reset.getDate()).toBe(9);

    jest.useRealTimers();
  });

  it('unknown period: defaults to hour-like behavior', () => {
    const result = computePeriodResetDate('unknown');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('reset date is always in the future', () => {
    for (const period of ['hour', 'day', 'week', 'month']) {
      const reset = parseLocal(computePeriodResetDate(period));
      expect(reset.getTime()).toBeGreaterThan(Date.now() - 1000);
    }
  });
});
