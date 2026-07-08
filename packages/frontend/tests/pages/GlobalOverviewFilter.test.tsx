import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';

/**
 * Targeted coverage for GlobalOverview's harness/provider multi-select
 * `onUnselectAll` callback. The real `FilterSelect` only renders a "Select all"
 * button, so `onUnselectAll` is unreachable through its DOM — we stub
 * FilterSelect to expose the callback as a button and assert the page clears the
 * selection and persists an empty set to sessionStorage.
 */

const apiMocks = vi.hoisted(() => ({
  getAgents: vi.fn(),
  getGlobalProviders: vi.fn(),
  getGlobalProviderUsage: vi.fn(),
  getOverview: vi.fn(),
  getOverviewAgentUsage: vi.fn(),
  getOverviewProviderUsage: vi.fn(),
  getBillingStatus: vi.fn(),
}));

const sseMocks = vi.hoisted(() => ({
  bumpAgent: undefined as undefined | (() => void),
  bumpMessage: undefined as undefined | (() => void),
  bumpRouting: undefined as undefined | (() => void),
  reset: undefined as undefined | (() => void),
}));

let filterSelectProps: {
  onUnselectAll: () => void;
  onSelectAll: () => void;
  items: string[];
} | null = null;
let mockSearchParams: Record<string, string | undefined> = {};

vi.mock('@solidjs/meta', () => ({
  Title: (props: { children: unknown }) => <title>{props.children}</title>,
}));

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [mockSearchParams],
}));

vi.mock('../../src/services/api.js', async () => {
  const providers = await vi.importActual<typeof import('../../src/services/api/providers')>(
    '../../src/services/api/providers',
  );
  return {
    getAgents: (...args: unknown[]) => apiMocks.getAgents(...args),
    getGlobalProviders: (...args: unknown[]) => apiMocks.getGlobalProviders(...args),
    getGlobalProviderUsage: (...args: unknown[]) => apiMocks.getGlobalProviderUsage(...args),
    mergeUsage: providers.mergeUsage,
  };
});

vi.mock('../../src/services/api/analytics.js', () => ({
  getOverview: (...args: unknown[]) => apiMocks.getOverview(...args),
  getOverviewAgentUsage: (...args: unknown[]) => apiMocks.getOverviewAgentUsage(...args),
  getOverviewProviderUsage: (...args: unknown[]) => apiMocks.getOverviewProviderUsage(...args),
}));

vi.mock('../../src/services/api/billing.js', () => ({
  getBillingStatus: (...args: unknown[]) => apiMocks.getBillingStatus(...args),
}));

vi.mock('../../src/services/auth-client.js', () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { id: 'u1', name: 'Test User', email: 'test@test.com' } },
      isPending: false,
    }),
  },
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
  ],
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (provider: string) =>
    provider.startsWith('custom:') ? null : <span data-provider-icon={provider} />,
  customProviderLogo: () => null,
}));

vi.mock('../../src/components/MultiAgentTokenChart.jsx', () => ({
  AGENT_COLORS: ['#111111', '#222222', '#333333'],
  default: () => <div data-testid="multi-agent-token-chart" />,
}));

vi.mock('../../src/components/ProviderChartCard.jsx', () => ({
  default: () => <div data-testid="provider-chart-card" />,
}));

vi.mock('../../src/components/Sparkline.jsx', () => ({
  default: (props: { data: number[] }) => <span data-testid="sparkline">{props.data.length}</span>,
}));

vi.mock('../../src/components/Select.jsx', () => ({
  default: (props: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ label: string; value: string; disabled?: boolean; description?: string }>;
  }) => (
    <select value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
      {props.options.map((option) => (
        <option value={option.value} disabled={option.disabled}>
          {option.description ? `${option.label} · ${option.description}` : option.label}
        </option>
      ))}
    </select>
  ),
}));

// Stub FilterSelect to surface the otherwise-unreachable onUnselectAll handler.
vi.mock('../../src/components/FilterSelect.jsx', () => ({
  default: (props: {
    items: string[];
    onUnselectAll: () => void;
    onSelectAll: () => void;
    onToggle: (item: string) => void;
  }) => {
    filterSelectProps = props;
    return (
      <div data-testid="filter-select">
        <span data-testid="filter-item-count">{props.items.length}</span>
        <button data-testid="filter-unselect-all" onClick={() => props.onUnselectAll()}>
          Unselect all
        </button>
        <button data-testid="filter-select-all" onClick={() => props.onSelectAll()}>
          Select all
        </button>
      </div>
    );
  },
}));

vi.mock('../../src/components/AddAgentModal.jsx', () => ({
  default: () => null,
}));

vi.mock('../../src/components/AuthBadge.jsx', () => ({
  authLabel: (authType: string) => `auth:${authType}`,
  authBadgeFor: (authType: string | null) => <span data-auth-badge={authType ?? ''} />,
}));

vi.mock('../../src/components/GlobalOverviewSkeleton.jsx', () => ({
  default: () => <div data-testid="global-overview-skeleton" />,
}));

vi.mock('../../src/services/sse.js', async () => {
  const { createSignal } = await vi.importActual<typeof import('solid-js')>('solid-js');
  const [agentPing, setAgentPing] = createSignal(0);
  const [messagePing, setMessagePing] = createSignal(0);
  const [routingPing, setRoutingPing] = createSignal(0);
  sseMocks.bumpAgent = () => setAgentPing((n) => n + 1);
  sseMocks.bumpMessage = () => setMessagePing((n) => n + 1);
  sseMocks.bumpRouting = () => setRoutingPing((n) => n + 1);
  sseMocks.reset = () => {
    setAgentPing(0);
    setMessagePing(0);
    setRoutingPing(0);
  };
  return { agentPing, messagePing, routingPing };
});

vi.mock('../../src/services/scroll-fade.js', () => ({
  toggleScrollFade: vi.fn(),
}));

vi.mock('../../src/services/model-display.js', () => ({
  getModelDisplayName: (slug: string) => slug,
  preloadModelDisplayNames: () => {},
}));

vi.mock('../../src/services/formatters.js', () => ({
  formatNumber: (v: number) => String(v),
  formatCost: (v: number) => `$${v.toFixed(2)}`,
  formatTimeAgo: (t: string) => t,
  customProviderColor: () => '#6366f1',
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  stripCustomPrefix: (m: string) => m.replace(/^custom:[^/]+\//, ''),
}));

vi.mock('manifest-shared', () => ({
  platformIcon: () => 'robot',
}));

let mockIsSelfHosted = false;
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => Promise.resolve(mockIsSelfHosted),
}));

import GlobalOverview from '../../src/pages/GlobalOverview';

const overviewResponse = {
  summary: {
    tokens_today: { value: 1200, trend_pct: 12 },
    cost_today: { value: 3.21, trend_pct: -4 },
    messages: { value: 18, trend_pct: 5 },
  },
  token_usage: [{ hour: '2026-06-04 10:00:00', input_tokens: 700, output_tokens: 500 }],
  message_usage: [{ hour: '2026-06-04 10:00:00', count: 18 }],
  cost_by_model: [],
  recent_activity: [],
  has_data: true,
  has_providers: true,
};

const providersResponse = {
  providers: [
    {
      provider: 'openai',
      auth_type: 'api_key',
      connection_count: 1,
      connections: [{ id: 'conn-openai', label: 'Default', is_active: true }],
      total_models: 10,
      consumption_tokens: 1200,
      consumption_messages: 18,
      consumption_cost: 3.21,
      sparkline_7d: [1, 2, 3],
      last_used_at: '2026-06-04T10:00:00Z',
    },
  ],
};

const agentsResponse = {
  agents: [
    {
      agent_name: 'demo-agent',
      display_name: 'Demo Agent',
      agent_category: 'personal',
      agent_platform: 'codex',
      message_count: 18,
      total_tokens: 1200,
      sparkline: [1, 2, 3],
    },
  ],
};

// Two series → allAgents().length > 1 → the FilterSelect renders.
const providerTimeseries = {
  agents: ['openai', 'anthropic'],
  timeseries: [{ hour: '2026-06-04 10:00:00', openai: 1200, anthropic: 900 }],
};
const providerUsageTimeseries = {
  tokenUsage: providerTimeseries,
  messageUsage: providerTimeseries,
  costUsage: providerTimeseries,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockIsSelfHosted = false;
  filterSelectProps = null;
  mockSearchParams = {};
  sseMocks.reset?.();

  apiMocks.getAgents.mockResolvedValue(agentsResponse);
  apiMocks.getGlobalProviders.mockResolvedValue(providersResponse);
  apiMocks.getGlobalProviderUsage.mockResolvedValue({ providers: [] });
  apiMocks.getOverview.mockResolvedValue(overviewResponse);
  apiMocks.getOverviewAgentUsage.mockResolvedValue(providerUsageTimeseries);
  apiMocks.getOverviewProviderUsage.mockResolvedValue(providerUsageTimeseries);
  apiMocks.getBillingStatus.mockResolvedValue({
    enabled: false,
    plan: 'free',
    priceMonthly: { amount: null, currency: null, interval: null },
    requests: { used: null, limit: null, periodEnd: null },
    cancelAtPeriodEnd: false,
    subscriptionPeriodEnd: null,
  });
});

afterEach(() => {
  cleanup();
});

describe('GlobalOverview filter onUnselectAll', () => {
  it('clears the selection and persists an empty set when "unselect all" fires', async () => {
    // Default grouping is "provider" → storageKey is global-agent-filter:provider.
    const { getByTestId } = render(() => <GlobalOverview />);

    // The multi-select renders once 2+ provider series resolve.
    await waitFor(() => expect(getByTestId('filter-select')).toBeDefined());
    expect(getByTestId('filter-item-count').textContent).toBe('2');

    // Seed a non-empty persisted selection via "select all" first, so the
    // unselect actually changes state and writes [].
    fireEvent.click(getByTestId('filter-select-all'));
    await waitFor(() =>
      expect(sessionStorage.getItem('global-agent-filter:provider')).toContain('openai'),
    );

    // Fire the unselect-all handler (GlobalOverview's inline callback).
    fireEvent.click(getByTestId('filter-unselect-all'));

    await waitFor(() => expect(sessionStorage.getItem('global-agent-filter:provider')).toBe('[]'));
  });

  it('swallows a sessionStorage write failure during "unselect all"', async () => {
    // The persist is wrapped in try/catch; a throwing setItem must not crash
    // the page (covers the catch branch of onUnselectAll).
    const { getByTestId } = render(() => <GlobalOverview />);
    await waitFor(() => expect(getByTestId('filter-select')).toBeDefined());

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      expect(() => fireEvent.click(getByTestId('filter-unselect-all'))).not.toThrow();
      // State still cleared even though persistence threw.
      expect(getByTestId('filter-item-count').textContent).toBe('2');
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('exposes the unselect-all callback to FilterSelect', async () => {
    render(() => <GlobalOverview />);
    await waitFor(() => expect(filterSelectProps).not.toBeNull());
    expect(typeof filterSelectProps!.onUnselectAll).toBe('function');
  });

  it('refetches global usage data when a message SSE ping lands', async () => {
    render(() => <GlobalOverview />);

    await waitFor(() => expect(apiMocks.getOverview).toHaveBeenCalledTimes(1));
    expect(apiMocks.getAgents).toHaveBeenCalledTimes(1);
    expect(apiMocks.getGlobalProviders).toHaveBeenCalledTimes(1);
    expect(apiMocks.getGlobalProviderUsage).toHaveBeenCalledTimes(1);
    expect(apiMocks.getOverviewProviderUsage).toHaveBeenCalledTimes(1);

    sseMocks.bumpMessage?.();

    await waitFor(() => expect(apiMocks.getOverview).toHaveBeenCalledTimes(2));
    expect(apiMocks.getAgents).toHaveBeenCalledTimes(2);
    expect(apiMocks.getGlobalProviders).toHaveBeenCalledTimes(1);
    expect(apiMocks.getGlobalProviderUsage).toHaveBeenCalledTimes(2);
    expect(apiMocks.getOverviewProviderUsage).toHaveBeenCalledTimes(2);
  });

  it('opens the Pro success modal when upgraded=1 is present', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    mockSearchParams = { upgraded: '1' };

    try {
      render(() => <GlobalOverview />);

      await waitFor(() => expect(localStorage.getItem('manifest_plan_chosen_u1')).toBe('1'));
      await waitFor(() => expect(document.body.textContent).toContain("You're on the Pro plan"));

      await waitFor(() => expect(document.querySelector('.modal-backdrop')).not.toBeNull());
      fireEvent.click(document.querySelector('.modal-backdrop')!);

      expect(replaceState).toHaveBeenCalledWith(null, '', '/overview');
    } finally {
      replaceState.mockRestore();
    }
  });
});
