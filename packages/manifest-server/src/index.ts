import { join } from 'path';
import { homedir } from 'os';

export const version = '0.1.0';

const LOCAL_DEFAULT_PORT = 2099;

// Dynamic path prevents tsc from resolving at compile time;
// the backend dist is copied into dist/backend/ at build time.
const BACKEND_DIR = './backend';

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
  process.env['MANIFEST_FRONTEND_DIR'] = join(__dirname, '..', 'public');

  // Generate a random persistent secret for local mode
  if (!process.env['BETTER_AUTH_SECRET']) {
    const constants = require(`${BACKEND_DIR}/common/constants/local-mode.constants`);
    process.env['BETTER_AUTH_SECRET'] = constants.getLocalAuthSecret();
  }

  const backendMain = await import(`${BACKEND_DIR}/main`);
  const app = await backendMain.bootstrap();

  const { trackEvent } = require(`${BACKEND_DIR}/common/utils/product-telemetry`);
  trackEvent('server_started', { package_version: version });

  return app;
}
