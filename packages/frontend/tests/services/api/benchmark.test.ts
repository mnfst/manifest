import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as benchmark from '../../../src/services/api/benchmark';

vi.mock('../../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

function setupFetch(response: unknown = {}, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => response,
    text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('benchmark API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('runBenchmark', () => {
    it('POSTs the request body to /benchmark/run as JSON', async () => {
      const fetchMock = setupFetch({
        content: 'hi',
        metrics: { cost: 0.001, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      });
      const out = await benchmark.runBenchmark({
        agentName: 'demo',
        model: 'openai/gpt-4o-mini',
        provider: 'openai',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(out.content).toBe('hi');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/benchmark/run');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body as string)).toMatchObject({
        agentName: 'demo',
        model: 'openai/gpt-4o-mini',
      });
    });

    it('threads the AbortSignal through to fetch', async () => {
      const fetchMock = setupFetch({
        content: '',
        metrics: { cost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 },
        headers: {},
      });
      const ctrl = new AbortController();
      await benchmark.runBenchmark(
        {
          agentName: 'demo',
          model: 'm',
          provider: 'p',
          messages: [{ role: 'user', content: 'hi' }],
        },
        { signal: ctrl.signal },
      );
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.signal).toBe(ctrl.signal);
    });

    it('passes signal=undefined when no init is provided', async () => {
      const fetchMock = setupFetch({
        content: '',
        metrics: { cost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 },
        headers: {},
      });
      await benchmark.runBenchmark({
        agentName: 'demo',
        model: 'm',
        provider: 'p',
        messages: [{ role: 'user', content: 'hi' }],
      });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.signal).toBeUndefined();
    });

    it('throws an Error with the parsed message when the request fails', async () => {
      setupFetch({ message: 'rate limited' }, 429);
      await expect(
        benchmark.runBenchmark({
          agentName: 'demo',
          model: 'm',
          provider: 'p',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow(/rate limited/);
    });
  });

  describe('listBenchmarkRuns', () => {
    it('GETs /benchmark/runs with the agentName query param', async () => {
      const fetchMock = setupFetch([
        { id: 'r1', prompt: 'p', createdAt: 'now', modelCount: 1, models: ['m'] },
      ]);
      const out = await benchmark.listBenchmarkRuns('demo');
      expect(out).toHaveLength(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v1/benchmark/runs');
      expect(url).toContain('agentName=demo');
    });
  });

  describe('getBenchmarkRun', () => {
    it('GETs /benchmark/runs/<id> with the required agentName query param', async () => {
      const fetchMock = setupFetch({
        id: 'run-42',
        prompt: 'p',
        createdAt: 'now',
        modelCount: 0,
        models: [],
        columns: [],
      });
      const out = await benchmark.getBenchmarkRun('run-42', 'demo');
      expect(out.id).toBe('run-42');
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v1/benchmark/runs/run-42');
      expect(url).toContain('agentName=demo');
    });

    it('URL-encodes the runId so reserved characters are safe', async () => {
      const fetchMock = setupFetch({
        id: 'a/b',
        prompt: 'p',
        createdAt: 'now',
        modelCount: 0,
        models: [],
        columns: [],
      });
      await benchmark.getBenchmarkRun('a/b', 'demo');
      const url = fetchMock.mock.calls[0][0] as string;
      // 'a/b' must be encoded so it's not interpreted as a path segment.
      expect(url).toContain('/benchmark/runs/a%2Fb');
    });
  });
});
