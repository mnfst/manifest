import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveKeyRules, listKeyRules, type KeyRotationRuleInput } from '../../../src/services/api/key-rules';

vi.mock('../../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

function setupFetch(response: unknown = {}, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function rule(overrides: Partial<KeyRotationRuleInput> = {}): KeyRotationRuleInput {
  return {
    id: 'client-generated-uuid',
    model: 'gemini-2.5-pro',
    provider: 'gemini',
    scope: 'model',
    keyOrder: ['Key 1', 'Key 2'],
    ...overrides,
  };
}

describe('key-rules API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('PUTs to the per-agent key-rules endpoint', async () => {
    const fetchMock = setupFetch({ rules: [rule()] });
    await saveKeyRules('demo', [rule()]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/routing/demo/key-rules');
    expect((init as RequestInit).method).toBe('PUT');
  });

  it('strips the local id from the wire payload (backend forbids unknown fields)', async () => {
    const fetchMock = setupFetch({ rules: [] });
    await saveKeyRules('demo', [
      rule(),
      rule({ id: undefined, scope: 'provider', model: null, provider: 'openai' }),
    ]);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.rules).toHaveLength(2);
    for (const entry of body.rules) {
      expect(entry).not.toHaveProperty('id');
      expect(entry).not.toHaveProperty('agentId');
    }
    expect(body.rules[0]).toEqual({
      model: 'gemini-2.5-pro',
      provider: 'gemini',
      scope: 'model',
      keyOrder: ['Key 1', 'Key 2'],
    });
    expect(body.rules[1]).toEqual({
      model: null,
      provider: 'openai',
      scope: 'provider',
      keyOrder: ['Key 1', 'Key 2'],
    });
  });

  it('GETs the rule list', async () => {
    const fetchMock = setupFetch({ rules: [rule({ id: 'server-id' })] });
    const out = await listKeyRules('demo');
    expect(out.rules[0]!.id).toBe('server-id');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/routing/demo/key-rules');
  });
});
