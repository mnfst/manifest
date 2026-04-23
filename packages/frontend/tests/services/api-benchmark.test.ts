import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getBenchmarkRun,
  listBenchmarkRuns,
  runBenchmark,
} from '../../src/services/api/benchmark';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('runBenchmark', () => {
  it('POSTs to /benchmark/run with the DTO and returns the parsed body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          content: 'hi',
          metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 10 },
          headers: {},
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await runBenchmark({
      agentName: 'demo',
      model: 'openai/gpt-4o',
      provider: 'openai',
      authType: 'api_key',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.content).toBe('hi');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/benchmark/run');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toMatchObject({
      agentName: 'demo',
      model: 'openai/gpt-4o',
      provider: 'openai',
    });
  });

  it('throws an Error with the server message when the response is not ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Provider not connected' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(
      runBenchmark({
        agentName: 'demo',
        model: 'x',
        provider: 'openai',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow('Provider not connected');
  });
});

describe('listBenchmarkRuns', () => {
  it('sends agentName as a query parameter', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const out = await listBenchmarkRuns('demo');
    expect(out).toEqual([]);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/benchmark/runs');
    expect(url).toContain('agentName=demo');
  });
});

describe('getBenchmarkRun', () => {
  it('GETs /benchmark/runs/:id with URL-encoded id', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'r1',
          prompt: 'p',
          createdAt: '',
          modelCount: 0,
          models: [],
          columns: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    await getBenchmarkRun('aaaa/bbbb');
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/benchmark/runs/aaaa%2Fbbbb');
  });
});
