import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { run } from '../index';
import { CLI_AGENT_PLATFORMS } from './agent';
import { agentKeyPath, saveAgentKey } from '../keystore';
import { OAUTH_POLL } from './oauth-connect';
import { fetchStub, makeIo, writeConfig } from '../../test/helpers';

const ME = { tenantId: 't1', userId: 'u1', authMethod: 'api_key', expiresAt: null };
const HOST = 'http://localhost:2099';

function authedIo(
  replies: Array<{ status: number; body: unknown }>,
  extra: Record<string, string> = {},
) {
  const stub = fetchStub(replies);
  const io = makeIo({
    env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key', ...extra },
    fetchImpl: stub.impl,
  });
  return { io, calls: stub.calls };
}

describe('auth commands', () => {
  it('login --token-env validates via /me, stores host-bound, never echoes the token', async () => {
    const stub = fetchStub([{ status: 200, body: ME }]);
    const io = makeIo({
      env: { MNFST_TOKEN: 'tok-123', MANIFEST_URL: HOST },
      fetchImpl: stub.impl,
    });
    expect(await run(io, ['login', '--token-env', 'MNFST_TOKEN'])).toBe(0);

    expect(stub.calls[0].url).toBe(`${HOST}/api/v1/me`);
    expect(io.lastJson()).toEqual({
      authenticated: true,
      url: HOST,
      tenantId: 't1',
      userId: 'u1',
      authMethod: 'api_key',
      expiresAt: null,
      source: 'config',
    });
    expect(io.lines.join('\n')).not.toContain('tok-123');

    const configFile = path.join(io.configDir, 'manifest', 'config.json');
    expect(JSON.parse(fs.readFileSync(configFile, 'utf8'))).toEqual({
      activeHost: HOST,
      hosts: { [HOST]: { apiKey: 'tok-123' } },
    });
    expect(fs.statSync(configFile).mode & 0o777).toBe(0o600);
  });

  it('login --token-stdin reads the token from stdin', async () => {
    const stub = fetchStub([{ status: 200, body: ME }]);
    const io = makeIo({ stdin: 'tok-stdin\n', env: { MANIFEST_URL: HOST }, fetchImpl: stub.impl });
    expect(await run(io, ['login', '--token-stdin'])).toBe(0);
    expect(stub.calls[0].headers['X-API-Key']).toBe('tok-stdin');
  });

  it('login with an invalid token surfaces the 401 and stores nothing', async () => {
    const stub = fetchStub([{ status: 401, body: { message: 'Invalid API key' } }]);
    const io = makeIo({ env: { MNFST_TOKEN: 'bad', MANIFEST_URL: HOST }, fetchImpl: stub.impl });
    expect(await run(io, ['login', '--token-env', 'MNFST_TOKEN'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      error: expect.any(String),
      message: 'Invalid API key',
      status: 401,
    });
    expect(fs.existsSync(path.join(io.configDir, 'manifest', 'config.json'))).toBe(false);
  });

  it('login with both token sources fails with the no-argv rule', async () => {
    const io = makeIo({ env: { MNFST_TOKEN: 't' } });
    expect(await run(io, ['login', '--token-stdin', '--token-env', 'MNFST_TOKEN'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'credential_source_required' });
  });

  it('login with no flags refuses browser login outside a TTY', async () => {
    const io = makeIo({ env: { MANIFEST_URL: HOST }, isTTY: false });
    expect(await run(io, ['login'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      error: 'no_tty',
      hint: expect.stringContaining('--token-stdin'),
    });
  });

  it('login with no flags runs the browser handshake and stores the minted token', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, ...(init?.body ? { body: String(init.body) } : {}) });
      if (url.endsWith('/api/v1/cli/token')) {
        return new Response(
          JSON.stringify({ token: 'mnfst_pat_browser', expiresAt: '2026-09-01T00:00:00.000Z' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ...ME, expiresAt: '2026-09-01T00:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const io = makeIo({
      env: { MANIFEST_URL: HOST },
      fetchImpl,
      isTTY: true,
      openBrowser: (url: string) => {
        const authUrl = new URL(url);
        expect(authUrl.pathname).toBe('/cli/auth');
        http.get(
          `http://127.0.0.1:${authUrl.searchParams.get('port')}/callback?code=${encodeURIComponent(
            'code-abcdefghijklmnop',
          )}&state=${encodeURIComponent(authUrl.searchParams.get('state')!)}`,
          () => undefined,
        );
        return true;
      },
    });

    expect(await run(io, ['login'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/cli/token`);
    expect(JSON.parse(calls[0].body!).code).toBe('code-abcdefghijklmnop');
    expect(calls[1].url).toBe(`${HOST}/api/v1/me`);
    expect(io.lastJson()).toEqual({
      authenticated: true,
      url: HOST,
      tenantId: 't1',
      userId: 'u1',
      authMethod: 'api_key',
      expiresAt: '2026-09-01T00:00:00.000Z',
      source: 'config',
    });
    // The raw PAT is never echoed on stdout, only stored.
    expect(io.lines.join('\n')).not.toContain('mnfst_pat_browser');
    expect(io.errLines.join('\n')).toContain('/cli/auth');
    const config = JSON.parse(
      fs.readFileSync(path.join(io.configDir, 'manifest', 'config.json'), 'utf8'),
    );
    expect(config).toEqual({
      activeHost: HOST,
      hosts: { [HOST]: { apiKey: 'mnfst_pat_browser' } },
    });
  });

  it('login falls back to the code expiry when /me omits one', async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/api/v1/cli/token')
        ? { token: 'mnfst_pat_browser', expiresAt: '2026-10-01T00:00:00.000Z' }
        : { ...ME, expiresAt: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const io = makeIo({
      env: { MANIFEST_URL: HOST },
      fetchImpl,
      isTTY: true,
      openBrowser: (url: string) => {
        const authUrl = new URL(url);
        http.get(
          `http://127.0.0.1:${authUrl.searchParams.get('port')}/callback?code=c-abcdefghijklmnop&state=${authUrl.searchParams.get('state')}`,
          () => undefined,
        );
        return true;
      },
    });
    expect(await run(io, ['login'])).toBe(0);
    expect(io.lastJson()).toMatchObject({ expiresAt: '2026-10-01T00:00:00.000Z' });
  });

  it('login honors --url over MANIFEST_URL', async () => {
    const stub = fetchStub([{ status: 200, body: ME }]);
    const io = makeIo({
      env: { MNFST_TOKEN: 't', MANIFEST_URL: 'http://env-host:1' },
      fetchImpl: stub.impl,
    });
    expect(
      await run(io, ['login', '--token-env', 'MNFST_TOKEN', '--url', 'http://flag-host:2']),
    ).toBe(0);
    expect(stub.calls[0].url).toBe('http://flag-host:2/api/v1/me');
  });

  it('browser login stores the minted token even when /me then fails', async () => {
    // The server just minted this PAT, so it is live. Bailing out without
    // storing it would strand a 30-day credential the user cannot revoke.
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/v1/cli/token')) {
        return new Response(JSON.stringify({ token: 'mnfst_pat_orphan', expiresAt: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Service Unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const io = makeIo({
      env: { MANIFEST_URL: HOST },
      fetchImpl,
      isTTY: true,
      openBrowser: (url: string) => {
        const authUrl = new URL(url);
        http.get(
          `http://127.0.0.1:${authUrl.searchParams.get('port')}/callback?code=c-abcdefghijklmnop&state=${authUrl.searchParams.get('state')}`,
          () => undefined,
        );
        return true;
      },
    });

    expect(await run(io, ['login'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      error: 'login_validation_failed',
      message: 'Service Unavailable',
      hint: expect.stringContaining('mnfst logout'),
    });
    // Stored anyway, so `mnfst logout` can still revoke it server-side.
    const config = JSON.parse(
      fs.readFileSync(path.join(io.configDir, 'manifest', 'config.json'), 'utf8'),
    );
    expect(config).toEqual({ activeHost: HOST, hosts: { [HOST]: { apiKey: 'mnfst_pat_orphan' } } });
  });

  it('browser login reports a non-Error validation failure without losing the token', async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      if (String(input).endsWith('/api/v1/cli/token')) {
        return new Response(JSON.stringify({ token: 'mnfst_pat_weird', expiresAt: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // A body that rejects with a bare string, not an Error.
      return { ok: true, status: 200, text: () => Promise.reject('stream torn') } as Response;
    }) as typeof fetch;
    const io = makeIo({
      env: { MANIFEST_URL: HOST },
      fetchImpl,
      isTTY: true,
      openBrowser: (url: string) => {
        const authUrl = new URL(url);
        http.get(
          `http://127.0.0.1:${authUrl.searchParams.get('port')}/callback?code=c-abcdefghijklmnop&state=${authUrl.searchParams.get('state')}`,
          () => undefined,
        );
        return true;
      },
    });
    expect(await run(io, ['login'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      error: 'login_validation_failed',
      message: 'stream torn',
    });
    const config = JSON.parse(
      fs.readFileSync(path.join(io.configDir, 'manifest', 'config.json'), 'utf8'),
    );
    expect(config.hosts[HOST].apiKey).toBe('mnfst_pat_weird');
  });

  it('token-flag login stores nothing when /me rejects the user-supplied token', async () => {
    // Mirror image of the browser path: a token the user typed may be garbage,
    // so it must prove itself before it is written to disk.
    const stub = fetchStub([{ status: 401, body: { message: 'Invalid API key' } }]);
    const io = makeIo({ env: { MNFST_TOKEN: 'bad', MANIFEST_URL: HOST }, fetchImpl: stub.impl });
    expect(await run(io, ['login', '--token-env', 'MNFST_TOKEN'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ message: 'Invalid API key', status: 401 });
    expect(fs.existsSync(path.join(io.configDir, 'manifest', 'config.json'))).toBe(false);
  });

  it('logout on a host with nothing stored reports loggedOut: false and never calls the server', async () => {
    const stub = fetchStub([{ status: 200, body: { revoked: true } }]);
    const io = makeIo({ env: { MANIFEST_URL: HOST }, fetchImpl: stub.impl });
    expect(await run(io, ['logout'])).toBe(0);
    expect(io.lastJson()).toEqual({ loggedOut: false, revoked: false, url: HOST });
    expect(stub.calls).toHaveLength(0);
  });

  it('logout revokes the stored token server-side before deleting it locally', async () => {
    const stub = fetchStub([{ status: 200, body: { revoked: true } }]);
    const io = makeIo({ fetchImpl: stub.impl });
    writeConfig(io, { activeHost: HOST, hosts: { [HOST]: { apiKey: 'stored-pat' } } });
    expect(await run(io, ['logout', '--url', HOST])).toBe(0);
    expect(stub.calls[0]).toMatchObject({
      url: `${HOST}/api/v1/cli/token`,
      method: 'DELETE',
    });
    expect(stub.calls[0].headers['X-API-Key']).toBe('stored-pat');
    expect(io.lastJson()).toEqual({ loggedOut: true, revoked: true, url: HOST });
  });

  it('logout still succeeds locally when the revoke call fails', async () => {
    const stub = fetchStub([{ status: 500, body: { message: 'boom' } }]);
    const io = makeIo({ fetchImpl: stub.impl });
    writeConfig(io, { activeHost: HOST, hosts: { [HOST]: { apiKey: 'stored-pat' } } });
    expect(await run(io, ['logout', '--url', HOST])).toBe(0);
    expect(io.lastJson()).toEqual({ loggedOut: true, revoked: false, url: HOST });
    const config = JSON.parse(
      fs.readFileSync(path.join(io.configDir, 'manifest', 'config.json'), 'utf8'),
    );
    expect(config).toEqual({ hosts: {} });
  });

  it('logout removes only the target host credential', async () => {
    const stub = fetchStub([{ status: 200, body: { revoked: false } }]);
    const io = makeIo({ fetchImpl: stub.impl });
    writeConfig(io, {
      activeHost: HOST,
      hosts: { [HOST]: { apiKey: 'a' }, 'http://other:1': { apiKey: 'b' } },
    });
    expect(await run(io, ['logout', '--url', HOST])).toBe(0);
    expect(io.lastJson()).toEqual({ loggedOut: true, revoked: false, url: HOST });
    const config = JSON.parse(
      fs.readFileSync(path.join(io.configDir, 'manifest', 'config.json'), 'utf8'),
    );
    expect(config).toEqual({ hosts: { 'http://other:1': { apiKey: 'b' } } });
  });

  it('auth status reports unauthenticated with exit 1 and no fetch', async () => {
    const io = makeIo({ env: { MANIFEST_URL: HOST } });
    expect(await run(io, ['auth', 'status'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      authenticated: false,
      url: HOST,
      hint: expect.stringContaining('login'),
    });
  });

  it('auth status and whoami report identity from /me', async () => {
    const { io } = authedIo([{ status: 200, body: ME }]);
    expect(await run(io, ['auth', 'status'])).toBe(0);
    expect(io.lastJson()).toMatchObject({ authenticated: true, source: 'env', tenantId: 't1' });

    const { io: io2 } = authedIo([{ status: 200, body: ME }]);
    expect(await run(io2, ['whoami'])).toBe(0);
    expect(io2.lastJson()).toEqual({ url: HOST, ...ME });
  });

  it('auth status surfaces the token expiry reported by /me', async () => {
    const { io } = authedIo([
      { status: 200, body: { ...ME, expiresAt: '2026-09-01T00:00:00.000Z' } },
    ]);
    expect(await run(io, ['auth', 'status'])).toBe(0);
    expect(io.lastJson()).toMatchObject({
      authenticated: true,
      expiresAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('config path prints the resolved config location', async () => {
    const io = makeIo();
    expect(await run(io, ['config', 'path'])).toBe(0);
    expect(io.lastJson()).toEqual({ path: path.join(io.configDir, 'manifest', 'config.json') });
  });

  it('stored config credential is used when no env key is set', async () => {
    const stub = fetchStub([{ status: 200, body: { agents: [] } }]);
    const io = makeIo({ fetchImpl: stub.impl });
    writeConfig(io, { activeHost: HOST, hosts: { [HOST]: { apiKey: 'stored-key' } } });
    expect(await run(io, ['agent', 'list'])).toBe(0);
    expect(stub.calls[0].headers['X-API-Key']).toBe('stored-key');
  });

  it('commands fail closed when no credential resolves for the target host', async () => {
    const io = makeIo({ env: { MANIFEST_URL: HOST } });
    expect(await run(io, ['agent', 'list'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'not_authenticated', status: 401 });
  });
});

describe('agent commands', () => {
  it('agent list forwards includePlayground', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { agents: [] } }]);
    expect(await run(io, ['agent', 'list', '--include-playground'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/agents?includePlayground=true`);
  });

  it('agent list strips dashboard-only sparkline data', async () => {
    const { io } = authedIo([
      {
        status: 200,
        body: {
          agents: [
            { id: 'a1', name: 'bot-1', sparkline: [0, 3, 12, 8] },
            { id: 'a2', name: 'bot-2', sparkline: [] },
          ],
        },
      },
    ]);
    expect(await run(io, ['agent', 'list'])).toBe(0);
    expect(io.lastJson()).toEqual({
      agents: [
        { id: 'a1', name: 'bot-1' },
        { id: 'a2', name: 'bot-2' },
      ],
    });
  });

  it('agent list passes non-object payloads through untouched', async () => {
    const { io } = authedIo([{ status: 200, body: { agents: 'unexpected' } }]);
    expect(await run(io, ['agent', 'list'])).toBe(0);
    expect(io.lastJson()).toEqual({ agents: 'unexpected' });
  });

  it('agent list passes a null body and non-object agent entries through untouched', async () => {
    const { io } = authedIo([{ status: 200, body: null }]);
    expect(await run(io, ['agent', 'list'])).toBe(0);
    expect(io.lastJson()).toBeNull();

    const { io: io2 } = authedIo([{ status: 200, body: { agents: ['weird', null] } }]);
    expect(await run(io2, ['agent', 'list'])).toBe(0);
    expect(io2.lastJson()).toEqual({ agents: ['weird', null] });
  });

  it('agent create writes the key file 0600 and prints only the prefix', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnfst-agent-'));
    const keyFile = path.join(dir, 'coding.key');
    const { io, calls } = authedIo([
      {
        status: 201,
        body: { agent: { id: 'a1', name: 'coding' }, apiKey: 'mnfst_secret_full_key' },
      },
    ]);
    expect(
      await run(io, [
        'agent',
        'create',
        '--name',
        'coding',
        '--key-file',
        keyFile,
        '--platform',
        'claude-code',
        '--category',
        'coding',
      ]),
    ).toBe(0);

    expect(JSON.parse(calls[0].body!)).toEqual({
      name: 'coding',
      agent_platform: 'claude-code',
      agent_category: 'coding',
    });
    expect(fs.readFileSync(keyFile, 'utf8')).toBe('mnfst_secret_full_key');
    expect(fs.statSync(keyFile).mode & 0o777).toBe(0o600);
    expect(io.lastJson()).toEqual({
      agent: { id: 'a1', name: 'coding' },
      keyPrefix: 'mnfst_secr',
      keyFile,
    });
    expect(io.lines.join('\n')).not.toContain('mnfst_secret_full_key');
  });

  it('agent create omits absent optional category', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnfst-agent-'));
    const keyFile = path.join(dir, 'p.key');
    const { io, calls } = authedIo([
      { status: 201, body: { agent: { name: 'p' }, apiKey: 'mnfst_k' } },
    ]);
    expect(
      await run(io, [
        'agent',
        'create',
        '--name',
        'p',
        '--key-file',
        keyFile,
        '--platform',
        'openclaw',
      ]),
    ).toBe(0);
    expect(JSON.parse(calls[0].body!)).toEqual({ name: 'p', agent_platform: 'openclaw' });
  });

  it('agent create without --platform fails with the platform list before any API call', async () => {
    const { io, calls } = authedIo([{ status: 201, body: {} }]);
    expect(await run(io, ['agent', 'create', '--name', 'x', '--key-file', '/tmp/x.key'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'missing_platform' });
    expect((io.lastJson() as { message: string }).message).toContain('openclaw');
    expect((io.lastJson() as { message: string }).message).toContain('other');
    expect(calls).toHaveLength(0);
  });

  it('agent create with an unknown --platform fails listing valid ones', async () => {
    const { io, calls } = authedIo([{ status: 201, body: {} }]);
    expect(
      await run(io, [
        'agent',
        'create',
        '--name',
        'x',
        '--key-file',
        '/tmp/x.key',
        '--platform',
        'skynet',
      ]),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'invalid_platform' });
    expect((io.lastJson() as { message: string }).message).toContain('claude-code');
    expect(calls).toHaveLength(0);
  });

  it('agent platforms lists valid platforms without touching the network', async () => {
    const stub = fetchStub([]);
    const io = makeIo({ fetchImpl: stub.impl });
    expect(await run(io, ['agent', 'platforms'])).toBe(0);
    expect(io.lastJson()).toEqual({ platforms: [...CLI_AGENT_PLATFORMS] });
    expect(stub.calls).toHaveLength(0);
  });

  it('CLI platform list matches manifest-shared (drift guard)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shared = require('manifest-shared') as { AGENT_PLATFORMS: readonly string[] };
    expect(CLI_AGENT_PLATFORMS).toEqual([...shared.AGENT_PLATFORMS]);
  });

  it('agent update maps --category alone', async () => {
    const { io, calls } = authedIo([{ status: 200, body: {} }]);
    expect(await run(io, ['agent', 'update', 'a', '--category', 'coding'])).toBe(0);
    expect(JSON.parse(calls[0].body!)).toEqual({ agent_category: 'coding' });
  });

  it('agent create validates the key file before calling the API', async () => {
    const { io, calls } = authedIo([{ status: 201, body: {} }]);
    expect(
      await run(io, [
        'agent',
        'create',
        '--name',
        'x',
        '--platform',
        'claude-code',
        '--key-file',
        '/nonexistent-dir-xyz/k.key',
      ]),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'key_file_dir_missing' });
    expect(calls).toHaveLength(0);
  });

  it('agent get normalizes the 200 {agent:null} miss into not_found', async () => {
    const { io } = authedIo([{ status: 200, body: { agent: null } }]);
    expect(await run(io, ['agent', 'get', 'ghost'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'not_found', status: 404 });

    const { io: hit } = authedIo([{ status: 200, body: { agent: { name: 'real' } } }]);
    expect(await run(hit, ['agent', 'get', 'real'])).toBe(0);
    expect(hit.lastJson()).toEqual({ agent: { name: 'real' } });
  });

  it('agent update requires at least one field and maps flags', async () => {
    const none = makeIo({ env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'k' } });
    expect(await run(none, ['agent', 'update', 'a'])).toBe(1);
    expect(none.lastJson()).toMatchObject({ error: 'missing_flag' });

    const { io, calls } = authedIo([{ status: 200, body: { renamed: true } }]);
    expect(await run(io, ['agent', 'update', 'a', '--name', 'b', '--platform', 'openclaw'])).toBe(
      0,
    );
    expect(calls[0].method).toBe('PATCH');
    expect(JSON.parse(calls[0].body!)).toEqual({ name: 'b', agent_platform: 'openclaw' });
  });

  it('agent delete and rotate-key demand --yes', async () => {
    const io = makeIo({ env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'k' } });
    expect(await run(io, ['agent', 'delete', 'a'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'confirmation_required' });

    const { io: deleted, calls } = authedIo([{ status: 200, body: { deleted: true } }]);
    expect(await run(deleted, ['agent', 'delete', 'a', '--yes'])).toBe(0);
    expect(calls[0].method).toBe('DELETE');
  });

  it('agent rotate-key writes the fresh key to the key file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnfst-rotate-'));
    const keyFile = path.join(dir, 'rotated.key');
    const { io, calls } = authedIo([{ status: 200, body: { apiKey: 'mnfst_rotated_key_value' } }]);
    expect(await run(io, ['agent', 'rotate-key', 'a', '--key-file', keyFile, '--yes'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/agents/a/rotate-key`);
    expect(fs.readFileSync(keyFile, 'utf8')).toBe('mnfst_rotated_key_value');
    expect(io.lastJson()).toEqual({ rotated: true, keyPrefix: 'mnfst_rota', keyFile });
  });

  it('agent create without --key-file stores the key in the managed keystore', async () => {
    const { io } = authedIo([
      { status: 201, body: { agent: { name: 'kept' }, apiKey: 'mnfst_kept_secret' } },
    ]);
    expect(await run(io, ['agent', 'create', '--name', 'kept', '--platform', 'claude-code'])).toBe(
      0,
    );
    const expected = agentKeyPath(io.env, HOST, 'kept');
    expect(fs.readFileSync(expected, 'utf8')).toBe('mnfst_kept_secret');
    expect(fs.statSync(expected).mode & 0o777).toBe(0o600);
    expect(io.lastJson()).toEqual({
      agent: { name: 'kept' },
      keyPrefix: 'mnfst_kept',
      keyPath: expected,
    });
    expect(io.lines.join('\n')).not.toContain('mnfst_kept_secret');
  });

  it('agent rotate-key without --key-file refreshes the keystore entry', async () => {
    const { io } = authedIo([{ status: 200, body: { apiKey: 'mnfst_fresh_secret' } }]);
    saveAgentKey(io.env, HOST, 'a', 'mnfst_stale');
    expect(await run(io, ['agent', 'rotate-key', 'a', '--yes'])).toBe(0);
    const expected = agentKeyPath(io.env, HOST, 'a');
    expect(fs.readFileSync(expected, 'utf8')).toBe('mnfst_fresh_secret');
    expect(io.lastJson()).toEqual({ rotated: true, keyPrefix: 'mnfst_fres', keyPath: expected });
  });

  it('agent key path serves the cached keystore entry without the network', async () => {
    const { io, calls } = authedIo([]);
    saveAgentKey(io.env, HOST, 'my-bot', 'mnfst_cached');
    expect(await run(io, ['agent', 'key', 'path', 'my-bot'])).toBe(0);
    expect(io.lastJson()).toEqual({
      agent: 'my-bot',
      path: agentKeyPath(io.env, HOST, 'my-bot'),
      source: 'keystore',
    });
    expect(calls).toHaveLength(0);
  });

  it('agent key path self-heals from the server when the cache is missing', async () => {
    const { io, calls } = authedIo([
      { status: 200, body: { keyPrefix: 'mnfst_serv', apiKey: 'mnfst_server_copy' } },
    ]);
    expect(await run(io, ['agent', 'key', 'path', 'my-bot'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/agents/my-bot/key`);
    const expected = agentKeyPath(io.env, HOST, 'my-bot');
    expect(fs.readFileSync(expected, 'utf8')).toBe('mnfst_server_copy');
    expect(io.lastJson()).toEqual({ agent: 'my-bot', path: expected, source: 'server' });
    expect(io.lines.join('\n')).not.toContain('mnfst_server_copy');
  });

  it('agent key path fails with a rotate hint when the server cannot recover the key', async () => {
    const { io } = authedIo([{ status: 200, body: { keyPrefix: 'mnfst_lega' } }]);
    expect(await run(io, ['agent', 'key', 'path', 'legacy-bot'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      error: 'key_unrecoverable',
      hint: expect.stringContaining('rotate-key'),
    });
  });

  it('agent key show prints the raw key as a deliberate act', async () => {
    const { io, calls } = authedIo([]);
    saveAgentKey(io.env, HOST, 'my-bot', 'mnfst_cached_secret');
    expect(await run(io, ['agent', 'key', 'show', 'my-bot'])).toBe(0);
    expect(io.lastJson()).toEqual({ agent: 'my-bot', apiKey: 'mnfst_cached_secret' });
    expect(calls).toHaveLength(0);
  });

  it('agent commands slugify display-name input like the backend does', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { agent: { agent_name: 'john' } } }]);
    expect(await run(io, ['agent', 'get', 'John'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/agents/john`);

    const { io: io2, calls: calls2 } = authedIo([{ status: 200, body: {} }]);
    expect(await run(io2, ['agent', 'delete', 'My Cool Agent', '--yes'])).toBe(0);
    expect(calls2[0].url).toBe(`${HOST}/api/v1/agents/my-cool-agent`);
  });

  it('routing and run take display names too', async () => {
    const { io, calls } = authedIo([{ status: 200, body: {} }]);
    expect(await run(io, ['routing', 'status', 'John'])).toBe(0);
    expect(calls[0].url).toContain('/routing/john/');

    const { io: io2 } = authedIo([]);
    saveAgentKey(io2.env, HOST, 'john', 'k');
    io2.spawnImpl = async () => 0;
    expect(await run(io2, ['run', '--agent', 'John', '--', 'tool'])).toBe(0);
  });

  it('create with a spaced name stores the keystore entry under the slug', async () => {
    const { io } = authedIo([
      { status: 201, body: { agent: { display_name: 'My Cool Agent' }, apiKey: 'mnfst_spaced' } },
    ]);
    expect(
      await run(io, ['agent', 'create', '--name', 'My Cool Agent', '--platform', 'other']),
    ).toBe(0);
    const expected = agentKeyPath(io.env, HOST, 'my-cool-agent');
    expect(fs.readFileSync(expected, 'utf8')).toBe('mnfst_spaced');
    expect((io.lastJson() as { keyPath: string }).keyPath).toBe(expected);
  });

  it('a name that slugifies to nothing fails fast', async () => {
    const { io, calls } = authedIo([]);
    expect(await run(io, ['agent', 'get', '!!!'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'invalid_agent_name' });
    expect(calls).toHaveLength(0);
  });

  it('agent key show falls back to the server and caches the result', async () => {
    const { io } = authedIo([
      { status: 200, body: { keyPrefix: 'mnfst_serv', apiKey: 'mnfst_server_secret' } },
    ]);
    expect(await run(io, ['agent', 'key', 'show', 'my-bot'])).toBe(0);
    expect(io.lastJson()).toEqual({ agent: 'my-bot', apiKey: 'mnfst_server_secret' });
    expect(fs.readFileSync(agentKeyPath(io.env, HOST, 'my-bot'), 'utf8')).toBe(
      'mnfst_server_secret',
    );
  });
});

describe('provider commands', () => {
  it('provider list hits the tenant-level endpoint', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { providers: [] } }]);
    expect(await run(io, ['provider', 'list'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/providers`);
  });

  it('provider list strips dashboard-only noise but keeps operational signals', async () => {
    const { io } = authedIo([
      {
        status: 200,
        body: {
          providers: [
            {
              provider: 'openai',
              auth_type: 'api_key',
              display_name: null,
              connection_count: 1,
              connections: [
                {
                  id: 'conn-1',
                  label: 'Default',
                  key_prefix: 'sk-fake-',
                  priority: 0,
                  connected_at: '2026-08-02T07:25:48.318Z',
                  models_fetched_at: '2026-08-02T09:29:54.928Z',
                  cached_model_count: 38,
                  is_active: true,
                },
              ],
              total_models: 38,
            },
            {
              provider: 'custom:abc',
              auth_type: 'api_key',
              display_name: 'My LiteLLM',
              connection_count: 1,
              connections: [
                {
                  id: 'conn-2',
                  label: 'Default',
                  key_prefix: null,
                  priority: 2,
                  connected_at: '2026-08-02T07:25:48.318Z',
                  models_fetched_at: null,
                  cached_model_count: 0,
                  is_active: false,
                },
              ],
              total_models: 0,
            },
          ],
          model_counts: { openai: 84, anthropic: 21 },
        },
      },
    ]);
    expect(await run(io, ['provider', 'list'])).toBe(0);
    expect(io.lastJson()).toEqual({
      providers: [
        {
          provider: 'openai',
          auth_type: 'api_key',
          connection_count: 1,
          connections: [
            {
              id: 'conn-1',
              label: 'Default',
              connected_at: '2026-08-02T07:25:48.318Z',
              cached_model_count: 38,
              is_active: true,
            },
          ],
          total_models: 38,
        },
        {
          provider: 'custom:abc',
          auth_type: 'api_key',
          display_name: 'My LiteLLM',
          connection_count: 1,
          connections: [
            {
              id: 'conn-2',
              label: 'Default',
              connected_at: '2026-08-02T07:25:48.318Z',
              cached_model_count: 0,
              is_active: false,
            },
          ],
          total_models: 0,
        },
      ],
    });
  });

  it('provider list passes unexpected payload shapes through untouched', async () => {
    const { io } = authedIo([{ status: 200, body: { providers: 'weird' } }]);
    expect(await run(io, ['provider', 'list'])).toBe(0);
    expect(io.lastJson()).toEqual({ providers: 'weird' });

    const { io: io2 } = authedIo([{ status: 200, body: null }]);
    expect(await run(io2, ['provider', 'list'])).toBe(0);
    expect(io2.lastJson()).toBeNull();

    const { io: io3 } = authedIo([
      { status: 200, body: { providers: ['weird', { provider: 'x', connections: [null, 'w'] }] } },
    ]);
    expect(await run(io3, ['provider', 'list'])).toBe(0);
    expect(io3.lastJson()).toEqual({
      providers: ['weird', { provider: 'x', connections: [null, 'w'] }],
    });
  });

  it('provider catalog lists connectable providers without auth or network', async () => {
    const stub = fetchStub([]);
    const io = makeIo({ fetchImpl: stub.impl });
    expect(await run(io, ['provider', 'catalog'])).toBe(0);
    const out = io.lastJson() as { providers: Array<Record<string, unknown>> };
    expect(out.providers.length).toBeGreaterThan(20);
    expect(out.providers.some((p) => p['id'] === 'openai')).toBe(true);
    // display-only noise stays out of the CLI surface
    for (const p of out.providers) {
      expect(Object.keys(p).sort()).toEqual(['authTypes', 'displayName', 'id']);
    }
    expect(stub.calls).toHaveLength(0);
  });

  it('provider connect resolves aliases and rejects unknown providers early', async () => {
    const { io, calls } = authedIo([{ status: 201, body: {} }], { CRED: 'g-key' });
    expect(
      await run(io, [
        'provider',
        'connect',
        '--provider',
        'google',
        '--agent',
        'a',
        '--credential-env',
        'CRED',
      ]),
    ).toBe(0);
    expect(JSON.parse(calls[0].body!).provider).toBe('gemini');

    const { io: io2, calls: calls2 } = authedIo([]);
    expect(
      await run(io2, [
        'provider',
        'connect',
        '--provider',
        'skynet-llc',
        '--agent',
        'a',
        '--credential-env',
        'CRED',
      ]),
    ).toBe(1);
    expect(io2.lastJson()).toMatchObject({ error: 'unknown_provider' });
    expect(calls2).toHaveLength(0);
  });

  it('provider connect takes the provider as a positional', async () => {
    const { io, calls } = authedIo([{ status: 201, body: { id: 'p1' } }], { K: 'xai-secret' });
    expect(
      await run(io, ['provider', 'connect', 'xai', '--agent', 'a', '--credential-env', 'K']),
    ).toBe(0);
    expect(JSON.parse(calls[0].body!).provider).toBe('xai');
    expect((io.lastJson() as { agent: string }).agent).toBe('a');
  });

  it('provider connect rejects provider given both ways, and neither way', async () => {
    const { io } = authedIo([]);
    expect(
      await run(io, ['provider', 'connect', 'xai', '--provider', 'openai', '--agent', 'a']),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'invalid_flag' });

    const { io: io2 } = authedIo([]);
    expect(await run(io2, ['provider', 'connect', '--agent', 'a'])).toBe(1);
    expect(io2.lastJson()).toMatchObject({
      error: 'missing_positional',
      hint: expect.stringContaining('provider catalog'),
    });
  });

  it('provider connect auto-picks an agent (tenant-wide effect) when --agent is omitted', async () => {
    const { io, calls } = authedIo(
      [
        { status: 200, body: { agents: [{ agent_name: 'john' }, { agent_name: 'other' }] } },
        { status: 201, body: { id: 'p1' } },
      ],
      { K: 'xai-secret' },
    );
    expect(await run(io, ['provider', 'connect', 'xai', '--credential-env', 'K'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/agents`);
    expect(calls[1].url).toBe(`${HOST}/api/v1/routing/john/providers`);
    expect((io.lastJson() as { agent: string }).agent).toBe('john');
  });

  it('provider connect with no agents at all explains what to do', async () => {
    const { io } = authedIo([{ status: 200, body: { agents: [] } }], { K: 'k' });
    expect(await run(io, ['provider', 'connect', 'xai', '--credential-env', 'K'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      error: 'no_agents',
      hint: expect.stringContaining('agent create'),
    });
  });

  it('provider connect prompts with hidden input on a TTY when no source is given', async () => {
    const prompts: string[] = [];
    const stub = fetchStub([{ status: 201, body: { id: 'p1' } }]);
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: stub.impl,
      isTTY: true,
      readSecret: async (promptText: string) => {
        prompts.push(promptText);
        return 'sk-typed-secretly\n';
      },
    });
    expect(
      await run(io, ['provider', 'connect', 'openai', '--agent', 'a', '--auth-type', 'api_key']),
    ).toBe(0);
    expect(prompts[0]).toContain('input hidden');
    expect(JSON.parse(stub.calls[0].body!).apiKey).toBe('sk-typed-secretly');
    expect(io.lines.join('\n')).not.toContain('sk-typed-secretly');
  });

  it('provider connect requires --auth-type when the provider offers a real choice', async () => {
    const { io, calls } = authedIo([]);
    expect(await run(io, ['provider', 'connect', 'xai', '--agent', 'a'])).toBe(1);
    expect(io.lastJson()).toMatchObject({
      error: 'missing_auth_type',
      message: expect.stringContaining('api_key, subscription'),
    });
    expect(calls).toHaveLength(0);
  });

  afterEach(() => {
    OAUTH_POLL.intervalMs = 2000;
    OAUTH_POLL.timeoutMs = 180_000;
  });

  it('subscription connect (redirect flow) opens the browser and polls to completion', async () => {
    OAUTH_POLL.intervalMs = 1;
    OAUTH_POLL.timeoutMs = 500;
    const opened: string[] = [];
    const stub = fetchStub([
      { status: 200, body: { providers: [] } }, // baseline
      { status: 200, body: { url: 'https://accounts.x.ai/authorize?x=1' } },
      { status: 200, body: { providers: [] } }, // first poll: not yet
      {
        status: 200,
        body: {
          providers: [{ provider: 'xai', auth_type: 'subscription', connection_count: 1 }],
        },
      },
    ]);
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: stub.impl,
      isTTY: true,
      openBrowser: (url: string) => {
        opened.push(url);
        return true;
      },
    });
    expect(
      await run(io, ['provider', 'connect', 'xai', '--agent', 'a', '--auth-type', 'subscription']),
    ).toBe(0);
    expect(stub.calls[1].url).toBe(`${HOST}/api/v1/oauth/xai/authorize?agentName=a`);
    expect(opened[0]).toContain('accounts.x.ai');
    expect(io.lastJson()).toEqual({ connected: 'xai', auth_type: 'subscription', agent: 'a' });
  });

  it('subscription connect (redirect flow) times out with a helpful error', async () => {
    OAUTH_POLL.intervalMs = 1;
    OAUTH_POLL.timeoutMs = 20;
    const stub = fetchStub(
      Array.from({ length: 60 }, (_, i) =>
        i === 1
          ? { status: 200, body: { url: 'https://accounts.x.ai/a' } }
          : { status: 200, body: { providers: [] } },
      ),
    );
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: stub.impl,
      isTTY: true,
      openBrowser: () => true,
    });
    expect(
      await run(io, ['provider', 'connect', 'xai', '--agent', 'a', '--auth-type', 'subscription']),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'oauth_timeout' });
  });

  it('subscription connect (paste flow) exchanges the pasted code', async () => {
    const stub = fetchStub([
      { status: 200, body: { url: 'https://claude.ai/oauth/authorize?x=1', state: 'st-1' } },
      { status: 200, body: { ok: true } },
    ]);
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: stub.impl,
      isTTY: true,
      readLine: async () => 'the-pasted-code#st-1',
      openBrowser: () => true,
    });
    expect(
      await run(io, [
        'provider',
        'connect',
        'anthropic',
        '--agent',
        'a',
        '--auth-type',
        'subscription',
      ]),
    ).toBe(0);
    expect(stub.calls[0].url).toBe(`${HOST}/api/v1/oauth/anthropic/authorize?agentName=a`);
    expect(JSON.parse(stub.calls[1].body!)).toEqual({
      code: 'the-pasted-code#st-1',
      state: 'st-1',
    });
    expect(io.lastJson()).toEqual({
      connected: 'anthropic',
      auth_type: 'subscription',
      agent: 'a',
    });
  });

  it('subscription connect refuses device-flow providers and non-TTY sessions', async () => {
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: fetchStub([]).impl,
      isTTY: true,
    });
    expect(
      await run(io, ['provider', 'connect', 'kiro', '--agent', 'a', '--auth-type', 'subscription']),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'subscription_unsupported' });

    const { io: io2 } = authedIo([]);
    expect(
      await run(io2, ['provider', 'connect', 'xai', '--agent', 'a', '--auth-type', 'subscription']),
    ).toBe(1);
    expect(io2.lastJson()).toMatchObject({ error: 'subscription_needs_tty' });
  });

  it('provider connect never prompts when a credential flag signals scripting (pty-safe)', async () => {
    // Agents under a pty look interactive; an explicit --credential-env must
    // keep the run fully non-blocking.
    const stub = fetchStub([{ status: 201, body: { id: 'p1' } }]);
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key', K: 'xai-secret' },
      fetchImpl: stub.impl,
      isTTY: true,
      readLine: async () => {
        throw new Error('must not prompt');
      },
      readSecret: async () => {
        throw new Error('must not prompt');
      },
    });
    expect(
      await run(io, ['provider', 'connect', 'xai', '--agent', 'a', '--credential-env', 'K']),
    ).toBe(0);
    // a credential source can only mean api_key — inferred, never prompted
    expect(JSON.parse(stub.calls[0].body!).authType).toBe('api_key');
  });

  it('provider connect infers local for local-only providers without prompting', async () => {
    const { io, calls } = authedIo([{ status: 201, body: { id: 'p1' } }]);
    expect(await run(io, ['provider', 'connect', 'ollama', '--agent', 'a'])).toBe(0);
    const body = JSON.parse(calls[0].body!);
    expect(body.authType).toBe('local');
    expect(body).not.toHaveProperty('apiKey');
  });

  it('provider connect validates --auth-type against the catalog', async () => {
    const { io, calls } = authedIo([], { K: 'k' });
    expect(
      await run(io, [
        'provider',
        'connect',
        'openrouter',
        '--agent',
        'a',
        '--auth-type',
        'local',
        '--credential-env',
        'K',
      ]),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'invalid_auth_type' });
    expect(calls).toHaveLength(0);
  });

  it('provider connect treats an empty prompted secret as an error', async () => {
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: fetchStub([]).impl,
      isTTY: true,
      readSecret: async () => '   ',
    });
    expect(
      await run(io, ['provider', 'connect', 'openai', '--agent', 'a', '--auth-type', 'api_key']),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'credential_empty' });
  });

  it('provider connect wraps a non-object response body with the agent used', async () => {
    const { io } = authedIo([{ status: 201, body: null }], { K: 'k' });
    expect(
      await run(io, ['provider', 'connect', 'xai', '--agent', 'a', '--credential-env', 'K']),
    ).toBe(0);
    expect(io.lastJson()).toEqual({ agent: 'a', result: null });
  });

  it('provider connect sends the credential from a named env var, never argv', async () => {
    const { io, calls } = authedIo([{ status: 201, body: { id: 'p1', provider: 'openai' } }], {
      OPENAI_KEY: 'sk-secret',
    });
    expect(
      await run(io, [
        'provider',
        'connect',
        '--provider',
        'openai',
        '--agent',
        'coding',
        '--credential-env',
        'OPENAI_KEY',
        '--label',
        'Main',
      ]),
    ).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/coding/providers`);
    expect(JSON.parse(calls[0].body!)).toEqual({
      provider: 'openai',
      apiKey: 'sk-secret',
      authType: 'api_key',
      label: 'Main',
    });
    expect(io.lines.join('\n')).not.toContain('sk-secret');
  });

  it('provider connect --auth-type local needs no credential', async () => {
    const { io, calls } = authedIo([{ status: 201, body: { id: 'p1', provider: 'ollama' } }]);
    expect(
      await run(io, [
        'provider',
        'connect',
        '--provider',
        'ollama',
        '--agent',
        'coding',
        '--auth-type',
        'local',
      ]),
    ).toBe(0);
    expect(JSON.parse(calls[0].body!)).toEqual({ provider: 'ollama', authType: 'local' });
  });

  it('provider connect without a credential source fails before any request', async () => {
    const { io, calls } = authedIo([{ status: 201, body: {} }]);
    expect(
      await run(io, [
        'provider',
        'connect',
        '--provider',
        'openai',
        '--agent',
        'coding',
        '--auth-type',
        'api_key',
      ]),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'credential_source_required' });
    expect(calls).toHaveLength(0);
  });

  it('provider disconnect requires --yes and forwards authType/label', async () => {
    const io = makeIo({ env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'k' } });
    expect(await run(io, ['provider', 'disconnect', '--provider', 'openai', '--agent', 'a'])).toBe(
      1,
    );

    const { io: ok, calls } = authedIo([{ status: 200, body: { ok: true } }]);
    expect(
      await run(ok, [
        'provider',
        'disconnect',
        '--provider',
        'openai',
        '--agent',
        'a',
        '--auth-type',
        'api_key',
        '--label',
        'Main',
        '--yes',
      ]),
    ).toBe(0);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toBe(
      `${HOST}/api/v1/routing/a/providers/openai?authType=api_key&label=Main`,
    );
  });
});

describe('routing commands', () => {
  it('status and tiers are thin GET wrappers', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { enabled: true, reason: null } }]);
    expect(await run(io, ['routing', 'status', 'coding'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/coding/status`);

    const { io: tiers, calls: tierCalls } = authedIo([{ status: 200, body: { tiers: [] } }]);
    expect(await run(tiers, ['routing', 'tiers', 'coding'])).toBe(0);
    expect(tierCalls[0].url).toBe(`${HOST}/api/v1/routing/coding/tiers`);
  });

  it('tier set PUTs the flat route with api_key default', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { ok: true } }]);
    expect(
      await run(io, [
        'routing',
        'tier',
        'set',
        'coding',
        '--tier',
        'default',
        '--model',
        'gpt-4o-mini',
        '--provider',
        'openai',
      ]),
    ).toBe(0);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/coding/tiers/default`);
    expect(JSON.parse(calls[0].body!)).toEqual({
      model: 'gpt-4o-mini',
      provider: 'openai',
      authType: 'api_key',
    });
  });

  it('tier set forwards auth-type and key-label pins', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { ok: true } }]);
    expect(
      await run(io, [
        'routing',
        'tier',
        'set',
        'coding',
        '--tier',
        'default',
        '--model',
        'claude-sonnet-5',
        '--provider',
        'anthropic',
        '--auth-type',
        'subscription',
        '--key-label',
        'Work',
      ]),
    ).toBe(0);
    expect(JSON.parse(calls[0].body!)).toEqual({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      authType: 'subscription',
      providerKeyLabel: 'Work',
    });
  });

  it('tier clear and fallbacks clear demand --yes', async () => {
    const io = makeIo({ env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'k' } });
    expect(await run(io, ['routing', 'tier', 'clear', 'coding', '--tier', 'default'])).toBe(1);
    expect(await run(io, ['routing', 'fallbacks', 'clear', 'coding', '--tier', 'default'])).toBe(1);

    const { io: ok, calls } = authedIo([{ status: 200, body: { ok: true } }]);
    expect(
      await run(ok, ['routing', 'tier', 'clear', 'coding', '--tier', 'default', '--yes']),
    ).toBe(0);
    expect(calls[0].method).toBe('DELETE');
  });

  it('fallbacks get/set map the tier path and models list', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { fallbacks: [] } }]);
    expect(await run(io, ['routing', 'fallbacks', 'get', 'coding', '--tier', 'default'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/coding/tiers/default/fallbacks`);

    const { io: set, calls: setCalls } = authedIo([{ status: 200, body: { ok: true } }]);
    expect(
      await run(set, [
        'routing',
        'fallbacks',
        'set',
        'coding',
        '--tier',
        'default',
        '--models',
        'gpt-4o-mini, claude-3-haiku,',
      ]),
    ).toBe(0);
    expect(JSON.parse(setCalls[0].body!)).toEqual({ models: ['gpt-4o-mini', 'claude-3-haiku'] });
  });

  it('fallbacks clear --yes issues the DELETE', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { ok: true } }]);
    expect(
      await run(io, ['routing', 'fallbacks', 'clear', 'coding', '--tier', 'default', '--yes']),
    ).toBe(0);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/coding/tiers/default/fallbacks`);
  });

  it('fallbacks set rejects an empty models list', async () => {
    const { io } = authedIo([{ status: 200, body: {} }]);
    expect(
      await run(io, [
        'routing',
        'fallbacks',
        'set',
        'coding',
        '--tier',
        'default',
        '--models',
        ' , ',
      ]),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'missing_flag' });
  });

  it('autofix and recording get/set wrap GET/PATCH with a strict boolean', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { enabled: true } }]);
    expect(await run(io, ['routing', 'autofix', 'get', 'coding'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/coding/autofix`);

    const { io: set, calls: setCalls } = authedIo([{ status: 200, body: { enabled: false } }]);
    expect(await run(set, ['routing', 'recording', 'set', 'coding', '--enabled', 'false'])).toBe(0);
    expect(setCalls[0].method).toBe('PATCH');
    expect(JSON.parse(setCalls[0].body!)).toEqual({ enabled: false });

    const bad = makeIo({ env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'k' } });
    expect(await run(bad, ['routing', 'autofix', 'set', 'coding', '--enabled', 'maybe'])).toBe(1);
    expect(bad.lastJson()).toMatchObject({ error: 'invalid_flag' });
  });
});

describe('analytics commands', () => {
  it('overview and costs forward range and agent filters', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { summary: {} } }]);
    expect(await run(io, ['overview', '--range', '7d', '--agent', 'coding'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/overview?range=7d&agent_name=coding`);

    const { io: cost, calls: costCalls } = authedIo([{ status: 200, body: {} }]);
    expect(await run(cost, ['costs', '--range', '24h'])).toBe(0);
    expect(costCalls[0].url).toBe(`${HOST}/api/v1/costs?range=24h`);
  });

  it('requests wraps the legacy /messages log with filters', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { messages: [] } }]);
    expect(
      await run(io, [
        'requests',
        '--range',
        '24h',
        '--limit',
        '50',
        '--status',
        'error',
        '--provider',
        'openai',
      ]),
    ).toBe(0);
    expect(calls[0].url).toBe(
      `${HOST}/api/v1/messages?range=24h&limit=50&status=error&provider=openai`,
    );
  });
});
