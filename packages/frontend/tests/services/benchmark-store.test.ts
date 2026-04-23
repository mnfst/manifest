import { describe, it, expect, vi, beforeEach } from 'vitest';

const runBenchmarkMock = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  runBenchmark: (...args: unknown[]) => runBenchmarkMock(...args),
}));

import { createBenchmarkStore } from '../../src/services/benchmark-store';
import type { AvailableModel, RoutingProvider } from '../../src/services/api';

function buildModel(overrides: Partial<AvailableModel> = {}): AvailableModel {
  return {
    model_name: 'openai/gpt-4o-mini',
    provider: 'openai',
    auth_type: 'api_key',
    input_price_per_token: 0.00000015,
    output_price_per_token: 0.0000006,
    context_window: 128_000,
    capability_reasoning: false,
    capability_code: true,
    quality_score: 2,
    display_name: 'GPT-4o Mini',
    provider_display_name: 'OpenAI',
    ...overrides,
  };
}

function buildProvider(overrides: Partial<RoutingProvider> = {}): RoutingProvider {
  return {
    id: 'p1',
    provider: 'openai',
    auth_type: 'api_key',
    is_active: true,
    has_api_key: true,
    connected_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('createBenchmarkStore', () => {
  beforeEach(() => {
    runBenchmarkMock.mockReset();
  });

  describe('pickDefaults', () => {
    it('picks two models from two different providers when available', () => {
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'anthropic/claude-sonnet-4', provider: 'anthropic' }),
        ],
        [
          buildProvider({ provider: 'openai' }),
          buildProvider({ id: 'p2', provider: 'anthropic' }),
        ],
      );
      expect(store.columns).toHaveLength(2);
      const providers = new Set(store.columns.map((c) => c.provider));
      expect(providers.size).toBe(2);
    });

    it('falls back to two models from the same provider when only one is connected', () => {
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o', display_name: 'GPT-4o' }),
          buildModel({ model_name: 'openai/gpt-4o-mini', display_name: 'GPT-4o Mini' }),
        ],
        [buildProvider({ provider: 'openai' })],
      );
      expect(store.columns).toHaveLength(2);
      expect(new Set(store.columns.map((c) => c.provider))).toEqual(new Set(['openai']));
    });

    it('picks nothing when no providers are connected', () => {
      const store = createBenchmarkStore('demo');
      store.pickDefaults([buildModel()], []);
      expect(store.columns).toHaveLength(0);
    });

    it('does not overwrite columns the user already added', () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      store.pickDefaults([buildModel()], [buildProvider({ provider: 'openai' })]);
      expect(store.columns).toHaveLength(1);
    });
  });

  describe('runAll', () => {
    it('sets success/error status per column and leaves successful columns intact when others fail', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'Claude Sonnet 4');
      store.setPrompt('hi');

      runBenchmarkMock.mockImplementation((req: { provider: string }) => {
        if (req.provider === 'openai') {
          return Promise.resolve({
            content: 'hello',
            metrics: { cost: 0.001, inputTokens: 5, outputTokens: 3, durationMs: 120 },
            headers: { 'x-request-id': 'abc' },
          });
        }
        return Promise.reject(new Error('anthropic provider down'));
      });

      await store.runAll();

      const [ok, err] = store.columns;
      expect(ok?.status).toBe('success');
      expect(ok?.response).toBe('hello');
      expect(ok?.metrics?.cost).toBe(0.001);
      expect(err?.status).toBe('error');
      expect(err?.error).toContain('anthropic provider down');
    });

    it('is a no-op when prompt is empty', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      await store.runAll();
      expect(runBenchmarkMock).not.toHaveBeenCalled();
    });
  });

  describe('removeColumn & replaceColumnModel', () => {
    it('removes a column by id', () => {
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'anthropic/claude-sonnet-4', provider: 'anthropic' }),
        ],
        [
          buildProvider({ provider: 'openai' }),
          buildProvider({ id: 'p2', provider: 'anthropic' }),
        ],
      );
      const id = store.columns[0]!.id;
      store.removeColumn(id);
      expect(store.columns).toHaveLength(1);
    });

    it('replaces a column model and resets its state', () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o', 'openai', 'api_key', 'GPT-4o');
      const id = store.columns[0]!.id;
      store.replaceColumnModel(id, 'openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      expect(store.columns[0]!.model).toBe('openai/gpt-4o-mini');
      expect(store.columns[0]!.status).toBe('idle');
    });
  });

  describe('retryColumn', () => {
    it('re-runs a single column with the latest prompt + headers', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hello');
      runBenchmarkMock.mockResolvedValueOnce({
        content: 'first',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      await store.runAll();
      runBenchmarkMock.mockClear();

      runBenchmarkMock.mockResolvedValueOnce({
        content: 'retry',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      const id = store.columns[0]!.id;
      await store.retryColumn(id, { requestHeaders: { 'X-Title': 'r' } });
      expect(runBenchmarkMock).toHaveBeenCalledTimes(1);
      expect((runBenchmarkMock.mock.calls[0][0] as { requestHeaders: unknown }).requestHeaders).toEqual({
        'X-Title': 'r',
      });
    });

    it('is a no-op when retrying with no prompt at all', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      await store.retryColumn(store.columns[0]!.id);
      expect(runBenchmarkMock).not.toHaveBeenCalled();
    });

    it('falls back to the last submitted prompt when the textarea is cleared', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('original');
      runBenchmarkMock.mockResolvedValue({
        content: 'ok',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      await store.runAll();
      runBenchmarkMock.mockClear();
      store.setPrompt('');
      const id = store.columns[0]!.id;
      await store.retryColumn(id);
      expect(runBenchmarkMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('pickDefaults edge cases', () => {
    it('caps the pair at two when multiple models exist per provider', () => {
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o', provider: 'openai' }),
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'openai/o1', provider: 'openai' }),
        ],
        [buildProvider({ provider: 'openai' })],
      );
      expect(store.columns.length).toBeLessThanOrEqual(2);
    });

    it('still picks two when every model in the pool is free', () => {
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({
            model_name: 'openai/gpt-free',
            provider: 'openai',
            input_price_per_token: 0,
            output_price_per_token: 0,
          }),
          buildModel({
            model_name: 'anthropic/free-haiku',
            provider: 'anthropic',
            input_price_per_token: 0,
            output_price_per_token: 0,
          }),
        ],
        [
          buildProvider({ provider: 'openai' }),
          buildProvider({ id: 'p2', provider: 'anthropic' }),
        ],
      );
      expect(store.columns).toHaveLength(2);
    });
  });

  describe('prompt recall', () => {
    it('recalls the last submitted prompt when requested', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      runBenchmarkMock.mockResolvedValue({
        content: 'ok',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      store.setPrompt('first prompt');
      await store.runAll();
      store.setPrompt('');
      store.recallPreviousPrompt();
      expect(store.prompt()).toBe('first prompt');
    });
  });

  describe('requestHeaders propagation', () => {
    it('passes requestHeaders to every column when runAll is called with them', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'B');
      runBenchmarkMock.mockResolvedValue({
        content: 'ok',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      store.setPrompt('hi');

      await store.runAll({ requestHeaders: { 'HTTP-Referer': 'https://x.com' } });

      const headersPerCall = runBenchmarkMock.mock.calls.map(
        (c) => (c[0] as { requestHeaders?: Record<string, string> }).requestHeaders,
      );
      expect(headersPerCall).toEqual([
        { 'HTTP-Referer': 'https://x.com' },
        { 'HTTP-Referer': 'https://x.com' },
      ]);
    });

    it('omits requestHeaders from the payload when the map is empty', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      runBenchmarkMock.mockResolvedValue({
        content: 'ok',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      store.setPrompt('hi');
      await store.runAll({ requestHeaders: {} });
      const call = runBenchmarkMock.mock.calls[0][0] as Record<string, unknown>;
      expect(call.requestHeaders).toBeUndefined();
    });
  });

  describe('runId propagation', () => {
    it('passes the same runId and distinct positions to every column in a single runAll', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'B');
      runBenchmarkMock.mockResolvedValue({
        content: 'ok',
        metrics: { cost: 0.0001, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      store.setPrompt('hi');
      await store.runAll();

      const calls = runBenchmarkMock.mock.calls.map((c) => c[0]) as Array<{
        runId: string;
        position: number;
      }>;
      expect(calls).toHaveLength(2);
      expect(calls[0].runId).toBe(calls[1].runId);
      expect(typeof calls[0].runId).toBe('string');
      expect(calls[0].runId.length).toBeGreaterThan(0);
      expect(new Set(calls.map((c) => c.position))).toEqual(new Set([0, 1]));
    });
  });

  describe('recording replay mode', () => {
    it('loadRecording pins an Original column, sets the prompt, and exposes the replay source', () => {
      const store = createBenchmarkStore('demo');
      store.loadRecording(
        {
          messageId: 'msg-1',
          prompt: 'original prompt',
          recordedAt: '2026-04-23T10:00:00Z',
          requestBody: { messages: [{ role: 'user', content: 'original prompt' }], temperature: 0 },
        },
        {
          id: 'orig-msg-1',
          model: 'openai/gpt-4o',
          provider: 'openai',
          authType: 'api_key',
          displayName: 'GPT-4o',
          status: 'success',
          response: 'original reply',
          metrics: { cost: 0.01, inputTokens: 10, outputTokens: 5, durationMs: 200 },
          headers: { 'x-rid': 'abc' },
        },
      );
      expect(store.columns).toHaveLength(1);
      expect(store.columns[0]!.isOriginal).toBe(true);
      expect(store.prompt()).toBe('original prompt');
      expect(store.replaySource()?.messageId).toBe('msg-1');
    });

    it('runAll forwards the recorded requestBody to every non-original column', async () => {
      const store = createBenchmarkStore('demo');
      store.loadRecording(
        {
          messageId: 'msg-1',
          prompt: 'p',
          recordedAt: '2026-04-23T10:00:00Z',
          requestBody: { messages: [{ role: 'user', content: 'p' }], temperature: 0.3 },
        },
        {
          id: 'orig-msg-1',
          model: 'openai/gpt-4o',
          provider: 'openai',
          authType: 'api_key',
          displayName: 'GPT-4o',
          status: 'success',
          response: 'r',
          metrics: { cost: 0.01, inputTokens: 10, outputTokens: 5, durationMs: 200 },
        },
      );
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'Claude');
      runBenchmarkMock.mockResolvedValue({
        content: 'ok',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });

      await store.runAll();

      expect(runBenchmarkMock).toHaveBeenCalledTimes(1);
      const call = runBenchmarkMock.mock.calls[0][0] as { rawRequestBody?: unknown; model: string };
      expect(call.model).toBe('anthropic/claude-sonnet-4');
      expect(call.rawRequestBody).toEqual({
        messages: [{ role: 'user', content: 'p' }],
        temperature: 0.3,
      });
    });

    it('exitRecordingMode drops the Original column, clears the source, and resets the prompt', () => {
      const store = createBenchmarkStore('demo');
      store.loadRecording(
        {
          messageId: 'msg-1',
          prompt: 'p',
          recordedAt: '2026-04-23T10:00:00Z',
          requestBody: { messages: [] },
        },
        {
          id: 'orig-msg-1',
          model: 'openai/gpt-4o',
          provider: 'openai',
          authType: 'api_key',
          displayName: 'GPT-4o',
          status: 'success',
          metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        },
      );
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'Claude');
      expect(store.columns).toHaveLength(2);

      store.exitRecordingMode();

      expect(store.replaySource()).toBeNull();
      expect(store.columns.find((c) => c.isOriginal)).toBeUndefined();
      expect(store.prompt()).toBe('');
      expect(store.columns.some((c) => c.model === 'anthropic/claude-sonnet-4')).toBe(true);
    });
  });

  describe('loadHistoryRun', () => {
    it('replaces columns and prompt with the historical run data', () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'current');
      store.loadHistoryRun({
        id: 'r-1',
        prompt: 'restored prompt',
        createdAt: new Date().toISOString(),
        modelCount: 2,
        models: ['GPT-4o', 'Claude'],
        columns: [
          {
            id: 'c1',
            model: 'openai/gpt-4o',
            provider: 'openai',
            authType: 'api_key',
            displayName: 'GPT-4o',
            status: 'success',
            content: 'hello',
            headers: { 'x-request-id': 'abc' },
            errorMessage: null,
            metrics: { cost: 0.001, inputTokens: 10, outputTokens: 5, durationMs: 200 },
            position: 0,
          },
          {
            id: 'c2',
            model: 'anthropic/claude',
            provider: 'anthropic',
            authType: 'api_key',
            displayName: 'Claude',
            status: 'error',
            content: null,
            headers: null,
            errorMessage: 'rate limited',
            metrics: null,
            position: 1,
          },
        ],
      });
      expect(store.columns).toHaveLength(2);
      expect(store.columns[0]!.model).toBe('openai/gpt-4o');
      expect(store.columns[0]!.response).toBe('hello');
      expect(store.columns[0]!.metrics?.cost).toBe(0.001);
      expect(store.columns[1]!.status).toBe('error');
      expect(store.columns[1]!.error).toBe('rate limited');
      expect(store.prompt()).toBe('restored prompt');
    });
  });
});
