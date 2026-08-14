import { execFileSync } from 'child_process';
import * as path from 'path';

/**
 * Non-UTC regression coverage for the local-time period boundaries.
 *
 * The assertions in period.util.spec.ts are vacuous on a UTC host (CI): there,
 * the old broken toISOString-style formatting and the correct local formatting
 * produce identical strings. Jest also sandboxes process.env per worker, so
 * setting TZ inside this process never reaches the native tz binding. The only
 * reliable way to pin a timezone is a child process started with a real TZ
 * env var, so we evaluate period.util there with a frozen clock and assert
 * hardcoded America/Chicago (UTC-5 in June) wall-clock strings.
 */
const runInChicago = (): Record<string, { periodStart: string; periodEnd: string } | string> => {
  const utilPath = path.resolve(__dirname, 'period.util.ts');
  const script = `
    const RealDate = Date;
    const INSTANT = new RealDate('2026-06-10T03:30:00.000Z').getTime();
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) { super(INSTANT); } else { super(...args); }
      }
      static now() { return INSTANT; }
    };
    const u = require(${JSON.stringify(utilPath)});
    process.stdout.write(JSON.stringify({
      day: u.computePeriodBoundaries('day'),
      hour: u.computePeriodBoundaries('hour'),
      week: u.computePeriodBoundaries('week'),
      month: u.computePeriodBoundaries('month'),
      resetDay: u.computePeriodResetDate('day'),
      resetHour: u.computePeriodResetDate('hour'),
    }));
  `;
  const out = execFileSync(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', '-e', script],
    {
      env: {
        ...process.env,
        TZ: 'America/Chicago',
        TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs"}',
      },
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8',
    },
  );
  return JSON.parse(out) as Record<string, { periodStart: string; periodEnd: string } | string>;
};

describe('period.util under a non-UTC timezone (America/Chicago)', () => {
  // 2026-06-10T03:30:00Z is 22:30 on Tuesday 2026-06-09 in Chicago (CDT,
  // UTC-5): the local calendar date differs from the UTC one, so any UTC leak
  // flips the day and every assertion below fails.
  let result: ReturnType<typeof runInChicago>;

  beforeAll(() => {
    result = runInChicago();
  }, 30000);

  it('day boundaries use the local calendar date, not the UTC one', () => {
    // UTC formatting would say 2026-06-10 00:00:00 / 2026-06-10 03:30:00.
    expect(result.day).toEqual({
      periodStart: '2026-06-09 00:00:00',
      periodEnd: '2026-06-09 22:30:00',
    });
  });

  it('hour boundary starts at the previous local hour', () => {
    expect((result.hour as { periodStart: string }).periodStart).toBe('2026-06-09 21:00:00');
  });

  it('week boundary starts on the local Monday', () => {
    expect((result.week as { periodStart: string }).periodStart).toBe('2026-06-08 00:00:00');
  });

  it('month boundary starts on the first of the local month', () => {
    expect((result.month as { periodStart: string }).periodStart).toBe('2026-06-01 00:00:00');
  });

  it('resets land on the next local midnight / next local hour', () => {
    // A UTC computation would land on 2026-06-11 00:00 / 2026-06-10 04:00.
    expect(result.resetDay).toBe('2026-06-10 00:00:00');
    expect(result.resetHour).toBe('2026-06-09 23:00:00');
  });
});
