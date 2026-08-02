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
    // --key-file is an ADDITIONAL copy; the keystore cache is always refreshed
    expect(fs.readFileSync(agentKeyPath(io.env, HOST, 'coding'), 'utf8')).toBe(
      'mnfst_secret_full_key',
    );
    expect(io.lastJson()).toEqual({
      agent: { id: 'a1', name: 'coding' },
      keyPrefix: 'mnfst_secr',
      keyFile,
      keyPath: agentKeyPath(io.env, HOST, 'coding'),
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
    saveAgentKey(io.env, HOST, 'a', 'mnfst_STALE_REVOKED');
    expect(await run(io, ['agent', 'rotate-key', 'a', '--key-file', keyFile, '--yes'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/agents/a/rotate-key`);
    expect(fs.readFileSync(keyFile, 'utf8')).toBe('mnfst_rotated_key_value');
    // regression (sim-B): --key-file must not leave the keystore serving the
    // revoked key through mnfst run / agent key show
    expect(fs.readFileSync(agentKeyPath(io.env, HOST, 'a'), 'utf8')).toBe(
      'mnfst_rotated_key_value',
    );
    expect(io.lastJson()).toEqual({
      rotated: true,
      keyPrefix: 'mnfst_rota',
      keyFile,
      keyPath: agentKeyPath(io.env, HOST, 'a'),
    });
  });

  it('agent delete drops the local keystore entry', async () => {
    const { io } = authedIo([{ status: 200, body: { ok: true } }]);
    const p = saveAgentKey(io.env, HOST, 'gone-bot', 'mnfst_dead');
    expect(await run(io, ['agent', 'delete', 'gone-bot', '--yes'])).toBe(0);
    expect(fs.existsSync(p)).toBe(false);
  });

  it('agent create --if-absent succeeds on conflict by resolving the existing agent', async () => {
    const { io, calls } = authedIo([
      { status: 409, body: { message: 'Agent "kept" already exists', error: 'Conflict' } },
      { status: 200, body: { agent: { agent_name: 'kept' } } },
      { status: 200, body: { keyPrefix: 'mnfst_serv', apiKey: 'mnfst_recovered_key' } },
    ]);
    expect(
      await run(io, ['agent', 'create', '--name', 'kept', '--platform', 'curl', '--if-absent']),
    ).toBe(0);
    expect(calls[1].url).toBe(`${HOST}/api/v1/agents/kept`);
    expect(io.lastJson()).toMatchObject({
      existed: true,
      keyPrefix: 'mnfst_reco',
      agent: { agent_name: 'kept' },
    });
    // the recovered key lands in the keystore for run/key path
    expect(fs.readFileSync(agentKeyPath(io.env, HOST, 'kept'), 'utf8')).toBe('mnfst_recovered_key');
  });

  it('agent create without --if-absent still fails on conflict', async () => {
    const { io } = authedIo([
      { status: 409, body: { message: 'Agent "kept" already exists', error: 'Conflict' } },
    ]);
    expect(await run(io, ['agent', 'create', '--name', 'kept', '--platform', 'curl'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ status: 409 });
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

  it('agent env emits dotenv lines, and --export shell lines', async () => {
    const { io, calls } = authedIo([]);
    saveAgentKey(io.env, HOST, 'my-bot', 'mnfst_env_secret');
    expect(await run(io, ['agent', 'env', 'My Bot'])).toBe(0);
    expect(io.lines.slice(-2)).toEqual([
      'MANIFEST_AGENT_KEY=mnfst_env_secret',
      `MANIFEST_AGENT_URL=${HOST}/v1`,
    ]);
    expect(calls).toHaveLength(0);

    const { io: io2 } = authedIo([]);
    saveAgentKey(io2.env, HOST, 'my-bot', 'k2');
    expect(await run(io2, ['agent', 'env', 'my-bot', '--export'])).toBe(0);
    expect(io2.lines.slice(-2)[0]).toBe('export MANIFEST_AGENT_KEY=k2');
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

  it('provider list --agent annotates connections with the agent enabled set', async () => {
    const { io, calls } = authedIo([
      {
        status: 200,
        body: {
          providers: [
            {
              provider: 'openai',
              auth_type: 'api_key',
              connections: [
                { id: 'conn-on', label: 'A', is_active: true },
                { id: 'conn-off', label: 'B', is_active: true },
              ],
            },
          ],
        },
      },
      { status: 200, body: { agent: { agent_name: 'john' } } },
      { status: 200, body: { enabled: ['conn-on'] } },
    ]);
    expect(await run(io, ['provider', 'list', '--agent', 'John'])).toBe(0);
    expect(calls[1].url).toBe(`${HOST}/api/v1/agents/john`);
    expect(calls[2].url).toBe(`${HOST}/api/v1/agents/john/enabled-providers`);
    const out = io.lastJson() as {
      agent: string;
      providers: Array<{ connections: Array<{ id: string; enabled: boolean }> }>;
    };
    expect(out.agent).toBe('john');
    expect(out.providers[0].connections).toEqual([
      { id: 'conn-on', label: 'A', is_active: true, enabled: true },
      { id: 'conn-off', label: 'B', is_active: true, enabled: false },
    ]);
  });

  it('provider list --agent 404s for a missing agent', async () => {
    const { io } = authedIo([
      { status: 200, body: { providers: [] } },
      { status: 200, body: { agent: null } },
    ]);
    expect(await run(io, ['provider', 'list', '--agent', 'ghost'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'not_found', status: 404 });
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
      await run(io, [
        'provider',
        'connect',
        'copilot',
        '--agent',
        'a',
        '--auth-type',
        'subscription',
      ]),
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

describe('models command', () => {
  it('lists routable models trimmed to tier-set fields', async () => {
    const { io, calls } = authedIo([
      {
        status: 200,
        body: [
          {
            model_name: 'grok-4',
            provider: 'xai',
            auth_type: 'api_key',
            context_window: 256000,
            input_price_per_token: 0.000003,
            output_price_per_token: 0.000015,
            capability_reasoning: true,
            input_modalities: ['text'],
          },
          'junk',
        ],
      },
    ]);
    expect(await run(io, ['models', 'John'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/john/available-models`);
    // default mirrors /v1/models: identity only
    expect(io.lastJson()).toEqual({
      agent: 'john',
      count: 1,
      models: [{ model: 'grok-4', provider: 'xai', auth_type: 'api_key' }],
    });
  });

  it('opts into cost and capabilities like /v1/models', async () => {
    const row = {
      model_name: 'grok-4',
      provider: 'xai',
      auth_type: 'api_key',
      context_window: 256000,
      input_price_per_token: 0.000003,
      output_price_per_token: 0.000015,
      capability_reasoning: true,
      capability_code: true,
      input_modalities: ['text'],
    };
    const { io } = authedIo([{ status: 200, body: [row] }]);
    expect(await run(io, ['models', 'john', '--cost'])).toBe(0);
    expect((io.lastJson() as { models: object[] }).models[0]).toEqual({
      model: 'grok-4',
      provider: 'xai',
      auth_type: 'api_key',
      input_price_per_token: 0.000003,
      output_price_per_token: 0.000015,
    });

    const { io: io2 } = authedIo([{ status: 200, body: [row] }]);
    expect(await run(io2, ['models', 'john', '--capabilities'])).toBe(0);
    expect((io2.lastJson() as { models: object[] }).models[0]).toEqual({
      model: 'grok-4',
      provider: 'xai',
      auth_type: 'api_key',
      context_window: 256000,
      capability_reasoning: true,
      capability_code: true,
      input_modalities: ['text'],
    });
  });

  it('filters by provider (alias-aware) and requires the agent explicitly', async () => {
    const { io } = authedIo([
      {
        status: 200,
        body: [
          { model_name: 'gemini-3-pro', provider: 'gemini', auth_type: 'api_key' },
          { model_name: 'grok-4', provider: 'xai', auth_type: 'api_key' },
        ],
      },
    ]);
    expect(await run(io, ['models', 'john', '--provider', 'google'])).toBe(0);
    const out = io.lastJson() as { count: number; models: Array<{ model: string }> };
    expect(out.count).toBe(1);
    expect(out.models[0].model).toBe('gemini-3-pro');

    const { io: io2, calls: calls2 } = authedIo([]);
    expect(await run(io2, ['models'])).toBe(1);
    expect(io2.lastJson()).toMatchObject({ error: 'missing_argument' });
    expect(calls2).toHaveLength(0);
  });

  it('surfaces cost_per_request and tolerates absent capability fields', async () => {
    const row = {
      model_name: 'gpt-6-codex',
      provider: 'opencode-go',
      auth_type: 'subscription',
      cost_per_request: 0.004,
      input_price_per_token: 0,
      output_price_per_token: 0,
      context_window: 400000,
      capability_reasoning: true,
      capability_code: true,
    };
    const { io } = authedIo([{ status: 200, body: [row] }]);
    expect(await run(io, ['models', 'john', '--cost', '--capabilities'])).toBe(0);
    const m = (io.lastJson() as { models: Array<Record<string, unknown>> }).models[0];
    expect(m['cost_per_request']).toBe(0.004);
    expect(m).not.toHaveProperty('capabilities');
    expect(m).not.toHaveProperty('input_modalities');
  });

  it('handles a non-array payload as zero models, with a hint', async () => {
    const { io } = authedIo([{ status: 200, body: { unexpected: true } }]);
    expect(await run(io, ['models', 'a'])).toBe(0);
    expect(io.lastJson()).toMatchObject({
      count: 0,
      models: [],
      hint: expect.stringContaining('provider list --agent a'),
    });
  });
});

describe('call', () => {
  const completion = (content: string, model = 'grok-build-0.1') => ({
    status: 200,
    body: {
      model,
      choices: [{ message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    },
  });

  it('sends a routed completion and prints the answer on stdout, facts on stderr', async () => {
    const { io, calls } = authedIo([completion('The answer.')]);
    saveAgentKey(io.env, HOST, 'john', 'mnfst_call_key');
    expect(await run(io, ['call', '--agent', 'John', 'what', 'is', 'up?'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/v1/chat/completions`);
    expect(calls[0].headers['Authorization']).toBe('Bearer mnfst_call_key');
    const body = JSON.parse(calls[0].body!);
    expect(body.model).toBe('auto');
    expect(body.messages).toEqual([{ role: 'user', content: 'what is up?' }]);
    expect(io.lines[io.lines.length - 1]).toBe('The answer.');
    expect(io.errLines.join('\n')).toContain('agent=john');
    expect(io.errLines.join('\n')).toContain('tokens=15');
  });

  it('forwards --model, --tier, --system and supports --json', async () => {
    const { io, calls } = authedIo([completion('ok', 'grok-4.5')]);
    saveAgentKey(io.env, HOST, 'john', 'k');
    expect(
      await run(io, [
        'call',
        '--agent',
        'john',
        '--model',
        'grok-4.5',
        '--tier',
        'thorough',
        '--system',
        'be brief',
        '--json',
        'hard question',
      ]),
    ).toBe(0);
    const body = JSON.parse(calls[0].body!);
    expect(body.model).toBe('grok-4.5');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be brief' });
    expect(calls[0].headers['x-manifest-tier']).toBe('thorough');
    expect(io.lastJson()).toMatchObject({ model: 'grok-4.5' });
  });

  it('reads the prompt from stdin when no argument is given', async () => {
    const stub = fetchStub([completion('reviewed')]);
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: stub.impl,
      stdin: 'review this patch\n',
    });
    saveAgentKey(io.env, HOST, 'john', 'k');
    expect(await run(io, ['call', '--agent', 'john'])).toBe(0);
    expect(JSON.parse(stub.calls[0].body!).messages[0].content).toBe('review this patch');
  });

  it('rejects an empty prompt and unmasks fake-200 Manifest errors', async () => {
    const { io } = authedIo([]);
    expect(await run(io, ['call', '--agent', 'john'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'missing_prompt' });

    const { io: io2 } = authedIo([
      completion('[🦚 Manifest M101] No providers configured. See docs'),
    ]);
    saveAgentKey(io2.env, HOST, 'john', 'k');
    expect(await run(io2, ['call', '--agent', 'john', 'hi'])).toBe(1);
    expect(io2.lastJson()).toMatchObject({
      error: 'call_failed',
      message: expect.stringContaining('M101'),
    });
  });

  it('wraps transport failures as network_error', async () => {
    const io = makeIo({
      env: { MANIFEST_URL: HOST, MANIFEST_API_KEY: 'env-key' },
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as typeof fetch,
    });
    saveAgentKey(io.env, HOST, 'john', 'k');
    expect(await run(io, ['call', '--agent', 'john', 'hi'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'network_error' });
  });

  it('auto-picks an agent when none is given and surfaces real HTTP errors', async () => {
    const { io, calls } = authedIo([
      { status: 200, body: { agents: [{ agent_name: 'john' }] } },
      { status: 429, body: { error: { message: 'rate limited' } } },
    ]);
    saveAgentKey(io.env, HOST, 'john', 'k');
    expect(await run(io, ['call', 'hi'])).toBe(1);
    expect(calls[0].url).toBe(`${HOST}/api/v1/agents`);
    expect(io.lastJson()).toMatchObject({ error: 'call_failed', status: 429 });
  });
});

describe('requests get', () => {
  it('passes filters through and surfaces the pagination envelope untouched', async () => {
    const { io, calls } = authedIo([
      {
        status: 200,
        body: {
          items: [{ id: 'r1' }, { id: 'r2' }],
          next_cursor: 'opaque-cursor-abc',
          total_count: 41,
          total_count_exact: true,
        },
      },
    ]);
    expect(
      await run(io, [
        'requests',
        'get',
        '--agent',
        'John',
        '--range',
        '24h',
        '--status',
        'error',
        '--limit',
        '2',
      ]),
    ).toBe(0);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe('/api/v1/messages');
    expect(url.searchParams.get('agent_name')).toBe('john');
    expect(url.searchParams.get('range')).toBe('24h');
    expect(url.searchParams.get('status')).toBe('error');
    expect(url.searchParams.get('limit')).toBe('2');
    expect(io.lastJson()).toEqual({
      agent: 'john',
      count: 2,
      next_cursor: 'opaque-cursor-abc',
      total_count: 41,
      total_count_exact: true,
      requests: [{ id: 'r1' }, { id: 'r2' }],
    });
  });

  it('trims rows to decision fields, omitting nulls; --full passes everything', async () => {
    const row = {
      id: 'r1',
      agent_name: 'john',
      timestamp: 't',
      status: 'failed',
      model: 'auto',
      provider: null,
      auth_type: null,
      cost: '0',
      input_tokens: '0',
      output_tokens: '0',
      duration_ms: 3,
      attempt_count: 0,
      error_code: 'M101',
      error_message: 'no providers',
      error_origin: 'config',
      error_http_status: null,
      error_class: 'no_provider',
      feedback_rating: null,
      display_name: 'auto',
      routing_tier: null,
      routing_reason: null,
      specificity_category: null,
      fallback_from_model: null,
      fallback_index: null,
      header_tier_id: null,
      header_tier_name: null,
      header_tier_color: null,
      provider_key_label: null,
      custom_provider_name: null,
      autofix_applied: false,
      autofix_role: null,
      cache_read_tokens: '0',
      cache_creation_tokens: '0',
    };
    const { io } = authedIo([{ status: 200, body: { items: [row], next_cursor: null } }]);
    expect(await run(io, ['requests', 'get'])).toBe(0);
    expect((io.lastJson() as { requests: object[] }).requests[0]).toEqual({
      id: 'r1',
      agent_name: 'john',
      timestamp: 't',
      status: 'failed',
      model: 'auto',
      provider: null,
      auth_type: null,
      cost: '0',
      input_tokens: '0',
      output_tokens: '0',
      duration_ms: 3,
      attempt_count: 0,
      error_code: 'M101',
      error_message: 'no providers',
      error_origin: 'config',
    });

    const { io: io2 } = authedIo([{ status: 200, body: { items: [row], next_cursor: null } }]);
    expect(await run(io2, ['requests', 'get', '--full'])).toBe(0);
    const full = (io2.lastJson() as { requests: Record<string, unknown>[] }).requests[0];
    expect(full).toHaveProperty('header_tier_color');
    expect(full).toHaveProperty('cache_read_tokens');
  });

  it('keeps meaningful conditionals: custom tier, fallback, autofix', async () => {
    const row = {
      id: 'r2',
      status: 'ok',
      header_tier_name: 'deep',
      fallback_from_model: 'grok-4.5',
      autofix_applied: true,
      custom_provider_name: 'My LiteLLM',
    };
    const { io } = authedIo([{ status: 200, body: { items: [row], next_cursor: null } }]);
    expect(await run(io, ['requests', 'get'])).toBe(0);
    expect((io.lastJson() as { requests: object[] }).requests[0]).toMatchObject({
      header_tier_name: 'deep',
      fallback_from_model: 'grok-4.5',
      autofix_applied: true,
      custom_provider_name: 'My LiteLLM',
    });
  });

  it('pages with the opaque cursor and reports the last page as null', async () => {
    const { io, calls } = authedIo([
      { status: 200, body: { items: [{ id: 'r3' }], next_cursor: null, total_count: 41 } },
    ]);
    expect(await run(io, ['requests', 'get', '--cursor', 'opaque-cursor-abc'])).toBe(0);
    expect(new URL(calls[0].url).searchParams.get('cursor')).toBe('opaque-cursor-abc');
    expect(io.lastJson()).toMatchObject({ count: 1, next_cursor: null });
  });

  it('validates --limit against the API cap', async () => {
    const { io, calls } = authedIo([]);
    expect(await run(io, ['requests', 'get', '--limit', '500'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'invalid_flag' });
    const { io: io2 } = authedIo([]);
    expect(await run(io2, ['requests', 'get', '--limit', 'many'])).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('validates --range against the known windows', async () => {
    const { io, calls } = authedIo([]);
    expect(await run(io, ['requests', 'get', '--range', 'bogus'])).toBe(1);
    expect((io.lastJson() as { message: string }).message).toContain('24h');
    expect(calls).toHaveLength(0);
  });

  it('passes non-object rows through untouched', async () => {
    const { io } = authedIo([{ status: 200, body: { items: ['junk', null], next_cursor: null } }]);
    expect(await run(io, ['requests', 'get'])).toBe(0);
    expect((io.lastJson() as { requests: unknown[] }).requests).toEqual(['junk', null]);
  });

  it('tolerates a null body', async () => {
    const { io } = authedIo([{ status: 200, body: null }]);
    expect(await run(io, ['requests', 'get'])).toBe(0);
    expect(io.lastJson()).toMatchObject({ count: 0, next_cursor: null, requests: [] });
  });
});

describe('routing commands', () => {
  it('status composes the real config: default route, custom tiers, toggles', async () => {
    const { io, calls } = authedIo([
      {
        status: 200,
        body: [
          { tier: 'simple', override_route: { model: 'old' } },
          {
            tier: 'default',
            override_route: { model: 'grok-4.5', provider: 'xai', authType: 'subscription' },
            fallback_routes: [{ model: 'grok-4.3', provider: 'xai' }],
          },
        ],
      },
      {
        status: 200,
        body: [
          {
            id: 'ht-1',
            name: 'deep',
            header_key: 'x-manifest-tier',
            header_value: 'deep',
            enabled: true,
            override_route: { model: 'grok-4.5' },
            fallback_routes: null,
          },
        ],
      },
      { status: 200, body: { enabled: true } },
      { status: 200, body: { enabled: false } },
    ]);
    expect(await run(io, ['routing', 'status', 'John'])).toBe(0);
    const urls = calls.map((c) => c.url).sort();
    expect(urls).toEqual(
      [
        `${HOST}/api/v1/routing/john/tiers`,
        `${HOST}/api/v1/routing/john/header-tiers`,
        `${HOST}/api/v1/routing/john/autofix`,
        `${HOST}/api/v1/routing/john/recording`,
      ].sort(),
    );
    expect(io.lastJson()).toEqual({
      agent: 'john',
      default: {
        route: { model: 'grok-4.5', provider: 'xai', authType: 'subscription' },
        fallbacks: [{ model: 'grok-4.3', provider: 'xai' }],
      },
      custom_tiers: [
        {
          name: 'deep',
          trigger: 'x-manifest-tier: deep',
          enabled: true,
          route: { model: 'grok-4.5' },
          fallbacks: [],
        },
      ],
      autofix: true,
      recording: false,
    });
  });

  it('status tolerates an unconfigured agent', async () => {
    const { io } = authedIo([
      { status: 200, body: [] },
      { status: 200, body: [] },
      { status: 200, body: { enabled: false } },
      { status: 200, body: { enabled: false } },
    ]);
    expect(await run(io, ['routing', 'status', 'john'])).toBe(0);
    expect(io.lastJson()).toMatchObject({
      default: { route: null, fallbacks: [] },
      custom_tiers: [],
    });
  });

  it('agent configure writes the default route with fallbacks from --models', async () => {
    const { io, calls } = authedIo([
      { status: 200, body: { ok: true } },
      { status: 200, body: { models: ['m2', 'm3'] } },
    ]);
    expect(
      await run(io, [
        'agent',
        'configure',
        'John',
        '--models',
        'grok-4.5, m2, m3',
        '--provider',
        'xai',
        '--auth-type',
        'subscription',
      ]),
    ).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/john/tiers/default`);
    expect(JSON.parse(calls[0].body!)).toEqual({
      model: 'grok-4.5',
      provider: 'xai',
      authType: 'subscription',
    });
    expect(calls[1].url).toBe(`${HOST}/api/v1/routing/john/tiers/default/fallbacks`);
    expect(JSON.parse(calls[1].body!)).toEqual({ models: ['m2', 'm3'] });
    expect(io.lastJson()).toMatchObject({ agent: 'john', route: { ok: true } });
  });

  it('agent configure with a single model clears existing fallbacks', async () => {
    const { io, calls } = authedIo([
      { status: 200, body: { ok: true } },
      { status: 200, body: { ok: true } },
    ]);
    expect(
      await run(io, ['agent', 'configure', 'john', '--models', 'solo', '--provider', 'openai']),
    ).toBe(0);
    expect(calls[1].method).toBe('DELETE');
    expect(calls[1].url).toBe(`${HOST}/api/v1/routing/john/tiers/default/fallbacks`);
    expect((io.lastJson() as { fallbacks: unknown }).fallbacks).toEqual([]);
  });

  it('agent configure --tier upserts the named custom tier', async () => {
    // existing tier: found by name, no create
    const { io, calls } = authedIo([
      { status: 200, body: [{ id: 'ht-9', name: 'Test' }] },
      { status: 200, body: { ok: true } },
      { status: 200, body: { models: ['fb'] } },
    ]);
    expect(
      await run(io, [
        'agent',
        'configure',
        'john',
        '--tier',
        'test',
        '--models',
        'grok-4.5,fb',
        '--provider',
        'xai',
      ]),
    ).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/john/header-tiers`);
    expect(calls[1].url).toBe(`${HOST}/api/v1/routing/john/header-tiers/ht-9/override`);
    expect((io.lastJson() as { tier: { created: boolean } }).tier.created).toBe(false);

    // missing tier: created with the default trigger
    const { io: io2, calls: calls2 } = authedIo([
      { status: 200, body: [] },
      { status: 201, body: { id: 'ht-new' } },
      { status: 200, body: { ok: true } },
      { status: 200, body: { ok: true } },
    ]);
    expect(
      await run(io2, [
        'agent',
        'configure',
        'john',
        '--tier',
        'heavy',
        '--models',
        'big-model',
        '--provider',
        'openai',
      ]),
    ).toBe(0);
    expect(JSON.parse(calls2[1].body!)).toEqual({
      name: 'heavy',
      header_key: 'x-manifest-tier',
      header_value: 'heavy',
      badge_color: 'indigo',
    });
    expect((io2.lastJson() as { tier: { created: boolean } }).tier.created).toBe(true);
  });

  it('agent configure toggles autofix/recording, alone or combined', async () => {
    const { io, calls } = authedIo([
      { status: 200, body: { enabled: true } },
      { status: 200, body: { enabled: false } },
    ]);
    expect(
      await run(io, ['agent', 'configure', 'john', '--autofix', 'true', '--recording', 'false']),
    ).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/john/autofix`);
    expect(calls[1].url).toBe(`${HOST}/api/v1/routing/john/recording`);
    expect(io.lastJson()).toMatchObject({
      autofix: { enabled: true },
      recording: { enabled: false },
    });
  });

  it('agent configure validates its input combinations', async () => {
    const { io } = authedIo([]);
    expect(await run(io, ['agent', 'configure', 'john'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'missing_flag' });

    const { io: io2 } = authedIo([]);
    // --autofix keeps the command non-empty so the tier-needs-route rule fires
    expect(
      await run(io2, ['agent', 'configure', 'john', '--tier', 'test', '--autofix', 'true']),
    ).toBe(1);
    expect((io2.lastJson() as { message: string }).message).toContain('--tier needs');

    const { io: io3 } = authedIo([]);
    expect(
      await run(io3, ['agent', 'configure', 'john', '--models', ' , ', '--provider', 'x']),
    ).toBe(1);
    expect(io3.lastJson()).toMatchObject({ error: 'missing_flag' });
  });

  it('the deprecated complexity-tier commands are gone', async () => {
    const { io } = authedIo([]);
    expect(await run(io, ['routing', 'tier', 'set', 'john', '--tier', 'simple'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'unknown_command' });
    const { io: io2 } = authedIo([]);
    expect(await run(io2, ['routing', 'tiers', 'john'])).toBe(1);
    expect(io2.lastJson()).toMatchObject({ error: 'unknown_command' });
  });

  it('fallbacks get/clear target the default route (writes live in agent configure)', async () => {
    const { io, calls } = authedIo([{ status: 200, body: {} }]);
    expect(await run(io, ['routing', 'fallbacks', 'get', 'john'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/john/tiers/default/fallbacks`);

    const { io: io2 } = authedIo([{ status: 200, body: {} }]);
    expect(await run(io2, ['routing', 'fallbacks', 'clear', 'john'])).toBe(1); // no --yes
    const { io: io3, calls: calls3 } = authedIo([{ status: 200, body: {} }]);
    expect(await run(io3, ['routing', 'fallbacks', 'clear', 'john', '--yes'])).toBe(0);
    expect(calls3[0].url).toBe(`${HOST}/api/v1/routing/john/tiers/default/fallbacks`);

    const { io: io4 } = authedIo([]);
    expect(await run(io4, ['routing', 'fallbacks', 'set', 'john', '--models', 'a'])).toBe(1);
    expect(io4.lastJson()).toMatchObject({ error: 'unknown_command' });
  });

  it('custom create makes the tier, routes it, and sets fallbacks', async () => {
    const { io, calls } = authedIo([
      { status: 201, body: { id: 'ht-1', name: 'test' } },
      { status: 200, body: { ok: true } },
      { status: 200, body: { models: ['fb-1'] } },
    ]);
    expect(
      await run(io, [
        'routing',
        'custom',
        'create',
        'john',
        '--name',
        'test',
        '--model',
        'grok-4.5',
        '--provider',
        'xai',
        '--fallbacks',
        'fb-1',
      ]),
    ).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/john/header-tiers`);
    expect(JSON.parse(calls[0].body!)).toEqual({
      name: 'test',
      header_key: 'x-manifest-tier',
      header_value: 'test',
      badge_color: 'indigo',
    });
    expect(calls[1].url).toBe(`${HOST}/api/v1/routing/john/header-tiers/ht-1/override`);
    expect(JSON.parse(calls[1].body!)).toEqual({
      model: 'grok-4.5',
      provider: 'xai',
      authType: 'api_key',
    });
    expect(calls[2].url).toBe(`${HOST}/api/v1/routing/john/header-tiers/ht-1/fallbacks`);
    expect(io.lastJson()).toMatchObject({ agent: 'john', tier: { id: 'ht-1' } });
  });

  it('custom create rejects an empty --fallbacks list', async () => {
    const { io } = authedIo([
      { status: 201, body: { id: 'ht-x' } },
      { status: 200, body: {} },
    ]);
    expect(
      await run(io, [
        'routing',
        'custom',
        'create',
        'john',
        '--name',
        'x',
        '--model',
        'm',
        '--provider',
        'p',
        '--fallbacks',
        ' , ',
      ]),
    ).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'missing_flag' });
  });

  it('custom create honors custom header key/value', async () => {
    const { io, calls } = authedIo([
      { status: 201, body: { id: 'ht-2' } },
      { status: 200, body: { ok: true } },
    ]);
    expect(
      await run(io, [
        'routing',
        'custom',
        'create',
        'john',
        '--name',
        'heavy',
        '--model',
        'm',
        '--provider',
        'openai',
        '--header-key',
        'x-task',
        '--header-value',
        'big',
      ]),
    ).toBe(0);
    expect(JSON.parse(calls[0].body!)).toMatchObject({ header_key: 'x-task', header_value: 'big' });
  });

  it('custom list and delete resolve tiers by name', async () => {
    const { io, calls } = authedIo([{ status: 200, body: [{ id: 'ht-1', name: 'test' }] }]);
    expect(await run(io, ['routing', 'custom', 'list', 'john'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/john/header-tiers`);

    const { io: io2, calls: calls2 } = authedIo([
      { status: 200, body: [{ id: 'ht-1', name: 'Test' }] },
      { status: 200, body: { ok: true } },
    ]);
    expect(await run(io2, ['routing', 'custom', 'delete', 'john', 'test', '--yes'])).toBe(0);
    expect(calls2[1].url).toBe(`${HOST}/api/v1/routing/john/header-tiers/ht-1`);

    const { io: io3 } = authedIo([{ status: 200, body: [] }]);
    expect(await run(io3, ['routing', 'custom', 'delete', 'john', 'ghost', '--yes'])).toBe(1);
    expect(io3.lastJson()).toMatchObject({ error: 'not_found' });
  });

  it('autofix and recording get/set wrap GET/PATCH with a strict boolean', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { enabled: true } }]);
    expect(await run(io, ['routing', 'autofix', 'get', 'a'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/routing/a/autofix`);

    const { io: io2, calls: calls2 } = authedIo([{ status: 200, body: { enabled: false } }]);
    expect(await run(io2, ['routing', 'recording', 'set', 'a', '--enabled', 'false'])).toBe(0);
    expect(JSON.parse(calls2[0].body!)).toEqual({ enabled: false });

    const { io: io3 } = authedIo([]);
    expect(await run(io3, ['routing', 'autofix', 'set', 'a', '--enabled', 'maybe'])).toBe(1);
  });
});
