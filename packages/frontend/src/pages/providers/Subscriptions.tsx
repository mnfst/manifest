import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import {
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  onCleanup,
  type Component,
} from 'solid-js';
import { fetchJson } from '../../services/api/core.js';
import { getAgents } from '../../services/api.js';
import {
  getProviderAnalytics,
  getProviderAnalyticsAgents,
  getPerAgentTimeseries,
  getPerAgentMessageTimeseries,
} from '../../services/api/analytics.js';
import { getProviders as getAgentProviders } from '../../services/api/routing.js';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import { formatNumber, formatTimeAgo } from '../../services/formatters.js';
import ProviderSelectModal from '../../components/ProviderSelectModal.jsx';
import ProviderChartCard from '../../components/ProviderChartCard.jsx';
import { AGENT_COLORS } from '../../components/MultiAgentTokenChart.jsx';
import Sparkline from '../../components/Sparkline.jsx';
import ActionMenu from '../../components/ActionMenu.jsx';
import Select from '../../components/Select.jsx';
import type { RoutingProvider } from '../../services/api/routing.js';
import '../../styles/charts.css';

interface Connection {
  id: string;
  label: string;
  key_prefix: string | null;
  cached_model_count: number;
  is_active: boolean;
}

interface ConnectedProvider {
  provider: string;
  auth_type: string;
  connection_count: number;
  connections: Connection[];
  total_models: number;
  consumption_tokens: number;
  consumption_messages: number;
  sparkline_7d?: number[];
  last_used_at?: string | null;
}

interface ProvidersResponse {
  providers: ConnectedProvider[];
  model_counts: Record<string, number>;
}

const SUBSCRIPTION_PROVIDERS = PROVIDERS.filter((p) => p.supportsSubscription);

const Subscriptions: Component = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = createSignal(false);
  const [deepLinkProvider, setDeepLinkProvider] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<'list' | 'grid'>('list');

  const [data, { refetch }] = createResource(async () => {
    try {
      return (await fetchJson('/providers')) as ProvidersResponse;
    } catch {
      return { providers: [], model_counts: {} };
    }
  });

  const [agents] = createResource(async () => {
    try {
      const res = await getAgents();
      return (res as any)?.agents ?? res ?? [];
    } catch {
      return [];
    }
  });

  const firstAgentName = () => (agents() ?? [])[0]?.agent_name ?? '';

  // Fetch the real RoutingProvider[] from the agent endpoint for the modal
  const [modalProviders, { refetch: refetchModalProviders }] = createResource(
    () => firstAgentName(),
    async (agentName) => {
      if (!agentName) return [];
      try {
        return await getAgentProviders(agentName);
      } catch {
        return [];
      }
    },
  );

  const connectedMap = () => {
    const map = new Map<string, ConnectedProvider>();
    for (const p of data()?.providers ?? []) {
      if (p.auth_type === 'subscription') map.set(p.provider, p);
    }
    return map;
  };

  const modelCounts = () => data()?.model_counts ?? {};
  const isConnected = (id: string) => connectedMap().has(id);
  const getConnected = (id: string) => connectedMap().get(id);
  const connectedProviders = () => SUBSCRIPTION_PROVIDERS.filter((p) => isConnected(p.id));

  // Flatten: one row per connection — show if active OR has historical consumption
  const connectedRows = () => {
    const rows: Array<{
      prov: (typeof SUBSCRIPTION_PROVIDERS)[0];
      conn: Connection;
      cp: ConnectedProvider;
    }> = [];
    for (const prov of connectedProviders()) {
      const cp = getConnected(prov.id)!;
      const hasConsumption = cp.consumption_tokens > 0 || cp.consumption_messages > 0;
      for (const conn of cp.connections) {
        if (conn.is_active || hasConsumption) {
          rows.push({ prov, conn, cp });
        }
      }
    }
    return rows;
  };

  const getModelCount = (provId: string) => {
    const cp = getConnected(provId);
    if (cp && cp.total_models > 0) return cp.total_models;
    const counts = modelCounts();
    return counts[provId.toLowerCase()] ?? counts[provId] ?? null;
  };

  const openConnect = (provId?: string) => {
    setDeepLinkProvider(provId ?? null);
    refetchModalProviders();
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setDeepLinkProvider(null);
    refetch();
  };

  // Chart state
  const [chartRange, setChartRange] = createSignal('7d');
  const [chartView, setChartView] = createSignal<'messages' | 'tokens'>('tokens');

  interface AnalyticsResponse {
    summary: {
      messages: { value: number; trend_pct: number };
      tokens: { value: number; trend_pct: number };
    };
    token_usage: Array<{
      hour?: string;
      date?: string;
      input_tokens: number;
      output_tokens: number;
    }>;
    message_usage: Array<{ hour?: string; date?: string; count: number }>;
  }

  const [analytics] = createResource(
    () => chartRange(),
    (range) => getProviderAnalytics('subscription', range) as Promise<AnalyticsResponse>,
  );

  const [agentTimeseries] = createResource(
    () => chartRange(),
    (range) => getPerAgentTimeseries('subscription', '', range),
  );

  const [agentMessageTimeseries] = createResource(
    () => chartRange(),
    (range) => getPerAgentMessageTimeseries('subscription', '', range),
  );

  const messageChartData = createMemo(() => {
    const src = analytics()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  // Agent filter (multi-select toggle)
  const [selectedAgents, setSelectedAgents] = createSignal<Set<string>>(new Set<string>());
  const [agentFilterOpen, setAgentFilterOpen] = createSignal(false);
  let agentFilterRef: HTMLDivElement | undefined;

  if (typeof document !== 'undefined') {
    const handleClickOutside = (e: MouseEvent) => {
      if (agentFilterRef && !agentFilterRef.contains(e.target as Node)) setAgentFilterOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAgentFilterOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    });
  }

  const allAgents = createMemo(() => {
    const t = agentTimeseries()?.agents ?? [];
    const m = agentMessageTimeseries()?.agents ?? [];
    return [...new Set([...t, ...m])].sort();
  });

  const agentColorMap = createMemo(() => {
    const map: Record<string, string> = {};
    const agents = allAgents();
    for (let i = 0; i < agents.length; i++)
      map[agents[i]!] = AGENT_COLORS[i % AGENT_COLORS.length]!;
    return map;
  });

  const effectiveSelected = () => {
    const sel = selectedAgents();
    if (sel.size === 0 && allAgents().length > 0) return new Set(allAgents());
    return sel;
  };
  const selectedAgentCount = () => effectiveSelected().size;

  const toggleAgent = (agent: string) => {
    const current = effectiveSelected();
    const next = new Set(current);
    if (next.has(agent)) next.delete(agent);
    else next.add(agent);
    setSelectedAgents(next);
  };

  const filteredAgentTimeseries = createMemo(() => {
    const raw = agentTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents, timeseries };
  });

  const filteredAgentMessageTimeseries = createMemo(() => {
    const raw = agentMessageTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents, timeseries };
  });

  const providerDeepLink = () => {
    const p = deepLinkProvider();
    return p ? { providerId: p, authType: 'subscription' as const, closeOnBack: true } : null;
  };

  return (
    <div class="container--lg">
      <Title>Subscriptions | Manifest</Title>
      <div class="page-header" style="border-bottom: none; padding-bottom: 0;">
        <div>
          <h1 class="page-header__title">Subscriptions</h1>
          <p class="page-header__subtitle">
            Connect flat-rate subscriptions to route queries through your existing plans.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <Show when={allAgents().length > 1}>
            <div class="agent-filter-select" ref={agentFilterRef}>
              <button
                class="agent-filter-select__trigger"
                onClick={() => setAgentFilterOpen(!agentFilterOpen())}
                type="button"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {selectedAgentCount() === allAgents().length
                  ? `All agents (${allAgents().length})`
                  : `${selectedAgentCount()} of ${allAgents().length} agents`}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <Show when={agentFilterOpen()}>
                <div class="agent-filter-select__dropdown">
                  <div class="agent-filter-select__actions">
                    <button
                      class="agent-filter-select__action-btn"
                      type="button"
                      disabled={selectedAgentCount() === allAgents().length}
                      onClick={() => setSelectedAgents(new Set(allAgents()))}
                    >
                      Select all
                    </button>
                    <button
                      class="agent-filter-select__action-btn"
                      type="button"
                      disabled={selectedAgentCount() === 0}
                      onClick={() => setSelectedAgents(new Set<string>())}
                    >
                      Unselect all
                    </button>
                  </div>
                  <For each={allAgents()}>
                    {(agent) => {
                      const isOn = () => effectiveSelected().has(agent);
                      return (
                        <button
                          class="agent-filter-select__item"
                          onClick={() => toggleAgent(agent)}
                          type="button"
                        >
                          <span
                            class="agent-filter-select__swatch"
                            style={{ background: agentColorMap()[agent] }}
                          />
                          <span class="agent-filter-select__name">{agent}</span>
                          <span
                            class="agent-filter-select__toggle"
                            classList={{ 'agent-filter-select__toggle--on': isOn() }}
                          >
                            <span class="agent-filter-select__toggle-thumb" />
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
          <Select
            value={chartRange()}
            onChange={setChartRange}
            options={[
              { label: 'Last 24 hours', value: '24h' },
              { label: 'Last 7 days', value: '7d' },
              { label: 'Last 30 days', value: '30d' },
            ]}
          />
        </div>
      </div>
      <Show when={analytics()}>
        <ProviderChartCard
          activeView={chartView()}
          onViewChange={setChartView}
          messagesValue={analytics()!.summary.messages.value}
          messagesTrendPct={analytics()!.summary.messages.trend_pct}
          tokensValue={analytics()!.summary.tokens.value}
          tokensTrendPct={analytics()!.summary.tokens.trend_pct}
          tokenUsage={analytics()!.token_usage}
          messageChartData={messageChartData()}
          range={chartRange()}
          agentTimeseries={filteredAgentTimeseries() ?? undefined}
          agentMessageTimeseries={filteredAgentMessageTimeseries() ?? undefined}
          colorMap={agentColorMap()}
        />
      </Show>

      {/* TABLE 1: My Subscriptions (active + inactive with history) */}
      <Show when={connectedRows().length > 0}>
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
          My Subscriptions
        </h3>
        <div class="panel" style="padding: 0; margin-bottom: 24px; overflow-x: auto;">
          <table class="data-table" style="min-width: 700px;">
            <colgroup>
              <col style="width: 214px;" />
              <col style="width: 60px;" />
              <col style="width: 100px;" />
              <col />
              <col style="width: 90px;" />
              <col style="width: 70px;" />
              <col style="width: 100px;" />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Models</th>
                <th>Name</th>
                <th>Usage (30d)</th>
                <th>Status</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={connectedRows()}>
                {(row) => {
                  const perKeyTokens = () =>
                    Math.round(row.cp.consumption_tokens / row.cp.connection_count);
                  const active = () => row.conn.is_active;
                  return (
                    <tr
                      style="cursor: pointer;"
                      onClick={() => navigate(`/providers/connections/${row.conn.id}`)}
                    >
                      <td>
                        <span style="display: flex; align-items: center; gap: 10px;">
                          <span style="display: flex; align-items: center; width: 20px; height: 20px;">
                            {providerIcon(row.prov.id, 20)}
                          </span>
                          <span style="font-weight: 500;">{row.prov.name}</span>
                        </span>
                      </td>
                      <td>{row.conn.cached_model_count || getModelCount(row.prov.id) || '—'}</td>
                      <td style="color: hsl(var(--muted-foreground));">{row.conn.label}</td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <Show when={row.cp.sparkline_7d?.length}>
                            <Sparkline data={row.cp.sparkline_7d!} width={60} height={20} />
                          </Show>
                          <span>{formatNumber(perKeyTokens())} tokens</span>
                        </div>
                      </td>
                      <td>
                        <Show
                          when={active()}
                          fallback={
                            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); font-weight: 500;">
                              Inactive
                            </span>
                          }
                        >
                          <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-xs); font-weight: 600;">
                            Active
                          </span>
                        </Show>
                      </td>
                      <td style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                        {row.cp.last_used_at ? formatTimeAgo(row.cp.last_used_at) : '—'}
                      </td>
                      <td style="text-align: right;">
                        <button
                          class="btn btn--outline btn--sm"
                          style="font-size: var(--font-size-xs);"
                          onClick={() => navigate(`/providers/connections/${row.conn.id}`)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* TABLE 2: Supported providers with list/grid toggle */}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin: 0;">
          Supported providers
        </h3>
        <div class="panel__tabs" role="tablist" style="height: 30px;">
          <button
            role="tab"
            aria-selected={viewMode() === 'list'}
            class="panel__tab"
            classList={{ 'panel__tab--active': viewMode() === 'list' }}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            style="padding: 0 8px;"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M4 11h16v2H4zm0-5h16v2H4zm0 10h16v2H4z" />
            </svg>
          </button>
          <button
            role="tab"
            aria-selected={viewMode() === 'grid'}
            class="panel__tab"
            classList={{ 'panel__tab--active': viewMode() === 'grid' }}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            style="padding: 0 8px;"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 3h4v4H3zm7 0h4v4h-4z" />
              <path d="M10 3h4v4h-4zm7 0h4v4h-4zM3 17h4v4H3zm7 0h4v4h-4z" />
              <path d="M10 17h4v4h-4zm7 0h4v4h-4zM3 10h4v4H3zm7 0h4v4h-4z" />
              <path d="M10 10h4v4h-4zm7 0h4v4h-4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* List view */}
      <Show when={viewMode() === 'list'}>
        <div class="panel" style="padding: 0; overflow-x: auto;">
          <table class="data-table" style="min-width: 500px;">
            <colgroup>
              <col style="width: 214px;" />
              <col style="width: 80px;" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Models</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={SUBSCRIPTION_PROVIDERS}>
                {(prov) => {
                  const cp = () => getConnected(prov.id);
                  const activeCount = () =>
                    cp()?.connections.filter((c) => c.is_active).length ?? 0;
                  return (
                    <tr>
                      <td>
                        <span style="display: flex; align-items: center; gap: 10px;">
                          <span style="display: flex; align-items: center; width: 20px; height: 20px;">
                            {providerIcon(prov.id, 20)}
                          </span>
                          <span style="font-weight: 500;">{prov.name}</span>
                        </span>
                      </td>
                      <td style="color: hsl(var(--muted-foreground));">
                        {getModelCount(prov.id) ?? '—'}
                      </td>
                      <td>
                        <span style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                          <Show when={activeCount() > 0}>
                            <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="8"
                                height="8"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
                              </svg>
                              {activeCount()} active{' '}
                              {activeCount() === 1 ? 'connection' : 'connections'}
                            </span>
                          </Show>
                          <button
                            class="btn btn--primary btn--sm"
                            style="white-space: nowrap;"
                            onClick={() => openConnect(prov.id)}
                          >
                            Add subscription
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* Grid view */}
      <Show when={viewMode() === 'grid'}>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;">
          <For each={SUBSCRIPTION_PROVIDERS}>
            {(prov) => {
              const cp = () => getConnected(prov.id);
              const activeCount = () => cp()?.connections.filter((c) => c.is_active).length ?? 0;
              return (
                <div
                  class="panel"
                  style="padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 0;"
                >
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="display: flex; align-items: center; width: 24px; height: 24px;">
                        {providerIcon(prov.id, 24)}
                      </span>
                      <span style="font-weight: 600; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
                        {prov.name}
                      </span>
                    </div>
                    <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                      {getModelCount(prov.id) ?? 0} models
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <Show when={activeCount() > 0} fallback={<span />}>
                      <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="8"
                          height="8"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
                        </svg>
                        {activeCount()} active {activeCount() === 1 ? 'connection' : 'connections'}
                      </span>
                    </Show>
                    <button
                      class="btn btn--primary btn--sm"
                      style="font-size: var(--font-size-xs); white-space: nowrap;"
                      onClick={() => openConnect(prov.id)}
                    >
                      Add subscription
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Connection modal — uses real RoutingProvider[] from agent endpoint */}
      <Show when={showModal() && firstAgentName()}>
        <ProviderSelectModal
          agentName={firstAgentName()}
          providers={modalProviders() ?? []}
          providerDeepLink={providerDeepLink()}
          onUpdate={() => {
            refetch();
            refetchModalProviders();
          }}
          onClose={handleModalClose}
        />
      </Show>
    </div>
  );
};

export default Subscriptions;
