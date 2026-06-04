import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const routerState = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  searchParams: {} as Record<string, string | undefined>,
  params: { connectionId: 'conn-openai' },
  location: { state: null as unknown },
  agentName: 'demo-agent',
}));

const apiMocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  getAgents: vi.fn(),
  getCustomProviders: vi.fn(),
  getAgentProviders: vi.fn(),
  disconnectProvider: vi.fn(),
  fetchMutate: vi.fn(),
  getOverview: vi.fn(),
  getGlobalPerAgentTimeseries: vi.fn(),
  getGlobalPerAgentMessageTimeseries: vi.fn(),
  getGlobalPerProviderTimeseries: vi.fn(),
  getGlobalPerProviderMessageTimeseries: vi.fn(),
  getGlobalPerModelTimeseries: vi.fn(),
  getGlobalPerModelMessageTimeseries: vi.fn(),
  getGlobalPerAgentCostTimeseries: vi.fn(),
  getGlobalPerProviderCostTimeseries: vi.fn(),
  getGlobalPerModelCostTimeseries: vi.fn(),
  getPerProviderTimeseries: vi.fn(),
  getPerProviderMessageTimeseries: vi.fn(),
  getConnectionDetail: vi.fn(),
  getProviderAnalytics: vi.fn(),
  getProviderAnalyticsAgents: vi.fn(),
  getPerAgentTimeseries: vi.fn(),
  getPerAgentMessageTimeseries: vi.fn(),
  getPerAgentCostTimeseries: vi.fn(),
}));

const recentMocks = vi.hoisted(() => ({
  isRecentlyCreated: vi.fn(() => false),
}));

vi.mock('@solidjs/meta', () => ({
  Title: () => null,
}));

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; children: unknown }) => <a href={props.href}>{props.children}</a>,
  useNavigate: () => routerState.navigate,
  useSearchParams: () => [routerState.searchParams, routerState.setSearchParams],
  useParams: () => routerState.params,
  useLocation: () => routerState.location,
}));

vi.mock('../../src/services/routing.js', () => ({
  useAgentName: () => () => routerState.agentName,
}));

vi.mock('../../src/services/api/core.js', () => ({
  fetchJson: (...args: unknown[]) => apiMocks.fetchJson(...args),
  fetchMutate: (...args: unknown[]) => apiMocks.fetchMutate(...args),
  routingPath: (agent: string, path: string) => `/api/v1/routing/${agent}/${path}`,
}));

vi.mock('../../src/services/api.js', () => ({
  getAgents: (...args: unknown[]) => apiMocks.getAgents(...args),
  getCustomProviders: (...args: unknown[]) => apiMocks.getCustomProviders(...args),
  disconnectProvider: (...args: unknown[]) => apiMocks.disconnectProvider(...args),
}));

vi.mock('../../src/services/api/routing.js', () => ({
  getProviders: (...args: unknown[]) => apiMocks.getAgentProviders(...args),
  getCustomProviders: (...args: unknown[]) => apiMocks.getCustomProviders(...args),
}));

vi.mock('../../src/services/api/analytics.js', () => ({
  getOverview: (...args: unknown[]) => apiMocks.getOverview(...args),
  getGlobalPerAgentTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerAgentTimeseries(...args),
  getGlobalPerAgentMessageTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerAgentMessageTimeseries(...args),
  getGlobalPerProviderTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerProviderTimeseries(...args),
  getGlobalPerProviderMessageTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerProviderMessageTimeseries(...args),
  getGlobalPerModelTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerModelTimeseries(...args),
  getGlobalPerModelMessageTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerModelMessageTimeseries(...args),
  getGlobalPerAgentCostTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerAgentCostTimeseries(...args),
  getGlobalPerProviderCostTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerProviderCostTimeseries(...args),
  getGlobalPerModelCostTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerModelCostTimeseries(...args),
  getPerProviderTimeseries: (...args: unknown[]) => apiMocks.getPerProviderTimeseries(...args),
  getPerProviderMessageTimeseries: (...args: unknown[]) =>
    apiMocks.getPerProviderMessageTimeseries(...args),
  getConnectionDetail: (...args: unknown[]) => apiMocks.getConnectionDetail(...args),
  getProviderAnalytics: (...args: unknown[]) => apiMocks.getProviderAnalytics(...args),
  getProviderAnalyticsAgents: (...args: unknown[]) => apiMocks.getProviderAnalyticsAgents(...args),
  getPerAgentTimeseries: (...args: unknown[]) => apiMocks.getPerAgentTimeseries(...args),
  getPerAgentMessageTimeseries: (...args: unknown[]) =>
    apiMocks.getPerAgentMessageTimeseries(...args),
  getPerAgentCostTimeseries: (...args: unknown[]) => apiMocks.getPerAgentCostTimeseries(...args),
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic', supportsSubscription: true },
    { id: 'chatgpt', name: 'ChatGPT', supportsSubscription: true, subscriptionOnly: true },
    { id: 'ollama', name: 'Ollama', localOnly: true },
  ],
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (provider: string) =>
    provider.startsWith('custom:') ? null : <span data-provider-icon={provider} />,
  customProviderLogo: (name: string) => <span data-custom-provider-logo={name} />,
}));

vi.mock('../../src/components/MultiAgentTokenChart.jsx', () => ({
  AGENT_COLORS: ['#111111', '#222222', '#333333'],
  default: () => <div data-testid="multi-agent-token-chart" />,
}));

vi.mock('../../src/components/ProviderChartCard.jsx', () => ({
  default: (props: {
    activeView: string;
    onViewChange: (view: 'messages' | 'tokens' | 'cost') => void;
    tokensValue: number;
    tokensTrendPct?: number;
    messagesValue: number;
    messagesTrendPct?: number;
    costValue?: number;
    costTrendPct?: number;
    tokenUsage?: unknown[];
    messageChartData?: unknown[];
    range?: string;
    agentTimeseries?: { agents: string[]; timeseries: unknown[] };
    agentMessageTimeseries?: { agents: string[]; timeseries: unknown[] };
    agentCostTimeseries?: { agents: string[]; timeseries: unknown[] };
    colorMap?: Record<string, string>;
  }) => (
    <div data-active-view={props.activeView} data-testid="provider-chart-card">
      <button onClick={() => props.onViewChange('messages')}>Messages chart</button>
      <button onClick={() => props.onViewChange('tokens')}>Tokens chart</button>
      <button onClick={() => props.onViewChange('cost')}>Cost chart</button>
      <span>{props.tokensValue}</span>
      <span>{props.tokensTrendPct ?? 0}</span>
      <span>{props.messagesValue}</span>
      <span>{props.messagesTrendPct ?? 0}</span>
      <span>{props.costValue ?? 0}</span>
      <span>{props.costTrendPct ?? 0}</span>
      <span>{props.tokenUsage?.length ?? 0}</span>
      <span>{props.messageChartData?.length ?? 0}</span>
      <span>{props.range}</span>
      <span>{props.agentTimeseries?.agents.join(',') ?? ''}</span>
      <span>{props.agentTimeseries?.timeseries.length ?? 0}</span>
      <span>{props.agentMessageTimeseries?.agents.join(',') ?? ''}</span>
      <span>{props.agentMessageTimeseries?.timeseries.length ?? 0}</span>
      <span>{props.agentCostTimeseries?.agents.join(',') ?? ''}</span>
      <span>{props.agentCostTimeseries?.timeseries.length ?? 0}</span>
      <span>{Object.keys(props.colorMap ?? {}).join(',')}</span>
    </div>
  ),
}));

vi.mock('../../src/components/Sparkline.jsx', () => ({
  default: (props: { data: number[] }) => <span data-testid="sparkline">{props.data.length}</span>,
}));

vi.mock('../../src/components/InfoTooltip.jsx', () => ({
  default: (props: { text: string }) => <span data-testid="info-tooltip">{props.text}</span>,
}));

vi.mock('../../src/components/Select.jsx', () => ({
  default: (props: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ label: string; value: string }>;
  }) => (
    <select value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
      {props.options.map((option) => (
        <option value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('../../src/components/ProviderSelectModal.jsx', () => ({
  default: (props: {
    agentName?: string;
    providers?: unknown[];
    initialTab: string;
    providerDeepLink?: { providerId: string } | null;
    onClose: () => void;
    onUpdate: () => void;
  }) => (
    <div data-provider={props.providerDeepLink?.providerId ?? ''} data-tab={props.initialTab}>
      Provider modal
      <span>{props.agentName ?? ''}</span>
      <span>{props.providers?.length ?? 0}</span>
      <button onClick={props.onUpdate}>Modal update</button>
      <button onClick={props.onClose}>Modal close</button>
    </div>
  ),
}));

vi.mock('../../src/components/SetupModal.jsx', () => ({
  default: (props: {
    open: boolean;
    agentName?: string;
    apiKey?: string | null;
    onClose: () => void;
    onDone: () => void;
  }) =>
    props.open ? (
      <div>
        <span>{props.agentName}</span>
        <span>{props.apiKey ?? ''}</span>
        <button onClick={props.onClose}>Close setup</button>
        <button onClick={props.onDone}>Finish setup</button>
      </div>
    ) : null,
}));

vi.mock('../../src/services/recent-agents.js', () => ({
  isRecentlyCreated: (...args: unknown[]) => recentMocks.isRecentlyCreated(...args),
}));

vi.mock('../../src/services/sse.js', () => ({
  agentPing: () => 0,
  messagePing: () => 0,
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/services/connection-breadcrumb-store.js', () => ({
  setConnectionBreadcrumb: vi.fn(),
}));

vi.mock('manifest-shared', () => ({
  platformIcon: () => 'robot',
  PLATFORM_LABELS: { codex: 'Codex' },
}));

import GlobalOverview from '../../src/pages/GlobalOverview';
import AgentOverview from '../../src/pages/AgentOverview';
import Byok from '../../src/pages/providers/Byok';
import Subscriptions from '../../src/pages/providers/Subscriptions';
import LocalProviders from '../../src/pages/providers/Local';
import ConnectionDetail from '../../src/pages/providers/ConnectionDetail';

const overviewResponse = {
  summary: {
    tokens_today: { value: 1200, trend_pct: 12 },
    cost_today: { value: 3.21, trend_pct: -4 },
    messages: { value: 18, trend_pct: 5 },
  },
  token_usage: [{ hour: '2026-06-04 10:00:00', input_tokens: 700, output_tokens: 500 }],
  message_usage: [{ hour: '2026-06-04 10:00:00', count: 18 }],
  cost_by_model: [
    {
      model: 'gpt-5',
      display_name: 'GPT-5',
      tokens: 1200,
      share_pct: 75,
      estimated_cost: 1.23,
      auth_type: 'api_key',
      provider: 'openai',
    },
  ],
  recent_activity: [
    {
      timestamp: '2026-06-04T10:00:00Z',
      agent_name: 'demo-agent',
      model: 'gpt-5',
      total_tokens: 1200,
      provider: 'openai',
      auth_type: 'api_key',
      first_message: 'Hello',
      cost_usd: 1.23,
    },
  ],
  has_data: true,
  has_providers: true,
};

const providersResponse = {
  providers: [
    {
      provider: 'openai',
      auth_type: 'api_key',
      connection_count: 1,
      connections: [
        {
          id: 'conn-openai',
          label: 'Default',
          key_prefix: 'sk',
          cached_model_count: 10,
          is_active: true,
        },
      ],
      total_models: 10,
      consumption_tokens: 1200,
      consumption_messages: 18,
      consumption_cost: 3.21,
      sparkline_7d: [1, 2, 3],
      last_used_at: '2026-06-04T10:00:00Z',
    },
    {
      provider: 'anthropic',
      auth_type: 'subscription',
      connection_count: 1,
      connections: [
        {
          id: 'conn-anthropic',
          label: 'Claude',
          key_prefix: null,
          cached_model_count: 8,
          is_active: true,
        },
      ],
      total_models: 8,
      consumption_tokens: 900,
      consumption_messages: 12,
      consumption_cost: 0,
      sparkline_7d: [2, 3, 4],
      last_used_at: '2026-06-04T10:00:00Z',
    },
    {
      provider: 'ollama',
      auth_type: 'local',
      connection_count: 1,
      connections: [
        {
          id: 'conn-ollama',
          label: 'Local',
          key_prefix: null,
          cached_model_count: 3,
          is_active: true,
        },
      ],
      total_models: 3,
      consumption_tokens: 600,
      consumption_messages: 8,
      consumption_cost: 0,
      sparkline_7d: [1, 1, 2],
      last_used_at: '2026-06-04T10:00:00Z',
    },
    {
      provider: 'custom:cp-1',
      auth_type: 'api_key',
      connection_count: 1,
      connections: [
        {
          id: 'conn-custom',
          label: 'Custom',
          key_prefix: 'ck',
          cached_model_count: 2,
          is_active: true,
        },
      ],
      total_models: 2,
      consumption_tokens: 300,
      consumption_messages: 4,
      consumption_cost: 0.44,
      sparkline_7d: [0, 1, 1],
      last_used_at: '2026-06-04T10:00:00Z',
    },
  ],
  model_counts: { openai: 10, anthropic: 8, ollama: 3 },
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
    {
      agent_name: 'worker-agent',
      display_name: 'Worker Agent',
      agent_category: 'personal',
      agent_platform: 'codex',
      message_count: 8,
      total_tokens: 600,
      sparkline: [0, 1, 2],
    },
  ],
};

const timeseries = {
  agents: ['openai', 'anthropic'],
  timeseries: [
    {
      hour: '2026-06-04 10:00:00',
      openai: 1200,
      anthropic: 900,
    },
  ],
};

const agentTimeseries = {
  agents: ['demo-agent', 'worker-agent'],
  timeseries: [
    {
      hour: '2026-06-04 10:00:00',
      'demo-agent': 1200,
      'worker-agent': 600,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  routerState.navigate.mockReset();
  routerState.setSearchParams.mockReset();
  routerState.searchParams = {};
  routerState.params = { connectionId: 'conn-openai' };
  routerState.location = { state: null };
  routerState.agentName = 'demo-agent';
  recentMocks.isRecentlyCreated.mockReturnValue(false);

  apiMocks.fetchJson.mockResolvedValue(providersResponse);
  apiMocks.getAgents.mockResolvedValue(agentsResponse);
  apiMocks.getCustomProviders.mockResolvedValue([{ id: 'cp-1', name: 'Custom Provider' }]);
  apiMocks.getAgentProviders.mockResolvedValue([]);
  apiMocks.disconnectProvider.mockResolvedValue({ notifications: [] });
  apiMocks.fetchMutate.mockResolvedValue({});
  apiMocks.getOverview.mockResolvedValue(overviewResponse);
  apiMocks.getGlobalPerAgentTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getGlobalPerAgentMessageTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getGlobalPerProviderTimeseries.mockResolvedValue(timeseries);
  apiMocks.getGlobalPerProviderMessageTimeseries.mockResolvedValue(timeseries);
  apiMocks.getGlobalPerModelTimeseries.mockResolvedValue(timeseries);
  apiMocks.getGlobalPerModelMessageTimeseries.mockResolvedValue(timeseries);
  apiMocks.getGlobalPerAgentCostTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getGlobalPerProviderCostTimeseries.mockResolvedValue(timeseries);
  apiMocks.getGlobalPerModelCostTimeseries.mockResolvedValue(timeseries);
  apiMocks.getPerProviderTimeseries.mockResolvedValue(timeseries);
  apiMocks.getPerProviderMessageTimeseries.mockResolvedValue(timeseries);
  apiMocks.getConnectionDetail.mockResolvedValue({
    connection: {
      id: 'conn-openai',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'Default',
      cached_model_count: 10,
      key_prefix: 'sk',
      connected_at: '2026-06-04T09:00:00Z',
      is_active: true,
      last_used_at: '2026-06-04T10:00:00Z',
    },
    agents: [
      {
        agent_name: 'demo-agent',
        agent_platform: 'codex',
        tokens_30d: 1200,
        cost_30d: 1.23,
        messages_30d: 18,
        pct_of_total: 100,
        last_used: '2026-06-04T10:00:00Z',
      },
    ],
    model_usage: [{ model: 'gpt-5', tokens: 1200, cost: 1.23, messages: 18, pct_of_total: 100 }],
    recent_messages: [{ timestamp: '2026-06-04T10:00:00Z', model: 'gpt-5', total_tokens: 1200 }],
  });
  apiMocks.getProviderAnalytics.mockResolvedValue({
    summary: {
      messages: { value: 18, trend_pct: 5 },
      tokens: { value: 1200, trend_pct: 12 },
      cost: { value: 3.21, trend_pct: -4 },
    },
    token_usage: overviewResponse.token_usage,
    message_usage: overviewResponse.message_usage,
  });
  apiMocks.getProviderAnalyticsAgents.mockResolvedValue({ agents: ['demo-agent', 'worker-agent'] });
  apiMocks.getPerAgentTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getPerAgentMessageTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getPerAgentCostTimeseries.mockResolvedValue(agentTimeseries);
});

afterEach(() => {
  cleanup();
});

describe('new provider overview pages', () => {
  it('renders the global overview with agent and provider data', async () => {
    const { container } = render(() => <GlobalOverview />);

    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('All your agents and providers')).toBeDefined();
    expect(screen.getAllByText('Demo Agent').length).toBeGreaterThan(0);
    expect(screen.getByText('OpenAI')).toBeDefined();

    fireEvent.click(screen.getByText('Messages chart'));
    expect(screen.getByTestId('provider-chart-card').getAttribute('data-active-view')).toBe(
      'messages',
    );

    for (const scroller of container.querySelectorAll('.scroll-panel__body')) {
      Object.defineProperties(scroller, {
        scrollHeight: { value: 100, configurable: true },
        scrollTop: { value: 92, configurable: true },
        clientHeight: { value: 10, configurable: true },
      });
      fireEvent.scroll(scroller);
    }
  });

  it('updates global overview grouping, range, and filter controls', async () => {
    sessionStorage.setItem('global-agent-filter', JSON.stringify(['openai']));
    render(() => <GlobalOverview />);

    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'agent' } });
    expect(localStorage.getItem('manifest_global_group')).toBe('agent');

    fireEvent.change(selects[1]!, { target: { value: '30d' } });
    expect(localStorage.getItem('manifest_global_range')).toBe('30d');

    fireEvent.click(screen.getByText('1 of 2 agents'));
    fireEvent.click(screen.getByText('Select all'));
    expect(sessionStorage.getItem('global-agent-filter')).toContain('openai');

    fireEvent.click(screen.getByText('Unselect all'));
    expect(sessionStorage.getItem('global-agent-filter')).toBe('[]');

    fireEvent.click(screen.getByText('All agents (2)'));
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('renders global onboarding states when agents or providers are missing', async () => {
    apiMocks.getAgents.mockRejectedValueOnce(new Error('agents unavailable'));
    apiMocks.fetchJson.mockRejectedValueOnce(new Error('providers unavailable'));

    const { unmount } = render(() => <GlobalOverview />);
    await waitFor(() =>
      expect(
        screen.getByText('Welcome to Manifest. Start by connecting your first agent.'),
      ).toBeDefined(),
    );
    unmount();

    apiMocks.getAgents.mockResolvedValueOnce(agentsResponse);
    apiMocks.fetchJson.mockResolvedValueOnce({ providers: [] });

    const second = render(() => <GlobalOverview />);
    await waitFor(() =>
      expect(
        screen.getByText("Connect a provider to start routing your agents' LLM calls."),
      ).toBeDefined(),
    );
    second.unmount();

    apiMocks.getAgents.mockResolvedValueOnce({ agents: [] });
    apiMocks.fetchJson.mockResolvedValueOnce(providersResponse);

    render(() => <GlobalOverview />);
    await waitFor(() =>
      expect(
        screen.getByText('You have providers connected. Create an agent to start routing.'),
      ).toBeDefined(),
    );
  });

  it('renders an agent overview and persists chart controls', async () => {
    const { container } = render(() => <AgentOverview />);

    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());
    expect(screen.getByText('Models')).toBeDefined();
    expect(screen.getByText('Recent Messages')).toBeDefined();

    fireEvent.change(screen.getByDisplayValue('Last 7 days'), { target: { value: '30d' } });
    expect(sessionStorage.getItem('agent-overview-range:demo-agent')).toBe('30d');

    fireEvent.click(screen.getByText('Messages chart'));
    expect(sessionStorage.getItem('agent-overview-view:demo-agent')).toBe('messages');

    fireEvent.click(screen.getByText('All providers (2)'));
    fireEvent.click(screen.getByText('Unselect all'));
    expect(sessionStorage.getItem('agent-overview-filter:demo-agent')).toBe('[]');

    const openAiFilter = screen
      .getAllByText('OpenAI')
      .find((el) => el.closest('.agent-filter-select'));
    fireEvent.click(openAiFilter!);
    expect(sessionStorage.getItem('agent-overview-filter:demo-agent')).toContain('anthropic');

    fireEvent.keyDown(document, { key: 'Escape' });

    for (const scroller of container.querySelectorAll('.scroll-panel__body')) {
      Object.defineProperties(scroller, {
        scrollHeight: { value: 100, configurable: true },
        scrollTop: { value: 92, configurable: true },
        clientHeight: { value: 10, configurable: true },
      });
      fireEvent.scroll(scroller);
    }
  });

  it('opens setup for a newly created agent and routes to provider setup when empty', async () => {
    recentMocks.isRecentlyCreated.mockReturnValue(true);
    routerState.location = { state: { newApiKey: 'mnfst_test' } };
    apiMocks.getOverview.mockResolvedValue({
      ...overviewResponse,
      has_providers: false,
    });

    render(() => <AgentOverview />);

    await waitFor(() => expect(screen.getByText('Finish setup')).toBeDefined());
    fireEvent.click(screen.getByText('Finish setup'));

    expect(localStorage.getItem('setup_completed_demo-agent')).toBe('1');
    expect(routerState.navigate).toHaveBeenCalledWith('/agents/demo-agent/routing', {
      state: { openProviders: true },
    });
  });

  it('allows dismissing first-run setup without routing away', async () => {
    recentMocks.isRecentlyCreated.mockReturnValue(true);
    routerState.location = { state: { newApiKey: 'mnfst_test' } };

    render(() => <AgentOverview />);

    await waitFor(() => expect(screen.getByText('Close setup')).toBeDefined());
    fireEvent.click(screen.getByText('Close setup'));

    expect(localStorage.getItem('setup_completed_demo-agent')).toBe('1');
    expect(routerState.navigate).not.toHaveBeenCalled();
  });

  it('renders API key provider rows and opens the add-key modal', async () => {
    render(() => <Byok />);

    await waitFor(() => expect(screen.getByText('My API Keys')).toBeDefined());
    expect(screen.getByText('Bring Your Own Key')).toBeDefined();
    expect(screen.getByText('Custom Provider')).toBeDefined();

    fireEvent.click(screen.getAllByText('Add API key')[0]);
    await waitFor(() => {
      expect(screen.getByText('Provider modal')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Modal update'));
    fireEvent.click(screen.getByText('Modal close'));
    await waitFor(() => expect(screen.queryByText('Provider modal')).toBeNull());
  });

  it('renders API key grid cards and deep-links provider setup', async () => {
    render(() => <Byok />);

    await waitFor(() => expect(screen.getByText('Supported providers')).toBeDefined());
    fireEvent.click(screen.getByLabelText('Grid view'));

    const buttons = screen.getAllByText('Add API key');
    fireEvent.click(buttons[buttons.length - 1]!);

    await waitFor(() => {
      expect(screen.getByText('Provider modal').getAttribute('data-provider')).toBe('anthropic');
    });
  });

  it('renders subscription provider rows and savings summary', async () => {
    render(() => <Subscriptions />);

    await waitFor(() => expect(screen.getByText('My Subscriptions')).toBeDefined());
    expect(screen.getByText('Subscriptions')).toBeDefined();
    expect(screen.getByText('Claude')).toBeDefined();

    fireEvent.click(screen.getAllByText('Add subscription')[0]);
    await waitFor(() => {
      expect(screen.getByText('Provider modal')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Modal update'));
    fireEvent.click(screen.getByText('Modal close'));
    await waitFor(() => expect(screen.queryByText('Provider modal')).toBeNull());
  });

  it('renders subscription grid cards and deep-links provider setup', async () => {
    render(() => <Subscriptions />);

    await waitFor(() => expect(screen.getByText('Supported providers')).toBeDefined());
    fireEvent.click(screen.getByLabelText('Grid view'));

    const buttons = screen.getAllByText('Add subscription');
    fireEvent.click(buttons[buttons.length - 1]!);

    await waitFor(() => {
      expect(screen.getByText('Provider modal').getAttribute('data-provider')).toBe('chatgpt');
    });
  });

  it('renders local provider rows and navigates to connection details', async () => {
    apiMocks.getOverview.mockResolvedValueOnce({
      ...overviewResponse,
      cost_by_model: [
        {
          model: 'llama-local',
          tokens: 1200,
          share_pct: 100,
          estimated_cost: 2.5,
          auth_type: 'local',
          provider: 'ollama',
        },
      ],
    });

    render(() => <LocalProviders />);

    await waitFor(() => expect(screen.getByText('My Local Providers')).toBeDefined());
    expect(screen.getByText('Local Providers')).toBeDefined();
    expect(screen.getByText('Estimated savings (30d)')).toBeDefined();

    fireEvent.click(screen.getAllByText('View details')[0]);
    expect(routerState.navigate).toHaveBeenCalledWith('/providers/connections/conn-ollama');
  });

  it('renders local provider grid cards and deep-links provider setup', async () => {
    render(() => <LocalProviders />);

    await waitFor(() => expect(screen.getByText('Supported providers')).toBeDefined());
    fireEvent.click(screen.getByLabelText('Grid view'));
    fireEvent.click(screen.getAllByText('Connect')[0]!);

    await waitFor(() => {
      expect(screen.getByText('Provider modal').getAttribute('data-provider')).toBe('ollama');
    });

    fireEvent.click(screen.getByText('Modal update'));
    fireEvent.click(screen.getByText('Modal close'));
    await waitFor(() => expect(screen.queryByText('Provider modal')).toBeNull());
  });

  it('auto-opens provider modals from add query params', async () => {
    routerState.searchParams = { add: 'true' };
    const { unmount } = render(() => <Byok />);
    await waitFor(() => expect(screen.getByText('Provider modal')).toBeDefined());
    expect(routerState.setSearchParams).toHaveBeenCalledWith({ add: undefined });
    unmount();

    routerState.searchParams = { add: 'true' };
    routerState.setSearchParams.mockClear();
    const second = render(() => <Subscriptions />);
    await waitFor(() => expect(screen.getByText('Provider modal')).toBeDefined());
    expect(routerState.setSearchParams).toHaveBeenCalledWith({ add: undefined });
    second.unmount();

    routerState.searchParams = { add: 'true' };
    routerState.setSearchParams.mockClear();
    render(() => <LocalProviders />);
    await waitFor(() => expect(screen.getByText('Provider modal')).toBeDefined());
    expect(routerState.setSearchParams).toHaveBeenCalledWith({ add: undefined });
  });

  it('renders connection detail analytics and action menu', async () => {
    const { container } = render(() => <ConnectionDetail />);

    await waitFor(() => expect(screen.getByText('Default')).toBeDefined());
    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.getAllByText('gpt-5').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Manage'));
    expect(screen.getByText('Manage connection')).toBeDefined();
    expect(screen.getByText('Disconnect')).toBeDefined();

    for (const scroller of container.querySelectorAll('.scroll-panel__body')) {
      Object.defineProperties(scroller, {
        scrollHeight: { value: 100, configurable: true },
        scrollTop: { value: 92, configurable: true },
        clientHeight: { value: 10, configurable: true },
      });
      fireEvent.scroll(scroller);
    }
  });

  it('updates connection detail filters and disconnects the provider', async () => {
    render(() => <ConnectionDetail />);

    await waitFor(() => expect(screen.getByText('Default')).toBeDefined());

    fireEvent.change(screen.getByDisplayValue('Last 7 days'), { target: { value: '30d' } });
    expect(sessionStorage.getItem('chart-range:conn-openai')).toBe('30d');

    fireEvent.click(screen.getByText('Messages chart'));
    expect(sessionStorage.getItem('chart-view:conn-openai')).toBe('messages');

    fireEvent.click(screen.getByText('All agents (2)'));
    fireEvent.click(screen.getByText('Unselect all'));
    expect(sessionStorage.getItem('agent-filter:conn-openai')).toBe('[]');

    const demoConnectionFilter = screen
      .getAllByText('demo-agent')
      .find((el) => el.closest('.agent-filter-select'));
    fireEvent.click(demoConnectionFilter!);
    expect(sessionStorage.getItem('agent-filter:conn-openai')).toContain('worker-agent');

    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getByText('Manage'));
    fireEvent.click(screen.getByText('Disconnect'));
    expect(screen.getByText('Disconnect OpenAI')).toBeDefined();

    fireEvent.click(screen.getAllByText('Disconnect')[0]!);

    await waitFor(() => {
      expect(apiMocks.disconnectProvider).toHaveBeenCalledWith(
        'demo-agent',
        'openai',
        'api_key',
        'Default',
      );
      expect(routerState.navigate).toHaveBeenCalledWith('/providers/byok');
    });
  });

  it('handles connection rename failures without leaving the save state active', async () => {
    apiMocks.fetchMutate.mockRejectedValueOnce(new Error('rename failed'));

    render(() => <ConnectionDetail />);

    await waitFor(() => expect(screen.getByText('Default')).toBeDefined());

    fireEvent.click(screen.getByText('Manage'));
    fireEvent.input(screen.getByDisplayValue('Default'), { target: { value: 'Primary' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(apiMocks.fetchMutate).toHaveBeenCalled();
      expect(screen.getByText('Save')).toBeDefined();
    });
  });

  it('renders custom inactive connection empty states and reactivation copy', async () => {
    routerState.params = { connectionId: 'conn-custom' };
    apiMocks.getConnectionDetail.mockResolvedValue({
      connection: {
        id: 'conn-custom',
        provider: 'custom:cp-1',
        auth_type: 'api_key',
        label: 'Custom',
        cached_model_count: 0,
        key_prefix: null,
        connected_at: '2026-06-04T09:00:00Z',
        is_active: false,
        last_used_at: null,
      },
      agents: [],
      model_usage: [],
      recent_messages: [],
    });
    apiMocks.getProviderAnalytics.mockResolvedValue({
      summary: {
        messages: { value: 0, trend_pct: 0 },
        tokens: { value: 0, trend_pct: 0 },
      },
      token_usage: [],
      message_usage: [],
    });
    apiMocks.getProviderAnalyticsAgents.mockResolvedValue({ agents: [] });
    apiMocks.getPerAgentTimeseries.mockResolvedValue({ agents: [], timeseries: [] });
    apiMocks.getPerAgentMessageTimeseries.mockResolvedValue({ agents: [], timeseries: [] });
    apiMocks.getPerAgentCostTimeseries.mockResolvedValue({ agents: [], timeseries: [] });

    render(() => <ConnectionDetail />);

    await waitFor(() => expect(screen.getByText('Custom Provider')).toBeDefined());
    expect(screen.getByText('Inactive')).toBeDefined();
    expect(screen.getByText('No messages yet.')).toBeDefined();
    expect(screen.getByText('No model usage data yet.')).toBeDefined();
    expect(screen.getByText('No agents have used this provider yet.')).toBeDefined();

    fireEvent.click(screen.getByText('Manage'));
    expect(screen.getByText(/To reactivate/)).toBeDefined();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  });
});
