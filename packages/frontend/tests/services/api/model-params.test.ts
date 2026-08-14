import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getModelParamSpecs,
  listModelParamSpecIndex,
  listModelParams,
  setModelParams,
  deleteModelParams,
  modelParamsKey,
} from '../../../src/services/api/model-params';

describe('model-params API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listModelParams GETs the route-scoped list', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as unknown as Response);
    await listModelParams('demo');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/routing/demo/model-params'),
      expect.anything(),
    );
  });

  it('getModelParamSpecs GETs the by-model specs with URL-encoded query params', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as unknown as Response);
    await getModelParamSpecs('demo', 'anthropic', 'api_key', 'anthropic/claude-opus-4-7');
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/routing/demo/model-param-specs/by-model');
    expect(String(url)).toContain('provider=anthropic');
    expect(String(url)).toContain('authType=api_key');
    // Model names contain slashes, so they must be encoded in the query string.
    expect(String(url)).toContain('model=anthropic%2Fclaude-opus-4-7');
  });

  it('does not cache model specs in the frontend client', async () => {
    const specs = [{ path: 'reasoning.effort', type: 'enum' }];
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(specs),
    } as unknown as Response);

    const first = await getModelParamSpecs('demo', 'copilot', 'subscription', 'copilot/gpt-5.5');
    const second = await getModelParamSpecs('demo', 'Copilot', 'subscription', 'copilot/gpt-5.5');

    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache failed model spec lookups', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve('temporary outage'),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      } as unknown as Response);

    await expect(
      getModelParamSpecs('demo', 'copilot', 'subscription', 'copilot/gpt-5.5'),
    ).rejects.toThrow('temporary outage');
    await expect(
      getModelParamSpecs('demo', 'copilot', 'subscription', 'copilot/gpt-5.5'),
    ).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('listModelParamSpecIndex GETs the spec identity index', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as unknown as Response);
    await listModelParamSpecIndex('demo');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/routing/demo/model-param-specs/index'),
      expect.anything(),
    );
  });

  it('setModelParams PUTs the full route identity + params payload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{}'),
    } as Response);
    await setModelParams('demo', {
      scope: 'tier:default',
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
      params: { thinking: { type: 'disabled' } },
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/v1/routing/demo/model-params');
    expect((init as RequestInit).method).toBe('PUT');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      scope: 'tier:default',
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
      params: { thinking: { type: 'disabled' } },
    });
  });

  it('deleteModelParams DELETEs with the route identity in the body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"ok":true}'),
    } as Response);
    await deleteModelParams('demo', {
      scope: 'tier:default',
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
    });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).method).toBe('DELETE');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      scope: 'tier:default',
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
    });
  });

  describe('modelParamsKey', () => {
    it('lowercases the provider so case differences between save and lookup do not break the index', () => {
      expect(modelParamsKey('tier:default', 'DeepSeek', 'api_key', 'deepseek-v4')).toBe(
        'tier:default::deepseek::deepseek-v4::api_key',
      );
    });

    it('keeps auth_type and model verbatim (case-sensitive on those segments)', () => {
      expect(modelParamsKey('specificity:coding', 'openai', 'subscription', 'gpt-4o')).toBe(
        'specificity:coding::openai::gpt-4o::subscription',
      );
    });
  });
});
