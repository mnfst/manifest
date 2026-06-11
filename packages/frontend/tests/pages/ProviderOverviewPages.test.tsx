import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Show } from 'solid-js';

const routerState = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { connectionId: 'conn-openai' } as Record<string, string>,
}));

const apiMocks = vi.hoisted(() => ({
  getAgents: vi.fn(),
  getCustomProviders: vi.fn(),
  getGlobalProviders: vi.fn(),
  getAgentProviders: vi.fn(),
  disconnectProvider: vi.fn(),
  fetchMutate: vi.fn(),
  getOverview: vi.fn(),
  getGlobalPerAgentTimeseries: vi.fn(),
  getGlobalPerAgentMessageTimeseries: vi.fn(),
  getGlobalPerProviderTimeseries: vi.fn(),
  getGlobalPerProviderMessageTimeseries: vi.fn(),
  getGlobalPerAgentCostTimeseries: vi.fn(),
  getGlobalPerProviderCostTimeseries: vi.fn(),
  getConnectionDetail: vi.fn(),
  getProviderAnalytics: vi.fn(),
  getPerAgentTimeseries: vi.fn(),
  getPerAgentMessageTimeseries: vi.fn(),
  getPerAgentCostTimeseries: vi.fn(),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: { children: unknown }) => <title>{props.children}</title>,
}));

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useNavigate: () => routerState.navigate,
  useParams: () => routerState.params,
}));

vi.mock('../../src/services/api/core.js', () => ({
  fetchMutate: (...args: unknown[]) => apiMocks.fetchMutate(...args),
  routingPath: (agent: string, path: string) => `/api/v1/routing/${agent}/${path}`,
}));

vi.mock('../../src/services/api.js', () => ({
  getAgents: (...args: unknown[]) => apiMocks.getAgents(...args),
  getCustomProviders: (...args: unknown[]) => apiMocks.getCustomProviders(...args),
  getGlobalProviders: (...args: unknown[]) => apiMocks.getGlobalProviders(...args),
  disconnectProvider: (...args: unknown[]) => apiMocks.disconnectProvider(...args),
}));

vi.mock('../../src/services/api/routing.js', () => ({
  getProviders: (...args: unknown[]) => apiMocks.getAgentProviders(...args),
  disconnectProvider: (...args: unknown[]) => apiMocks.disconnectProvider(...args),
  renameProviderKey: vi.fn().mockResolvedValue(undefined),
  refreshModels: vi.fn().mockResolvedValue(undefined),
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
  getGlobalPerAgentCostTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerAgentCostTimeseries(...args),
  getGlobalPerProviderCostTimeseries: (...args: unknown[]) =>
    apiMocks.getGlobalPerProviderCostTimeseries(...args),
  getConnectionDetail: (...args: unknown[]) => apiMocks.getConnectionDetail(...args),
  getProviderAnalytics: (...args: unknown[]) => apiMocks.getProviderAnalytics(...args),
  getPerAgentTimeseries: (...args: unknown[]) => apiMocks.getPerAgentTimeseries(...args),
  getPerAgentMessageTimeseries: (...args: unknown[]) =>
    apiMocks.getPerAgentMessageTimeseries(...args),
  getPerAgentCostTimeseries: (...args: unknown[]) => apiMocks.getPerAgentCostTimeseries(...args),
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic', supportsSubscription: true },
    { id: 'ollama', name: 'Ollama', localOnly: true },
  ],
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  // Return null for custom: ids and for the special 'mystery' provider so both
  // the custom and non-custom icon-fallback branches are exercised.
  providerIcon: (provider: string) =>
    provider.startsWith('custom:') || provider === 'mystery' ? null : (
      <span data-provider-icon={provider} />
    ),
  // Return null so the colored-initial fallback path is exercised.
  customProviderLogo: () => null,
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
    costInfoTooltip?: string;
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
      {/* Read every prop so each prop accessor is exercised for coverage. */}
      <span>{props.tokensValue}</span>
      <span>{props.tokensTrendPct ?? 0}</span>
      <span>{props.messagesValue}</span>
      <span>{props.messagesTrendPct ?? 0}</span>
      <span>{props.costValue ?? 0}</span>
      <span>{props.costTrendPct ?? 0}</span>
      <span>{props.costInfoTooltip ?? ''}</span>
      <span>{props.tokenUsage?.length ?? 0}</span>
      <span>{props.messageChartData?.length ?? 0}</span>
      <span>{props.range}</span>
      <span data-testid="ts-agents">{props.agentTimeseries?.agents.join(',') ?? ''}</span>
      <span data-testid="msg-agents">{props.agentMessageTimeseries?.agents.join(',') ?? ''}</span>
      <span data-testid="cost-agents">{props.agentCostTimeseries?.agents.join(',') ?? ''}</span>
      <span data-testid="color-keys">{Object.keys(props.colorMap ?? {}).join(',')}</span>
    </div>
  ),
}));

vi.mock('../../src/components/Sparkline.jsx', () => ({
  default: (props: { data: number[] }) => <span data-testid="sparkline">{props.data.length}</span>,
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

vi.mock('../../src/components/AddAgentModal.jsx', () => ({
  default: (props: { open: boolean; onClose: () => void }) => (
    <Show when={props.open}>
      <div data-testid="add-agent-modal">
        <button onClick={props.onClose}>Dismiss add agent</button>
      </div>
    </Show>
  ),
}));

vi.mock('../../src/components/ProviderSelectModal.jsx', () => ({
  default: (props: {
    agentName?: string;
    providers?: unknown[];
    customProviders?: unknown[];
    providerDeepLink?: { providerId: string } | null;
    onClose: () => void;
    onUpdate: () => void;
  }) => (
    <div data-provider={props.providerDeepLink?.providerId ?? ''}>
      Provider modal
      <span>{props.agentName ?? ''}</span>
      <span>{props.providers?.length ?? 0}</span>
      <span data-testid="modal-custom">{props.customProviders?.length ?? 0}</span>
      <button onClick={props.onUpdate}>Modal update</button>
      <button onClick={props.onClose}>Modal close</button>
    </div>
  ),
}));

vi.mock('../../src/components/AuthBadge.jsx', () => ({
  authLabel: (authType: string) => `auth:${authType}`,
  authBadgeFor: (authType: string | null) => <span data-auth-badge={authType ?? ''} />,
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
  // routing-utils (imported by GlobalOverview for stripCustomPrefix) reads
  // these at module scope.
  SHARED_PROVIDERS: [],
  inferProviderFromModel: (m: string) => (m.startsWith('custom:') ? 'custom' : null),
}));

// Local providers only exist on self-hosted installs; GlobalOverview hides
// the Local stat card in cloud. Default to self-hosted so the dashboard
// tests keep covering the card; cloud tests flip the flag.
let mockIsSelfHosted = true;
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => Promise.resolve(mockIsSelfHosted),
}));

import GlobalOverview from '../../src/pages/GlobalOverview';
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
    {
      // Custom provider row with a backend-resolved name → letter avatar +
      // stripped model text (the literal `custom:` prefix must never render).
      model: 'custom:cp-1/llama-local',
      display_name: 'custom:cp-1/llama-local',
      tokens: 300,
      share_pct: 19,
      estimated_cost: 0.44,
      auth_type: 'api_key',
      provider: 'custom:cp-1',
      custom_provider_name: 'Custom Provider',
    },
    {
      // Deleted custom provider (NULL name) → letter falls back to the model.
      model: 'custom:cp-gone/zeta-model',
      display_name: 'custom:cp-gone/zeta-model',
      tokens: 100,
      share_pct: 6,
      estimated_cost: 0.1,
      auth_type: 'api_key',
      provider: 'custom:cp-gone',
      custom_provider_name: null,
    },
    {
      // Legacy row with no stored provider → no icon, plain display name.
      model: 'orphan-model',
      display_name: 'Orphan Model',
      tokens: 10,
      share_pct: 1,
      estimated_cost: 0.01,
      auth_type: null,
      provider: null,
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
      status: 'ok',
      first_message: 'Hello',
      cost_usd: 1.23,
    },
    {
      timestamp: '2026-06-04T09:00:00Z',
      agent_name: 'demo-agent',
      model: 'gpt-5',
      total_tokens: 50,
      provider: 'openai',
      auth_type: 'api_key',
      status: 'retry',
      description: 'Retry message',
      cost_usd: 0.01,
    },
    {
      timestamp: '2026-06-04T08:00:00Z',
      agent_name: 'worker-agent',
      model: '',
      total_tokens: 0,
      status: 'error',
      cost_usd: 0,
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
      connections: [{ id: 'conn-openai', label: 'Default', is_active: true }],
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
      connections: [{ id: 'conn-anthropic', label: 'Claude', is_active: true }],
      total_models: 8,
      consumption_tokens: 900,
      consumption_messages: 12,
      consumption_cost: 0,
      sparkline_7d: [],
      last_used_at: '2026-06-04T10:00:00Z',
    },
    {
      provider: 'ollama',
      auth_type: 'local',
      connection_count: 1,
      connections: [{ id: 'conn-ollama', label: 'Local', is_active: false }],
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
      // Backend-resolved custom provider name (LEFT JOIN on custom_providers).
      display_name: 'Custom Provider',
      connection_count: 1,
      connections: [{ id: 'conn-custom', label: 'My custom key', is_active: true }],
      total_models: 2,
      consumption_tokens: 300,
      consumption_messages: 4,
      consumption_cost: 0.44,
      sparkline_7d: [0, 1, 1],
      last_used_at: '2026-06-04T10:00:00Z',
    },
    {
      provider: 'custom:cp-2',
      auth_type: 'subscription',
      display_name: 'Sub Custom',
      connection_count: 1,
      connections: [{ id: 'conn-custom-sub', label: 'Default', is_active: true }],
      total_models: 1,
      consumption_tokens: 100,
      consumption_messages: 2,
      consumption_cost: 0,
      sparkline_7d: [],
      last_used_at: '2026-06-04T10:00:00Z',
    },
    {
      provider: 'custom:cp-3',
      auth_type: 'local',
      connection_count: 1,
      connections: [{ id: 'conn-custom-local', label: 'Default', is_active: true }],
      total_models: 1,
      consumption_tokens: 50,
      consumption_messages: 1,
      consumption_cost: 0,
      sparkline_7d: [],
      last_used_at: '2026-06-04T10:00:00Z',
    },
    {
      // Non-custom provider with no icon → exercises the non-custom
      // icon-fallback branch in the provider connections table.
      provider: 'mystery',
      auth_type: 'api_key',
      connection_count: 1,
      connections: [{ id: 'conn-mystery', label: 'Default', is_active: true }],
      total_models: 0,
      consumption_tokens: 10,
      consumption_messages: 1,
      consumption_cost: 0,
      sparkline_7d: [],
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
      agent_platform: null,
      message_count: 8,
      total_tokens: 600,
      sparkline: [],
    },
  ],
};

const agentTimeseries = {
  agents: ['demo-agent', 'worker-agent'],
  timeseries: [{ hour: '2026-06-04 10:00:00', 'demo-agent': 1200, 'worker-agent': 600 }],
};

const providerTimeseries = {
  agents: ['openai', 'anthropic'],
  timeseries: [{ hour: '2026-06-04 10:00:00', openai: 1200, anthropic: 900 }],
};

const connectionDetail = {
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
  recent_messages: [
    {
      timestamp: '2026-06-04T10:00:00Z',
      model: 'gpt-5',
      description: 'Hi there',
      input_tokens: 700,
      output_tokens: 500,
    },
  ],
};

const connectionAnalytics = {
  summary: {
    messages: { value: 18, trend_pct: 5 },
    tokens: { value: 1200, trend_pct: 12 },
  },
  token_usage: overviewResponse.token_usage,
  message_usage: overviewResponse.message_usage,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  routerState.navigate.mockReset();
  routerState.params = { connectionId: 'conn-openai' };
  mockIsSelfHosted = true;

  apiMocks.getAgents.mockResolvedValue(agentsResponse);
  apiMocks.getCustomProviders.mockResolvedValue([
    { id: 'cp-1', name: 'Custom Provider' },
    { id: 'cp-2', name: 'Custom Sub' },
    { id: 'cp-3', name: 'Custom Local' },
  ]);
  apiMocks.getGlobalProviders.mockResolvedValue(providersResponse);
  apiMocks.getAgentProviders.mockResolvedValue([]);
  apiMocks.disconnectProvider.mockResolvedValue({ notifications: [] });
  apiMocks.fetchMutate.mockResolvedValue({});
  apiMocks.getOverview.mockResolvedValue(overviewResponse);
  apiMocks.getGlobalPerAgentTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getGlobalPerAgentMessageTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getGlobalPerProviderTimeseries.mockResolvedValue(providerTimeseries);
  apiMocks.getGlobalPerProviderMessageTimeseries.mockResolvedValue(providerTimeseries);
  apiMocks.getGlobalPerAgentCostTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getGlobalPerProviderCostTimeseries.mockResolvedValue(providerTimeseries);
  apiMocks.getConnectionDetail.mockResolvedValue(connectionDetail);
  apiMocks.getProviderAnalytics.mockResolvedValue(connectionAnalytics);
  apiMocks.getPerAgentTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getPerAgentMessageTimeseries.mockResolvedValue(agentTimeseries);
  apiMocks.getPerAgentCostTimeseries.mockResolvedValue(agentTimeseries);
});

afterEach(() => {
  cleanup();
});

describe('GlobalOverview (analytics)', () => {
  it('shows the Local stat card with a 4-column grid when self-hosted', async () => {
    const { container } = render(() => <GlobalOverview />);
    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('.overview-stat-card__label')).map(
        (el) => el.textContent,
      );
      expect(labels).toContain('Local');
    });
    expect(container.querySelector('.overview-stats')?.getAttribute('style')).toContain(
      'repeat(4, 1fr)',
    );
  });

  it('hides the Local stat card and drops to a 3-column grid in cloud', async () => {
    mockIsSelfHosted = false;
    const { container } = render(() => <GlobalOverview />);
    await waitFor(() => {
      expect(container.querySelector('.overview-stats')?.getAttribute('style')).toContain(
        'repeat(3, 1fr)',
      );
    });
    const labels = Array.from(container.querySelectorAll('.overview-stat-card__label')).map(
      (el) => el.textContent,
    );
    expect(labels).not.toContain('Local');
    expect(labels).toContain('Subscriptions');
  });

  it('renders the dashboard with harness and provider data', async () => {
    const { container } = render(() => <GlobalOverview />);

    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('All your harnesses and providers')).toBeDefined();
    expect(screen.getAllByText('Demo Agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    expect(screen.getByText('Success')).toBeDefined();
    expect(screen.getByText('Retried')).toBeDefined();
    expect(screen.getByText('Failed')).toBeDefined();
    // custom provider name resolves asynchronously
    await waitFor(() => expect(screen.getAllByText('Custom Provider').length).toBeGreaterThan(0));
    // model usage + provider connection rows render
    expect(screen.getByText('GPT-5')).toBeDefined();
    // custom cost-by-model rows show the stripped model text (no `custom:`),
    // with a letter avatar from the provider name — or from the model when
    // the provider was deleted (NULL custom_provider_name).
    expect(screen.getByText('llama-local')).toBeDefined();
    expect(screen.getByText('zeta-model')).toBeDefined();
    expect(container.textContent).not.toContain('custom:cp-1/');
    expect(container.textContent).not.toContain('custom:cp-gone/');

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

  it('navigates to harness and connection detail on row click', async () => {
    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());

    // provider connection row → connection detail
    const providerCell = screen
      .getAllByText('OpenAI')
      .map((el) => el.closest('tr'))
      .find((tr) => tr?.querySelector('td'));
    fireEvent.click(providerCell!);
    expect(routerState.navigate).toHaveBeenCalledWith('/providers/connections/conn-openai');

    // harness row → harness detail
    const harnessRow = screen
      .getAllByText('Worker Agent')
      .map((el) => el.closest('tr'))
      .find((tr) => tr);
    fireEvent.click(harnessRow!);
    expect(routerState.navigate).toHaveBeenCalledWith('/harnesses/worker-agent');
  });

  it('updates grouping, range, and harness filter controls', async () => {
    // Selection is scoped per grouping; seed the harness-grouping key.
    sessionStorage.setItem('global-agent-filter:agent', JSON.stringify(['demo-agent']));
    render(() => <GlobalOverview />);

    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'agent' } });
    expect(localStorage.getItem('manifest_global_group')).toBe('agent');

    fireEvent.change(selects[1]!, { target: { value: '30d' } });
    expect(localStorage.getItem('manifest_global_range')).toBe('30d');

    // After grouping by harness, the filter trigger lists harnesses.
    await waitFor(() => expect(screen.getByText('1 of 2 harnesses')).toBeDefined());
    fireEvent.click(screen.getByText('1 of 2 harnesses'));
    fireEvent.click(screen.getByText('Select all'));
    expect(sessionStorage.getItem('global-agent-filter:agent')).toContain('demo-agent');

    // With all selected, toggling one off persists the remaining selection.
    const toggle = screen
      .getAllByText('worker-agent')
      .find((el) => el.closest('.agent-filter-select'));
    fireEvent.click(toggle!);
    const saved = sessionStorage.getItem('global-agent-filter:agent')!;
    expect(saved).toContain('demo-agent');
    expect(saved).not.toContain('worker-agent');

    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('keeps series visible when switching groupings (selection scoped per group)', async () => {
    // Provider mode: deselect everything except 'openai'. That persisted set
    // must NOT bleed into harness mode (which lists demo-agent/worker-agent) —
    // otherwise the intersection is empty and the chart blanks out.
    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());

    // In provider grouping the series list is the provider timeseries agents.
    await waitFor(() => expect(screen.getByText('All providers (2)')).toBeDefined());
    fireEvent.click(screen.getByText('All providers (2)'));
    // Toggle 'openai' off (from the all-selected set) so only 'anthropic'
    // remains — a partial provider-mode selection that must persist per group.
    const openaiToggle = screen
      .getAllByText('openai')
      .find((el) => el.closest('.agent-filter-select'));
    fireEvent.click(openaiToggle!);
    expect(sessionStorage.getItem('global-agent-filter:provider')).toContain('anthropic');
    expect(sessionStorage.getItem('global-agent-filter:provider')).not.toContain('openai');

    // Switch to harness grouping. The harness selection is independent and
    // defaults to all selected, so the chart still shows every harness series.
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'agent' } });
    await waitFor(() => expect(screen.getByText('All harnesses (2)')).toBeDefined());
    // The chart card receives both harness series (not blanked out).
    expect(screen.getByTestId('ts-agents').textContent).toContain('demo-agent');
    expect(screen.getByTestId('ts-agents').textContent).toContain('worker-agent');

    // Switch back to provider grouping: the earlier provider selection is
    // restored (only anthropic), proving per-group isolation.
    fireEvent.change(selects[0]!, { target: { value: 'provider' } });
    await waitFor(() => expect(screen.getByText('1 of 2 providers')).toBeDefined());
    expect(screen.getByTestId('ts-agents').textContent).toBe('anthropic');
  });

  it('defaults to all-selected when a persisted selection no longer intersects', async () => {
    // A stale selection (e.g. left over from another grouping) that shares no
    // members with the current series must fall back to "all selected" rather
    // than blanking the chart.
    sessionStorage.setItem('global-agent-filter:provider', JSON.stringify(['ghost-series']));
    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());
    await waitFor(() => expect(screen.getByText('All providers (2)')).toBeDefined());
    // Both providers still render despite the stale persisted set.
    expect(screen.getByTestId('ts-agents').textContent).toContain('openai');
    expect(screen.getByTestId('ts-agents').textContent).toContain('anthropic');
  });

  it('shows custom provider names instead of custom:<uuid> in provider series', async () => {
    const customSeries = {
      agents: ['openai', 'custom:cp-1'],
      timeseries: [{ hour: '2026-06-04 10:00:00', openai: 1200, 'custom:cp-1': 300 }],
    };
    apiMocks.getGlobalPerProviderTimeseries.mockResolvedValue(customSeries);
    apiMocks.getGlobalPerProviderMessageTimeseries.mockResolvedValue(customSeries);
    apiMocks.getGlobalPerProviderCostTimeseries.mockResolvedValue(customSeries);
    // A custom model with no display_name must render its stripped name, not
    // the raw custom:<uuid>/ slug.
    apiMocks.getOverview.mockResolvedValue({
      ...overviewResponse,
      cost_by_model: [
        {
          model: 'custom:cp-1/qwen-2.5',
          display_name: null,
          tokens: 300,
          share_pct: 25,
          estimated_cost: 0.1,
          auth_type: 'api_key',
          provider: 'custom:cp-1',
        },
      ],
    });

    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());

    // Chart series and filter list the resolved name once customProviderData loads.
    await waitFor(() =>
      expect(screen.getByTestId('ts-agents').textContent).toContain('Custom Provider'),
    );
    expect(screen.getByTestId('ts-agents').textContent).not.toContain('custom:cp-1');
    fireEvent.click(screen.getByText('All providers (2)'));
    expect(
      screen.getAllByText('Custom Provider').some((el) => el.closest('.agent-filter-select')),
    ).toBe(true);

    // Model usage renders the stripped model name.
    expect(screen.getByText('qwen-2.5')).toBeDefined();
  });

  it('shows the empty state when there are no harnesses and no providers', async () => {
    apiMocks.getAgents.mockResolvedValue({ agents: [] });
    apiMocks.getGlobalProviders.mockResolvedValue({ providers: [] });

    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeDefined());
    expect(screen.getByText('Set up harness')).toBeDefined();

    // The Add Harness modal opens from the empty-state CTA.
    fireEvent.click(screen.getByText('Set up harness'));
    await waitFor(() => expect(screen.getByTestId('add-agent-modal')).toBeDefined());
    fireEvent.click(screen.getByText('Dismiss add agent'));
    await waitFor(() => expect(screen.queryByTestId('add-agent-modal')).toBeNull());
  });

  it('adds a harness back to a partial selection via the filter toggle', async () => {
    localStorage.setItem('manifest_global_group', 'agent');
    sessionStorage.setItem('global-agent-filter:agent', JSON.stringify(['demo-agent']));
    render(() => <GlobalOverview />);

    await waitFor(() => expect(screen.getByText('1 of 2 harnesses')).toBeDefined());
    fireEvent.click(screen.getByText('1 of 2 harnesses'));

    const toggle = screen
      .getAllByText('worker-agent')
      .find((el) => el.closest('.agent-filter-select'));
    fireEvent.click(toggle!);
    const saved = sessionStorage.getItem('global-agent-filter:agent')!;
    expect(saved).toContain('demo-agent');
    expect(saved).toContain('worker-agent');
  });

  it('survives storage failures when reading and writing filter state', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByTestId('provider-chart-card')).toBeDefined());

    const selects = screen.getAllByRole('combobox');
    // group → harness, range → 30d both attempt to persist and swallow errors
    fireEvent.change(selects[0]!, { target: { value: 'agent' } });
    fireEvent.change(selects[1]!, { target: { value: '30d' } });

    await waitFor(() => expect(screen.getByText('All harnesses (2)')).toBeDefined());
    fireEvent.click(screen.getByText('All harnesses (2)'));
    // Toggle one harness off → partial selection enables "Select all", letting
    // us exercise the Select all persistence handler (which swallows the thrown
    // storage error).
    const toggle = screen
      .getAllByText('demo-agent')
      .find((el) => el.closest('.agent-filter-select'));
    fireEvent.click(toggle!);
    fireEvent.click(screen.getByText('Select all'));

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('swallows storage errors when dismissing the onboarding modal', async () => {
    apiMocks.getAgents.mockResolvedValue({ agents: [] });
    apiMocks.getGlobalProviders.mockResolvedValue({ providers: [] });

    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeDefined());
    fireEvent.click(screen.getByText('Set up harness'));
    await waitFor(() => expect(screen.getByTestId('add-agent-modal')).toBeDefined());

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    fireEvent.click(screen.getByText('Dismiss add agent'));
    await waitFor(() => expect(screen.queryByTestId('add-agent-modal')).toBeNull());
    setItem.mockRestore();
  });

  it('shows the no-providers state when harnesses exist without providers', async () => {
    apiMocks.getGlobalProviders.mockResolvedValue({ providers: [] });

    render(() => <GlobalOverview />);
    await waitFor(() => expect(screen.getByText('No providers connected')).toBeDefined());
    expect(screen.getByText('Connect provider')).toBeDefined();
  });

  it('falls back to empty arrays when the providers and agents calls reject', async () => {
    apiMocks.getAgents.mockRejectedValue(new Error('agents down'));
    apiMocks.getGlobalProviders.mockRejectedValue(new Error('providers down'));

    render(() => <GlobalOverview />);
    // Both empty → onboarding empty state
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeDefined());
  });
});

describe('ConnectionDetail (analytics)', () => {
  it('renders connection analytics, models, and harness breakdown', async () => {
    const { container } = render(() => <ConnectionDetail />);

    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Harnesses').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gpt-5').length).toBeGreaterThan(0);
    // Recent messages table renders model and token data (description is no longer displayed).
    expect(screen.getByText('Recent Messages')).toBeDefined();
    // BYOK connection → cost columns present
    expect(screen.getByText('Active')).toBeDefined();

    // Manage opens an inline modal (not the ProviderSelectModal).
    fireEvent.click(screen.getByText('Manage'));
    expect(screen.getByText('Connection name')).toBeDefined();
    // Close the inline manage modal via the Done button.
    fireEvent.click(screen.getByText('Done'));

    for (const scroller of container.querySelectorAll('.scroll-panel__body')) {
      Object.defineProperties(scroller, {
        scrollHeight: { value: 100, configurable: true },
        scrollTop: { value: 92, configurable: true },
        clientHeight: { value: 10, configurable: true },
      });
      fireEvent.scroll(scroller);
    }
  });

  it('persists chart range/view and harness filter selection', async () => {
    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByDisplayValue('Last 7 days'), { target: { value: '30d' } });
    expect(sessionStorage.getItem('chart-range:conn-openai')).toBe('30d');

    fireEvent.click(screen.getByText('Messages chart'));
    expect(sessionStorage.getItem('chart-view:conn-openai')).toBe('messages');

    fireEvent.click(screen.getByText('All harnesses (2)'));

    const filterToggle = () =>
      screen.getAllByText('demo-agent').find((el) => el.closest('.agent-filter-select'))!;
    // Toggle demo-agent off from the all-selected set → partial selection.
    fireEvent.click(filterToggle());
    expect(sessionStorage.getItem('agent-filter:conn-openai')).not.toContain('demo-agent');
    expect(sessionStorage.getItem('agent-filter:conn-openai')).toContain('worker-agent');
    // Toggle demo-agent back on.
    fireEvent.click(filterToggle());
    expect(sessionStorage.getItem('agent-filter:conn-openai')).toContain('demo-agent');

    fireEvent.click(screen.getByText('Select all'));
    expect(sessionStorage.getItem('agent-filter:conn-openai')).toContain('demo-agent');
    expect(sessionStorage.getItem('agent-filter:conn-openai')).toContain('worker-agent');
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('defaults to all harnesses selected when no selection is persisted, then honors a saved empty selection', async () => {
    // No persisted preference → effectiveSelected() is all agents.
    sessionStorage.removeItem('agent-filter:conn-openai');
    const first = render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('All harnesses (2)'));
    // "All harnesses (2)" label reflects all-selected by default.
    expect(screen.getAllByText('All harnesses (2)').length).toBeGreaterThan(0);
    first.unmount();

    // A persisted empty selection ([]) must be restored as a genuine empty
    // selection on reload, not reset to "all selected".
    sessionStorage.setItem('agent-filter:conn-openai', '[]');
    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('0 of 2 harnesses'));
    expect(screen.getAllByText('0 of 2 harnesses').length).toBeGreaterThan(0);
  });

  it('opens the inline manage modal from the connection detail', async () => {
    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByText('Manage'));
    // The inline manage modal shows connection name, models, and disconnect.
    expect(screen.getByText('Connection name')).toBeDefined();
    fireEvent.click(screen.getByText('Done'));
  });

  it('renders inactive custom connection with reactivation copy', async () => {
    routerState.params = { connectionId: 'conn-custom' };
    apiMocks.getConnectionDetail.mockResolvedValue({
      connection: {
        id: 'conn-custom',
        provider: 'custom:cp-1',
        auth_type: 'subscription',
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
    apiMocks.getPerAgentTimeseries.mockResolvedValue({ agents: [], timeseries: [] });
    apiMocks.getPerAgentMessageTimeseries.mockResolvedValue({ agents: [], timeseries: [] });
    apiMocks.getPerAgentCostTimeseries.mockResolvedValue({ agents: [], timeseries: [] });

    render(() => <ConnectionDetail />);

    await waitFor(() => expect(screen.getByText('Custom Provider')).toBeDefined());
    // "Custom" appears both as the badge and as the connection label.
    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0);
    expect(screen.getByText('Inactive')).toBeDefined();
    expect(screen.getByText('No messages yet.')).toBeDefined();
    expect(screen.getByText('No model usage data yet.')).toBeDefined();
    expect(screen.getByText('No harnesses have used this provider yet.')).toBeDefined();
    // Manage button is present even for inactive connections.
    expect(screen.getByText('Manage')).toBeDefined();
    // back link points to subscriptions for subscription auth type
    expect(screen.getByText(/Subscriptions/)).toBeDefined();
  });

  it('shows a loading state until the connection detail resolves', async () => {
    let resolveDetail!: (value: unknown) => void;
    apiMocks.getConnectionDetail.mockReturnValue(
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
    );

    const { container } = render(() => <ConnectionDetail />);
    // Loading state renders a skeleton placeholder (no "Loading..." text).
    expect(container.querySelector('[style*="skeleton-pulse"]')).not.toBeNull();

    resolveDetail(connectionDetail);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));
  });

  it('shows a not-found state for a missing/deleted connection (P3)', async () => {
    // A resolved-but-null connection must render not-found, never spin on the
    // loading fallback forever.
    apiMocks.getConnectionDetail.mockResolvedValue({
      connection: null,
      agents: [],
      model_usage: [],
      recent_messages: [],
    });

    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getByText('Connection not found')).toBeDefined());
    expect(screen.queryByText('Loading...')).toBeNull();
    expect(screen.getByText('Back to overview')).toBeDefined();
  });

  it('scopes every chart query to the connection label (P2)', async () => {
    // The detail page must pass the connection's label to all chart/summary
    // queries so two connections sharing provider+auth_type but differing by
    // label don't show each other's usage.
    routerState.params = { connectionId: 'conn-work' };
    apiMocks.getConnectionDetail.mockResolvedValue({
      ...connectionDetail,
      connection: { ...connectionDetail.connection, id: 'conn-work', label: 'Work' },
    });

    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Work').length).toBeGreaterThan(0));

    // analytics summary/timeseries: getProviderAnalytics(authType, range, agent, provider, label)
    const analyticsCall = apiMocks.getProviderAnalytics.mock.calls.at(-1)!;
    expect(analyticsCall[4]).toBe('Work');
    // per-agent token/message/cost fetchers: (...args, range, label)
    expect(apiMocks.getPerAgentTimeseries.mock.calls.at(-1)![3]).toBe('Work');
    expect(apiMocks.getPerAgentMessageTimeseries.mock.calls.at(-1)![3]).toBe('Work');
    expect(apiMocks.getPerAgentCostTimeseries.mock.calls.at(-1)![3]).toBe('Work');
  });

  it('opens the inline manage modal for a custom provider connection', async () => {
    routerState.params = { connectionId: 'conn-custom' };
    apiMocks.getConnectionDetail.mockResolvedValue({
      ...connectionDetail,
      connection: {
        ...connectionDetail.connection,
        id: 'conn-custom',
        provider: 'custom:cp-1',
        label: 'Custom key',
      },
    });

    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getByText('Custom Provider')).toBeDefined());

    fireEvent.click(screen.getByText('Manage'));
    expect(screen.getByText('Connection name')).toBeDefined();
    fireEvent.click(screen.getByText('Done'));
  });

  it('falls back to empty data when the custom provider lookup rejects', async () => {
    routerState.params = { connectionId: 'conn-custom' };
    apiMocks.getConnectionDetail.mockResolvedValue({
      ...connectionDetail,
      connection: {
        ...connectionDetail.connection,
        id: 'conn-custom',
        provider: 'custom:cp-1',
        label: 'Custom key',
      },
    });
    // Custom provider name lookup rejects → resolver returns null → provider id
    // is shown as the display name.
    apiMocks.getCustomProviders.mockRejectedValue(new Error('custom lookup failed'));

    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Custom key').length).toBeGreaterThan(0));
  });

  it('falls back to no providers when the harness list cannot load', async () => {
    apiMocks.getAgents.mockRejectedValue(new Error('agents down'));

    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));

    // Manage still opens the inline modal even when harness list fails.
    fireEvent.click(screen.getByText('Manage'));
    expect(screen.getByText('Connection name')).toBeDefined();
    fireEvent.click(screen.getByText('Done'));
  });

  it('falls back to an empty provider list when the routing call rejects', async () => {
    // Harness list loads, but the per-harness provider fetch rejects → the
    // inline manage modal still opens normally.
    apiMocks.getAgentProviders.mockRejectedValue(new Error('providers down'));

    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByText('Manage'));
    expect(screen.getByText('Connection name')).toBeDefined();
    fireEvent.click(screen.getByText('Done'));
  });

  it('swallows storage failures across chart and filter persistence', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    render(() => <ConnectionDetail />);
    await waitFor(() => expect(screen.getAllByText('Default').length).toBeGreaterThan(0));

    // range + view persistence both throw and are swallowed
    fireEvent.change(screen.getByDisplayValue('Last 7 days'), { target: { value: '30d' } });
    fireEvent.click(screen.getByText('Messages chart'));

    // filter persistence (toggle / select all) all throw + swallow
    fireEvent.click(screen.getByText('All harnesses (2)'));
    const toggle = screen
      .getAllByText('demo-agent')
      .find((el) => el.closest('.agent-filter-select'));
    fireEvent.click(toggle!);
    fireEvent.click(screen.getByText('Select all'));

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
