import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'test-agent' }),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ''} content={props.content ?? ''} />,
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockProviderData = {
  providers: [
    {
      provider: 'Anthropic',
      total_tokens: 5000,
      models: [
        {
          model: 'claude-sonnet-4-20250514',
          auth_type: 'api_key',
          total_tokens: 3000,
          total_cost: 0.45,
          daily: [{ date: '2026-04-01', tokens: 3000 }],
        },
        {
          model: 'claude-sonnet-4-20250514',
          auth_type: 'subscription',
          total_tokens: 2000,
          total_cost: 0,
          daily: [{ date: '2026-04-01', tokens: 2000 }],
        },
      ],
    },
    {
      provider: 'OpenAI',
      total_tokens: 1000,
      models: [
        {
          model: 'gpt-4o',
          auth_type: 'api_key',
          total_tokens: 1000,
          total_cost: 0.12,
          daily: [{ date: '2026-04-01', tokens: 1000 }],
        },
      ],
    },
  ],
  cached_at: '2026-04-08T00:00:00Z',
};

let mockFetchResult: any = mockProviderData;

vi.mock('../../src/services/api/public-stats.js', () => ({
  getProviderTokens: () => Promise.resolve(mockFetchResult),
}));

vi.mock('../../src/components/ProviderTokensChart.jsx', () => ({
  default: (props: any) => (
    <div data-testid="mock-chart" data-series-count={props.series?.length ?? 0} />
  ),
}));

import ProviderTokens, { formatAuthType, formatModelCost } from '../../src/pages/ProviderTokens';

describe('ProviderTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResult = mockProviderData;
  });

  it('renders the page title', async () => {
    render(() => <ProviderTokens />);
    const title = document.querySelector('title');
    expect(title?.textContent).toBe('Provider Tokens - Manifest');
  });

  it('renders the page header', async () => {
    render(() => <ProviderTokens />);
    expect(screen.getByText('Provider Tokens')).toBeDefined();
  });

  it('renders the subtitle', async () => {
    render(() => <ProviderTokens />);
    expect(
      screen.getByText('Daily token consumption by provider and model (last 30 days)'),
    ).toBeDefined();
  });

  it('shows empty state when no providers', async () => {
    mockFetchResult = { providers: [], cached_at: '' };
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getByText('No token data available yet.')).toBeDefined();
    });
  });


  it('renders provider tabs', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders total token counts in tabs', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getByText('5k')).toBeDefined();
      expect(screen.getByText('1k')).toBeDefined();
    });
  });

  it('defaults to first provider as active', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getByText('5k tokens')).toBeDefined();
    });
  });

  it('switches provider on tab click', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(1);
    });

    const openaiTab = screen.getAllByText('OpenAI')[0]!;
    fireEvent.click(openaiTab);

    await vi.waitFor(() => {
      expect(screen.getByText('1k tokens')).toBeDefined();
    });
  });

  it('renders model table for active provider', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('claude-sonnet-4-20250514').length).toBe(2);
    });
  });

  it('renders the chart component', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      const chart = screen.getByTestId('mock-chart');
      expect(chart).toBeDefined();
      expect(chart.getAttribute('data-series-count')).toBe('2');
    });
  });

  it('updates chart series when switching providers', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText('OpenAI')[0]!);

    await vi.waitFor(() => {
      const chart = screen.getByTestId('mock-chart');
      expect(chart.getAttribute('data-series-count')).toBe('1');
    });
  });

  it('renders table headers including Type and Cost', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getByText('Model')).toBeDefined();
      expect(screen.getByText('Type')).toBeDefined();
      expect(screen.getByText('Total Tokens')).toBeDefined();
      expect(screen.getByText('Cost')).toBeDefined();
    });
  });

  it('displays API Key type for api_key auth_type', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('API Key').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays Subscription type for subscription auth_type', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('Subscription').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays formatted cost for api_key rows', async () => {
    render(() => <ProviderTokens />);
    await vi.waitFor(() => {
      expect(screen.getByText('$0.45')).toBeDefined();
    });
  });
});

describe('formatAuthType', () => {
  it('returns Subscription for subscription', () => {
    expect(formatAuthType('subscription')).toBe('Subscription');
  });

  it('returns API Key for api_key', () => {
    expect(formatAuthType('api_key')).toBe('API Key');
  });

  it('returns dash for null', () => {
    expect(formatAuthType(null)).toBe('\u2013');
  });
});

describe('formatModelCost', () => {
  it('returns Subscription for subscription auth_type', () => {
    expect(formatModelCost('subscription', 0)).toBe('Subscription');
  });

  it('returns formatted cost for api_key', () => {
    expect(formatModelCost('api_key', 0.45)).toBe('$0.45');
  });

  it('returns dash for null cost', () => {
    expect(formatModelCost('api_key', null)).toBe('\u2013');
  });

  it('returns dash for null auth_type and null cost', () => {
    expect(formatModelCost(null, null)).toBe('\u2013');
  });

  it('returns < $0.01 for very small costs', () => {
    expect(formatModelCost('api_key', 0.001)).toBe('< $0.01');
  });

  it('returns dash for negative cost (invalid)', () => {
    expect(formatModelCost('api_key', -1)).toBe('\u2013');
  });
});
