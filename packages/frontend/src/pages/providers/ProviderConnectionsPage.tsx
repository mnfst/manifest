import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  getAgents,
  getCustomProviders,
  getProviders as getAgentProviders,
} from '../../services/api.js';
import {
  getProviders as getGlobalProviders,
  type UserProviderSummary,
} from '../../services/api/providers.js';
import type { AuthType, CustomProviderData, RoutingProvider } from '../../services/api.js';
import type { ProviderDeepLink } from '../../services/routing-params.js';
import { PROVIDERS, type ProviderDef } from '../../services/providers.js';
import { customProviderColor, formatNumber, formatTimeAgo } from '../../services/formatters.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import ProviderSelectModal from '../../components/ProviderSelectModal.jsx';
import '../../styles/routing.css';

type ProviderPageKind = 'subscriptions' | 'byok' | 'local';

interface ProviderConnectionsPageProps {
  kind: ProviderPageKind;
}

interface AgentRow {
  agent_name: string;
}

const PAGE_COPY: Record<
  ProviderPageKind,
  {
    title: string;
    heading: string;
    subtitle: string;
    addLabel: string;
    connectedHeading: string;
    supportedHeading: string;
    authType: AuthType;
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
  },
  byok: {
    title: 'BYOK | Manifest',
    heading: 'BYOK',
    subtitle: 'Connect provider API keys managed at the workspace level.',
    addLabel: 'Add API key',
    connectedHeading: 'My API Keys',
    supportedHeading: 'Supported API key providers',
    authType: 'api_key',
  },
  local: {
    title: 'Local Providers | Manifest',
    heading: 'Local Providers',
    subtitle: 'Connect to LLM servers running on your machine.',
    addLabel: 'Add local provider',
    connectedHeading: 'My Local Providers',
    supportedHeading: 'Supported local providers',
    authType: 'local',
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

const ProviderMark: Component<{ providerId: string; name: string }> = (props) => (
  <Show
    when={providerIcon(props.providerId, 20)}
    fallback={
      <span
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          width: '20px',
          height: '20px',
          'border-radius': '4px',
          'font-size': '11px',
          'font-weight': '600',
          color: 'white',
          background: customProviderColor(props.name),
        }}
      >
        {props.name.charAt(0).toUpperCase()}
      </span>
    }
  >
    <span style="display: flex; align-items: center; width: 20px; height: 20px;">
      {providerIcon(props.providerId, 20)}
    </span>
  </Show>
);

const ProviderConnectionsPage: Component<ProviderConnectionsPageProps> = (props) => {
  const copy = () => PAGE_COPY[props.kind];
  const [showModal, setShowModal] = createSignal(false);
  const [deepLink, setDeepLink] = createSignal<ProviderDeepLink | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, { refetch: refetchGlobalProviders }] = createResource(async () => {
    try {
      return await getGlobalProviders();
    } catch {
      return { providers: [], model_counts: {} };
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
      setShowModal(true);
    });
  }

  const connectedSummaries = () =>
    (data()?.providers ?? []).filter((provider) => provider.auth_type === copy().authType);

  const connectedRows = () => {
    const rows: Array<{
      summary: UserProviderSummary;
      connection: UserProviderSummary['connections'][number];
      name: string;
    }> = [];
    for (const summary of connectedSummaries()) {
      const hasUsage = summary.consumption_tokens > 0 || summary.consumption_messages > 0;
      for (const connection of summary.connections) {
        if (!connection.is_active && !hasUsage) continue;
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

  const openModal = (providerId?: string) => {
    // Deep-link with the page's auth type so the connection form opens in the
    // matching mode (e.g. the Subscriptions page opens the OAuth/subscription
    // flow rather than the API-key form for providers that support both).
    setDeepLink(providerId ? { providerId, authType: copy().authType } : null);
    void refetchModalProviders();
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setDeepLink(null);
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
        <button
          class="btn btn--primary btn--sm"
          disabled={!firstAgentName()}
          onClick={() => openModal()}
        >
          {copy().addLabel}
        </button>
      </div>

      <Show when={connectedRows().length > 0}>
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
          {copy().connectedHeading}
        </h3>
        <div class="panel" style="padding: 0; margin-bottom: 24px; overflow-x: auto;">
          <table class="data-table" style="min-width: 640px;">
            <colgroup>
              <col style="width: 220px;" />
              <col style="width: 120px;" />
              <col style="width: 90px;" />
              <col />
              <col style="width: 100px;" />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Connection</th>
                <th>Models</th>
                <th>Usage (30d)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <For each={connectedRows()}>
                {(row) => (
                  <tr>
                    <td>
                      <span style="display: flex; align-items: center; gap: 10px;">
                        <ProviderMark providerId={row.summary.provider} name={row.name} />
                        <span style="font-weight: 500;">{row.name}</span>
                      </span>
                    </td>
                    <td style="color: hsl(var(--muted-foreground));">{row.connection.label}</td>
                    <td>{row.connection.cached_model_count || row.summary.total_models || '-'}</td>
                    <td>{formatNumber(row.summary.consumption_tokens)} tokens</td>
                    <td>
                      <Show
                        when={row.connection.is_active}
                        fallback={
                          <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); font-weight: 500;">
                            Inactive
                          </span>
                        }
                      >
                        <span
                          title={
                            row.summary.last_used_at
                              ? `Last used ${formatTimeAgo(row.summary.last_used_at)}`
                              : undefined
                          }
                          style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-xs); font-weight: 600;"
                        >
                          Active
                        </span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
        {copy().supportedHeading}
      </h3>
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
                      <Show when={activeCount() > 0}>
                        <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; margin-right: 8px;">
                          {activeCount()} active
                        </span>
                      </Show>
                      <button
                        class="btn btn--outline btn--sm"
                        disabled={!firstAgentName()}
                        onClick={() => openModal(provider.id)}
                      >
                        {copy().addLabel}
                      </button>
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
          customProviders={customProviders() ?? []}
          providerDeepLink={deepLink()}
          onUpdate={handleModalUpdate}
          onClose={handleModalClose}
        />
      </Show>
    </div>
  );
};

export default ProviderConnectionsPage;
