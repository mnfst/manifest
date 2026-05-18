import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as playground from '../../../src/services/api/playground';
import type { PlaygroundStreamEvent } from 'manifest-shared';

vi.mock('../../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

/**
 * Build a fetch Response whose body is a ReadableStream that emits the given
 * UTF-8 chunks (already-encoded SSE text). One chunk per reader.read() call.
 */
function streamResponse(
  chunks: string[],
  opts: { status?: number; contentType?: string } = {},
): Response {
  const status = opts.status ?? 200;
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({
      'content-type': opts.contentType ?? 'text/event-stream',
    }),
    body,
  } as unknown as Response;
}

/** A non-stream JSON error Response (used for the pre-stream error path). */
function jsonResponse(payload: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    body: status >= 200 && status < 300 ? new ReadableStream() : null,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

function sse(event: PlaygroundStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe('playground API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('streamPlayground', () => {
    it('POSTs the request body to /playground/run and threads the AbortSignal', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            sse({ type: 'delta', text: 'hi' }),
            sse({
              type: 'done',
              columnId: 'col-1',
              content: 'hi there',
              metrics: { cost: 0.001, inputTokens: 1, outputTokens: 2, durationMs: 10 },
              headers: { 'x-id': 'a' },
            }),
          ]),
        );
      vi.stubGlobal('fetch', fetchMock);

      const ctrl = new AbortController();
      const deltas: string[] = [];
      const result = await playground.streamPlayground(
        {
          agentName: 'demo',
          model: 'openai/gpt-4o-mini',
          provider: 'openai',
          messages: [{ role: 'user', content: 'hi' }],
        },
        { signal: ctrl.signal, onDelta: (t) => deltas.push(t) },
      );

      expect(deltas).toEqual(['hi']);
      expect(result).toEqual({
        columnId: 'col-1',
        content: 'hi there',
        metrics: { cost: 0.001, inputTokens: 1, outputTokens: 2, durationMs: 10 },
        headers: { 'x-id': 'a' },
      });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/playground/run');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(init.signal).toBe(ctrl.signal);
      expect(JSON.parse(init.body as string)).toMatchObject({
        agentName: 'demo',
        model: 'openai/gpt-4o-mini',
      });
    });

    it('throws the parsed JSON error message when the request fails before the stream opens', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'rate limited' }, 429)));
      await expect(
        playground.streamPlayground(
          { agentName: 'demo', model: 'm', provider: 'p' },
          { onDelta: vi.fn() },
        ),
      ).rejects.toThrow('rate limited');
    });

    it('throws when the content-type is not an event stream (HTML/JSON 200)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse({ message: 'unexpected non-stream body' }, 200),
        ),
      );
      await expect(
        playground.streamPlayground(
          { agentName: 'demo', model: 'm', provider: 'p' },
          { onDelta: vi.fn() },
        ),
      ).rejects.toThrow('unexpected non-stream body');
    });

    it('throws when the response has no body', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: null,
          json: async () => ({ message: 'no body' }),
          text: async () => '{"message":"no body"}',
        } as unknown as Response),
      );
      await expect(
        playground.streamPlayground(
          { agentName: 'demo', model: 'm', provider: 'p' },
          { onDelta: vi.fn() },
        ),
      ).rejects.toThrow('no body');
    });

    it('falls back to a generic message when the missing content-type is absent', async () => {
      // headers.get('content-type') → null exercises the `?? ''` branch.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Error',
          headers: new Headers(),
          body: null,
          json: async () => {
            throw new Error('not json');
          },
          text: async () => 'boom',
        } as unknown as Response),
      );
      await expect(
        playground.streamPlayground(
          { agentName: 'demo', model: 'm', provider: 'p' },
          { onDelta: vi.fn() },
        ),
      ).rejects.toThrow('Request failed (500)');
    });

    it('emits each delta then resolves with the terminal done event', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          streamResponse([
            sse({ type: 'delta', text: 'Hel' }),
            sse({ type: 'delta', text: 'lo' }),
            sse({
              type: 'done',
              columnId: null,
              content: 'Hello',
              metrics: { cost: null, inputTokens: 0, outputTokens: 2, durationMs: 5 },
              headers: {},
            }),
          ]),
        ),
      );
      const deltas: string[] = [];
      const result = await playground.streamPlayground(
        { agentName: 'demo', model: 'm', provider: 'p' },
        { onDelta: (t) => deltas.push(t) },
      );
      expect(deltas).toEqual(['Hel', 'lo']);
      expect(result.columnId).toBeNull();
      expect(result.content).toBe('Hello');
    });

    it('throws the message carried by a mid-stream error event', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          streamResponse([
            sse({ type: 'delta', text: 'partial' }),
            sse({ type: 'error', message: 'upstream exploded' }),
          ]),
        ),
      );
      await expect(
        playground.streamPlayground(
          { agentName: 'demo', model: 'm', provider: 'p' },
          { onDelta: vi.fn() },
        ),
      ).rejects.toThrow('upstream exploded');
    });

    it('reassembles an SSE block split across multiple reads', async () => {
      const done = sse({
        type: 'done',
        columnId: 'c2',
        content: 'joined',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 1 },
        headers: {},
      });
      // Split the single block across 3 chunks; the parser must buffer until
      // it sees the \n\n delimiter.
      const a = done.slice(0, 5);
      const b = done.slice(5, 20);
      const c = done.slice(20);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([a, b, c])));
      const result = await playground.streamPlayground(
        { agentName: 'demo', model: 'm', provider: 'p' },
        { onDelta: vi.fn() },
      );
      expect(result.content).toBe('joined');
      expect(result.columnId).toBe('c2');
    });

    it('flushes a trailing buffer that has no terminating blank line', async () => {
      // No "\n\n" at the end — handled by the post-loop `buffer.trim()` flush.
      const done = `data: ${JSON.stringify({
        type: 'done',
        columnId: 'tail',
        content: 'tail-content',
        metrics: { cost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 },
        headers: {},
      })}`;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([done])));
      const result = await playground.streamPlayground(
        { agentName: 'demo', model: 'm', provider: 'p' },
        { onDelta: vi.fn() },
      );
      expect(result.content).toBe('tail-content');
    });

    it('joins multi-line data: fields and ignores non-data lines', async () => {
      const event = { type: 'delta', text: 'multi' } as PlaygroundStreamEvent;
      const json = JSON.stringify(event);
      // Two data: lines whose trimmed concat reforms the JSON, plus a comment.
      const block = `: keep-alive\ndata: ${json.slice(0, 4)}\ndata:${json.slice(4)}\n\n`;
      const done = sse({
        type: 'done',
        columnId: 'x',
        content: 'multi',
        metrics: { cost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 },
        headers: {},
      });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([block + done])));
      const deltas: string[] = [];
      const result = await playground.streamPlayground(
        { agentName: 'demo', model: 'm', provider: 'p' },
        { onDelta: (t) => deltas.push(t) },
      );
      expect(deltas).toEqual(['multi']);
      expect(result.content).toBe('multi');
    });

    it('skips blocks with no data: payload and blocks with malformed JSON', async () => {
      const done = sse({
        type: 'done',
        columnId: 'ok',
        content: 'ok',
        metrics: { cost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 },
        headers: {},
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          streamResponse([
            ': just a comment\n\n', // no data: line → skipped (returns early)
            'data: {not-json}\n\n', // malformed → JSON.parse throws → skipped
            done,
          ]),
        ),
      );
      const result = await playground.streamPlayground(
        { agentName: 'demo', model: 'm', provider: 'p' },
        { onDelta: vi.fn() },
      );
      expect(result.content).toBe('ok');
    });

    it('throws "Stream ended without a result" when no done event arrives', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          streamResponse([sse({ type: 'delta', text: 'only a delta' })]),
        ),
      );
      await expect(
        playground.streamPlayground(
          { agentName: 'demo', model: 'm', provider: 'p' },
          { onDelta: vi.fn() },
        ),
      ).rejects.toThrow('Stream ended without a result');
    });
  });

  describe('setPlaygroundRunBest', () => {
    it('PATCHes the run best endpoint and returns the new bestColumnId', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ bestColumnId: 'col-9' }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const out = await playground.setPlaygroundRunBest('run 1/2', 'col-9');
      expect(out).toBe('col-9');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/v1/playground/runs/run%201%2F2/best');
      expect(init.method).toBe('PATCH');
      expect(init.credentials).toBe('include');
      expect(JSON.parse(init.body as string)).toEqual({ columnId: 'col-9' });
    });

    it('accepts null to clear the best pick', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ bestColumnId: null }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const out = await playground.setPlaygroundRunBest('r1', null);
      expect(out).toBeNull();
      expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
        columnId: null,
      });
    });

    it('throws when the response is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
      );
      await expect(playground.setPlaygroundRunBest('r1', 'c1')).rejects.toThrow(
        'Failed to set best answer',
      );
    });
  });

  describe('listPlaygroundRuns / getPlaygroundRun', () => {
    function setupFetch(response: unknown): ReturnType<typeof vi.fn> {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => response,
        text: async () => JSON.stringify(response),
      });
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    it('GETs /playground/runs with the agentName query param', async () => {
      const fetchMock = setupFetch([
        { id: 'r1', prompt: 'p', createdAt: 'now', modelCount: 1, models: ['m'] },
      ]);
      const out = await playground.listPlaygroundRuns('demo');
      expect(out).toHaveLength(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v1/playground/runs');
      expect(url).toContain('agentName=demo');
    });

    it('GETs /playground/runs/<id> and URL-encodes the runId', async () => {
      const fetchMock = setupFetch({
        id: 'a/b',
        prompt: 'p',
        createdAt: 'now',
        modelCount: 0,
        models: [],
        columns: [],
      });
      const out = await playground.getPlaygroundRun('a/b', 'demo');
      expect(out.id).toBe('a/b');
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/playground/runs/a%2Fb');
      expect(url).toContain('agentName=demo');
    });
  });

  describe('togglePlaygroundRunStar', () => {
    it('PATCHes the star endpoint and returns the new starred flag', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ starred: true }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const out = await playground.togglePlaygroundRunStar('r/1');
      expect(out).toBe(true);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/v1/playground/runs/r%2F1/star');
      expect(init.method).toBe('PATCH');
    });

    it('throws when the star toggle fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
      );
      await expect(playground.togglePlaygroundRunStar('r1')).rejects.toThrow(
        'Failed to toggle star',
      );
    });
  });
});
