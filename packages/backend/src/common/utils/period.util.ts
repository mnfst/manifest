import { toLocalSqlTimestamp } from './postgres-sql';

export interface PeriodBoundaries {
  periodStart: string;
  periodEnd: string;
}

// Boundaries are computed in the Node process's LOCAL timezone, not UTC, because
// they are compared against `provider_attempts.timestamp` — which the pg driver
// stores as a local-time `timestamp without time zone`. A UTC boundary would be
// offset from the stored values by the process TZ, so `periodEnd` (UTC "now")
// lands behind the local-time rows and the SUM silently reads ~0, meaning token
// /cost limits never trip. Use local Date constructors + toLocalSqlTimestamp to
// stay aligned with how the rows are written (see computeCutoff for the same
// rationale on the analytics range cutoffs).
export function computePeriodBoundaries(period: string): PeriodBoundaries {
  const now = new Date();
  let start: Date;

  switch (period) {
    case 'hour':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
      break;
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week': {
      const dayOfWeek = now.getDay();
      const monday = now.getDate() - ((dayOfWeek + 6) % 7);
      start = new Date(now.getFullYear(), now.getMonth(), monday);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
  }

  const end = new Date(now.getTime());
  return { periodStart: toLocalSqlTimestamp(start), periodEnd: toLocalSqlTimestamp(end) };
}

// Computed in local time for the same reason as computePeriodBoundaries: the
// reset instant must line up with the local-time period window shown to the user
// in threshold alerts.
export function computePeriodResetDate(period: string): string {
  const now = new Date();
  let reset: Date;

  switch (period) {
    case 'hour':
      reset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
      break;
    case 'day':
      reset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'week': {
      const dayOfWeek = now.getDay();
      const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
      reset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
      break;
    }
    case 'month':
      reset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    default:
      reset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
  }

  return toLocalSqlTimestamp(reset);
}
