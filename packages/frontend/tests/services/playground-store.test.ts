import { describe, it, expect, vi, beforeEach } from 'vitest';

// streamPlayground(req, { signal, onDelta }) → Promise<PlaygroundStreamResult>
const streamPlaygroundMock = vi.fn();
const setPlaygroundRunBestMock = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  streamPlayground: (...args: unknown[]) => streamPlaygroundMock(...args),
  setPlaygroundRunBest: (...args: unknown[]) => setPlaygroundRunBestMock(...args),
}));

import {
  createPlaygroundStore,
  getOrCreatePlaygroundStore,
} from '../../src/services/playground-store';
import type { AvailableModel, RoutingProvider } from '../../src/services/api';
import type { PlaygroundColumn } from '../../src/services/playground-store';

type StreamInit = { signal?: AbortSignal; onDelta: (t: string) => void };

function okResult(over: Record<string, unknown> = {}) {
  return {
    columnId: 'db-col-1',
    content: 'hello',
    metrics: { cost: 0.001, inputTokens: 5, outputTokens: 3, durationMs: 120 },
    headers: { 'x-request-id': 'abc' },
    ...over,
  };
}

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

describe('createPlaygroundStore', () => {
  beforeEach(() => {
    streamPlaygroundMock.mockReset();
    setPlaygroundRunBestMock.mockReset();
  });

  describe('pickDefaults', () => {
    it('picks two models from two different providers when available', () => {
      const store = createPlaygroundStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'anthropic/claude-sonnet-4', provider: 'anthropic' }),
        ],
        [buildProvider({ provider: 'openai' }), buildProvider({ id: 'p2', provider: 'anthropic' })],
      );
      expect(store.columns).toHaveLength(2);
      expect(new Set(store.columns.map((c) => c.provider)).size).toBe(2);
    });

    it('falls back to two models from the same provider when only one is connected', () => {
      const store = createPlaygroundStore('demo');
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
      const store = createPlaygroundStore('demo');
      store.pickDefaults([buildModel()], []);
      expect(store.columns).toHaveLength(0);
    });

    it('picks nothing when there are no eligible models for the connected provider', () => {
      const store = createPlaygroundStore('demo');
      store.pickDefaults(
        [buildModel({ provider: 'anthropic' })],
        [buildProvider({ provider: 'openai' })],
      );
      expect(store.columns).toHaveLength(0);
    });

    it('ignores models with no auth_type', () => {
      const store = createPlaygroundStore('demo');
      store.pickDefaults(
        [buildModel({ auth_type: undefined as unknown as AvailableModel['auth_type'] })],
        [buildProvider({ provider: 'openai' })],
      );
      expect(store.columns).toHaveLength(0);
    });

    it('skips inactive connected providers', () => {
      const store = createPlaygroundStore('demo');
      store.pickDefaults([buildModel()], [buildProvider({ provider: 'openai', is_active: false })]);
      expect(store.columns).toHaveLength(0);
    });

    it('does not overwrite columns the user already added', () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      store.pickDefaults([buildModel()], [buildProvider({ provider: 'openai' })]);
      expect(store.columns).toHaveLength(1);
    });

    it('caps the pair at two when multiple models exist per provider', () => {
      const store = createPlaygroundStore('demo');
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
      const store = createPlaygroundStore('demo');
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

    it('prefers the native model first among proxy-branded siblings from the same provider', () => {
      const store = createPlaygroundStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'gemini-imposter', provider: 'openai' }),
        ],
        [buildProvider({ provider: 'openai' })],
      );
      // Two models from one provider — picker takes both (order is shuffled,
      // but the native-first ordering pool guarantees both appear).
      expect(store.columns).toHaveLength(2);
      expect(new Set(store.columns.map((c) => c.model))).toEqual(
        new Set(['openai/gpt-4o-mini', 'gemini-imposter']),
      );
    });

    it('falls back to aggregator-proxied models when only an aggregator is connected', () => {
      const store = createPlaygroundStore('demo');
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
      const store = createPlaygroundStore('demo');
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
        [buildProvider({ provider: 'openai' }), buildProvider({ id: 'p2', provider: 'anthropic' })],
      );
      expect(store.columns).toHaveLength(2);
    });
  });

  describe('runAll (streaming)', () => {
    it('appends streamed deltas to the column response and finalizes on done', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      store.setPrompt('hi');

      streamPlaygroundMock.mockImplementation(async (_req: unknown, init: StreamInit) => {
        init.onDelta('Hel');
        init.onDelta('lo');
        return okResult({ columnId: 'db-1', content: 'Hello' });
      });

      await store.runAll();

      const col = store.columns[0]!;
      expect(col.status).toBe('success');
      expect(col.response).toBe('Hello');
      expect(col.metrics?.cost).toBe(0.001);
      expect(col.headers).toEqual({ 'x-request-id': 'abc' });
      expect(col.columnDbId).toBe('db-1');
    });

    it('shows the in-progress streamed text before the done event arrives', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      store.setPrompt('hi');

      let resolveStream: ((v: unknown) => void) | null = null;
      streamPlaygroundMock.mockImplementation((_req: unknown, init: StreamInit) => {
        init.onDelta('partial ');
        init.onDelta('text');
        return new Promise((res) => (resolveStream = res));
      });

      const p = store.runAll();
      await Promise.resolve();
      // Still loading, but the deltas already painted.
      expect(store.columns[0]!.status).toBe('loading');
      expect(store.columns[0]!.response).toBe('partial text');

      resolveStream!(okResult({ content: 'partial text final' }));
      await p;
      expect(store.columns[0]!.status).toBe('success');
      expect(store.columns[0]!.response).toBe('partial text final');
    });

    it('sets success/error per column and leaves successful columns intact when others fail', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'Claude Sonnet 4');
      store.setPrompt('hi');

      streamPlaygroundMock.mockImplementation(
        async (req: { provider: string }, init: StreamInit) => {
          if (req.provider === 'openai') {
            init.onDelta('hello');
            return okResult({ content: 'hello' });
          }
          throw new Error('anthropic provider down');
        },
      );

      await store.runAll();

      const [ok, err] = store.columns;
      expect(ok?.status).toBe('success');
      expect(ok?.response).toBe('hello');
      expect(err?.status).toBe('error');
      expect(err?.error).toContain('anthropic provider down');
    });

    it('paints a generic message when the rejection is not an Error instance', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');
      streamPlaygroundMock.mockRejectedValue('weird string failure');
      await store.runAll();
      expect(store.columns[0]!.status).toBe('error');
      expect(store.columns[0]!.error).toBe('Request failed');
    });

    it('is a no-op when prompt is empty', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      const runId = store.runAll();
      expect(runId).toBeUndefined();
      expect(streamPlaygroundMock).not.toHaveBeenCalled();
    });

    it('is a no-op when there are no columns', () => {
      const store = createPlaygroundStore('demo');
      store.setPrompt('hi');
      expect(store.runAll()).toBeUndefined();
    });

    it('runAll sets a fresh run id and clears any previous best pick', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');
      streamPlaygroundMock.mockResolvedValue(okResult({ columnId: 'db-A' }));

      // First run + mark best.
      const runId = store.runAll();
      await Promise.resolve();
      await Promise.resolve();
      expect(runId).toBeTruthy();
      setPlaygroundRunBestMock.mockResolvedValue('db-A');
      await store.markBest(store.columns[0]!);
      expect(store.bestColumnId()).toBe('db-A');

      // A second runAll resets the best pick.
      store.runAll();
      expect(store.bestColumnId()).toBeNull();
    });

    it('passes the same runId and distinct positions to every column', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'B');
      streamPlaygroundMock.mockResolvedValue(okResult());
      store.setPrompt('hi');
      await store.runAll();

      const calls = streamPlaygroundMock.mock.calls.map((c) => c[0]) as Array<{
        runId: string;
        position: number;
      }>;
      expect(calls).toHaveLength(2);
      expect(calls[0].runId).toBe(calls[1].runId);
      expect(new Set(calls.map((c) => c.position))).toEqual(new Set([0, 1]));
    });

    it('does not append a late delta after the column was replaced', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let lateDelta: ((t: string) => void) | null = null;
      let resolveStream: ((v: unknown) => void) | null = null;
      streamPlaygroundMock.mockImplementationOnce((_req: unknown, init: StreamInit) => {
        lateDelta = init.onDelta;
        return new Promise((res) => (resolveStream = res));
      });
      streamPlaygroundMock.mockImplementationOnce(async () => okResult({ content: 'second' }));

      const colId = store.columns[0]!.id;
      const run = store.runAll();
      await Promise.resolve();
      // Replace the column — aborts the first stream, resets state.
      store.replaceColumnModel(colId, 'anthropic/claude-3', 'anthropic', 'api_key', 'C');
      // A late delta from the stale stream must be dropped.
      lateDelta!('STALE DELTA');
      resolveStream!(okResult({ content: 'STALE' }));
      await run;

      // The onDelta + done guards both drop the stale stream, so the
      // replaced column keeps its reset (undefined) response.
      expect(store.columns[0]!.response).toBeUndefined();
      expect(store.columns[0]!.status).toBe('idle');
    });
  });

  describe('retryColumn', () => {
    it('re-runs a single column with the latest prompt + headers', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hello');
      streamPlaygroundMock.mockResolvedValue(okResult({ content: 'first' }));
      await store.runAll();
      streamPlaygroundMock.mockClear();

      streamPlaygroundMock.mockResolvedValue(okResult({ content: 'retry' }));
      const id = store.columns[0]!.id;
      await store.retryColumn(id, { requestHeaders: { 'X-Title': 'r' } });
      expect(streamPlaygroundMock).toHaveBeenCalledTimes(1);
      expect(
        (streamPlaygroundMock.mock.calls[0][0] as { requestHeaders: unknown }).requestHeaders,
      ).toEqual({ 'X-Title': 'r' });
    });

    it('is a no-op when retrying with no prompt at all', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      await store.retryColumn(store.columns[0]!.id);
      expect(streamPlaygroundMock).not.toHaveBeenCalled();
    });

    it('returns early when the column id is unknown', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hello');
      await store.retryColumn('does-not-exist');
      // runSingle bails on the missing column, so the stream never fires.
      expect(streamPlaygroundMock).not.toHaveBeenCalled();
    });

    it('falls back to the last submitted prompt when the textarea is cleared', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('original');
      streamPlaygroundMock.mockResolvedValue(okResult({ content: 'ok' }));
      await store.runAll();
      streamPlaygroundMock.mockClear();
      store.setPrompt('');
      await store.retryColumn(store.columns[0]!.id);
      expect(streamPlaygroundMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('prompt recall', () => {
    it('recalls the last submitted prompt when requested', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      streamPlaygroundMock.mockResolvedValue(okResult({ content: 'ok' }));
      store.setPrompt('first prompt');
      await store.runAll();
      store.setPrompt('');
      store.recallPreviousPrompt();
      expect(store.prompt()).toBe('first prompt');
    });

    it('does nothing on recall when there is no history', () => {
      const store = createPlaygroundStore('demo');
      store.setPrompt('typed');
      store.recallPreviousPrompt();
      expect(store.prompt()).toBe('typed');
    });

    it('does not duplicate the prompt history when the same prompt is submitted twice', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      streamPlaygroundMock.mockResolvedValue(okResult({ content: 'ok' }));
      store.setPrompt('same');
      await store.runAll();
      await store.runAll();
      store.setPrompt('');
      store.recallPreviousPrompt();
      expect(store.prompt()).toBe('same');
    });
  });

  describe('requestHeaders propagation', () => {
    it('passes requestHeaders to every column when runAll is called with them', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.addColumn('anthropic/claude-sonnet-4', 'anthropic', 'api_key', 'B');
      streamPlaygroundMock.mockResolvedValue(okResult({ content: 'ok' }));
      store.setPrompt('hi');

      await store.runAll({ requestHeaders: { 'HTTP-Referer': 'https://x.com' } });

      const headersPerCall = streamPlaygroundMock.mock.calls.map(
        (c) => (c[0] as { requestHeaders?: Record<string, string> }).requestHeaders,
      );
      expect(headersPerCall).toEqual([
        { 'HTTP-Referer': 'https://x.com' },
        { 'HTTP-Referer': 'https://x.com' },
      ]);
    });

    it('omits requestHeaders from the payload when the map is empty', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      streamPlaygroundMock.mockResolvedValue(okResult({ content: 'ok' }));
      store.setPrompt('hi');
      await store.runAll({ requestHeaders: {} });
      const call = streamPlaygroundMock.mock.calls[0][0] as Record<string, unknown>;
      expect(call.requestHeaders).toBeUndefined();
    });
  });

  describe('removeColumn & replaceColumnModel', () => {
    it('removes a column by id', () => {
      const store = createPlaygroundStore('demo');
      store.pickDefaults(
        [
          buildModel({ model_name: 'openai/gpt-4o-mini', provider: 'openai' }),
          buildModel({ model_name: 'anthropic/claude-sonnet-4', provider: 'anthropic' }),
        ],
        [buildProvider({ provider: 'openai' }), buildProvider({ id: 'p2', provider: 'anthropic' })],
      );
      store.removeColumn(store.columns[0]!.id);
      expect(store.columns).toHaveLength(1);
    });

    it('replaces a column model and resets its state', () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o', 'openai', 'api_key', 'GPT-4o');
      const id = store.columns[0]!.id;
      store.replaceColumnModel(id, 'openai/gpt-4o-mini', 'openai', 'api_key', 'GPT-4o Mini');
      expect(store.columns[0]!.model).toBe('openai/gpt-4o-mini');
      expect(store.columns[0]!.status).toBe('idle');
    });

    it('replaceColumnModel is a no-op for an unknown id', () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o', 'openai', 'api_key', 'GPT-4o');
      store.replaceColumnModel('nope', 'm', 'p', 'api_key', 'X');
      expect(store.columns[0]!.model).toBe('openai/gpt-4o');
    });

    it('addColumn stops adding once MAX_COLUMNS is reached', () => {
      const store = createPlaygroundStore('demo');
      for (let i = 0; i < 8; i++) store.addColumn(`m${i}`, 'openai', 'api_key', `M${i}`);
      expect(store.columns).toHaveLength(6);
    });
  });

  describe('cancellation', () => {
    it('cancelColumn aborts the in-flight signal and resets status to idle', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let capturedSignal: AbortSignal | undefined;
      streamPlaygroundMock.mockImplementation((_req: unknown, init: StreamInit) => {
        capturedSignal = init.signal;
        return new Promise((_, reject) => {
          const onAbort = () => reject(new DOMException('aborted', 'AbortError'));
          if (init.signal?.aborted) onAbort();
          else init.signal?.addEventListener('abort', onAbort);
        });
      });

      const colId = store.columns[0]!.id;
      const runPromise = store.runAll();
      await Promise.resolve();
      store.cancelColumn(colId);
      await runPromise;

      expect(capturedSignal?.aborted).toBe(true);
      expect(store.columns[0]!.status).toBe('idle');
      expect(store.columns[0]!.error).toBeUndefined();
    });

    it('cancelColumn leaves a non-loading column status untouched', () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      // idle column — cancel should not flip it.
      store.cancelColumn(store.columns[0]!.id);
      expect(store.columns[0]!.status).toBe('idle');
    });

    it('cancelAll aborts every in-flight column at once', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('a', 'openai', 'api_key', 'A');
      store.addColumn('b', 'anthropic', 'api_key', 'B');
      store.setPrompt('hi');

      const signals: AbortSignal[] = [];
      streamPlaygroundMock.mockImplementation((_req: unknown, init: StreamInit) => {
        if (init.signal) signals.push(init.signal);
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      });

      const runPromise = store.runAll();
      await Promise.resolve();
      store.cancelAll();
      await runPromise;

      expect(signals.length).toBe(2);
      expect(signals.every((s) => s.aborted)).toBe(true);
      expect(store.columns.every((c) => c.status === 'idle')).toBe(true);
    });

    it('removeColumn aborts any in-flight request without painting an error', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let captured: AbortSignal | undefined;
      streamPlaygroundMock.mockImplementation((_req: unknown, init: StreamInit) => {
        captured = init.signal;
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      });

      const colId = store.columns[0]!.id;
      const runPromise = store.runAll();
      await Promise.resolve();
      store.removeColumn(colId);
      await runPromise;

      expect(captured?.aborted).toBe(true);
      expect(store.columns).toHaveLength(0);
    });

    it('does not paint a stale success after the column was replaced', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let resolveFirst: ((v: unknown) => void) | null = null;
      streamPlaygroundMock.mockImplementationOnce(
        () => new Promise((res) => (resolveFirst = res)),
      );
      streamPlaygroundMock.mockImplementationOnce(async () => okResult({ content: 'second' }));

      const colId = store.columns[0]!.id;
      const firstRun = store.runAll();
      await Promise.resolve();
      store.replaceColumnModel(colId, 'anthropic/claude-3', 'anthropic', 'api_key', 'C');
      resolveFirst!(okResult({ content: 'STALE' }));
      await firstRun;

      expect(store.columns[0]!.response).not.toBe('STALE');
      expect(store.columns[0]!.status).toBe('idle');
    });

    it('ignores an AbortError rejection without painting an error state', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let rejectFirst: ((reason: unknown) => void) | null = null;
      streamPlaygroundMock.mockImplementationOnce(
        () => new Promise((_, rej) => (rejectFirst = rej)),
      );

      const run = store.runAll();
      await Promise.resolve();
      // Reject with a real AbortError while the column is still inflight.
      rejectFirst!(new DOMException('aborted', 'AbortError'));
      await run;

      expect(store.columns[0]!.status).toBe('loading');
      expect(store.columns[0]!.error).toBeUndefined();
    });

    it('does not paint a stale error after the column was cancelled', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let rejectFirst: ((reason: unknown) => void) | null = null;
      streamPlaygroundMock.mockImplementationOnce(
        () => new Promise((_, rej) => (rejectFirst = rej)),
      );

      const colId = store.columns[0]!.id;
      const firstRun = store.runAll();
      await Promise.resolve();
      store.cancelColumn(colId);
      rejectFirst!(new Error('NETWORK'));
      await firstRun;

      expect(store.columns[0]!.error).toBeUndefined();
      expect(store.columns[0]!.status).toBe('idle');
    });
  });

  describe('markBest', () => {
    async function withRun(): Promise<{
      store: ReturnType<typeof createPlaygroundStore>;
      col: PlaygroundColumn;
    }> {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');
      streamPlaygroundMock.mockResolvedValue(okResult({ columnId: 'db-A' }));
      await store.runAll();
      // allow microtasks of Promise.allSettled / runSingle to settle
      await Promise.resolve();
      return { store, col: store.columns[0]! };
    }

    it('optimistically marks then persists, returning the server value', async () => {
      const { store, col } = await withRun();
      setPlaygroundRunBestMock.mockResolvedValue('db-A');
      await store.markBest(col);
      expect(store.bestColumnId()).toBe('db-A');
      expect(setPlaygroundRunBestMock).toHaveBeenCalledWith(expect.any(String), 'db-A');
    });

    it('toggles off when the already-best column is marked again', async () => {
      const { store, col } = await withRun();
      setPlaygroundRunBestMock.mockResolvedValue('db-A');
      await store.markBest(col);
      expect(store.bestColumnId()).toBe('db-A');

      setPlaygroundRunBestMock.mockResolvedValue(null);
      await store.markBest(col);
      expect(store.bestColumnId()).toBeNull();
      // Second call PATCHes null (toggle-off).
      expect(setPlaygroundRunBestMock).toHaveBeenLastCalledWith(expect.any(String), null);
    });

    it('reverts the optimistic state and rethrows when the PATCH fails', async () => {
      const { store, col } = await withRun();
      setPlaygroundRunBestMock.mockRejectedValue(new Error('server boom'));
      await expect(store.markBest(col)).rejects.toThrow('server boom');
      expect(store.bestColumnId()).toBeNull();
    });

    it('is a no-op when the column has no persisted columnDbId', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      // Column never ran → columnDbId is undefined.
      await store.markBest(store.columns[0]!);
      expect(setPlaygroundRunBestMock).not.toHaveBeenCalled();
      expect(store.bestColumnId()).toBeNull();
    });

    it('is a no-op when there is no current run id', async () => {
      const store = createPlaygroundStore('demo');
      // Fabricate a column with a db id but no run loaded/submitted.
      const fake: PlaygroundColumn = {
        id: 'x',
        model: 'm',
        provider: 'openai',
        authType: 'api_key',
        displayName: 'X',
        status: 'success',
        columnDbId: 'db-orphan',
      };
      await store.markBest(fake);
      expect(setPlaygroundRunBestMock).not.toHaveBeenCalled();
      expect(store.bestColumnId()).toBeNull();
    });
  });

  describe('loadHistoryRun', () => {
    it('replaces columns/prompt, maps columnDbId, and sets the run + best pick', () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'current');
      store.loadHistoryRun({
        id: 'r-1',
        prompt: 'restored prompt',
        createdAt: new Date().toISOString(),
        modelCount: 2,
        models: ['GPT-4o', 'Claude'],
        starred: false,
        bestColumnId: 'c2',
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
            authType: null,
            displayName: null,
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
      expect(store.columns[0]!.columnDbId).toBe('c1');
      // authType/displayName fall back when null.
      expect(store.columns[1]!.authType).toBe('api_key');
      expect(store.columns[1]!.displayName).toBe('anthropic/claude');
      expect(store.columns[1]!.error).toBe('rate limited');
      expect(store.prompt()).toBe('restored prompt');
      expect(store.bestColumnId()).toBe('c2');
    });

    it('defaults bestColumnId to null when the run has none', () => {
      const store = createPlaygroundStore('demo');
      store.loadHistoryRun({
        id: 'r-2',
        prompt: 'p',
        createdAt: new Date().toISOString(),
        modelCount: 0,
        models: [],
        starred: false,
        bestColumnId: null,
        columns: [],
      });
      expect(store.bestColumnId()).toBeNull();
    });

    it('does not duplicate prompt history when reloading the same prompt', () => {
      const store = createPlaygroundStore('demo');
      const detail = {
        id: 'r-3',
        prompt: 'dupe',
        createdAt: new Date().toISOString(),
        modelCount: 0,
        models: [],
        starred: false,
        bestColumnId: null,
        columns: [],
      };
      store.loadHistoryRun(detail);
      store.loadHistoryRun(detail);
      store.setPrompt('');
      store.recallPreviousPrompt();
      expect(store.prompt()).toBe('dupe');
    });

    it('cancels any in-flight requests before swapping in the loaded columns', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');

      let captured: AbortSignal | undefined;
      streamPlaygroundMock.mockImplementation((_req: unknown, init: StreamInit) => {
        captured = init.signal;
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      });

      const runPromise = store.runAll();
      await Promise.resolve();
      store.loadHistoryRun({
        id: 'r1',
        prompt: 'historical',
        createdAt: new Date().toISOString(),
        modelCount: 1,
        models: ['Loaded'],
        starred: false,
        bestColumnId: null,
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
      expect(store.columns).toHaveLength(1);
      expect(store.columns[0]!.response).toBe('loaded-content');
    });
  });

  describe('reset', () => {
    it('clears columns, prompt, current run and best pick', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');
      streamPlaygroundMock.mockResolvedValue(okResult({ columnId: 'db-A' }));
      await store.runAll();
      await Promise.resolve();
      setPlaygroundRunBestMock.mockResolvedValue('db-A');
      await store.markBest(store.columns[0]!);
      expect(store.bestColumnId()).toBe('db-A');

      store.reset();
      expect(store.columns).toHaveLength(0);
      expect(store.prompt()).toBe('');
      expect(store.bestColumnId()).toBeNull();
      // currentRunId is cleared → markBest becomes a no-op even on a db col.
      setPlaygroundRunBestMock.mockClear();
      await store.markBest({
        id: 'x',
        model: 'm',
        provider: 'openai',
        authType: 'api_key',
        displayName: 'X',
        status: 'success',
        columnDbId: 'db-A',
      });
      expect(setPlaygroundRunBestMock).not.toHaveBeenCalled();
    });
  });

  describe('newRunId fallback', () => {
    it('generates an RFC4122-v4 run id when crypto.randomUUID is unavailable', async () => {
      const originalCrypto = globalThis.crypto;
      // Remove randomUUID so newRunId() takes the Math.random fallback branch.
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: {},
      });
      try {
        const store = createPlaygroundStore('demo');
        store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
        store.setPrompt('hi');
        streamPlaygroundMock.mockResolvedValue(okResult());
        const runId = store.runAll();
        await Promise.resolve();
        expect(runId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          configurable: true,
          value: originalCrypto,
        });
      }
    });
  });

  describe('getOrCreatePlaygroundStore', () => {
    it('creates a store on first call and returns the cached instance after', () => {
      const a = getOrCreatePlaygroundStore('agent-cache-test');
      const b = getOrCreatePlaygroundStore('agent-cache-test');
      expect(a).toBe(b);
      // Distinct agents get distinct stores.
      const c = getOrCreatePlaygroundStore('other-agent-cache-test');
      expect(c).not.toBe(a);
    });

    it('returns a usable store (signals survive createRoot)', () => {
      const store = getOrCreatePlaygroundStore('agent-usable-test');
      store.setPrompt('persisted');
      expect(store.prompt()).toBe('persisted');
      expect(store.bestColumnId()).toBeNull();
    });
  });

  describe('isAnyRunning', () => {
    it('is true while a column is loading and false once settled', async () => {
      const store = createPlaygroundStore('demo');
      store.addColumn('openai/gpt-4o-mini', 'openai', 'api_key', 'A');
      store.setPrompt('hi');
      let resolveStream: ((v: unknown) => void) | null = null;
      streamPlaygroundMock.mockImplementation(
        () => new Promise((res) => (resolveStream = res)),
      );
      const p = store.runAll();
      await Promise.resolve();
      expect(store.isAnyRunning()).toBe(true);
      resolveStream!(okResult());
      await p;
      expect(store.isAnyRunning()).toBe(false);
    });
  });
});
