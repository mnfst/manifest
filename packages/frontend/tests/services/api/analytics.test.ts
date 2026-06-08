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

  it('calls provider analytics endpoints with scoped query params', async () => {
    const fetchMock = setupFetch({});

    await analytics.getProviderAnalytics('api_key', '30d', 'demo', 'openai');
    await analytics.getProviderAnalyticsAgents('subscription');
    await analytics.getConnectionDetail('conn-openai');

    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toContain('/api/v1/provider-analytics');
    expect(urls[0]).toContain('auth_type=api_key');
    expect(urls[0]).toContain('range=30d');
    expect(urls[0]).toContain('agent_name=demo');
    expect(urls[0]).toContain('provider=openai');
    expect(urls[1]).toContain('/api/v1/provider-analytics/agents');
    expect(urls[1]).toContain('auth_type=subscription');
    expect(urls[2]).toContain('/api/v1/provider-analytics/connection-detail');
    expect(urls[2]).toContain('connection_id=conn-openai');
  });

  it('calls per-agent analytics timeseries endpoints', async () => {
    const fetchMock = setupFetch({ agents: [], timeseries: [] });

    await analytics.getPerAgentTimeseries('api_key', 'openai', '7d');
    await analytics.getPerAgentMessageTimeseries('api_key', 'openai', '7d');
    await analytics.getPerAgentCostTimeseries('api_key', 'openai', '7d');

    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toContain('/api/v1/provider-analytics/per-agent-timeseries');
    expect(urls[1]).toContain('/api/v1/provider-analytics/per-agent-message-timeseries');
    expect(urls[2]).toContain('/api/v1/provider-analytics/per-agent-cost-timeseries');
    for (const url of urls) {
      expect(url).toContain('auth_type=api_key');
      expect(url).toContain('provider=openai');
      expect(url).toContain('range=7d');
    }
  });

  it('calls global overview pivot endpoints', async () => {
    const fetchMock = setupFetch({ agents: [], timeseries: [] });

    await analytics.getGlobalPerAgentTimeseries('30d');
    await analytics.getGlobalPerAgentMessageTimeseries('30d');
    await analytics.getGlobalPerAgentCostTimeseries('30d');
    await analytics.getGlobalPerProviderTimeseries('30d');
    await analytics.getGlobalPerProviderMessageTimeseries('30d');
    await analytics.getGlobalPerProviderCostTimeseries('30d');
    await analytics.getGlobalPerModelTimeseries('30d');
    await analytics.getGlobalPerModelMessageTimeseries('30d');
    await analytics.getGlobalPerModelCostTimeseries('30d');

    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls).toEqual([
      expect.stringContaining('/api/v1/overview/per-agent-timeseries'),
      expect.stringContaining('/api/v1/overview/per-agent-message-timeseries'),
      expect.stringContaining('/api/v1/overview/per-agent-cost-timeseries'),
      expect.stringContaining('/api/v1/overview/per-provider-timeseries'),
      expect.stringContaining('/api/v1/overview/per-provider-message-timeseries'),
      expect.stringContaining('/api/v1/overview/per-provider-cost-timeseries'),
      expect.stringContaining('/api/v1/overview/per-model-timeseries'),
      expect.stringContaining('/api/v1/overview/per-model-message-timeseries'),
      expect.stringContaining('/api/v1/overview/per-model-cost-timeseries'),
    ]);
    for (const url of urls) {
      expect(url).toContain('range=30d');
    }
  });

  it('calls agent-scoped provider overview pivot endpoints', async () => {
    const fetchMock = setupFetch({ agents: [], timeseries: [] });

    await analytics.getPerProviderTimeseries('demo', '7d');
    await analytics.getPerProviderMessageTimeseries('demo', '7d');

    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toContain('/api/v1/overview/per-provider-timeseries');
    expect(urls[1]).toContain('/api/v1/overview/per-provider-message-timeseries');
    for (const url of urls) {
      expect(url).toContain('agent_name=demo');
      expect(url).toContain('range=7d');
    }
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
