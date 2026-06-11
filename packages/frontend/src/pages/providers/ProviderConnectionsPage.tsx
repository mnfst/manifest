import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  getAgents,
  getCustomProviders,
  getProviders as getAgentProviders,
} from '../../services/api.js';
import { getOverview } from '../../services/api/analytics.js';
import {
  getProviders as getGlobalProviders,
  type UserProviderSummary,
} from '../../services/api/providers.js';
import type { AuthType, CustomProviderData, RoutingProvider } from '../../services/api.js';
import type { CustomProviderPrefill, ProviderDeepLink } from '../../services/routing-params.js';
import { PROVIDERS, type ProviderDef } from '../../services/providers.js';
import {
  customProviderColor,
  formatCost,
  formatNumber,
  formatTimeAgo,
} from '../../services/formatters.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import InfoTooltip from '../../components/InfoTooltip.jsx';
import ProviderSelectModal from '../../components/ProviderSelectModal.jsx';
import Sparkline from '../../components/Sparkline.jsx';
import '../../styles/routing.css';

type ProviderPageKind = 'subscriptions' | 'byok' | 'local';
type ViewMode = 'list' | 'grid';

interface ProviderConnectionsPageProps {
  kind: ProviderPageKind;
}

interface AgentRow {
  agent_name: string;
}

interface OverviewData {
  cost_by_model?: Array<{
    estimated_cost?: number;
    auth_type?: string | null;
  }>;
}

const PAGE_COPY: Record<
  ProviderPageKind,
  {
    title: string;
    heading: string;
    subtitle: string;
    addLabel: string;
    customAddLabel?: string;
    connectedHeading: string;
    supportedHeading: string;
    authType: AuthType;
    metricLabel: string;
    metricTooltip: string;
    rowMetricHeading: string;
    activeSingular: string;
    activePlural: string;
  }
> = {
  subscriptions: {
    title: 'Subscriptions | Manifest',
    heading: 'Subscriptions',
    subtitle: 'Connect flat-rate subscriptions to route through your existing plans.',
    addLabel: 'Add subscription',
    connectedHeading: 'My Subscriptions',
    supportedHeading: 'Supported subscriptions',
    authType: 'subscription',
    metricLabel: 'Estimated savings (30d)',
    metricTooltip: 'Equivalent API cost you saved by using subscriptions instead of pay-per-use.',
    rowMetricHeading: 'Savings (30d)',
    activeSingular: 'connection',
    activePlural: 'connections',
  },
  byok: {
    title: 'BYOK | Manifest',
    heading: 'BYOK',
    subtitle: 'Connect provider API keys managed at the workspace level.',
    addLabel: 'Add API key',
    customAddLabel: 'Add custom provider',
    connectedHeading: 'My API Keys',
    supportedHeading: 'Supported API key providers',
    authType: 'api_key',
    metricLabel: 'Total API cost (30d)',
    metricTooltip: 'Sum of all API key usage costs across your connected providers.',
    rowMetricHeading: 'Cost (30d)',
    activeSingular: 'key',
    activePlural: 'keys',
  },
  local: {
    title: 'Local Providers | Manifest',
    heading: 'Local Providers',
    subtitle: 'Connect to LLM servers running on your machine.',
    addLabel: 'Add local provider',
    connectedHeading: 'My Local Providers',
    supportedHeading: 'Supported local providers',
    authType: 'local',
    metricLabel: 'Estimated savings (30d)',
    metricTooltip:
      'Equivalent API cost you saved by running models locally instead of using paid API keys.',
    rowMetricHeading: 'Savings (30d)',
    activeSingular: 'connection',
    activePlural: 'connections',
  },
};

const providerListForKind = (kind: ProviderPageKind): ProviderDef[] => {
  if (kind === 'subscriptions')
    return PROVIDERS.filter((provider) => provider.supportsSubscription);
  if (kind === 'local') return PROVIDERS.filter((provider) => provider.localOnly);
  return PROVIDERS.filter((provider) => !provider.subscriptionOnly && !provider.localOnly);
};

const standardProviderName = (providerId: string): string | null =>
  PROVIDERS.find((provider) => provider.id === providerId)?.name ?? null;

const customProviderName = (
  providerId: string,
  customProviders: readonly CustomProviderData[],
): string | null => {
  if (!providerId.startsWith('custom:')) return null;
  const id = providerId.slice('custom:'.length);
  return customProviders.find((provider) => provider.id === id)?.name ?? null;
};

const providerDisplayName = (
  providerId: string,
  customProviders: readonly CustomProviderData[],
): string =>
  customProviderName(providerId, customProviders) ?? standardProviderName(providerId) ?? providerId;

const StatusBadge: Component<{ active: boolean }> = (props) => (
  <Show
    when={props.active}
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
);

const ProviderMark: Component<{ providerId: string; name: string; size?: number }> = (props) => {
  const size = () => props.size ?? 20;
  return (
    <Show
      when={providerIcon(props.providerId, size())}
      fallback={
        <span
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            width: `${size()}px`,
            height: `${size()}px`,
            'border-radius': '4px',
            'font-size': size() > 20 ? '12px' : '11px',
            'font-weight': '600',
            color: 'white',
            background: customProviderColor(props.name || props.providerId),
          }}
        >
          {(props.name || props.providerId).charAt(0).toUpperCase()}
        </span>
      }
    >
      <span style={`display: flex; align-items: center; width: ${size()}px; height: ${size()}px;`}>
        {providerIcon(props.providerId, size())}
      </span>
    </Show>
  );
};

const ListIcon: Component = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z" />
  </svg>
);

const GridIcon: Component = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
  </svg>
);

const CustomProviderIcon: Component = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M7 11h10c.37 0 .72-.21.89-.54s.14-.73-.08-1.04l-5-7c-.38-.53-1.25-.53-1.63 0l-5 7A.997.997 0 0 0 6.99 11Zm5-6.28L15.06 9H8.95l3.06-4.28ZM17.5 13c-2.48 0-4.5 2.02-4.5 4.5s2.02 4.5 4.5 4.5 4.5-2.02 4.5-4.5-2.02-4.5-4.5-4.5m0 7a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5M3 22h7c.55 0 1-.45 1-1v-7c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v7c0 .55.45 1 1 1m1-7h5v5H4z" />
  </svg>
);

const ProviderConnectionsPage: Component<ProviderConnectionsPageProps> = (props) => {
  const copy = () => PAGE_COPY[props.kind];
  const navigate = useNavigate();
  const [showModal, setShowModal] = createSignal(false);
  const [deepLink, setDeepLink] = createSignal<ProviderDeepLink | null>(null);
  const [customProviderPrefill, setCustomProviderPrefill] =
    createSignal<CustomProviderPrefill | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>('list');
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, { refetch: refetchGlobalProviders }] = createResource(async () => {
    try {
      return await getGlobalProviders();
    } catch {
      return { providers: [], model_counts: {} };
    }
  });

  const [overview] = createResource(async (): Promise<OverviewData> => {
    try {
      return (await getOverview('30d')) as OverviewData;
    } catch {
      return { cost_by_model: [] };
    }
  });

  const [agents] = createResource(async () => {
    try {
      const result = (await getAgents()) as { agents?: AgentRow[] } | AgentRow[];
      return Array.isArray(result) ? result : (result.agents ?? []);
    } catch {
      return [];
    }
  });

  const firstAgentName = () => agents()?.[0]?.agent_name ?? '';

  const [modalProviders, { refetch: refetchModalProviders }] = createResource(
    () => firstAgentName(),
    async (agentName): Promise<RoutingProvider[]> => {
      if (!agentName) return [];
      try {
        return await getAgentProviders(agentName);
      } catch {
        return [];
      }
    },
  );

  const [customProviders, { refetch: refetchCustomProviders }] = createResource(
    () => firstAgentName(),
    async (agentName): Promise<CustomProviderData[]> => {
      if (!agentName) return [];
      try {
        return await getCustomProviders(agentName);
      } catch {
        return [];
      }
    },
  );

  if (searchParams.add === 'true') {
    queueMicrotask(() => {
      setSearchParams({ add: undefined });
      openModal();
    });
  }

  const connectedSummaries = () =>
    (data()?.providers ?? []).filter((provider) => provider.auth_type === copy().authType);

  const hasUsage = (summary: UserProviderSummary) =>
    summary.consumption_tokens > 0 || summary.consumption_messages > 0;

  const connectedRows = () => {
    const rows: Array<{
      summary: UserProviderSummary;
      connection: UserProviderSummary['connections'][number];
      name: string;
    }> = [];
    for (const summary of connectedSummaries()) {
      for (const connection of summary.connections) {
        if (!connection.is_active && !hasUsage(summary)) continue;
        rows.push({
          summary,
          connection,
          name: providerDisplayName(summary.provider, customProviders() ?? []),
        });
      }
    }
    return rows;
  };

  const connectedByProvider = () => {
    const map = new Map<string, UserProviderSummary>();
    for (const summary of connectedSummaries()) map.set(summary.provider, summary);
    return map;
  };

  const modelCount = (providerId: string) => {
    const summary = connectedByProvider().get(providerId);
    if (summary && summary.total_models > 0) return summary.total_models;
    const counts = data()?.model_counts ?? {};
    return counts[providerId.toLowerCase()] ?? counts[providerId] ?? null;
  };

  const activeConnectionCount = (providerId: string) =>
    connectedByProvider()
      .get(providerId)
      ?.connections.filter((connection) => connection.is_active).length ?? 0;

  const totalEstimatedSavings = createMemo(() => {
    if (copy().authType === 'api_key') return 0;
    return (overview()?.cost_by_model ?? [])
      .filter((row) => row.auth_type === copy().authType)
      .reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0);
  });

  const totalApiCost = createMemo(() =>
    connectedSummaries().reduce((sum, summary) => sum + summary.consumption_cost, 0),
  );

  const pageMetricTotal = () =>
    copy().authType === 'api_key' ? totalApiCost() : totalEstimatedSavings();

  const totalKindTokens = () =>
    connectedSummaries().reduce((sum, summary) => sum + summary.consumption_tokens, 0);

  const connectionDenominator = (summary: UserProviderSummary) =>
    Math.max(
      summary.connections.filter((connection) => connection.is_active || hasUsage(summary)).length,
      summary.connection_count,
      1,
    );

  const perConnectionTokens = (summary: UserProviderSummary) =>
    Math.round(summary.consumption_tokens / connectionDenominator(summary));

  const perConnectionMetric = (summary: UserProviderSummary) => {
    if (copy().authType === 'api_key') {
      return summary.consumption_cost / connectionDenominator(summary);
    }
    const tokens = totalKindTokens();
    if (tokens <= 0) return 0;
    return (
      ((summary.consumption_tokens / tokens) * totalEstimatedSavings()) /
      connectionDenominator(summary)
    );
  };

  const connectionLastUsedAt = (summary: UserProviderSummary) =>
    summary.connections.length === 1 ? summary.last_used_at : null;

  const showMetricCard = () =>
    props.kind === 'subscriptions' || connectedRows().length > 0 || pageMetricTotal() > 0;

  const activeLabel = (count: number) => {
    if (props.kind === 'local') return 'Connected';
    return `${count} active ${count === 1 ? copy().activeSingular : copy().activePlural}`;
  };

  const openModal = (providerId?: string) => {
    setCustomProviderPrefill(null);
    // Deep-link with the page's auth type so the connection form opens in the
    // matching mode (e.g. the Subscriptions page opens the OAuth/subscription
    // flow rather than the API-key form for providers that support both).
    setDeepLink(providerId ? { providerId, authType: copy().authType } : null);
    void refetchModalProviders();
    setShowModal(true);
  };

  const openCustomProvider = () => {
    setDeepLink(null);
    setCustomProviderPrefill({ name: '', baseUrl: '' });
    void refetchModalProviders();
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setDeepLink(null);
    setCustomProviderPrefill(null);
    void refetchGlobalProviders();
  };

  const handleModalUpdate = async () => {
    await Promise.all([
      refetchModalProviders(),
      refetchGlobalProviders(),
      refetchCustomProviders(),
    ]);
  };

  return (
    <div class="container--lg">
      <Title>{copy().title}</Title>
      <div class="page-header" style="border-bottom: none; padding-bottom: 0;">
        <div>
          <h1 class="page-header__title">{copy().heading}</h1>
          <p class="page-header__subtitle">{copy().subtitle}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <Show when={copy().customAddLabel}>
            <button
              class="btn btn--outline btn--sm"
              disabled={!firstAgentName()}
              onClick={openCustomProvider}
              style="display: inline-flex; align-items: center; gap: 6px;"
            >
              <CustomProviderIcon />
              {copy().customAddLabel}
            </button>
          </Show>
          <button
            class="btn btn--primary btn--sm"
            disabled={!firstAgentName()}
            onClick={() => openModal()}
          >
            {copy().addLabel}
          </button>
        </div>
      </div>

      <Show when={showMetricCard()}>
        <div class="chart-card" style="margin-bottom: 24px; padding: 20px 24px;">
          <span class="chart-card__label" style="display: flex; align-items: center; gap: 0;">
            {copy().metricLabel}
            <InfoTooltip text={copy().metricTooltip} />
          </span>
          <div class="chart-card__value-row" style="margin-top: 4px;">
            <span class="chart-card__value">{formatCost(pageMetricTotal()) ?? '$0.00'}</span>
          </div>
        </div>
      </Show>

      <Show when={connectedRows().length > 0}>
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
          {copy().connectedHeading}
        </h3>
        <div class="panel" style="padding: 0; margin-bottom: 24px; overflow-x: auto;">
          <table class="data-table" style="min-width: 860px;">
            <colgroup>
              <col style="width: 214px;" />
              <col style="width: 120px;" />
              <col style="width: 70px;" />
              <col />
              <col style="width: 110px;" />
              <col style="width: 90px;" />
              <col style="width: 90px;" />
              <col style="width: 110px;" />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Connection</th>
                <th>Models</th>
                <th>Usage (30d)</th>
                <th>{copy().rowMetricHeading}</th>
                <th>Status</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={connectedRows()}>
                {(row) => (
                  <tr
                    style="cursor: pointer;"
                    onClick={() => navigate(`/providers/connections/${row.connection.id}`)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/providers/connections/${row.connection.id}`);
                      }
                    }}
                    tabindex="0"
                  >
                    <td>
                      <span style="display: flex; align-items: center; gap: 10px;">
                        <ProviderMark providerId={row.summary.provider} name={row.name} />
                        <span style="font-weight: 500;">{row.name}</span>
                        <Show when={row.summary.provider.startsWith('custom:')}>
                          <span style="display: inline-flex; padding: 1px 6px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border)); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                            Custom
                          </span>
                        </Show>
                      </span>
                    </td>
                    <td style="color: hsl(var(--muted-foreground));">{row.connection.label}</td>
                    <td>{row.connection.cached_model_count || row.summary.total_models || '-'}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <Show when={row.summary.sparkline_7d?.length}>
                          <span style="flex-shrink: 0;">
                            <Sparkline data={row.summary.sparkline_7d} width={60} height={20} />
                          </span>
                        </Show>
                        <span>{formatNumber(perConnectionTokens(row.summary))} tokens</span>
                      </div>
                    </td>
                    <td>{formatCost(perConnectionMetric(row.summary)) ?? '$0.00'}</td>
                    <td>
                      <StatusBadge active={row.connection.is_active} />
                    </td>
                    <td style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                      {connectionLastUsedAt(row.summary)
                        ? formatTimeAgo(connectionLastUsedAt(row.summary)!)
                        : '-'}
                    </td>
                    <td style="text-align: right;">
                      <button
                        class="btn btn--outline btn--sm"
                        style="font-size: var(--font-size-xs); white-space: nowrap;"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/providers/connections/${row.connection.id}`);
                        }}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin: 0;">
          {copy().supportedHeading}
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
            <ListIcon />
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
            <GridIcon />
          </button>
        </div>
      </div>

      <Show when={viewMode() === 'list'}>
        <div class="panel" style="padding: 0; overflow-x: auto;">
          <table class="data-table" style="min-width: 520px;">
            <colgroup>
              <col style="width: 240px;" />
              <col style="width: 100px;" />
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
              <For each={providerListForKind(props.kind)}>
                {(provider) => {
                  const activeCount = () => activeConnectionCount(provider.id);
                  return (
                    <tr>
                      <td>
                        <span style="display: flex; align-items: center; gap: 10px;">
                          <ProviderMark providerId={provider.id} name={provider.name} />
                          <span style="font-weight: 500;">{provider.name}</span>
                        </span>
                      </td>
                      <td style="color: hsl(var(--muted-foreground));">
                        {modelCount(provider.id) ?? '-'}
                      </td>
                      <td style="text-align: right;">
                        <span style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px;">
                          <Show when={activeCount() > 0}>
                            <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                              <svg
                                width="8"
                                height="8"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
                              </svg>
                              {activeLabel(activeCount())}
                            </span>
                          </Show>
                          <button
                            class="btn btn--outline btn--sm"
                            disabled={!firstAgentName()}
                            style="white-space: nowrap;"
                            onClick={() => openModal(provider.id)}
                          >
                            {copy().addLabel}
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

      <Show when={viewMode() === 'grid'}>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          <For each={providerListForKind(props.kind)}>
            {(provider) => {
              const activeCount = () => activeConnectionCount(provider.id);
              return (
                <div
                  class="panel"
                  style="padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 0;"
                >
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                      <ProviderMark providerId={provider.id} name={provider.name} size={24} />
                      <span style="font-weight: 600; font-size: var(--font-size-sm); color: hsl(var(--foreground)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        {provider.name}
                      </span>
                    </div>
                    <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); white-space: nowrap;">
                      {modelCount(provider.id) ?? 0} models
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <Show when={activeCount() > 0} fallback={<span />}>
                      <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                        <svg
                          width="8"
                          height="8"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
                        </svg>
                        {activeLabel(activeCount())}
                      </span>
                    </Show>
                    <button
                      class="btn btn--outline btn--sm"
                      disabled={!firstAgentName()}
                      style="font-size: var(--font-size-xs); white-space: nowrap;"
                      onClick={() => openModal(provider.id)}
                    >
                      {copy().addLabel}
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={showModal() && firstAgentName()}>
        <ProviderSelectModal
          agentName={firstAgentName()}
          providers={modalProviders() ?? []}
          customProviders={customProviders() ?? []}
          customProviderPrefill={customProviderPrefill()}
          providerDeepLink={deepLink()}
          initialTab={copy().authType}
          onUpdate={handleModalUpdate}
          onClose={handleModalClose}
        />
      </Show>
    </div>
  );
};

export default ProviderConnectionsPage;
