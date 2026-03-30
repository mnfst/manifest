import { extractFamily, filterBySubscriptionAccess } from './anthropic-subscription-probe';
import { DiscoveredModel } from './model-fetcher';

function makeModel(id: string): DiscoveredModel {
  return {
    id,
    displayName: id,
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
  };
}

describe('extractFamily', () => {
  it('extracts "sonnet" from claude-sonnet-4-6', () => {
    expect(extractFamily('claude-sonnet-4-6')).toBe('sonnet');
  });

  it('extracts "opus" from claude-opus-4-6', () => {
    expect(extractFamily('claude-opus-4-6')).toBe('opus');
  });

  it('extracts "haiku" from claude-haiku-4-5-20251001', () => {
    expect(extractFamily('claude-haiku-4-5-20251001')).toBe('haiku');
  });

  it('extracts "haiku" from claude-3-haiku-20240307 (legacy naming)', () => {
    expect(extractFamily('claude-3-haiku-20240307')).toBe('haiku');
  });

  it('extracts "opus" from claude-opus-4-5-20251101', () => {
    expect(extractFamily('claude-opus-4-5-20251101')).toBe('opus');
  });

  it('extracts "sonnet" from claude-sonnet-4-20250514', () => {
    expect(extractFamily('claude-sonnet-4-20250514')).toBe('sonnet');
  });

  it('returns null for non-Claude model IDs', () => {
    expect(extractFamily('gpt-4o')).toBeNull();
    expect(extractFamily('gemini-2.5-flash')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractFamily('')).toBeNull();
  });
});

describe('filterBySubscriptionAccess', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchResponses(accessMap: Record<string, boolean>): void {
    global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      const model = body.model as string;
      const family = extractFamily(model);
      const accessible = family ? (accessMap[family] ?? true) : true;

      if (accessible) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              type: 'message',
              content: [{ type: 'text', text: '.' }],
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            type: 'error',
            error: { type: 'invalid_request_error', message: 'Error' },
          }),
      });
    });
  }

  it('keeps all models when all families are accessible', async () => {
    mockFetchResponses({ haiku: true, sonnet: true, opus: true });

    const models = [
      makeModel('claude-haiku-4-5-20251001'),
      makeModel('claude-sonnet-4-6'),
      makeModel('claude-opus-4-6'),
    ];
    const result = await filterBySubscriptionAccess(models, 'test-key');
    expect(result.map((m) => m.id)).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
    ]);
  });

  it('removes sonnet and opus when only haiku is accessible (Pro plan)', async () => {
    mockFetchResponses({ haiku: true, sonnet: false, opus: false });

    const models = [
      makeModel('claude-haiku-4-5-20251001'),
      makeModel('claude-3-haiku-20240307'),
      makeModel('claude-sonnet-4-6'),
      makeModel('claude-sonnet-4-5-20250929'),
      makeModel('claude-opus-4-6'),
      makeModel('claude-opus-4-5-20251101'),
    ];
    const result = await filterBySubscriptionAccess(models, 'test-key');
    expect(result.map((m) => m.id)).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-3-haiku-20240307',
    ]);
  });

  it('removes only opus when haiku and sonnet are accessible (Team plan)', async () => {
    mockFetchResponses({ haiku: true, sonnet: true, opus: false });

    const models = [
      makeModel('claude-haiku-4-5-20251001'),
      makeModel('claude-sonnet-4-6'),
      makeModel('claude-opus-4-6'),
    ];
    const result = await filterBySubscriptionAccess(models, 'test-key');
    expect(result.map((m) => m.id)).toEqual(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6']);
  });

  it('probes exactly one model per family', async () => {
    mockFetchResponses({ haiku: true, sonnet: true, opus: true });

    const models = [
      makeModel('claude-haiku-4-5-20251001'),
      makeModel('claude-3-haiku-20240307'),
      makeModel('claude-sonnet-4-6'),
      makeModel('claude-sonnet-4-5-20250929'),
      makeModel('claude-opus-4-6'),
      makeModel('claude-opus-4-5-20251101'),
    ];
    await filterBySubscriptionAccess(models, 'test-key');
    // 3 families = 3 probe calls
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('keeps models with no extractable family', async () => {
    mockFetchResponses({ haiku: true });

    const models = [makeModel('claude-haiku-4-5-20251001'), makeModel('some-unknown-model')];
    const result = await filterBySubscriptionAccess(models, 'test-key');
    expect(result.map((m) => m.id)).toEqual(['claude-haiku-4-5-20251001', 'some-unknown-model']);
  });

  it('keeps models on network/timeout errors (non-deterministic failures)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    const models = [makeModel('claude-sonnet-4-6'), makeModel('claude-opus-4-6')];
    const result = await filterBySubscriptionAccess(models, 'test-key');
    expect(result).toHaveLength(2);
  });

  it('keeps models on non-400 errors like 429 rate limit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const models = [makeModel('claude-sonnet-4-6'), makeModel('claude-opus-4-6')];
    const result = await filterBySubscriptionAccess(models, 'test-key');
    expect(result).toHaveLength(2);
  });

  it('sends correct headers for subscription auth', async () => {
    mockFetchResponses({ haiku: true });

    await filterBySubscriptionAccess([makeModel('claude-haiku-4-5-20251001')], 'my-token');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'oauth-2025-04-20',
        }),
      }),
    );
  });

  it('sends max_tokens: 1 to minimize cost', async () => {
    mockFetchResponses({ haiku: true });

    await filterBySubscriptionAccess([makeModel('claude-haiku-4-5-20251001')], 'my-token');

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.max_tokens).toBe(1);
  });

  it('returns empty array for empty input', async () => {
    const spy = jest.fn();
    global.fetch = spy;
    const result = await filterBySubscriptionAccess([], 'test-key');
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
