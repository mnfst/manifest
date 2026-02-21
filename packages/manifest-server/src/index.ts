import { join } from 'path';
import { homedir } from 'os';
import { getLocalAuthSecret, LOCAL_DEFAULT_PORT } from 'manifest-backend/dist/common/constants/local-mode.constants';

export const version = '0.1.0';

interface StartOptions {
  port?: number;
  host?: string;
  dbPath?: string;
}

export async function start(options: StartOptions = {}): Promise<unknown> {
  const port = options.port ?? LOCAL_DEFAULT_PORT;
  const host = options.host ?? '127.0.0.1';
  const dbPath = options.dbPath ?? join(homedir(), '.openclaw', 'manifest', 'manifest.db');

  // Set environment before importing the backend (it reads env at import time)
  process.env['MANIFEST_MODE'] = 'local';
  process.env['MANIFEST_EMBEDDED'] = '1';
  process.env['PORT'] = String(port);
  process.env['BIND_ADDRESS'] = host;
  process.env['MANIFEST_DB_PATH'] = dbPath;
  process.env['NODE_ENV'] = 'development';

  // Generate a random persistent secret for local mode
  if (!process.env['BETTER_AUTH_SECRET']) {
    process.env['BETTER_AUTH_SECRET'] = getLocalAuthSecret();
  }

  const { bootstrap } = await import('manifest-backend/dist/main');
  return bootstrap();
}
