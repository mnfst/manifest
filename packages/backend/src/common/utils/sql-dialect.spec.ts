import {
  computeCutoff,
  sqlCastFloat,
  sqlCastInterval,
  sqlDateBucket,
  sqlHourBucket,
  sqlNow,
  sqlSanitizeCost,
  timestampDefault,
  timestampType,
} from './sql-dialect';

describe('sql-dialect', () => {
  describe('timestamp helpers', () => {
    it('uses `timestamp` as the column type', () => {
      expect(timestampType()).toBe('timestamp');
    });

    it('returns a factory that emits NOW() when invoked', () => {
      const factory = timestampDefault();
      expect(typeof factory).toBe('function');
      expect(factory()).toBe('NOW()');
    });
  });

  describe('computeCutoff', () => {
    const FIXED_NOW = new Date('2026-04-20T12:00:00').getTime();

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('subtracts the given number of days and returns a local-ISO string', () => {
      const out = computeCutoff('7 days');
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      // No TZ suffix.
      expect(out.endsWith('Z')).toBe(false);
      // 7 days before 2026-04-20 is 2026-04-13.
      expect(out.startsWith('2026-04-13')).toBe(true);
    });

    it('supports singular day/hour forms', () => {
      expect(computeCutoff('1 day').startsWith('2026-04-19')).toBe(true);
      expect(computeCutoff('1 hour').startsWith('2026-04-20T11:')).toBe(true);
    });

    it('subtracts hours for the "hours" unit', () => {
      // 24 hours before noon on 2026-04-20 is noon on 2026-04-19.
      expect(computeCutoff('24 hours').startsWith('2026-04-19T12:')).toBe(true);
    });

    it('defaults to 24 hours and warns on unrecognized intervals', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const out = computeCutoff('not-an-interval');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('unrecognized interval'));
      expect(out.startsWith('2026-04-19T12:')).toBe(true);
      warn.mockRestore();
    });
  });

  describe('sqlNow', () => {
    it('returns a local ISO string for the current time', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-02T03:04:05').getTime());
      expect(sqlNow()).toBe('2026-01-02T03:04:05');
      jest.useRealTimers();
    });
  });

  describe('SQL expression helpers', () => {
    it('sqlHourBucket wraps the column in date_trunc + to_char for hour granularity', () => {
      expect(sqlHourBucket('ts')).toBe(
        `to_char(date_trunc('hour', ts), 'YYYY-MM-DD"T"HH24:MI:SS')`,
      );
    });

    it('sqlDateBucket casts the column to date and formats it', () => {
      expect(sqlDateBucket('created_at')).toBe(`to_char(created_at::date, 'YYYY-MM-DD')`);
    });

    it('sqlCastFloat appends ::float', () => {
      expect(sqlCastFloat('cost')).toBe('cost::float');
    });

    it('sqlSanitizeCost returns NULL for negative costs', () => {
      expect(sqlSanitizeCost('cost')).toBe('CASE WHEN cost >= 0 THEN cost ELSE NULL END');
    });

    it('sqlCastInterval wraps a named parameter in CAST(... AS interval)', () => {
      expect(sqlCastInterval('since')).toBe('CAST(:since AS interval)');
    });
  });
});
