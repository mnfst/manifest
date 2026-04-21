/**
 * Postgres SQL helpers. Manifest is Postgres-only, so these emit Postgres SQL
 * directly — no dialect switching. The module name is historical; the
 * `DbDialect` abstraction was removed once SQLite was retired.
 */

/**
 * TypeORM column type for timestamp columns.
 */
export function timestampType(): 'timestamp' {
  return 'timestamp';
}

/**
 * Column default factory for timestamp columns.
 */
export function timestampDefault(): () => string {
  return () => 'NOW()';
}

/**
 * Compute an ISO cutoff for an interval string (e.g. '7 days').
 *
 * Returns a local-time ISO string (no 'Z' suffix) because the pg driver
 * serialises JS Dates in the Node process's local timezone and PostgreSQL
 * stores them as `timestamp without time zone`. Comparing with a local-time
 * cutoff avoids the ~TZ-offset data gap that UTC cutoffs would cause.
 */
export function computeCutoff(interval: string): string {
  const ms = intervalToMs(interval);
  const cutoff = new Date(Date.now() - ms);
  return formatLocalIso(cutoff);
}

function intervalToMs(interval: string): number {
  const match = interval.match(/^(\d+)\s+(hour|hours|day|days)$/);
  if (!match) {
    console.warn(`sql-dialect: unrecognized interval "${interval}", defaulting to 24 hours`);
    return 24 * 60 * 60 * 1000;
  }
  const n = parseInt(match[1], 10);
  const unit = match[2];
  return unit.startsWith('hour') ? n * 3600_000 : n * 86400_000;
}

export function sqlNow(): string {
  return formatLocalIso(new Date());
}

export function sqlHourBucket(col: string): string {
  // Stored values are already in the Node process's local timezone (the pg
  // driver serialises JS Dates using local time into `timestamp without time
  // zone` columns). Truncate directly — no AT TIME ZONE conversion needed.
  return `to_char(date_trunc('hour', ${col}), 'YYYY-MM-DD"T"HH24:MI:SS')`;
}

export function sqlDateBucket(col: string): string {
  return `to_char(${col}::date, 'YYYY-MM-DD')`;
}

export function sqlCastFloat(col: string): string {
  return `${col}::float`;
}

/**
 * Returns a SQL expression that treats negative costs as NULL.
 * Negative costs indicate failed pricing lookups and should not be
 * included in aggregations or displayed as real dollar amounts.
 */
export function sqlSanitizeCost(col: string): string {
  return `CASE WHEN ${col} >= 0 THEN ${col} ELSE NULL END`;
}

export function sqlCastInterval(paramName: string): string {
  return `CAST(:${paramName} AS interval)`;
}

/**
 * Format a Date as a local-time ISO-8601 string without timezone suffix.
 * Matches the format PostgreSQL stores for `timestamp without time zone`
 * when the pg driver serialises JS Dates in the Node process's local TZ.
 */
function formatLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
