import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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

  it('setModelParams PUTs the full route identity + params payload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{}'),
    } as Response);
    await setModelParams('demo', {
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
      params: { thinking: { type: 'disabled' } },
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/v1/routing/demo/model-params');
    expect((init as RequestInit).method).toBe('PUT');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
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
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
    });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).method).toBe('DELETE');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
    });
  });

  describe('modelParamsKey', () => {
    it('lowercases the provider so case differences between save and lookup do not break the index', () => {
      expect(modelParamsKey('DeepSeek', 'api_key', 'deepseek-v4')).toBe(
        'deepseek::api_key::deepseek-v4',
      );
    });

    it('keeps auth_type and model verbatim (case-sensitive on those segments)', () => {
      expect(modelParamsKey('openai', 'subscription', 'gpt-4o')).toBe(
        'openai::subscription::gpt-4o',
      );
    });
  });
});
