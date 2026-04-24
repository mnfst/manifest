import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getComplexityStatus, toggleComplexity } from '../../src/services/api.js';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('getComplexityStatus', () => {
  it('GETs /api/v1/routing/:agent/complexity and returns the JSON body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ enabled: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    const result = await getComplexityStatus('my-agent');
    expect(result).toEqual({ enabled: true });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/routing/my-agent/complexity');
    expect(init.credentials).toBe('include');
  });

  it('encodes the agent name', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ enabled: false }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;
    await getComplexityStatus('agent/slash');
    const [url] = fetchSpy.mock.calls[0] as [string, unknown];
    expect(url).toContain('/api/v1/routing/agent%2Fslash/complexity');
  });
});

describe('toggleComplexity', () => {
  it('POSTs the requested enabled flag and returns the response body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, enabled: false }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    const result = await toggleComplexity('my-agent', false);
    expect(result).toEqual({ ok: true, enabled: false });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/routing/my-agent/complexity/toggle');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ enabled: false }));
  });
});
