export type DbDialect = 'postgres' | 'sqlite';

export function detectDialect(dsType: string): DbDialect {
  return dsType === 'better-sqlite3' ? 'sqlite' : 'postgres';
}

/**
 * Returns the correct TypeORM column type for timestamp columns.
 * Postgres uses 'timestamp', SQLite uses 'datetime'.
 * Evaluated at decorator time using MANIFEST_MODE env var.
 */
export function timestampType(): 'datetime' | 'timestamp' {
  return process.env['MANIFEST_MODE'] === 'local' ? 'datetime' : 'timestamp';
}

/**
 * Returns the correct column default for timestamp columns.
 * Postgres uses NOW(), SQLite uses CURRENT_TIMESTAMP.
 * Evaluated at decorator time using MANIFEST_MODE env var.
 */
export function timestampDefault(): () => string {
  return process.env['MANIFEST_MODE'] === 'local'
    ? () => 'CURRENT_TIMESTAMP'
    : () => 'NOW()';
}

/**
 * Convert a Postgres-style interval string (e.g. '7 days', '24 hours')
 * to a JS Date cutoff. Both Postgres and SQLite can compare ISO timestamps.
 */
export function computeCutoff(interval: string): string {
  const ms = intervalToMs(interval);
  return new Date(Date.now() - ms).toISOString();
}

function intervalToMs(interval: string): number {
  const match = interval.match(/^(\d+)\s+(hour|hours|day|days)$/);
  if (!match) {
    // Unrecognized interval format — default to 24 hours
    console.warn(`sql-dialect: unrecognized interval "${interval}", defaulting to 24 hours`);
    return 24 * 60 * 60 * 1000;
  }
  const n = parseInt(match[1], 10);
  const unit = match[2];
  return unit.startsWith('hour') ? n * 3600_000 : n * 86400_000;
}

export function sqlNow(): string {
  return new Date().toISOString();
}

export function sqlHourBucket(col: string, dialect: DbDialect): string {
  return dialect === 'sqlite'
    ? `strftime('%Y-%m-%dT%H:00:00', ${col})`
    : `to_char(date_trunc('hour', ${col}), 'YYYY-MM-DD"T"HH24:MI:SS')`;
}

export function sqlDateBucket(col: string, dialect: DbDialect): string {
  return dialect === 'sqlite'
    ? `strftime('%Y-%m-%d', ${col})`
    : `to_char(${col}::date, 'YYYY-MM-DD')`;
}

export function sqlCastFloat(col: string, dialect: DbDialect): string {
  return dialect === 'sqlite' ? `CAST(${col} AS REAL)` : `${col}::float`;
}

/**
 * Convert Postgres-style $1, $2 placeholders to ? for SQLite.
 * Pass-through for Postgres.
 */
export function portableSql(sql: string, dialect: DbDialect): string {
  if (dialect === 'postgres') return sql;
  return sql.replace(/\$\d+/g, '?');
}

export function sqlCastInterval(paramName: string, dialect: DbDialect): string {
  // For sqlite we use computeCutoff() instead, so this is only for postgres
  return dialect === 'sqlite'
    ? `:${paramName}`
    : `CAST(:${paramName} AS interval)`;
}
