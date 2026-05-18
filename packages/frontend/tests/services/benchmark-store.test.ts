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

    it('includes the native model when picking across native and aggregator-proxy providers', () => {
      // User has openai (native) and ollama-cloud (aggregator catalog with
      // gemini-/glm-/gpt-oss proxies). The cross-provider pick should land
      // on one openai native and one ollama-cloud entry (the second pick's
      // bucket has only proxies, which is fine — user opted into ollama-cloud).
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'gemini-3-flash-preview', provider: 'ollama-cloud' }),
          buildModel({ model_name: 'glm-5.1', provider: 'ollama-cloud' }),
        ],
        [
          buildProvider({ provider: 'openai' }),
          buildProvider({ id: 'p2', provider: 'ollama-cloud', auth_type: 'subscription' }),
        ],
      );
      expect(store.columns).toHaveLength(2);
      expect(store.columns.some((c) => c.model.startsWith('openai/'))).toBe(true);
    });

    it('picks the openai-native model over proxy-branded siblings when both are served by openai', () => {
      // Pathological: an openai-connected catalog somehow includes a model
      // whose prefix belongs to another vendor. The pick should prefer the
      // native openai/gpt-4o-mini, not the openai-labeled gemini-* imposter.
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'gemini-imposter', provider: 'openai' }),
        ],
        [buildProvider({ provider: 'openai' })],
      );
      // Two models from one provider — picker should take both.
      expect(store.columns).toHaveLength(2);
      // Order should put the native first (gpt-4o-mini) before the proxied one.
      expect(store.columns[0]!.model).toBe('openai/gpt-4o-mini');
    });

    it('falls back to aggregator-proxied models when the user only has an aggregator connected', () => {
      const store = createBenchmarkStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'gemini-3-flash-preview', provider: 'ollama-cloud' }),
          buildModel({ model_name: 'glm-5.1', provider: 'ollama-cloud' }),
        ],
        [buildProvider({ provider: 'ollama-cloud', auth_type: 'subscription' })],
      );
      expect(store.columns).toHaveLength(2);
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

    it('falls back to an RFC4122-v4 id when crypto.randomUUID is unavailable', async () => {
      // Stub crypto without randomUUID so newRunId() takes the manual path.
      vi.stubGlobal('crypto', {});
      try {
        const store = createBenchmarkStore('demo');
        store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
        runBenchmarkMock.mockResolvedValue({
          content: 'ok',
          metrics: { cost: 0.0001, inputTokens: 1, outputTokens: 1, durationMs: 10 },
          headers: {},
        });
        store.setPrompt('hi');
        await store.runAll();

        const { runId } = runBenchmarkMock.mock.calls[0]![0] as { runId: string };
        expect(runId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('isAnyRunning', () => {
    it('is false with idle columns and true while a column is loading', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      expect(store.isAnyRunning()).toBe(false);

      let release!: () => void;
      runBenchmarkMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            release = () =>
              resolve({
                content: 'ok',
                metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 1 },
                headers: {},
              });
          }),
      );
      store.setPrompt('hi');
      const done = store.runAll();
      expect(store.isAnyRunning()).toBe(true);

      release();
      await done;
      expect(store.isAnyRunning()).toBe(false);
    });
  });

  describe('cancellation', () => {
    it('cancelColumn aborts the in-flight signal and resets status to idle', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      // Resolve only when the signal fires AbortError; if signal is already
      // aborted at call time, we reject immediately.
      let capturedSignal: AbortSignal | undefined;
      runBenchmarkMock.mockImplementation(
        (_req: unknown, init: { signal?: AbortSignal } | undefined) => {
          capturedSignal = init?.signal;
          return new Promise((_, reject) => {
            const onAbort = () => reject(new DOMException('aborted', 'AbortError'));
            if (init?.signal?.aborted) onAbort();
            else init?.signal?.addEventListener('abort', onAbort);
          });
        },
      );

      const colId = store.columns[0]!.id;
      const runPromise = store.runAll();
      // Let the synchronous setup land, then cancel.
      await Promise.resolve();
      store.cancelColumn(colId);

      await runPromise;
      expect(capturedSignal?.aborted).toBe(true);
      expect(store.columns[0]!.status).toBe('idle');
      // AbortError must NOT paint an error message.
      expect(store.columns[0]!.error).toBeUndefined();
    });

    it('cancelAll aborts every in-flight column at once', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('a', 'openai', 'api_key', 'A');
      store.addColumn('b', 'anthropic', 'api_key', 'B');
      store.setPrompt('hi');

      const signals: AbortSignal[] = [];
      runBenchmarkMock.mockImplementation(
        (_req: unknown, init: { signal?: AbortSignal } | undefined) => {
          if (init?.signal) signals.push(init.signal);
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          });
        },
      );

      const runPromise = store.runAll();
      await Promise.resolve();
      store.cancelAll();
      await runPromise;

      expect(signals.length).toBe(2);
      expect(signals.every((s) => s.aborted)).toBe(true);
      expect(store.columns.every((c) => c.status === 'idle')).toBe(true);
    });

    it('removeColumn aborts any in-flight request for that column without painting an error', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let captured: AbortSignal | undefined;
      runBenchmarkMock.mockImplementation(
        (_req: unknown, init: { signal?: AbortSignal } | undefined) => {
          captured = init?.signal;
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          });
        },
      );

      const colId = store.columns[0]!.id;
      const runPromise = store.runAll();
      await Promise.resolve();
      store.removeColumn(colId);
      await runPromise;

      expect(captured?.aborted).toBe(true);
      // Column is gone — there is no error to paint.
      expect(store.columns).toHaveLength(0);
    });

    it('replaceColumnModel aborts any in-flight request for that column', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let captured: AbortSignal | undefined;
      runBenchmarkMock.mockImplementation(
        (_req: unknown, init: { signal?: AbortSignal } | undefined) => {
          captured = init?.signal;
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          });
        },
      );

      const colId = store.columns[0]!.id;
      const runPromise = store.runAll();
      await Promise.resolve();
      store.replaceColumnModel(colId, 'anthropic/claude-3', 'anthropic', 'api_key', 'C');
      await runPromise;

      expect(captured?.aborted).toBe(true);
      expect(store.columns[0]!.model).toBe('anthropic/claude-3');
      expect(store.columns[0]!.status).toBe('idle');
      expect(store.columns[0]!.error).toBeUndefined();
    });

    it('does not paint a stale success after the column was replaced', async () => {
      // Run #1 resolves (slowly) AFTER the column has been replaced. The
      // inflight-controller guard inside runSingle must reject the late
      // result so we don't paint over the new column state.
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let resolveFirst: ((v: unknown) => void) | null = null;
      runBenchmarkMock.mockImplementationOnce(
        () => new Promise((res) => (resolveFirst = res)),
      );
      runBenchmarkMock.mockImplementationOnce(() =>
        Promise.resolve({
          content: 'second',
          metrics: { cost: 0.001, inputTokens: 1, outputTokens: 1, durationMs: 10 },
          headers: {},
        }),
      );

      const colId = store.columns[0]!.id;
      const firstRun = store.runAll();
      await Promise.resolve();
      // Replace the column — this aborts the first call and resets state.
      store.replaceColumnModel(colId, 'anthropic/claude-3', 'anthropic', 'api_key', 'C');
      // Now resolve the first request as if the upstream finally responded.
      resolveFirst!({
        content: 'STALE',
        metrics: { cost: 0.999, inputTokens: 99, outputTokens: 99, durationMs: 999 },
        headers: { 'x-stale': 'yes' },
      });
      await firstRun;

      // Stale result must NOT have been applied.
      expect(store.columns[0]!.response).not.toBe('STALE');
      expect(store.columns[0]!.status).toBe('idle');
    });

    it('does not paint a stale error after the column was cancelled', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let rejectFirst: ((reason: unknown) => void) | null = null;
      runBenchmarkMock.mockImplementationOnce(
        () => new Promise((_, rej) => (rejectFirst = rej)),
      );

      const colId = store.columns[0]!.id;
      const firstRun = store.runAll();
      await Promise.resolve();
      store.cancelColumn(colId);
      rejectFirst!(new Error('NETWORK'));
      await firstRun;

      // The cancellation guard early-returns before painting an error state.
      expect(store.columns[0]!.error).toBeUndefined();
      expect(store.columns[0]!.status).toBe('idle');
    });

    it('loadHistoryRun cancels any in-flight requests before swapping in the loaded columns', async () => {
      const store = createBenchmarkStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let captured: AbortSignal | undefined;
      runBenchmarkMock.mockImplementation(
        (_req: unknown, init: { signal?: AbortSignal } | undefined) => {
          captured = init?.signal;
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          });
        },
      );

      const runPromise = store.runAll();
      await Promise.resolve();

      store.loadHistoryRun({
        id: 'r1',
        prompt: 'historical',
        createdAt: new Date().toISOString(),
        modelCount: 1,
        models: ['Loaded'],
        columns: [
          {
            id: 'c1',
            model: 'loaded/model',
            provider: 'openai',
            authType: 'api_key',
            displayName: 'Loaded',
            status: 'success',
            content: 'loaded-content',
            headers: null,
            errorMessage: null,
            metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 1 },
            position: 0,
          },
        ],
      });

      await runPromise;

      expect(captured?.aborted).toBe(true);
      // The history columns were applied AFTER the abort; the original
      // column's stale resolution can't paint over them.
      expect(store.columns).toHaveLength(1);
      expect(store.columns[0]!.response).toBe('loaded-content');
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
