console.warn(
  '[@mnfst/server] This package is deprecated. ' +
  'The embedded server is now included in the `manifest` plugin package. ' +
  'Uninstall @mnfst/server and update manifest to the latest version.',
);

import { join } from 'path';
import { existsSync } from 'fs';
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
  quiet?: boolean;
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
  if (!process.env['BETTER_AUTH_URL']) {
    process.env['BETTER_AUTH_URL'] = `http://${host}:${port}`;
  }

  // Pre-flight: verify backend dist exists
  const backendMainPath = join(__dirname, 'backend', 'main.js');
  if (!existsSync(backendMainPath)) {
    throw new Error(
      `Backend not found at ${backendMainPath}. ` +
        'The @mnfst/server package may be corrupt — try reinstalling it.',
    );
  }

  // Pre-flight: verify sql.js (WASM) can be loaded.
  try {
    require('sql.js');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `sql.js package failed to load: ${msg}\n` +
      '  Try reinstalling the plugin: openclaw plugins install manifest',
    );
  }

  // Generate a random persistent secret for local mode
  if (!process.env['BETTER_AUTH_SECRET']) {
    const constants = require(`${BACKEND_DIR}/common/constants/local-mode.constants`);
    process.env['BETTER_AUTH_SECRET'] = constants.getLocalAuthSecret();
  }

  const backendMain = await import(`${BACKEND_DIR}/main`);
  const app = await backendMain.bootstrap();

  if (!options.quiet) {
    console.log(`Manifest dashboard ready: http://${host}:${port}`);
  }

  const { trackEvent } = require(`${BACKEND_DIR}/common/utils/product-telemetry`);
  trackEvent('server_started', { package_version: version });

  return app;
}
