import { join } from 'path';
import { homedir } from 'os';

export const version = '0.1.0';

interface StartOptions {
  port?: number;
  host?: string;
  dbPath?: string;
}

export async function start(options: StartOptions = {}): Promise<unknown> {
  const port = options.port ?? 2099;
  const host = options.host ?? '127.0.0.1';
  const dbPath = options.dbPath ?? join(homedir(), '.openclaw', 'manifest', 'manifest.db');

  // Set environment before importing the backend (it reads env at import time)
  process.env['MANIFEST_MODE'] = 'local';
  process.env['MANIFEST_EMBEDDED'] = '1';
  process.env['PORT'] = String(port);
  process.env['BIND_ADDRESS'] = host;
  process.env['MANIFEST_DB_PATH'] = dbPath;
  process.env['NODE_ENV'] = 'development';

  // Fixed secret for local mode (not security-sensitive — auth is auto-granted for loopback)
  if (!process.env['BETTER_AUTH_SECRET']) {
    process.env['BETTER_AUTH_SECRET'] = 'manifest-local-mode-secret-not-for-production-use!!';
  }

  const { bootstrap } = await import('manifest-backend/dist/main');
  return bootstrap();
}
