import { OAUTH_POLL, subscriptionConnect } from './oauth-connect';
import { ApiClient } from '../client';
import { CliError } from '../errors';
import { makeIo } from '../../test/helpers';

function fakeClient(replies: unknown[]): ApiClient {
  let i = 0;
  return {
    request: async () => replies[Math.min(i++, replies.length - 1)],
  } as unknown as ApiClient;
}

afterEach(() => {
  OAUTH_POLL.intervalMs = 2000;
  OAUTH_POLL.timeoutMs = 180_000;
});

describe('subscriptionConnect edge paths', () => {
  it('paste flow requires readLine even on a TTY', async () => {
    const io = makeIo({ isTTY: true });
    await expect(subscriptionConnect(io, fakeClient([]), 'anthropic', 'a')).rejects.toThrow(
      CliError,
    );
  });

  it('paste flow rejects an empty pasted code', async () => {
    const io = makeIo({ isTTY: true, readLine: async () => '   ' });
    io.openBrowser = () => true;
    await expect(
      subscriptionConnect(io, fakeClient([{ url: 'https://x', state: 's' }]), 'anthropic', 'a'),
    ).rejects.toThrow(expect.objectContaining({ code: 'credential_empty' }));
  });

  it('prints the manual URL when the browser fails to open', async () => {
    OAUTH_POLL.intervalMs = 1;
    OAUTH_POLL.timeoutMs = 5;
    const io = makeIo({ isTTY: true, readLine: async () => 'x' });
    io.openBrowser = () => false;
    await expect(
      subscriptionConnect(
        io,
        fakeClient([{ providers: 'weird' }, { url: 'https://xai/auth' }, { providers: null }]),
        'xai',
        'a',
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'oauth_timeout' }));
    expect(io.errLines.join('\n')).toContain('Open this URL');
  });

  it('counts entries without connection_count as one connection', async () => {
    OAUTH_POLL.intervalMs = 1;
    OAUTH_POLL.timeoutMs = 500;
    const io = makeIo({ isTTY: true });
    io.openBrowser = () => true;
    await subscriptionConnect(
      io,
      fakeClient([
        { providers: [] },
        { url: 'https://xai/auth' },
        { providers: [{ provider: 'xai', auth_type: 'subscription' }, 'junk'] },
      ]),
      'xai',
      'a',
    );
    expect(io.lastJson()).toEqual({ connected: 'xai', auth_type: 'subscription', agent: 'a' });
  });
});
