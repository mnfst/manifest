import { registerAs } from '@nestjs/config';
import { resolve } from 'path';

function sanitizeSqlitePath(raw: string): string {
  if (!raw) return '';
  return resolve(raw);
}

export const appConfig = registerAs('app', () => ({
  port: Number(process.env['PORT'] ?? 3001),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  databaseUrl: process.env['DATABASE_URL'] ?? 'postgresql://myuser:mypassword@localhost:5432/mydatabase',
  manifestMode: process.env['MANIFEST_MODE'] ?? 'cloud',
  sqlitePath: sanitizeSqlitePath(process.env['MANIFEST_DB_PATH'] ?? ''),

  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
  throttleTtl: Number(process.env['THROTTLE_TTL'] ?? 60000),
  throttleLimit: Number(process.env['THROTTLE_LIMIT'] ?? 100),
  apiKey: process.env['API_KEY'] ?? '',
  bindAddress: process.env['BIND_ADDRESS'] ?? '127.0.0.1',
  mailgunApiKey: process.env['MAILGUN_API_KEY'] ?? '',
  mailgunDomain: process.env['MAILGUN_DOMAIN'] ?? '',
  notificationFromEmail: process.env['NOTIFICATION_FROM_EMAIL'] ?? 'noreply@manifest.build',
  pluginOtlpEndpoint: process.env['PLUGIN_OTLP_ENDPOINT'] ?? '',
}));
