import { registerAs } from '@nestjs/config';

function resolveDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (url) return url;
  if (process.env['NODE_ENV'] === 'test')
    return 'postgresql://myuser:mypassword@localhost:5432/mydatabase';
  throw new Error('DATABASE_URL is required. Set it in your .env file.');
}

export const appConfig = registerAs('app', () => ({
  port: Number(process.env['PORT'] ?? 3001),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  databaseUrl: resolveDatabaseUrl(),

  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
  betterAuthUrl: process.env['BETTER_AUTH_URL'] ?? '',
  throttleTtl: Number(process.env['THROTTLE_TTL'] ?? 60000),
  throttleLimit: Number(process.env['THROTTLE_LIMIT'] ?? 100),
  apiKey: process.env['API_KEY'] ?? '',
  bindAddress: process.env['BIND_ADDRESS'] ?? '127.0.0.1',
  // Unified email provider (used for BOTH Better Auth transactional emails
  // and threshold alerts when no per-user config exists). Supports mailgun,
  // resend, sendgrid.
  emailProvider: process.env['EMAIL_PROVIDER'] ?? '',
  emailApiKey: process.env['EMAIL_API_KEY'] ?? '',
  emailDomain: process.env['EMAIL_DOMAIN'] ?? '',
  emailFrom:
    process.env['EMAIL_FROM'] ?? process.env['NOTIFICATION_FROM_EMAIL'] ?? 'noreply@manifest.build',
  // Legacy Mailgun-only (backward compat with older deployments).
  mailgunApiKey: process.env['MAILGUN_API_KEY'] ?? '',
  mailgunDomain: process.env['MAILGUN_DOMAIN'] ?? '',
  notificationFromEmail: process.env['NOTIFICATION_FROM_EMAIL'] ?? 'noreply@manifest.build',
  dbPoolMax: Number(process.env['DB_POOL_MAX'] ?? 30),
  // Apply PgBouncer-safe planner defaults (jit off, larger work_mem, SSD-tuned
  // random_page_cost) as role-level defaults at boot. Set DB_TUNE_SESSION=false
  // to skip (e.g. a managed Postgres where the role lacks ALTER ROLE on itself).
  dbTuneSession: process.env['DB_TUNE_SESSION'] !== 'false',
  // Run pending migrations on app boot. Default on (safe for single-instance dev
  // and self-hosted). Set RUN_MIGRATIONS_ON_BOOT=false on multi-replica deploys
  // (Railway) where a pre-deploy step migrates once over a direct connection, so
  // replicas never migrate concurrently over PgBouncer.
  runMigrationsOnBoot: process.env['RUN_MIGRATIONS_ON_BOOT'] !== 'false',
  // Graceful-shutdown drain window (ms). On a real termination signal in
  // production the server keeps accepting traffic for this long — while the
  // health probe reports 503 — so the platform edge (Railway) deregisters this
  // replica before its socket closes, instead of refusing requests it is still
  // routing during the post-SIGTERM deregistration lag (the rolling-deploy 5xx
  // spike). Must be shorter than Railway's `drainingSeconds`. 0 disables it.
  shutdownDrainMs: Number(process.env['SHUTDOWN_DRAIN_MS'] ?? 10000),
  // When true, /api/v1/public/* endpoints expose aggregate stats without auth.
  // Off by default — only Manifest Cloud's marketing homepage should enable it.
  publicStatsEnabled: process.env['MANIFEST_PUBLIC_STATS'] === 'true',
}));
