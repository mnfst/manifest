/* eslint-disable @typescript-eslint/no-require-imports */
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { PluginLogger } from './types';

const CONFIG_DIR = join(homedir(), '.openclaw', 'manifest');
const HEALTH_TIMEOUT_MS = 3000;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function checkExistingServer(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/api/v1/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return (
      body !== null &&
      typeof body === 'object' &&
      'status' in body &&
      (body as Record<string, unknown>).status === 'healthy'
    );
  } catch {
    return false;
  }
}

export function registerLocalMode(api: any, port: number, host: string, logger: PluginLogger) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const dbPath = join(CONFIG_DIR, 'manifest.db');

  logger.debug('[manifest] Starting embedded server...');

  let serverModule: {
    start: (opts: Record<string, unknown>) => Promise<unknown>;
    version?: string;
  };
  try {
    serverModule = require('./server');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[manifest] Failed to load embedded server.\n' +
        `  Error: ${msg}\n` +
        '  This is a packaging error — please reinstall the manifest plugin.',
    );
    return;
  }

  const startServer = async () => {
    logger.debug('[manifest] Service start callback invoked');
    const alreadyRunning = await checkExistingServer(host, port);
    if (alreadyRunning) {
      logger.info(
        `\n[🦚 Manifest] Dashboard: http://${host}:${port}\n` +
          '[🦚 Manifest] Reusing existing server.\n' +
          '[🦚 Manifest] Open the dashboard to connect a provider and start routing.',
      );
      return;
    }

    try {
      await serverModule.start({ port, host, dbPath, quiet: true });

      const verified = await checkExistingServer(host, port);
      if (verified) {
        logger.info(
          `\n[🦚 Manifest] Dashboard: http://${host}:${port}\n` +
            '[🦚 Manifest] The embedded server is running.\n' +
            '[🦚 Manifest] Open the dashboard to connect a provider and start routing.',
        );
        logger.debug(`[manifest] DB: ${dbPath}`);
      } else {
        const warnFn = logger.warn ?? logger.info;
        warnFn(
          `[manifest] Server started but health check failed.\n` +
            `  The dashboard may not be accessible at http://${host}:${port}`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('EADDRINUSE') || msg.includes('address already in use')) {
        const isManifest = await checkExistingServer(host, port);
        if (isManifest) {
          logger.info(
            `\n[🦚 Manifest] Dashboard: http://${host}:${port}\n` +
              '[🦚 Manifest] Reusing existing server.\n' +
              '[🦚 Manifest] Open the dashboard to connect a provider and start routing.',
          );
        } else {
          logger.error(
            `[manifest] Port ${port} is already in use by another process.\n` +
              `  Change it with: openclaw config set plugins.entries.manifest.config.port ${port + 1}\n` +
              `  Then restart the gateway.`,
          );
        }
      } else {
        logger.error(
          `[manifest] Failed to start local server: ${msg}\n` +
            `  Try reinstalling: openclaw plugins install manifest\n` +
            `  Then restart: openclaw gateway restart`,
        );
      }
    }
  };

  // Register with OpenClaw for lifecycle management (deferred callback).
  api.registerService({ id: 'manifest', start: startServer });

  // Also start eagerly — newer OpenClaw versions may not invoke the callback.
  // checkExistingServer() at the top of startServer() prevents double-starts.
  startServer().catch(() => {});
}
