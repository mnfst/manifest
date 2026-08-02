import { ApiClient } from '../client';
import { CliIo, printJson } from '../context';
import { CliError } from '../errors';
import { defaultOpenBrowser } from '../oauth-login';

/**
 * Subscription (OAuth) connect flows, driven against the backend's existing
 * per-provider endpoints:
 * - redirect: GET /oauth/<p>/authorize?agentName → {url}; the provider
 *   redirects to a callback the BACKEND serves, so completion is entirely
 *   server-side — the CLI opens the browser and polls until the connection
 *   materializes.
 * - paste: POST authorize → {url, state}; the user signs in, copies the code
 *   shown by the provider, pastes it into the terminal; POST exchange.
 * - Device-code providers (Kiro, MiniMax, Copilot) are a follow-up.
 */
const OAUTH_FLOWS: Record<string, 'redirect' | 'paste' | 'device'> = {
  xai: 'redirect',
  openai: 'redirect',
  gemini: 'redirect',
  anthropic: 'paste',
  kiro: 'device',
  minimax: 'device',
};

/** Poll cadence; mutable so tests can shrink the clock. */
export const OAUTH_POLL = { intervalMs: 2000, timeoutMs: 180_000 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function subscriptionConnectionCount(payload: unknown, providerId: string): number {
  const providers = (payload as { providers?: unknown })?.providers;
  if (!Array.isArray(providers)) return 0;
  return providers
    .filter(
      (p): p is { provider?: string; auth_type?: string; connection_count?: number } =>
        typeof p === 'object' && p !== null,
    )
    .filter((p) => p.provider === providerId && p.auth_type === 'subscription')
    .reduce((sum, p) => sum + (typeof p.connection_count === 'number' ? p.connection_count : 1), 0);
}

export async function subscriptionConnect(
  io: CliIo,
  client: ApiClient,
  providerId: string,
  agent: string,
): Promise<void> {
  if (!io.isTTY) {
    throw new CliError(
      'subscription_needs_tty',
      'Subscription connect signs in through your browser and needs an interactive terminal',
      'Connect with an API key instead, or use the dashboard',
    );
  }
  const flow = OAUTH_FLOWS[providerId];
  if (!flow) {
    throw new CliError(
      'subscription_unsupported',
      `Subscription connect for ${providerId} is not supported by the CLI yet`,
      'Connect it from the dashboard (Providers → Subscriptions)',
    );
  }

  const open = io.openBrowser ?? defaultOpenBrowser;

  if (flow === 'device') {
    // Device flow is terminal-native: show the code, open the verification
    // page, poll the backend until the user approves there.
    const start = (await client.request(
      'POST',
      `/oauth/${providerId}/start?agentName=${encodeURIComponent(agent)}`,
    )) as { flowId: string; userCode: string; verificationUri: string; pollIntervalMs?: number };
    const opened = open(start.verificationUri);
    io.stderr(`Your code: ${start.userCode}`);
    io.stderr(
      opened
        ? `Opening ${start.verificationUri} — confirm the code there.`
        : `Open ${start.verificationUri} and enter the code.`,
    );
    const interval = Math.max(1000, start.pollIntervalMs ?? OAUTH_POLL.intervalMs);
    const deadline = Date.now() + OAUTH_POLL.timeoutMs;
    while (Date.now() < deadline) {
      await sleep(Math.min(interval, OAUTH_POLL.intervalMs));
      const poll = (await client.request(
        'GET',
        `/oauth/${providerId}/poll?flowId=${encodeURIComponent(start.flowId)}`,
      )) as { status: 'pending' | 'success' | 'error'; message?: string };
      if (poll.status === 'success') {
        printJson(io, { connected: providerId, auth_type: 'subscription', agent });
        return;
      }
      if (poll.status === 'error') {
        throw new CliError('oauth_failed', poll.message ?? `${providerId} sign-in failed`);
      }
    }
    throw new CliError(
      'oauth_timeout',
      `${providerId} sign-in was not approved within ${Math.round(OAUTH_POLL.timeoutMs / 1000)}s`,
      'Run the command again to restart the flow',
    );
  }

  if (flow === 'paste') {
    if (!io.readLine) {
      throw new CliError('subscription_needs_tty', 'Interactive input unavailable');
    }
    const authorize = (await client.request(
      'POST',
      `/oauth/${providerId}/authorize?agentName=${encodeURIComponent(agent)}`,
    )) as { url: string; state: string };
    const opened = open(authorize.url);
    io.stderr(
      opened
        ? `Opening your browser to sign in… If nothing opens, visit: ${authorize.url}`
        : `Open this URL in your browser to sign in: ${authorize.url}`,
    );
    const code = (await io.readLine('Paste the code shown after sign-in: ')).trim();
    if (!code) throw new CliError('credential_empty', 'No code entered');
    await client.request(
      'POST',
      `/oauth/${providerId}/exchange?agentName=${encodeURIComponent(agent)}`,
      {
        body: { code, state: authorize.state },
      },
    );
    printJson(io, { connected: providerId, auth_type: 'subscription', agent });
    return;
  }

  // redirect flow: completion is server-side; watch the connection appear.
  const before = subscriptionConnectionCount(await client.request('GET', '/providers'), providerId);
  const authorize = (await client.request(
    'GET',
    `/oauth/${providerId}/authorize?agentName=${encodeURIComponent(agent)}`,
  )) as { url: string };
  const opened = open(authorize.url);
  io.stderr(
    opened
      ? `Opening your browser to sign in… If nothing opens, visit: ${authorize.url}`
      : `Open this URL in your browser to sign in: ${authorize.url}`,
  );

  const deadline = Date.now() + OAUTH_POLL.timeoutMs;
  while (Date.now() < deadline) {
    await sleep(OAUTH_POLL.intervalMs);
    const now = subscriptionConnectionCount(await client.request('GET', '/providers'), providerId);
    if (now > before) {
      printJson(io, { connected: providerId, auth_type: 'subscription', agent });
      return;
    }
  }
  throw new CliError(
    'oauth_timeout',
    `No ${providerId} subscription connection appeared within ${Math.round(OAUTH_POLL.timeoutMs / 1000)}s`,
    'Finish the browser sign-in and check mnfst provider list, or retry',
  );
}
