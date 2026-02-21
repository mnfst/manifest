import {
  detectDialect,
  timestampType,
  computeCutoff,
  sqlNow,
  sqlHourBucket,
  sqlDateBucket,
  sqlCastFloat,
  portableSql,
  sqlCastInterval,
} from './sql-dialect';

describe('sql-dialect', () => {
  describe('detectDialect', () => {
    it('returns sqlite for better-sqlite3', () => {
      expect(detectDialect('better-sqlite3')).toBe('sqlite');
    });

    it('returns postgres for postgres', () => {
      expect(detectDialect('postgres')).toBe('postgres');
    });

    it('returns postgres for any unknown type', () => {
      expect(detectDialect('mysql')).toBe('postgres');
      expect(detectDialect('')).toBe('postgres');
    });
  });

  describe('timestampType', () => {
    const origMode = process.env['MANIFEST_MODE'];
    afterEach(() => {
      if (origMode === undefined) delete process.env['MANIFEST_MODE'];
      else process.env['MANIFEST_MODE'] = origMode;
    });

    it('returns datetime when MANIFEST_MODE is local', () => {
      process.env['MANIFEST_MODE'] = 'local';
      expect(timestampType()).toBe('datetime');
    });

    it('returns timestamp when MANIFEST_MODE is cloud', () => {
      process.env['MANIFEST_MODE'] = 'cloud';
      expect(timestampType()).toBe('timestamp');
    });

    it('returns timestamp when MANIFEST_MODE is unset', () => {
      delete process.env['MANIFEST_MODE'];
      expect(timestampType()).toBe('timestamp');
    });
  });

  describe('computeCutoff', () => {
    it('returns an ISO string in the past for "24 hours"', () => {
      const before = Date.now();
      const cutoff = computeCutoff('24 hours');
      const after = Date.now();
      const parsed = new Date(cutoff).getTime();

      expect(parsed).toBeGreaterThanOrEqual(before - 24 * 3600_000);
      expect(parsed).toBeLessThanOrEqual(after - 24 * 3600_000);
    });

    it('handles "7 days"', () => {
      const cutoff = computeCutoff('7 days');
      const diff = Date.now() - new Date(cutoff).getTime();
      // Should be approximately 7 days in ms (allow 1 second tolerance)
      expect(diff).toBeGreaterThanOrEqual(7 * 86400_000 - 1000);
      expect(diff).toBeLessThanOrEqual(7 * 86400_000 + 1000);
    });

    it('handles singular "1 hour"', () => {
      const cutoff = computeCutoff('1 hour');
      const diff = Date.now() - new Date(cutoff).getTime();
      expect(diff).toBeGreaterThanOrEqual(3600_000 - 1000);
      expect(diff).toBeLessThanOrEqual(3600_000 + 1000);
    });

    it('handles singular "1 day"', () => {
      const cutoff = computeCutoff('1 day');
      const diff = Date.now() - new Date(cutoff).getTime();
      expect(diff).toBeGreaterThanOrEqual(86400_000 - 1000);
      expect(diff).toBeLessThanOrEqual(86400_000 + 1000);
    });

    it('defaults to 24h for unrecognized format', () => {
      const cutoff = computeCutoff('invalid');
      const diff = Date.now() - new Date(cutoff).getTime();
      expect(diff).toBeGreaterThanOrEqual(86400_000 - 1000);
      expect(diff).toBeLessThanOrEqual(86400_000 + 1000);
    });
  });

  describe('sqlNow', () => {
    it('returns a valid ISO string close to current time', () => {
      const before = Date.now();
      const result = sqlNow();
      const after = Date.now();
      const parsed = new Date(result).getTime();
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(after);
    });
  });

  describe('sqlHourBucket', () => {
    it('returns strftime expression for sqlite', () => {
      const result = sqlHourBucket('at.timestamp', 'sqlite');
      expect(result).toBe("strftime('%Y-%m-%dT%H:00:00', at.timestamp)");
    });

    it('returns to_char/date_trunc expression for postgres', () => {
      const result = sqlHourBucket('at.timestamp', 'postgres');
      expect(result).toBe(
        `to_char(date_trunc('hour', at.timestamp), 'YYYY-MM-DD"T"HH24:MI:SS')`,
      );
    });
  });

  describe('sqlDateBucket', () => {
    it('returns strftime expression for sqlite', () => {
      const result = sqlDateBucket('at.timestamp', 'sqlite');
      expect(result).toBe("strftime('%Y-%m-%d', at.timestamp)");
    });

    it('returns to_char/::date expression for postgres', () => {
      const result = sqlDateBucket('at.timestamp', 'postgres');
      expect(result).toBe("to_char(at.timestamp::date, 'YYYY-MM-DD')");
    });
  });

  describe('sqlCastFloat', () => {
    it('returns CAST AS REAL for sqlite', () => {
      expect(sqlCastFloat('at.cost_usd', 'sqlite')).toBe(
        'CAST(at.cost_usd AS REAL)',
      );
    });

    it('returns ::float for postgres', () => {
      expect(sqlCastFloat('at.cost_usd', 'postgres')).toBe(
        'at.cost_usd::float',
      );
    });
  });

  describe('portableSql', () => {
    it('passes through for postgres', () => {
      const sql = 'SELECT * FROM t WHERE id = $1 AND name = $2';
      expect(portableSql(sql, 'postgres')).toBe(sql);
    });

    it('converts $N placeholders to ? for sqlite', () => {
      const sql = 'SELECT * FROM t WHERE id = $1 AND name = $2';
      expect(portableSql(sql, 'sqlite')).toBe(
        'SELECT * FROM t WHERE id = ? AND name = ?',
      );
    });

    it('converts many numbered params for sqlite', () => {
      const sql = 'INSERT INTO t VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)';
      expect(portableSql(sql, 'sqlite')).toBe(
        'INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
    });

    it('handles SQL with no placeholders', () => {
      const sql = 'SELECT * FROM t WHERE is_active = true';
      expect(portableSql(sql, 'sqlite')).toBe(sql);
      expect(portableSql(sql, 'postgres')).toBe(sql);
    });
  });

  describe('sqlCastInterval', () => {
    it('returns parameter name for sqlite', () => {
      expect(sqlCastInterval('interval', 'sqlite')).toBe(':interval');
    });

    it('returns CAST expression for postgres', () => {
      expect(sqlCastInterval('interval', 'postgres')).toBe(
        'CAST(:interval AS interval)',
      );
    });
  });
});
