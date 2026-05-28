import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import { fetchJson } from '../../services/api/core.js';
import { getAgents } from '../../services/api.js';
import { getProviderAnalytics, getProviderAnalyticsAgents } from '../../services/api/analytics.js';
import { getProviders as getAgentProviders } from '../../services/api/routing.js';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import { formatNumber, formatCost } from '../../services/formatters.js';
import ProviderSelectModal from '../../components/ProviderSelectModal.jsx';
import ProviderChartCard from '../../components/ProviderChartCard.jsx';
import Sparkline from '../../components/Sparkline.jsx';
import ActionMenu from '../../components/ActionMenu.jsx';
import Select from '../../components/Select.jsx';
import '../../styles/charts.css';

interface Connection {
  id: string;
  label: string;
  key_prefix: string | null;
  cached_model_count: number;
}
interface ConnectedProvider {
  provider: string;
  auth_type: string;
  connection_count: number;
  connections: Connection[];
  total_models: number;
  consumption_tokens: number;
  consumption_messages: number;
  consumption_cost: number;
  sparkline_7d?: number[];
}
interface ProvidersResponse {
  providers: ConnectedProvider[];
  model_counts: Record<string, number>;
}

const BYOK_PROVIDERS = PROVIDERS.filter((p) => !p.subscriptionOnly && !p.localOnly);

const Byok: Component = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = createSignal(false);
  const [deepLinkProvider, setDeepLinkProvider] = createSignal<string | null>(null);
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
  const connectedMap = () => {
    const map = new Map<string, ConnectedProvider>();
    for (const p of data()?.providers ?? []) {
      if (p.auth_type === 'api_key') map.set(p.provider, p);
    }
    return map;
  };
  const modelCounts = () => data()?.model_counts ?? {};
  const isConnected = (id: string) => connectedMap().has(id);
  const getConnected = (id: string) => connectedMap().get(id);
  const connectedProviders = () => BYOK_PROVIDERS.filter((p) => isConnected(p.id));
  const getModelCount = (provId: string) => {
    const cp = getConnected(provId);
    if (cp && cp.total_models > 0) return cp.total_models;
    return modelCounts()[provId.toLowerCase()] ?? modelCounts()[provId] ?? null;
  };

  // Flatten: one row per connection (not per provider)
  const connectedRows = () => {
    const rows: Array<{
      prov: (typeof BYOK_PROVIDERS)[0];
      conn: Connection;
      cp: ConnectedProvider;
    }> = [];
    for (const prov of connectedProviders()) {
      const cp = getConnected(prov.id)!;
      for (const conn of cp.connections) {
        rows.push({ prov, conn, cp });
      }
    }
    return rows;
  };

  const [modalProviders, { refetch: refetchModalProviders }] = createResource(
    () => firstAgentName(),
    async (name) => {
      if (!name) return [];
      try {
        return await getAgentProviders(name);
      } catch {
        return [];
      }
    },
  );
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
  const [chartRange, setChartRange] = createSignal('24h');
  const [chartView, setChartView] = createSignal<'messages' | 'tokens'>('tokens');
  const [chartAgent, setChartAgent] = createSignal('');

  const [chartAgents] = createResource(() =>
    getProviderAnalyticsAgents('api_key').catch(() => ({ agents: [] as string[] })),
  );

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
    () => ({ range: chartRange(), agent: chartAgent() }),
    (p) =>
      getProviderAnalytics('api_key', p.range, p.agent || undefined) as Promise<AnalyticsResponse>,
  );

  const messageChartData = createMemo(() => {
    const src = analytics()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  const agentOptions = () => {
    const list = chartAgents()?.agents ?? [];
    return [{ label: 'All agents', value: '' }, ...list.map((a) => ({ label: a, value: a }))];
  };

  const providerDeepLink = () => {
    const p = deepLinkProvider();
    return p ? { providerId: p, authType: 'api_key' as const, closeOnBack: true } : null;
  };

  return (
    <div class="container--lg">
      <Title>API Keys | Manifest</Title>
      <div class="page-header">
        <h1 class="page-header__title">Bring Your Own Key</h1>
        <p class="page-header__subtitle">
          Connect providers using your own API keys for pay-as-you-go usage.
        </p>
      </div>

      {/* Chart */}
      <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 16px;">
        <Select value={chartAgent()} onChange={setChartAgent} options={agentOptions()} />
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
        />
      </Show>

      {/* TABLE 1: Connected — one row per connection */}
      <Show when={connectedRows().length > 0}>
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
          Connected providers
        </h3>
        <div class="panel" style="padding: 0; margin-bottom: 24px;">
          <table class="data-table" style="table-layout: fixed;">
            <colgroup>
              <col style="width: 200px;" />
              <col style="width: 80px;" />
              <col style="width: 120px;" />
              <col style="width: 160px;" />
              <col style="width: 100px;" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Models</th>
                <th>Key name</th>
                <th>Usage (30d)</th>
                <th>Cost (30d)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={connectedRows()}>
                {(row) => {
                  const perKeyTokens = () =>
                    Math.round(row.cp.consumption_tokens / row.cp.connection_count);
                  const perKeyCost = () => row.cp.consumption_cost / row.cp.connection_count;
                  return (
                    <tr>
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
                          <span>{formatNumber(perKeyTokens())} tokens</span>
                          <Show when={row.cp.sparkline_7d?.length}>
                            <Sparkline data={row.cp.sparkline_7d!} width={80} height={24} />
                          </Show>
                        </div>
                      </td>
                      <td>{formatCost(perKeyCost()) ?? '$0.00'}</td>
                      <td>
                        <span style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                          <button
                            class="btn btn--outline btn--sm"
                            style="font-size: var(--font-size-xs);"
                            onClick={() => navigate(`/providers/connections/${row.conn.id}`)}
                          >
                            View details
                          </button>
                          <ActionMenu
                            items={[{ label: 'Manage', onClick: () => openConnect(row.prov.id) }]}
                          />
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

      {/* TABLE 2: All supported */}
      <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
        Supported providers
      </h3>
      <div class="panel" style="padding: 0;">
        <table class="data-table" style="table-layout: fixed;">
          <colgroup>
            <col style="width: 200px;" />
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
            <For each={BYOK_PROVIDERS}>
              {(prov) => {
                const has = () => isConnected(prov.id);
                const cp = () => getConnected(prov.id);
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
                        <Show when={has()}>
                          <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; white-space: nowrap;">
                            {cp()!.connection_count} {cp()!.connection_count === 1 ? 'key' : 'keys'}
                          </span>
                        </Show>
                        <Show
                          when={has()}
                          fallback={
                            <button
                              class="btn btn--primary btn--sm"
                              onClick={() => openConnect(prov.id)}
                            >
                              Connect
                            </button>
                          }
                        >
                          <button
                            class="btn btn--sm"
                            style="font-size: var(--font-size-xs); white-space: nowrap;"
                            onClick={() => openConnect(prov.id)}
                          >
                            Add key
                          </button>
                        </Show>
                      </span>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>

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

export default Byok;
