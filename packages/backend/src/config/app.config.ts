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
  dbPoolMax: Number(process.env['DB_POOL_MAX'] ?? 20),
  // When true, /api/v1/public/* endpoints expose aggregate stats without auth.
  // Off by default — only Manifest Cloud's marketing homepage should enable it.
  publicStatsEnabled: process.env['MANIFEST_PUBLIC_STATS'] === 'true',
}));
