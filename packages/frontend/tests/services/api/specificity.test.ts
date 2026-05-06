import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as specificity from '../../../src/services/api/specificity';

vi.mock('../../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

function setupFetch(response: unknown = {}, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('specificity API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getSpecificityAssignments GETs the specificity list', async () => {
    const fetchMock = setupFetch([]);
    await specificity.getSpecificityAssignments('demo');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/routing/demo/specificity');
  });

  it('toggleSpecificity POSTs the active flag', async () => {
    const fetchMock = setupFetch({});
    await specificity.toggleSpecificity('demo', 'coding', true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/routing/demo/specificity/coding/toggle');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ active: true });
  });

  it('toggleSpecificity URL-encodes the category', async () => {
    const fetchMock = setupFetch({});
    await specificity.toggleSpecificity('demo', 'web browsing', false);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/specificity/web%20browsing/toggle');
  });

  it('resetSpecificity DELETEs the category override', async () => {
    const fetchMock = setupFetch({});
    await specificity.resetSpecificity('demo', 'coding');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/routing/demo/specificity/coding');
    expect((init as RequestInit).method).toBe('DELETE');
  });
});
