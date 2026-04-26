import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSavings, getBaselineCandidates } from '../../src/services/api/analytics.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('location', { origin: 'http://localhost:3000', pathname: '/agents/test' });
  mockFetch.mockReset();
});

describe('getSavings', () => {
  it('calls /savings with range and agent_name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          total_saved: 5,
          savings_pct: 42,
          actual_cost: 7,
          baseline_cost: 12,
          baseline_model: null,
          baseline_override_stale: false,
          request_count: 10,
          trend_pct: 0,
          is_auto: true,
          savings_by_auth_type: { api_key: 0, subscription: 5, local: 0 },
        }),
    });

    const result = await getSavings('30d', 'my-agent');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/savings');
    expect(url).toContain('range=30d');
    expect(url).toContain('agent_name=my-agent');
    expect(result.total_saved).toBe(5);
    expect(result.is_auto).toBe(true);
  });

  it('includes baseline param when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ total_saved: 0, is_auto: false }),
    });

    await getSavings('7d', 'bot', 'gpt-4o');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('baseline=gpt-4o');
  });
});

describe('getBaselineCandidates', () => {
  it('calls /savings/baseline-candidates with agent_name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            id: 'model-1',
            display_name: 'Model 1',
            provider: 'test',
            input_price_per_token: 0.001,
            output_price_per_token: 0.002,
            price_per_million: 3.0,
            is_current: false,
          },
        ]),
    });

    const result = await getBaselineCandidates('my-agent');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/savings/baseline-candidates');
    expect(url).toContain('agent_name=my-agent');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('model-1');
  });
});
