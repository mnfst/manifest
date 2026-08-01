import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { run } from '../index';
import { fetchStub, makeIo, writeConfig } from '../../test/helpers';

const ME = { tenantId: 't1', userId: 'u1', authMethod: 'api_key' };
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

  it('login without a token source fails with the no-argv rule', async () => {
    const io = makeIo();
    expect(await run(io, ['login'])).toBe(1);
    expect(io.lastJson()).toMatchObject({ error: 'credential_source_required' });
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

  it('logout on a host with nothing stored reports loggedOut: false', async () => {
    const io = makeIo({ env: { MANIFEST_URL: HOST } });
    expect(await run(io, ['logout'])).toBe(0);
    expect(io.lastJson()).toEqual({ loggedOut: false, url: HOST });
  });

  it('logout removes only the target host credential', async () => {
    const io = makeIo();
    writeConfig(io, {
      activeHost: HOST,
      hosts: { [HOST]: { apiKey: 'a' }, 'http://other:1': { apiKey: 'b' } },
    });
    expect(await run(io, ['logout', '--url', HOST])).toBe(0);
    expect(io.lastJson()).toEqual({ loggedOut: true, url: HOST });
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
        '--category',
        'coding',
      ]),
    ).toBe(0);

    expect(JSON.parse(calls[0].body!)).toEqual({ name: 'coding', agent_category: 'coding' });
    expect(fs.readFileSync(keyFile, 'utf8')).toBe('mnfst_secret_full_key');
    expect(fs.statSync(keyFile).mode & 0o777).toBe(0o600);
    expect(io.lastJson()).toEqual({
      agent: { id: 'a1', name: 'coding' },
      keyPrefix: 'mnfst_secr',
      keyFile,
    });
    expect(io.lines.join('\n')).not.toContain('mnfst_secret_full_key');
  });

  it('agent create forwards --platform and omits absent optionals', async () => {
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

  it('agent update maps --category alone', async () => {
    const { io, calls } = authedIo([{ status: 200, body: {} }]);
    expect(await run(io, ['agent', 'update', 'a', '--category', 'coding'])).toBe(0);
    expect(JSON.parse(calls[0].body!)).toEqual({ agent_category: 'coding' });
  });

  it('agent create validates the key file before calling the API', async () => {
    const { io, calls } = authedIo([{ status: 201, body: {} }]);
    expect(
      await run(io, ['agent', 'create', '--name', 'x', '--key-file', '/nonexistent-dir-xyz/k.key']),
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
});

describe('provider commands', () => {
  it('provider list hits the tenant-level endpoint', async () => {
    const { io, calls } = authedIo([{ status: 200, body: { providers: [] } }]);
    expect(await run(io, ['provider', 'list'])).toBe(0);
    expect(calls[0].url).toBe(`${HOST}/api/v1/providers`);
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
      await run(io, ['provider', 'connect', '--provider', 'openai', '--agent', 'coding']),
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
