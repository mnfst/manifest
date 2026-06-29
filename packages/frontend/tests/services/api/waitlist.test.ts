import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as waitlist from '../../../src/services/api/waitlist';

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

describe('waitlist API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getAutofixWaitlistStatus fetches the status endpoint', async () => {
    const fetchMock = setupFetch({ joined: false, joinedAt: null });
    const result = await waitlist.getAutofixWaitlistStatus();
    expect(result).toEqual({ joined: false, joinedAt: null });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/waitlist/autofix');
  });

  it('getAutofixWaitlistStatus returns joined status when user is on waitlist', async () => {
    const ts = '2026-06-25T10:00:00.000Z';
    setupFetch({ joined: true, joinedAt: ts });
    const result = await waitlist.getAutofixWaitlistStatus();
    expect(result).toEqual({ joined: true, joinedAt: ts });
  });

  it('joinAutofixWaitlist POSTs to the waitlist endpoint', async () => {
    const fetchMock = setupFetch({ joined: true, joinedAt: '2026-06-25T10:00:00.000Z' });
    const result = await waitlist.joinAutofixWaitlist();
    expect(result.joined).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/waitlist/autofix');
    expect((init as RequestInit).method).toBe('POST');
  });
});
