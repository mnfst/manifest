import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as analytics from '../../../src/services/api/analytics';

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

describe('analytics API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getOverview defaults range to 24h and omits agent_name when absent', async () => {
    const fetchMock = setupFetch({});
    await analytics.getOverview();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/overview');
    expect(url).toContain('range=24h');
    expect(url).not.toContain('agent_name=');
  });

  it('getOverview forwards agent_name when provided', async () => {
    const fetchMock = setupFetch({});
    await analytics.getOverview('7d', 'demo');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('range=7d');
    expect(url).toContain('agent_name=demo');
  });

  it('getHealth GETs /health', async () => {
    const fetchMock = setupFetch({ ok: true });
    await analytics.getHealth();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/health');
  });

  it('getModelPrices GETs /model-prices', async () => {
    const fetchMock = setupFetch([]);
    await analytics.getModelPrices();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/model-prices');
  });

  it('getSavings forwards range, agent_name, and baseline params', async () => {
    const fetchMock = setupFetch({});
    await analytics.getSavings('7d', 'demo', 'gpt-4o');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/savings');
    expect(url).toContain('range=7d');
    expect(url).toContain('agent_name=demo');
    expect(url).toContain('baseline=gpt-4o');
  });

  it('getSavings omits baseline when not provided', async () => {
    const fetchMock = setupFetch({});
    await analytics.getSavings('7d', 'demo');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain('baseline=');
  });

  it('getBaselineCandidates forwards agent_name', async () => {
    const fetchMock = setupFetch([]);
    await analytics.getBaselineCandidates('demo');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/savings/baseline-candidates');
    expect(url).toContain('agent_name=demo');
  });

  it('getSavingsTimeseries forwards range and agent_name', async () => {
    const fetchMock = setupFetch([]);
    await analytics.getSavingsTimeseries('30d', 'demo');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/savings/timeseries');
    expect(url).toContain('range=30d');
    expect(url).toContain('agent_name=demo');
  });
});
