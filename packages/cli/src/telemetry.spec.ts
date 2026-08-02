import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_TELEMETRY_ENDPOINT, reportUsage, telemetryAnonId } from './telemetry';
import { makeIo } from '../test/helpers';

describe('telemetry', () => {
  it('mints a persistent anon id (0600) and reuses it', () => {
    const io = makeIo();
    const first = telemetryAnonId(io);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    const idPath = path.join(io.configDir, 'manifest', 'telemetry-id');
    expect(fs.statSync(idPath).mode & 0o777).toBe(0o600);
    expect(telemetryAnonId(io)).toBe(first);
  });

  it('sends command key, version, os — and nothing resembling arguments', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const io = makeIo({
      env: { MANIFEST_TELEMETRY_DISABLED: '0' },
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body) });
        return new Response('{}', { status: 202 });
      }) as typeof fetch,
    });
    await reportUsage(io, 'agent create', true, 123);
    expect(calls[0].url).toBe(DEFAULT_TELEMETRY_ENDPOINT);
    const body = JSON.parse(calls[0].body);
    expect(body).toEqual({
      schema_version: 1,
      anon_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      cli_version: expect.any(String),
      command: 'agent create',
      ok: true,
      duration_ms: 123,
      os: expect.any(String),
    });
  });

  it('honors MANIFEST_TELEMETRY_DISABLED and a custom endpoint', async () => {
    const calls: string[] = [];
    const impl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response('{}', { status: 202 });
    }) as typeof fetch;

    const off = makeIo({ env: { MANIFEST_TELEMETRY_DISABLED: '1' }, fetchImpl: impl });
    await reportUsage(off, 'whoami', true, 1);
    expect(calls).toHaveLength(0);

    const custom = makeIo({
      env: {
        MANIFEST_TELEMETRY_DISABLED: '0',
        MANIFEST_CLI_TELEMETRY_ENDPOINT: 'http://peacock.local/v1/cli-event',
      },
      fetchImpl: impl,
    });
    await reportUsage(custom, 'whoami', true, 1);
    expect(calls[0]).toBe('http://peacock.local/v1/cli-event');
  });

  it('swallows transport failures and clamps duration', async () => {
    const bodies: string[] = [];
    const io = makeIo({
      env: { MANIFEST_TELEMETRY_DISABLED: '0' },
      fetchImpl: (async (_u: string | URL | Request, init?: RequestInit) => {
        bodies.push(String(init?.body));
        throw new Error('ECONNREFUSED');
      }) as typeof fetch,
    });
    await expect(reportUsage(io, 'login', false, 9_999_999)).resolves.toBeUndefined();
    expect(JSON.parse(bodies[0]).duration_ms).toBe(600000);
  });
});
