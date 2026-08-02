import * as http from 'http';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { AddressInfo } from 'net';
import { CliError } from './errors';
import { CliIo } from './context';

export const LOGIN_TIMEOUT_MS = 120_000;

const SUCCESS_HTML = `<!doctype html><meta charset="utf-8"><title>Manifest CLI</title><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>&#10003; Connected</h1><p>You can close this page and return to the terminal.</p></div></body>`;
const FAILURE_HTML = `<!doctype html><meta charset="utf-8"><title>Manifest CLI</title><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>Login failed</h1><p>State mismatch &mdash; return to the terminal and retry.</p></div></body>`;

/** Open a URL with the platform opener, detached so the CLI never blocks on it. */
export function defaultOpenBrowser(url: string): boolean {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Browser half of `mnfst login`: loopback listener + one-time code exchange.
 * The raw PAT travels only over the direct CLI→server exchange, never through
 * the browser. Human-readable progress goes to stderr; stdout stays JSON-only.
 */
export async function browserLogin(
  io: CliIo,
  origin: string,
  timeoutMs: number = LOGIN_TIMEOUT_MS,
): Promise<{ token: string; expiresAt: string | null }> {
  const state = randomBytes(24).toString('base64url');
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;
  const authUrl = `${origin}/cli/auth?port=${port}&state=${state}`;

  let code: string;
  try {
    code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new CliError(
            'login_timeout',
            `No browser authorization received within ${Math.round(timeoutMs / 1000)}s`,
            'Try again, or use mnfst login --token-stdin',
          ),
        );
      }, timeoutMs);
      server.on('request', (req, res) => {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
        const gotCode = url.searchParams.get('code');
        if (url.pathname !== '/callback' || url.searchParams.get('state') !== state || !gotCode) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(FAILURE_HTML);
          return; // keep listening — a stray request must not kill the login
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(SUCCESS_HTML);
        clearTimeout(timer);
        resolve(gotCode);
      });
      const opened = (io.openBrowser ?? defaultOpenBrowser)(authUrl);
      io.stderr(
        opened
          ? `Opening your browser to authorize the CLI… (${authUrl})`
          : `Open this URL in your browser to authorize the CLI: ${authUrl}`,
      );
    });
  } finally {
    server.close();
  }

  // Exchange the one-time code — a public endpoint, so no X-API-Key here.
  let response: Response;
  try {
    response = await io.fetchImpl(`${origin}/api/v1/cli/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
  } catch (error) {
    throw new CliError(
      'network_error',
      `Could not reach ${origin}: ${error instanceof Error ? error.message : String(error)}`,
      'Check the URL and that the Manifest server is running',
    );
  }
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-JSON body → fall through to generic error */
  }
  if (!response.ok || typeof parsed['token'] !== 'string') {
    const message =
      typeof parsed['message'] === 'string'
        ? (parsed['message'] as string)
        : `Token exchange failed with HTTP ${response.status}`;
    throw new CliError('login_failed', message, 'Run mnfst login again');
  }
  return {
    token: parsed['token'] as string,
    expiresAt: typeof parsed['expiresAt'] === 'string' ? (parsed['expiresAt'] as string) : null,
  };
}
