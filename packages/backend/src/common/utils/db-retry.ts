// Transport-level failures that mean "the database isn't reachable yet" — the
// only class of error worth retrying at boot (e.g. Postgres still starting).
const TRANSPORT_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
]);

// pg sometimes surfaces transport/startup failures as a message without a code.
const TRANSPORT_MESSAGES = [
  'connection terminated',
  'connection refused',
  'timeout expired',
  'the database system is starting up',
  'terminating connection',
  'server closed the connection',
];

/**
 * Decides whether a failed TypeORM DataSource initialization is worth retrying.
 *
 * Retry ONLY transport-level connection failures (the DB not being reachable
 * yet). Everything else — a failed migration, a query error, or any unexpected
 * error — fails fast: retrying never fixes it and just buries the real cause
 * under repeated "Unable to connect to the database. Retrying (N)..." lines.
 * Migrations run on connect (`migrationsRun: true`), so this is what stops a
 * failed migration from looping. @nestjs/typeorm checks this predicate BEFORE
 * logging, so returning false also suppresses the misleading retry message.
 *
 * Used as the `toRetry` predicate in database.module.ts.
 */
export function shouldRetryDbConnection(err: unknown): boolean {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';

  if (TRANSPORT_CODES.has(code)) return true;
  return TRANSPORT_MESSAGES.some((m) => message.includes(m));
}
