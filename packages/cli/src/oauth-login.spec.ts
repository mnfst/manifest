import * as http from 'http';
import { browserLogin } from './oauth-login';
import { CliError } from './errors';
import { CliIo } from './context';

function makeIo(fetchImpl: typeof fetch, openBrowser: (url: string) => boolean): CliIo {
  return {
    env: {},
    fetchImpl,
    stdout: jest.fn(),
    stderr: jest.fn(),
    readStdin: jest.fn(),
    isTTY: true,
    openBrowser,
  };
}

/** Simulate the browser: hit the CLI's loopback callback with given params. */
function fakeBrowser(transform: (authUrl: URL) => string): (url: string) => boolean {
  return (url: string) => {
    const authUrl = new URL(url);
    const callback = transform(authUrl);
    void http.get(callback, () => undefined);
    return true;
  };
}

describe('browserLogin', () => {
  it('completes the loopback handshake and exchanges the code', async () => {
    const exchange = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ token: 'mnfst_pat_ok', expiresAt: '2026-09-01T00:00:00Z' }),
    });
    const io = makeIo(
      exchange as unknown as typeof fetch,
      fakeBrowser(
        (u) =>
          `http://127.0.0.1:${u.searchParams.get('port')}/callback?code=code-abcdefghijklmnop&state=${u.searchParams.get('state')}`,
      ),
    );
    const result = await browserLogin(io, 'http://localhost:3001');
    expect(result).toEqual({ token: 'mnfst_pat_ok', expiresAt: '2026-09-01T00:00:00Z' });
    const [url, init] = exchange.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/v1/cli/token');
    expect(JSON.parse(init.body).code).toBe('code-abcdefghijklmnop');
  });

  it('ignores a callback with the wrong state and times out', async () => {
    const io = makeIo(
      jest.fn() as unknown as typeof fetch,
      fakeBrowser(
        (u) =>
          `http://127.0.0.1:${u.searchParams.get('port')}/callback?code=x-abcdefghijklmnop&state=WRONG`,
      ),
    );
    await expect(browserLogin(io, 'http://localhost:3001', 300)).rejects.toThrow(CliError);
  });

  it('times out when the browser never calls back', async () => {
    const io = makeIo(jest.fn() as unknown as typeof fetch, () => true);
    await expect(browserLogin(io, 'http://localhost:3001', 200)).rejects.toThrow(
      expect.objectContaining({ code: 'login_timeout' }),
    );
  });

  it('prints the URL for manual opening when the browser fails to open', async () => {
    const io = makeIo(jest.fn() as unknown as typeof fetch, () => false);
    await expect(browserLogin(io, 'http://localhost:3001', 200)).rejects.toThrow(CliError);
    expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining('Open this URL'));
  });

  it('surfaces a server rejection of the exchange', async () => {
    const exchange = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'Invalid or expired authorization code' }),
    });
    const io = makeIo(
      exchange as unknown as typeof fetch,
      fakeBrowser(
        (u) =>
          `http://127.0.0.1:${u.searchParams.get('port')}/callback?code=code-abcdefghijklmnop&state=${u.searchParams.get('state')}`,
      ),
    );
    await expect(browserLogin(io, 'http://localhost:3001')).rejects.toThrow(
      'Invalid or expired authorization code',
    );
  });

  it('reports a generic failure when the exchange body is not JSON', async () => {
    const exchange = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>bad gateway</html>',
    });
    const io = makeIo(
      exchange as unknown as typeof fetch,
      fakeBrowser(
        (u) =>
          `http://127.0.0.1:${u.searchParams.get('port')}/callback?code=code-abcdefghijklmnop&state=${u.searchParams.get('state')}`,
      ),
    );
    await expect(browserLogin(io, 'http://localhost:3001')).rejects.toThrow(
      'Token exchange failed with HTTP 502',
    );
  });

  it('returns a null expiresAt when the server omits it', async () => {
    const exchange = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'mnfst_pat_ok' }),
    });
    const io = makeIo(
      exchange as unknown as typeof fetch,
      fakeBrowser(
        (u) =>
          `http://127.0.0.1:${u.searchParams.get('port')}/callback?code=code-abcdefghijklmnop&state=${u.searchParams.get('state')}`,
      ),
    );
    await expect(browserLogin(io, 'http://localhost:3001')).resolves.toEqual({
      token: 'mnfst_pat_ok',
      expiresAt: null,
    });
  });

  it('wraps a transport failure of the exchange as network_error', async () => {
    const exchange = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const io = makeIo(
      exchange as unknown as typeof fetch,
      fakeBrowser(
        (u) =>
          `http://127.0.0.1:${u.searchParams.get('port')}/callback?code=code-abcdefghijklmnop&state=${u.searchParams.get('state')}`,
      ),
    );
    await expect(browserLogin(io, 'http://localhost:3001')).rejects.toThrow(
      expect.objectContaining({ code: 'network_error' }),
    );
  });

  it('wraps a non-Error transport rejection as network_error', async () => {
    const exchange = jest.fn().mockRejectedValue('socket hang up');
    const io = makeIo(
      exchange as unknown as typeof fetch,
      fakeBrowser(
        (u) =>
          `http://127.0.0.1:${u.searchParams.get('port')}/callback?code=code-abcdefghijklmnop&state=${u.searchParams.get('state')}`,
      ),
    );
    await expect(browserLogin(io, 'http://localhost:3001')).rejects.toThrow(/socket hang up/);
  });

  it('ignores a request to a foreign path and still completes on the real callback', async () => {
    const exchange = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'mnfst_pat_ok', expiresAt: null }),
    });
    const io = makeIo(exchange as unknown as typeof fetch, (url: string) => {
      const authUrl = new URL(url);
      const port = authUrl.searchParams.get('port');
      const state = authUrl.searchParams.get('state');
      // A stray favicon probe must not kill the login.
      http.get(`http://127.0.0.1:${port}/favicon.ico`, () => {
        http.get(
          `http://127.0.0.1:${port}/callback?code=code-abcdefghijklmnop&state=${state}`,
          () => undefined,
        );
      });
      return true;
    });
    await expect(browserLogin(io, 'http://localhost:3001')).resolves.toMatchObject({
      token: 'mnfst_pat_ok',
    });
  });

  it('falls back to defaultOpenBrowser when io.openBrowser is absent', async () => {
    // child_process is stubbed so the suite never launches a real browser.
    jest.resetModules();
    const spawn = jest.fn().mockReturnValue({ unref: jest.fn() });
    jest.doMock('child_process', () => ({ spawn }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after doMock
    const mod = require('./oauth-login') as typeof import('./oauth-login');
    const io: CliIo = {
      env: {},
      fetchImpl: jest.fn() as unknown as typeof fetch,
      stdout: jest.fn(),
      stderr: jest.fn(),
      readStdin: jest.fn(),
      isTTY: true,
    };
    await expect(mod.browserLogin(io, 'http://localhost:3001', 150)).rejects.toThrow(
      expect.objectContaining({ code: 'login_timeout' }),
    );
    expect(spawn).toHaveBeenCalled();
    jest.dontMock('child_process');
  });
});

describe('defaultOpenBrowser', () => {
  it('spawns a detached opener and returns true', () => {
    jest.resetModules();
    const unref = jest.fn();
    const spawn = jest.fn().mockReturnValue({ unref });
    jest.doMock('child_process', () => ({ spawn }));
    // re-require after doMock so the module sees the stub

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after doMock
    const mod = require('./oauth-login') as typeof import('./oauth-login');
    expect(mod.defaultOpenBrowser('http://x')).toBe(true);
    expect(spawn).toHaveBeenCalled();
    expect(unref).toHaveBeenCalled();
    jest.dontMock('child_process');
  });

  it('returns false when spawning throws', () => {
    jest.resetModules();
    jest.doMock('child_process', () => ({
      spawn: () => {
        throw new Error('ENOENT');
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after doMock
    const mod = require('./oauth-login') as typeof import('./oauth-login');
    expect(mod.defaultOpenBrowser('http://x')).toBe(false);
    jest.dontMock('child_process');
  });

  it('uses the platform-specific opener command', () => {
    const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const calls: Array<{ cmd: string; args: string[] }> = [];
    jest.resetModules();
    jest.doMock('child_process', () => ({
      spawn: (cmd: string, args: string[]) => {
        calls.push({ cmd, args });
        return { unref: () => undefined };
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after doMock
    const mod = require('./oauth-login') as typeof import('./oauth-login');
    try {
      for (const platform of ['darwin', 'win32', 'linux']) {
        Object.defineProperty(process, 'platform', { value: platform, configurable: true });
        mod.defaultOpenBrowser('http://x');
      }
    } finally {
      Object.defineProperty(process, 'platform', original);
      jest.dontMock('child_process');
    }
    expect(calls.map((c) => c.cmd)).toEqual(['open', 'cmd', 'xdg-open']);
    expect(calls[1].args).toEqual(['/c', 'start', '', 'http://x']);
    expect(calls[2].args).toEqual(['http://x']);
  });
});
